import db from '../db/connection.js';
import { notify } from './notify.js';

// Returns all active products for an owner that are at or below their reorder
// level (reorder_level > 0). A reorder_level of 0 means "no alert threshold".
export function lowStockProducts(ownerId) {
  return db
    .prepare(
      `SELECT * FROM products
       WHERE owner_id = ? AND is_active = 1
         AND reorder_level > 0 AND stock_qty <= reorder_level`
    )
    .all(ownerId);
}

// Ensure every currently-low product has an unread low-stock notification.
// De-duplicates against existing unread alerts for the same product so polling
// or repeated mutations do not flood the inbox. Returns the products alerted.
export function raiseLowStockAlerts(ownerId) {
  const products = lowStockProducts(ownerId);
  const alerted = [];
  for (const p of products) {
    const existing = db
      .prepare(
        `SELECT 1 FROM notifications
         WHERE user_id = ? AND type = 'low_stock'
           AND reference_type = 'product' AND reference_id = ?
           AND is_read = 0
         LIMIT 1`
      )
      .get(ownerId, p.id);
    if (existing) continue;
    const id = notify({
      userId: ownerId,
      type: 'low_stock',
      title: 'Low stock alert',
      body: `"${p.name}" is low (${p.stock_qty} left, reorder at ${p.reorder_level}).`,
      referenceType: 'product',
      referenceId: p.id,
    });
    if (id) alerted.push(p);
  }
  return alerted;
}
