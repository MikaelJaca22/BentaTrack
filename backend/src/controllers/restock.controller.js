import { z } from 'zod';
import db from '../db/connection.js';
import { ApiError } from '../middleware/errorHandler.js';
import { notify } from '../utils/notify.js';
import { parsePagination } from '../utils/query.js';

const itemQty = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
});

const RESTOCK_STATUSES = ['pending', 'declined', 'accepted', 'delivered', 'discrepancy', 'completed'];

export const createRequestSchema = z.object({
  supplierId: z.number().int().positive(),
  note: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  items: z.array(itemQty).min(1, 'Add at least one product'),
});

export const declineSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required').max(500),
});

export const deliverSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        quantityDelivered: z.number().int().min(0, 'Quantity cannot be negative'),
      })
    )
    .min(1),
});

export const verifySchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        quantityReceived: z.number().int().min(0, 'Quantity cannot be negative'),
      })
    )
    .min(1),
});

export const discrepancySchema = verifySchema.extend({
  note: z.string().trim().min(1, 'A note is required').max(500),
});

export const resendSchema = z.object({
  supplierId: z.number().int().positive(),
});

function logEvent(requestId, actorId, eventType, message = null) {
  db.prepare(
    `INSERT INTO restock_events (request_id, actor_id, event_type, message)
     VALUES (?, ?, ?, ?)`
  ).run(requestId, actorId, eventType, message);
}

function buildRequest(id) {
  const req = db.prepare('SELECT * FROM restock_requests WHERE id = ?').get(id);
  if (!req) throw new ApiError(404, 'Request not found');
  const items = db
    .prepare('SELECT * FROM restock_items WHERE request_id = ? ORDER BY id ASC')
    .all(id);
  const owner = db.prepare('SELECT id, name FROM users WHERE id = ?').get(req.owner_id);
  const supplier = db.prepare('SELECT id, name FROM users WHERE id = ?').get(req.supplier_id);
  const events = db
    .prepare(
      `SELECT re.*, u.name AS actor_name FROM restock_events re
       JOIN users u ON u.id = re.actor_id
       WHERE re.request_id = ? ORDER BY re.id ASC`
    )
    .all(id);
  return {
    id: req.id,
    status: req.status,
    note: req.note,
    declineReason: req.decline_reason,
    createdAt: req.created_at,
    updatedAt: req.updated_at,
    storeOwner: { id: owner.id, name: owner.name },
    supplier: { id: supplier.id, name: supplier.name },
    items: items.map((it) => ({
      id: it.id,
      productId: it.product_id,
      name: it.product_name_snapshot,
      quantityRequested: it.quantity_requested,
      quantityDelivered: it.quantity_delivered,
      quantityReceived: it.quantity_received,
    })),
    events: events.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      message: e.message,
      actorName: e.actor_name,
      createdAt: e.created_at,
    })),
  };
}

// Verify the caller (owner or supplier) has access to a request.
function assertAccess(req, reqRow, user) {
  if (user.role === 'store_owner' && reqRow.owner_id !== user.id) {
    throw new ApiError(403, 'Not your request');
  }
  if (user.role === 'supplier' && reqRow.supplier_id !== user.id) {
    throw new ApiError(403, 'Not your request');
  }
}

function loadRequest(id) {
  const reqRow = db.prepare('SELECT * FROM restock_requests WHERE id = ?').get(id);
  if (!reqRow) throw new ApiError(404, 'Request not found');
  return reqRow;
}

