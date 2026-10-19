import { z } from 'zod';
import db from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';
import { nextReceiptNo } from '../utils/receipt.js';
import { notify } from '../utils/notify.js';

export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      })
    )
    .min(1, 'Cart is empty'),
  amountTendered: z.number().min(0, 'Amount tendered cannot be negative'),
});

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

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
      total: roundMoney(sale.total),
      amountTendered: roundMoney(sale.amount_tendered),
      changeDue: roundMoney(sale.change_due),
      paymentMethod: sale.payment_method,
      createdAt: sale.created_at,
    },
    store: { name: owner.name },
    items: items.map((it) => ({
      id: it.id,
      productId: it.product_id,
      name: it.product_name_snapshot,
      unitPrice: roundMoney(it.unit_price_snapshot),
      quantity: it.quantity,
      lineTotal: roundMoney(it.line_total),
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
        const lineTotal = roundMoney(p.price * quantity);
        total += lineTotal;
        lines.push({ product: p, quantity, lineTotal });
      }
      total = roundMoney(total);

      if (amountTendered < total) {
        throw new ApiError(
          400,
          'Amount tendered is less than the total',
          'amountTendered'
        );
      }
      const changeDue = roundMoney(amountTendered - total);

      const receiptNo = nextReceiptNo(ownerId);
      const saleInfo = db
        .prepare(
          `INSERT INTO sales (owner_id, receipt_no, total, amount_tendered, change_due)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(ownerId, receiptNo, total, amountTendered, changeDue);
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
    const receipt = buildReceipt(result.saleId, ownerId);
    for (const p of receipt.lowStock) {
      notify({
        userId: ownerId,
        type: 'low_stock',
        title: 'Low stock alert',
        body: `"${p.name}" is low (${p.stockQty} left, reorder at ${p.reorderLevel}).`,
        referenceType: 'product',
        referenceId: p.id,
      });
    }
    res.status(201).json(receipt);
  } catch (e) {
    next(e);
  }
}

export function list(req, res, next) {
  try {
    const from = (req.query.from || '').toString();
    const to = (req.query.to || '').toString();
    let sql = 'SELECT * FROM sales WHERE owner_id = ?';
    const params = [req.user.id];
    if (from) {
      sql += ' AND date(created_at) >= date(?)';
      params.push(from);
    }
    if (to) {
      sql += ' AND date(created_at) <= date(?)';
      params.push(to);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json({
      sales: rows.map((s) => ({
        id: s.id,
        receiptNo: s.receipt_no,
        total: roundMoney(s.total),
        amountTendered: roundMoney(s.amount_tendered),
        changeDue: roundMoney(s.change_due),
        paymentMethod: s.payment_method,
        createdAt: s.created_at,
      })),
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
