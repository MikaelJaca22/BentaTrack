import db from '../db/connection.js';

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
    const onlyUnread = (req.query.unread || '').toString() === 'true';
    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [req.user.id];
    if (onlyUnread) sql += ' AND is_read = 0';
    sql += ' ORDER BY created_at DESC, id DESC';
    const rows = db.prepare(sql).all(...params);
    const unreadCount = rows.filter((r) => !r.is_read).length;
    res.json({ notifications: rows.map(mapRow), unreadCount });
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
