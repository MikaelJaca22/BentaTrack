import { z } from 'zod';
import db from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';
import { nextReceiptNo } from '../utils/receipt.js';
import { raiseLowStockAlerts } from '../utils/stockAlerts.js';
import { parseDate, parsePagination } from '../utils/query.js';
import { toMinor, toMajor } from '../utils/money.js';

export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z
          .number()
          .int()
          .min(1, 'Quantity must be at least 1')
          .max(1_000_000, 'Quantity is unreasonably large'),
      })
    )
    .min(1, 'Cart is empty'),
  amountTendered: z
    .number()
    .finite('Amount tendered must be a finite number')
    .min(0, 'Amount tendered cannot be negative')
    .max(1_000_000_000, 'Amount tendered is unreasonably large'),
});

// All money below is in INTEGER minor units, so sums are exact. The API
// converts to major units at the boundary via toMajor().

function getLowStockProducts(ownerId, productIds) {
  if (!productIds.length) return [];
  const placeholders = productIds.map(() => '?').join(',');
  return db
    .prepare(
      `SELECT * FROM products
       WHERE owner_id = ? AND reorder_level > 0 AND stock_qty <= reorder_level
         AND id IN (${placeholders})`
    )
    .all(ownerId, ...productIds);
}

// Build a full sale/receipt object for a single sale row.
function buildReceipt(saleId, ownerId) {
  const sale = db
    .prepare('SELECT * FROM sales WHERE id = ? AND owner_id = ?')
    .get(saleId, ownerId);
  if (!sale) throw new ApiError(404, 'Sale not found');
  const items = db
    .prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC')
    .all(saleId);
  const owner = db.prepare('SELECT id, name FROM users WHERE id = ?').get(ownerId);
  const low = getLowStockProducts(ownerId, items.map((i) => i.product_id));
  return {
    sale: {
      id: sale.id,
      receiptNo: sale.receipt_no,
      total: toMajor(sale.total),
      amountTendered: toMajor(sale.amount_tendered),
      changeDue: toMajor(sale.change_due),
      paymentMethod: sale.payment_method,
      createdAt: sale.created_at,
    },
    store: { name: owner.name },
    items: items.map((it) => ({
      id: it.id,
      productId: it.product_id,
      name: it.product_name_snapshot,
      unitPrice: toMajor(it.unit_price_snapshot),
      quantity: it.quantity,
      lineTotal: toMajor(it.line_total),
    })),
    lowStock: low.map((p) => ({
      id: p.id,
      name: p.name,
      stockQty: p.stock_qty,
      reorderLevel: p.reorder_level,
    })),
  };
}

// Transactional sale creation (flow 8.2 step 5).
export function create(req, res, next) {
  const ownerId = req.user.id;
  const { items, amountTendered } = req.body;

  try {
    const result = db.transaction(() => {
      // De-duplicate product ids and sum quantities per product.
      const qtyByProduct = new Map();
      for (const it of items) {
        qtyByProduct.set(
          it.productId,
          (qtyByProduct.get(it.productId) || 0) + it.quantity
        );
      }

      // Recompute totals from DB prices; never trust client totals.
      // p.price is already in minor units, so price * quantity is exact integer
      // arithmetic and the line sums can never drift.
      let total = 0;
      const lines = [];
      for (const [productId, quantity] of qtyByProduct.entries()) {
        const p = db
          .prepare('SELECT * FROM products WHERE id = ? AND owner_id = ?')
          .get(productId, ownerId);
        if (!p) throw new ApiError(400, 'One or more products are not available');
        if (!p.is_active) {
          throw new ApiError(400, `"${p.name}" is inactive and cannot be sold`);
        }
        if (p.stock_qty < quantity) {
          throw new ApiError(
            400,
            `Insufficient stock for "${p.name}" (available ${p.stock_qty}, requested ${quantity})`,
            'items'
          );
        }
        const lineTotal = p.price * quantity;
        total += lineTotal;
        lines.push({ product: p, quantity, lineTotal });
      }

      const tendered = toMinor(amountTendered);
      if (tendered < total) {
        throw new ApiError(
          400,
          'Amount tendered is less than the total',
          'amountTendered'
        );
      }
      const changeDue = tendered - total;

      const receiptNo = nextReceiptNo(ownerId);
      const saleInfo = db
        .prepare(
          `INSERT INTO sales (owner_id, receipt_no, total, amount_tendered, change_due)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(ownerId, receiptNo, total, tendered, changeDue);
      const saleId = saleInfo.lastInsertRowid;

      const insertItem = db.prepare(
        `INSERT INTO sale_items
          (sale_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const deductStock = db.prepare(
        `UPDATE products SET stock_qty = stock_qty - ?, updated_at = datetime('now') WHERE id = ?`
      );

      for (const line of lines) {
        insertItem.run(
          saleId,
          line.product.id,
          line.product.name,
          line.product.price,
          line.quantity,
          line.lineTotal
        );
        deductStock.run(line.quantity, line.product.id);
      }

      return { saleId, receiptNo };
    })();

    // After commit: build receipt (includes fresh low-stock info) and notify.
    // The transaction has already committed at this point. If anything below
    // throws, the client would see a 500 for a sale that was actually saved and
    // would likely retry it, deducting stock twice. So the receipt is built
    // first (it can only fail on a genuinely missing sale), and notification
    // failures are logged and swallowed rather than turned into an error.
    const receipt = buildReceipt(result.saleId, ownerId);
    // Real-time, system-wide: re-evaluate every product in the store, not just
    // the ones on this receipt, so any item that is now at/below its reorder
    // level gets an alert immediately.
    try {
      raiseLowStockAlerts(ownerId);
    } catch (notifyErr) {
      // eslint-disable-next-line no-console
      console.error('Low-stock notification failed after sale commit:', notifyErr);
    }
    res.status(201).json(receipt);
  } catch (e) {
    next(e);
  }
}

export function list(req, res, next) {
  try {
    const q = req.query;
    const from = parseDate(q.from);
    const to = parseDate(q.to);
    const { limit, offset } = parsePagination(q);
    let where = 'owner_id = ?';
    const params = [req.user.id];
    if (from) {
      where += ' AND date(created_at) >= date(?)';
      params.push(from);
    }
    if (to) {
      where += ' AND date(created_at) <= date(?)';
      params.push(to);
    }
    // Count first so the client knows whether more pages exist.
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM sales WHERE ${where}`).get(...params);
    // Deterministic ordering: created_at alone is not unique, so id breaks ties
    // and keeps OFFSET pagination from skipping or repeating a row.
    const rows = db
      .prepare(
        `SELECT * FROM sales WHERE ${where}
         ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);
    res.json({
      sales: rows.map((s) => ({
        id: s.id,
        receiptNo: s.receipt_no,
        total: toMajor(s.total),
        amountTendered: toMajor(s.amount_tendered),
        changeDue: toMajor(s.change_due),
        paymentMethod: s.payment_method,
        createdAt: s.created_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + rows.length < total,
      },
    });
  } catch (e) {
    next(e);
  }
}

export function getById(req, res, next) {
  try {
    res.json(buildReceipt(req.params.id, req.user.id));
  } catch (e) {
    next(e);
  }
}