// ---- Store owner: create ----
export function create(req, res, next) {
  const ownerId = req.user.id;
  const { supplierId, note, items } = req.body;
  try {
    const link = db
      .prepare(
        'SELECT id FROM store_suppliers WHERE owner_id = ? AND supplier_id = ?'
      )
      .get(ownerId, supplierId);
    if (!link) {
      throw new ApiError(400, 'Supplier is not linked to your store');
    }

    const result = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO restock_requests (owner_id, supplier_id, status, note)
           VALUES (?, ?, 'pending', ?)`
        )
        .run(ownerId, supplierId, note || null);
      const requestId = info.lastInsertRowid;
      const insertItem = db.prepare(
        `INSERT INTO restock_items
          (request_id, product_id, product_name_snapshot, quantity_requested)
         VALUES (?, ?, ?, ?)`
      );
      for (const it of items) {
        const p = db
          .prepare('SELECT * FROM products WHERE id = ? AND owner_id = ?')
          .get(it.productId, ownerId);
        if (!p) throw new ApiError(400, 'One or more products are not yours');
        insertItem.run(requestId, p.id, p.name, it.quantity);
      }
      logEvent(requestId, ownerId, 'created', 'Restock request created');
      return requestId;
    })();

    notify({
      userId: supplierId,
      type: 'restock_new',
      title: 'New restock request',
      body: `Store owner requested restock goods.`,
      referenceType: 'restock_request',
      referenceId: result,
    });
    res.status(201).json(buildRequest(result));
  } catch (e) {
    next(e);
  }
}

// ---- Both roles: list (filtered to caller) ----
export function list(req, res, next) {
  try {
    const q = req.query;
    const status = RESTOCK_STATUSES.includes(q.status) ? q.status : '';
    const { limit, offset } = parsePagination(q);

    let where = req.user.role === 'store_owner' ? 'r.owner_id = ?' : 'r.supplier_id = ?';
    const params = [req.user.id];
    if (status) {
      where += ' AND r.status = ?';
      params.push(status);
    }

    // Single joined query: the previous version ran two extra queries per row
    // (counterpart name + item count), so listing N requests meant 2N+1.
    const rows = db
      .prepare(
        `SELECT r.id, r.status, r.note, r.created_at, r.updated_at,
                r.owner_id, r.supplier_id,
                u.name AS counterpart_name,
                (SELECT COUNT(*) FROM restock_items ri WHERE ri.request_id = r.id) AS item_count
         FROM restock_requests r
         LEFT JOIN users u ON u.id = CASE
           WHEN r.owner_id = ? THEN r.supplier_id ELSE r.owner_id END
         WHERE ${where}
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(req.user.id, ...params, limit, offset);

    // Count the full filtered set, not just this page.
    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM restock_requests r WHERE ${where}`)
      .get(...params);

    res.json({
      requests: rows.map((r) => ({
        id: r.id,
        status: r.status,
        note: r.note,
        itemCount: r.item_count,
        counterpart: r.counterpart_name || '',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      pagination: { total, limit, offset, hasMore: offset + rows.length < total },
    });
  } catch (e) {
    next(e);
  }
}

export function getById(req, res, next) {
  try {
    const reqRow = loadRequest(req.params.id);
    assertAccess(req, reqRow, req.user);
    res.json(buildRequest(reqRow.id));
  } catch (e) {
    next(e);
  }
}

// ---- Supplier: decline ----
export function decline(req, res, next) {
  try {
    const reqRow = loadRequest(req.params.id);
    assertAccess(req, reqRow, req.user);
    if (reqRow.status !== 'pending') {
      throw new ApiError(400, 'Only pending requests can be declined');
    }
    db.prepare(
      `UPDATE restock_requests
       SET status = 'declined', decline_reason = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(req.body.reason, reqRow.id);
    logEvent(reqRow.id, req.user.id, 'declined', req.body.reason);
    notify({
      userId: reqRow.owner_id,
      type: 'restock_declined',
      title: 'Restock request declined',
      body: `Your request was declined: ${req.body.reason}`,
      referenceType: 'restock_request',
      referenceId: reqRow.id,
    });
    res.json(buildRequest(reqRow.id));
  } catch (e) {
    next(e);
  }
}

// ---- Supplier: accept ----
export function accept(req, res, next) {
  try {
    const reqRow = loadRequest(req.params.id);
    assertAccess(req, reqRow, req.user);
    if (reqRow.status !== 'pending') {
      throw new ApiError(400, 'Only pending requests can be accepted');
    }
    db.prepare(
      `UPDATE restock_requests SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`
    ).run(reqRow.id);
    logEvent(reqRow.id, req.user.id, 'accepted', 'Request accepted');
    notify({
      userId: reqRow.owner_id,
      type: 'restock_accepted',
      title: 'Restock request accepted',
      body: 'The supplier accepted your request.',
      referenceType: 'restock_request',
      referenceId: reqRow.id,
    });
    res.json(buildRequest(reqRow.id));
  } catch (e) {
    next(e);
  }
}

