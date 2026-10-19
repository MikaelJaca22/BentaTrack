import db from '../db/connection.js';
import { parseBool, parsePagination } from '../utils/query.js';

function mapRow(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    referenceType: n.reference_type,
    referenceId: n.reference_id,
    isRead: !!n.is_read,
    createdAt: n.created_at,
  };
}

export function list(req, res, next) {
  try {
    const onlyUnread = parseBool(req.query.unread);
    const { limit, offset } = parsePagination(req.query, { defaultLimit: 50 });

    let where = 'user_id = ?';
    const params = [req.user.id];
    if (onlyUnread) where += ' AND is_read = 0';

    // unreadCount must describe the whole set, not just the current page,
    // otherwise the badge count changes as the user pages through history.
    const unreadCount = db
      .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user.id).c;
    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM notifications WHERE ${where}`)
      .get(...params);

    const rows = db
      .prepare(
        `SELECT * FROM notifications WHERE ${where}
         ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    res.json({
      notifications: rows.map(mapRow),
      unreadCount,
      pagination: { total, limit, offset, hasMore: offset + rows.length < total },
    });
  } catch (e) {
    next(e);
  }
}

export function markRead(req, res, next) {
  try {
    const info = db
      .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: { message: 'Notification not found' } });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export function markAllRead(req, res, next) {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
