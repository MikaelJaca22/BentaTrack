import { z } from 'zod';
import db from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';
import { likePattern, LIKE_ESCAPE } from '../utils/query.js';

export const linkSchema = z.object({
  supplierId: z.number().int().positive(),
});

// Linked suppliers for the owner.
export function linked(req, res, next) {
  try {
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.username, ss.linked_at
         FROM store_suppliers ss
         JOIN users u ON u.id = ss.supplier_id
         WHERE ss.owner_id = ?
         ORDER BY u.name COLLATE NOCASE ASC`
      )
      .all(req.user.id);
    res.json({
      suppliers: rows.map((r) => ({
        id: r.id,
        name: r.name,
        username: r.username,
        linkedAt: r.linked_at,
      })),
    });
  } catch (e) {
    next(e);
  }
}

// Search existing Supplier accounts (id, name, username only).
export function search(req, res, next) {
  try {
    const q = (req.query.q ?? '').toString().trim();
    let sql = "SELECT id, name, username FROM users WHERE role = 'supplier'";
    const params = [];
    if (q) {
      // Escape LIKE wildcards so a search for "%" does not return every supplier.
      const pattern = likePattern(q);
      sql += ` AND (name LIKE ? ${LIKE_ESCAPE} OR username LIKE ? ${LIKE_ESCAPE})`;
      params.push(pattern, pattern);
    }
    sql += ' ORDER BY name COLLATE NOCASE ASC LIMIT 50';
    const rows = db.prepare(sql).all(...params);
    res.json({ suppliers: rows });
  } catch (e) {
    next(e);
  }
}

export function link(req, res, next) {
  try {
    const supplier = db
      .prepare("SELECT id FROM users WHERE id = ? AND role = 'supplier'")
      .get(req.body.supplierId);
    if (!supplier) {
      throw new ApiError(400, 'Supplier account not found');
    }
    const exists = db
      .prepare(
        'SELECT id FROM store_suppliers WHERE owner_id = ? AND supplier_id = ?'
      )
      .get(req.user.id, req.body.supplierId);
    if (exists) {
      throw new ApiError(409, 'Supplier already linked');
    }
    db.prepare(
      'INSERT INTO store_suppliers (owner_id, supplier_id) VALUES (?, ?)'
    ).run(req.user.id, req.body.supplierId);
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export function unlink(req, res, next) {
  try {
    db.prepare(
      'DELETE FROM store_suppliers WHERE owner_id = ? AND supplier_id = ?'
    ).run(req.user.id, req.params.supplierId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