// ---- Supplier: mark delivered (also re-deliver after discrepancy) ----
export function deliver(req, res, next) {
  try {
    const reqRow = loadRequest(req.params.id);
    assertAccess(req, reqRow, req.user);
    if (reqRow.status !== 'accepted' && reqRow.status !== 'discrepancy') {
      throw new ApiError(400, 'Only accepted or discrepancy requests can be delivered');
    }
    const items = db
      .prepare('SELECT * FROM restock_items WHERE request_id = ?')
      .all(reqRow.id);
    const map = new Map(req.body.items.map((i) => [i.itemId, i.quantityDelivered]));

    // A supplier must not be able to inflate the delivered quantity beyond what
    // was ordered: the owner credits exactly this number to stock on verify.
    for (const it of items) {
      if (map.has(it.id) && map.get(it.id) > it.quantity_requested) {
        throw new ApiError(
          400,
          `Delivered quantity cannot exceed the ordered quantity for "${it.product_name_snapshot}"`,
          'quantityDelivered'
        );
      }
    }

    // Items omitted from a re-delivery must keep their previously reported
    // quantity rather than being silently reset to the ordered quantity. The
    // supplier is correcting a discrepancy, not re-entering everything.
    for (const it of items) {
      if (!map.has(it.id)) {
        map.set(it.id, it.quantity_delivered ?? it.quantity_requested);
      }
    }

    db.transaction(() => {
      const upd = db.prepare(
        'UPDATE restock_items SET quantity_delivered = ? WHERE id = ? AND request_id = ?'
      );
      for (const it of items) {
        const qty = map.has(it.id) ? map.get(it.id) : it.quantity_requested;
        upd.run(qty, it.id, reqRow.id);
      }
      db.prepare(
        `UPDATE restock_requests SET status = 'delivered', updated_at = datetime('now') WHERE id = ?`
      ).run(reqRow.id);
      logEvent(reqRow.id, req.user.id, 'delivered', 'Goods delivered');
    })();
    notify({
      userId: reqRow.owner_id,
      type: 'restock_delivered',
      title: 'Delivery completed',
      body: 'The supplier marked goods as delivered. Please verify.',
      referenceType: 'restock_request',
      referenceId: reqRow.id,
    });
    res.json(buildRequest(reqRow.id));
  } catch (e) {
    next(e);
  }
}

// ---- Owner: verify delivery -> completed (only if all received == delivered) ----
export function verify(req, res, next) {
  try {
    const reqRow = loadRequest(req.params.id);
    assertAccess(req, reqRow, req.user);
    if (reqRow.status !== 'delivered') {
      throw new ApiError(400, 'Only delivered requests can be verified');
    }
    const items = db
      .prepare('SELECT * FROM restock_items WHERE request_id = ?')
      .all(reqRow.id);
    const map = new Map(req.body.items.map((i) => [i.itemId, i.quantityReceived]));

    // Every received quantity must equal delivered.
    for (const it of items) {
      if (!map.has(it.id)) {
        throw new ApiError(400, 'Received quantity required for every item');
      }
      const received = map.get(it.id);
      const delivered = it.quantity_delivered ?? it.quantity_requested;
      if (received !== delivered) {
        throw new ApiError(
          400,
          'Quantities do not match delivered amounts. Report a discrepancy instead.',
          'items'
        );
      }
    }

    db.transaction(() => {
      const updReceived = db.prepare(
        'UPDATE restock_items SET quantity_received = ? WHERE id = ? AND request_id = ?'
      );
      const addStock = db.prepare(
        `UPDATE products SET stock_qty = stock_qty + ?, updated_at = datetime('now') WHERE id = ?`
      );
      for (const it of items) {
        const received = map.get(it.id);
        updReceived.run(received, it.id, reqRow.id);
        addStock.run(received, it.product_id);
      }
      db.prepare(
        `UPDATE restock_requests SET status = 'completed', updated_at = datetime('now') WHERE id = ?`
      ).run(reqRow.id);
      logEvent(reqRow.id, req.user.id, 'completed', 'Delivery verified, inventory updated');
    })();

    notify({
      userId: reqRow.supplier_id,
      type: 'restock_completed',
      title: 'Restock completed',
      body: 'The store verified the delivery and completed the request.',
      referenceType: 'restock_request',
      referenceId: reqRow.id,
    });
    res.json(buildRequest(reqRow.id));
  } catch (e) {
    next(e);
  }
}

