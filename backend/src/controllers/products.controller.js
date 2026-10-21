import { z } from 'zod';
import db from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';
import { parseBool, likePattern, LIKE_ESCAPE } from '../utils/query.js';
import { toMinor, toMajor } from '../utils/money.js';
import { raiseLowStockAlerts } from '../utils/stockAlerts.js';

export const createProductSchema = z.object({
  productCode: z.string().trim().max(60).optional().nullable().or(z.literal('')),
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.string().trim().max(60).optional().nullable().or(z.literal('')),
  unit: z.string().trim().max(20).default('pc'),
  price: z.number().min(0, 'Price cannot be negative').max(1_000_000_000),
  cost: z.number().min(0, 'Cost cannot be negative').default(0),
  stockQty: z.number().int().min(0, 'Stock cannot be negative').default(0),
  reorderLevel: z.number().int().min(0).default(0),
});

export const updateProductSchema = createProductSchema.partial();

export const stockAdjustSchema = z.object({
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    // Adjustment amount (can be negative to reduce stock).
    .refine((v) => v !== 0, 'Adjustment cannot be zero'),
  reason: z.string().trim().min(1, 'Reason is required').max(200),
});

function mapProduct(row) {
  return {
    id: row.id,
    productCode: row.product_code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    price: toMajor(row.price),
    cost: toMajor(row.cost),
    stockQty: row.stock_qty,
    reorderLevel: row.reorder_level,
    isActive: !!row.is_active,
    isLow: row.reorder_level > 0 && row.stock_qty <= row.reorder_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Scoped list for the owner. Supports ?search= (name or code) and ?lowStock=true.
export function list(req, res, next) {
  try {
    // Real-time, system-wide sweep so any product currently at or below its
    // reorder level has an alert before the catalogue is returned.
    if (req.user && req.user.role === 'store_owner') {
      try {
        raiseLowStockAlerts(req.user.id);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Low-stock sweep failed while listing products:', e);
      }
    }
    const search = (req.query.search ?? '').toString().trim();
    const lowStock = parseBool(req.query.lowStock);
    let sql = 'SELECT * FROM products WHERE owner_id = ?';
    const params = [req.user.id];
    if (search) {
      // Wildcards in user input are escaped, so searching for "%" matches a
      // literal percent sign instead of every product in the store.
      const pattern = likePattern(search);
      sql += ` AND (name LIKE ? ${LIKE_ESCAPE} OR product_code LIKE ? ${LIKE_ESCAPE})`;
      params.push(pattern, pattern);
    }
    if (lowStock) {
      sql += ' AND reorder_level > 0 AND stock_qty <= reorder_level';
    }
    // Include inactive products so the owner can reactivate them.
    sql += ' ORDER BY name COLLATE NOCASE ASC';
    const rows = db.prepare(sql).all(...params);
    res.json({ products: rows.map(mapProduct) });
  } catch (e) {
    next(e);
  }
}

export function create(req, res, next) {
  try {
    const b = req.body;
    const code = b.productCode ? b.productCode : null;
    const info = db
      .prepare(
        `INSERT INTO products
          (owner_id, product_code, name, category, unit, price, cost, stock_qty, reorder_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.user.id,
        code,
        b.name,
        b.category || null,
        b.unit || 'pc',
        toMinor(b.price),
        toMinor(b.cost ?? 0),
        b.stockQty ?? 0,
        b.reorderLevel ?? 0
      );
    const row = db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(info.lastInsertRowid);
    try {
      raiseLowStockAlerts(req.user.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Low-stock alert failed after product create:', e);
    }
    res.status(201).json({ product: mapProduct(row) });
  } catch (e) {
    next(e);
  }
}

function findOwned(req) {
  const row = db
    .prepare('SELECT * FROM products WHERE id = ? AND owner_id = ?')
    .get(req.params.id, req.user.id);
  if (!row) throw new ApiError(404, 'Product not found');
  return row;
}

export function update(req, res, next) {
  try {
    const existing = findOwned(req);
    const b = req.body;
    const nextValues = {
      product_code: 'productCode' in b ? (b.productCode || null) : existing.product_code,
      name: 'name' in b ? b.name : existing.name,
      category: 'category' in b ? (b.category || null) : existing.category,
      unit: 'unit' in b ? b.unit : existing.unit,
      price: 'price' in b ? toMinor(b.price) : existing.price,
      cost: 'cost' in b ? toMinor(b.cost) : existing.cost,
      stock_qty: 'stockQty' in b ? b.stockQty : existing.stock_qty,
      reorder_level: 'reorderLevel' in b ? b.reorderLevel : existing.reorder_level,
    };
    db.prepare(
      `UPDATE products SET
        product_code = :product_code, name = :name, category = :category,
        unit = :unit, price = :price, cost = :cost, stock_qty = :stock_qty,
        reorder_level = :reorder_level, updated_at = datetime('now')
       WHERE id = :id`
    ).run({ ...nextValues, id: existing.id });
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
    try {
      raiseLowStockAlerts(req.user.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Low-stock alert failed after product update:', e);
    }
    res.json({ product: mapProduct(row) });
  } catch (e) {
    next(e);
  }
}

// Soft delete.
export function remove(req, res, next) {
  try {
    const existing = findOwned(req);
    db.prepare(
      `UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?`
    ).run(existing.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// Manual stock adjustment, guarded so stock never goes below zero.
export function adjustStock(req, res, next) {
  try {
    // The read-modify-write is wrapped in a transaction so that, even if the
    // API ever runs as more than one process sharing one file, two concurrent
    // adjustments cannot read the same stock_qty and clobber each other.
    const row = db.transaction(() => {
      const existing = findOwned(req);
      const newQty = existing.stock_qty + req.body.quantity;
      if (newQty < 0) {
        throw new ApiError(400, 'Adjustment would make stock negative', 'quantity');
      }
      db.prepare(
        `UPDATE products SET stock_qty = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(newQty, existing.id);
      return db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
    })();
    try {
      raiseLowStockAlerts(req.user.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Low-stock alert failed after stock adjustment:', e);
    }
    res.json({ product: mapProduct(row) });
  } catch (e) {
    next(e);
  }
}

export { mapProduct };
