import db from '../db/connection.js';

// Create an in-app notification for a user.
// type: e.g. 'low_stock', 'restock_new', 'restock_declined', 'restock_delivered',
// 'restock_completed', 'restock_discrepancy'.
export function notify({ userId, type, title, body, referenceType = null, referenceId = null }) {
  const info = db
    .prepare(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(userId, type, title, body, referenceType, referenceId);
  return info.lastInsertRowid;
}

// Notify multiple users at once.
export function notifyMany(userIds, payload) {
  return userIds.map((userId) => notify({ userId, ...payload }));
}