// ---- Owner: report discrepancy ----
export function discrepancy(req, res, next) {
  try {
    const reqRow = loadRequest(req.params.id);
    assertAccess(req, reqRow, req.user);
    if (reqRow.status !== 'delivered') {
      throw new ApiError(400, 'Only delivered requests can report a discrepancy');
    }
    const items = db
      .prepare('SELECT * FROM restock_items WHERE request_id = ?')
      .all(reqRow.id);
    const map = new Map(req.body.items.map((i) => [i.itemId, i.quantityReceived]));

    db.transaction(() => {
      const upd = db.prepare(
        'UPDATE restock_items SET quantity_received = ? WHERE id = ? AND request_id = ?'
      );
      for (const it of items) {
        const received = map.has(it.id) ? map.get(it.id) : it.quantity_delivered;
        upd.run(received, it.id, reqRow.id);
      }
      db.prepare(
        `UPDATE restock_requests SET status = 'discrepancy', updated_at = datetime('now') WHERE id = ?`
      ).run(reqRow.id);
      logEvent(reqRow.id, req.user.id, 'discrepancy', req.body.note);
    })();

    notify({
      userId: reqRow.supplier_id,
      type: 'restock_discrepancy',
      title: 'Discrepancy reported',
      body: `The store reported a discrepancy: ${req.body.note}`,
      referenceType: 'restock_request',
      referenceId: reqRow.id,
    });
    res.json(buildRequest(reqRow.id));
  } catch (e) {
    next(e);
  }
}

// ---- Owner: resend a declined request to another supplier ----
export function resend(req, res, next) {
  try {
    const reqRow = loadRequest(req.params.id);
    assertAccess(req, reqRow, req.user);
    if (reqRow.status !== 'declined') {
      throw new ApiError(400, 'Only declined requests can be resent');
    }
    const targetSupplier = req.body.supplierId;
    const link = db
      .prepare(
        'SELECT id FROM store_suppliers WHERE owner_id = ? AND supplier_id = ?'
      )
      .get(reqRow.owner_id, targetSupplier);
    if (!link) {
      throw new ApiError(400, 'Supplier is not linked to your store');
    }
    // A declined request may only be resent once: otherwise one decline could
    // spawn an unbounded number of new requests against different suppliers.
    const alreadyResent = db
      .prepare(
        `SELECT 1 FROM restock_events WHERE request_id = ? AND event_type = 'resent' LIMIT 1`
      )
      .get(reqRow.id);
    if (alreadyResent) {
      throw new ApiError(400, 'This request has already been resent');
    }
    const items = db
      .prepare('SELECT * FROM restock_items WHERE request_id = ?')
      .all(reqRow.id);

    const newId = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO restock_requests (owner_id, supplier_id, status, note)
           VALUES (?, ?, 'pending', ?)`
        )
        .run(reqRow.owner_id, targetSupplier, reqRow.note || null);
      const insertItem = db.prepare(
        `INSERT INTO restock_items
          (request_id, product_id, product_name_snapshot, quantity_requested)
         VALUES (?, ?, ?, ?)`
      );
      for (const it of items) {
        insertItem.run(info.lastInsertRowid, it.product_id, it.product_name_snapshot, it.quantity_requested);
      }
      logEvent(info.lastInsertRowid, req.user.id, 'resent', 'Resent to another supplier');
      return info.lastInsertRowid;
    })();

    notify({
      userId: targetSupplier,
      type: 'restock_new',
      title: 'New restock request',
      body: 'A resent restock request is waiting for you.',
      referenceType: 'restock_request',
      referenceId: newId,
    });
    res.status(201).json(buildRequest(newId));
  } catch (e) {
    next(e);
  }
}
