import db from '../db/connection.js';

// Create an in-app notification for a user.
// type: e.g. 'low_stock', 'restock_new', 'restock_declined', 'restock_delivered',
// 'restock_completed', 'restock_discrepancy'.
//
// Notification failures are logged and swallowed rather than thrown. Callers
// invoke notify() after their transaction has already committed, so letting an
// error escape would return a 500 for an operation that succeeded and invite the
// client to retry it. A missing alert is recoverable; a duplicated sale is not.
export function notify({ userId, type, title, body, referenceType = null, referenceId = null }) {
  try {
    const info = db
      .prepare(
        `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(userId, type, title, body, referenceType, referenceId);
    return info.lastInsertRowid;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Failed to create "${type}" notification for user ${userId}:`, err);
    return null;
  }
}

// Notify multiple users at once.
export function notifyMany(userIds, payload) {
  return userIds.map((userId) => notify({ userId, ...payload }));
}
