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
    // Dedup against the most recent low-stock alert for this product. An unread
    // alert means we already notified the owner, so skip. A read alert is only
    // superseded when the product changed since that alert was created (e.g. a
    // further sale or stock adjustment) — otherwise a still-low product would
    // re-open an alert the owner just dismissed and the badge could never clear.
    const latest = db
      .prepare(
        `SELECT is_read, body FROM notifications
         WHERE user_id = ? AND type = 'low_stock'
           AND reference_type = 'product' AND reference_id = ?
         ORDER BY id DESC LIMIT 1`
      )
      .get(ownerId, p.id);
    if (latest) {
      const stillUnread = latest.is_read === 0;
      if (stillUnread) continue;
      // Only re-alert when the stock situation actually changed since the
      // last (read) alert, so a dismissed alert does not keep reappearing on
      // every poll while the product stays low.
      const match = String(latest.body || '').match(/\((\d+) left, reorder at (\d+)\)/);
      const prevStock = match ? Number(match[1]) : null;
      const prevReorder = match ? Number(match[2]) : null;
      const changed =
        prevStock === null ||
        prevReorder === null ||
        prevStock !== p.stock_qty ||
        prevReorder !== p.reorder_level;
      if (!changed) continue;
    }
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
