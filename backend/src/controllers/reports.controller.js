import db from '../db/connection.js';
import { parseDate } from '../utils/query.js';
import { toMajor } from '../utils/money.js';

// Cap on the receipts list embedded in the sales report. The summary totals
// above it are computed over the full date range regardless; only this
// convenience list is truncated.
const MAX_RECEIPTS = 200;

// Every SUM() below runs over INTEGER minor units, so totals are exact.
// toMajor() converts to pesos only at the API boundary.

// Convert an array of flat objects to CSV text.
function toCsv(rows, columns) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    // Neutralise spreadsheet formula injection. Free-text fields such as a
    // supplier's name come from open registration, so an attacker could store
    // "=HYPERLINK(...)" and have it evaluated when an owner opens the export.
    // Leading =, +, -, @, tab and CR all trigger a formula in Excel/Sheets.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => esc(c.label)).join(',');
  const lines = rows.map((r) =>
    columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(',')
  );
  return [header, ...lines].join('\r\n');
}

function sendMaybeCsv(req, res, jsonPayload, csvRows, columns) {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
    return res.send(toCsv(csvRows, columns));
  }
  res.json(jsonPayload);
}

// ---- Sales report ----
export function sales(req, res, next) {
  try {
    const ownerId = req.user.id;
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    let where = 'owner_id = ?';
    const params = [ownerId];
    if (from) {
      where += ' AND date(created_at) >= date(?)';
      params.push(from);
    }
    if (to) {
      where += ' AND date(created_at) <= date(?)';
      params.push(to);
    }

    const totals = db
      .prepare(
        `SELECT COUNT(*) AS txns, COALESCE(SUM(total),0) AS revenue
         FROM sales WHERE ${where}`
      )
      .get(...params);

    const itemsSold = db
      .prepare(
        `SELECT COALESCE(SUM(si.quantity),0) AS qty
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE ${where.replace('owner_id', 's.owner_id')}`
      )
      .get(...params);

    const daily = db
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS txns, SUM(total) AS revenue
         FROM sales WHERE ${where}
         GROUP BY day ORDER BY day ASC`
      )
      .all(...params)
      .map((d) => ({ day: d.day, txns: d.txns, revenue: toMajor(d.revenue) }));

    const topByQty = db
      .prepare(
        `SELECT si.product_name_snapshot AS name,
                SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE ${where.replace('owner_id', 's.owner_id')}
         GROUP BY si.product_id, si.product_name_snapshot
         ORDER BY quantity DESC LIMIT 10`
      )
      .all(...params)
      .map((p) => ({ name: p.name, quantity: p.quantity, revenue: toMajor(p.revenue) }));

    const topByRevenue = db
      .prepare(
        `SELECT si.product_name_snapshot AS name,
                SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE ${where.replace('owner_id', 's.owner_id')}
         GROUP BY si.product_id, si.product_name_snapshot
         ORDER BY revenue DESC LIMIT 10`
      )
      .all(...params)
      .map((p) => ({ name: p.name, quantity: p.quantity, revenue: toMajor(p.revenue) }));

    // Bounded: this array previously returned every sale ever made for the
    // store, so a year of trading meant a multi-megabyte response.
    const receipts = db
      .prepare(
        `SELECT id, receipt_no, total, created_at FROM sales WHERE ${where}
         ORDER BY created_at DESC, id DESC LIMIT ?`
      )
      .all(...params, MAX_RECEIPTS)
      .map((r) => ({
        id: r.id,
        receiptNo: r.receipt_no,
        total: toMajor(r.total),
        createdAt: r.created_at,
      }));

    const payload = {
      range: { from: from || null, to: to || null },
      summary: {
        totalSales: toMajor(totals.revenue),
        transactionCount: totals.txns,
        itemsSold: itemsSold.qty,
        // Division can still be inexact, so the average is rounded once here
        // and stays in minor units until it reaches the client.
        averageSale: totals.txns ? Math.round(totals.revenue / totals.txns) / 100 : 0,
      },
      daily,
      topProductsByQuantity: topByQty,
      topProductsByRevenue: topByRevenue,
      receipts,
    };

    sendMaybeCsv(
      req,
      res,
      payload,
      receipts,
      [
        { label: 'Receipt No', key: 'receiptNo' },
        { label: 'Total', key: 'total' },
        { label: 'Date', key: 'createdAt' },
      ]
    );
  } catch (e) {
    next(e);
  }
}

// ---- Inventory report ----
export function inventory(req, res, next) {
  try {
    const rows = db
      .prepare(
        `SELECT * FROM products WHERE owner_id = ? ORDER BY name COLLATE NOCASE ASC`
      )
      .all(req.user.id);
    // Sum the total in minor units first, then convert once. Adding the already
    // converted per-row values would reintroduce the float drift this change
    // exists to remove.
    const totalStockValueMinor = rows.reduce((s, p) => s + p.stock_qty * p.cost, 0);
    const products = rows.map((p) => ({
      id: p.id,
      productCode: p.product_code,
      name: p.name,
      category: p.category,
      unit: p.unit,
      stockQty: p.stock_qty,
      reorderLevel: p.reorder_level,
      cost: toMajor(p.cost),
      price: toMajor(p.price),
      // Integer minor units: stock_qty * cost is exact, no float drift.
      stockValue: toMajor(p.stock_qty * p.cost),
      isLow: p.reorder_level > 0 && p.stock_qty <= p.reorder_level,
      isActive: !!p.is_active,
    }));
    const totalStockValue = toMajor(totalStockValueMinor);
    const lowStockCount = products.filter((p) => p.isLow).length;
    const payload = {
      summary: { totalStockValue, lowStockCount, productCount: products.length },
      products,
    };
    sendMaybeCsv(
      req,
      res,
      payload,
      products,
      [
        { label: 'Code', key: 'productCode' },
        { label: 'Name', key: 'name' },
        { label: 'Category', key: 'category' },
        { label: 'Stock', key: 'stockQty' },
        { label: 'Reorder Level', key: 'reorderLevel' },
        { label: 'Cost', key: 'cost' },
        { label: 'Stock Value', key: 'stockValue' },
        { label: 'Low Stock', value: (r) => (r.isLow ? 'YES' : 'NO') },
      ]
    );
  } catch (e) {
    next(e);
  }
}

// ---- Restock report ----
export function restock(req, res, next) {
  try {
    const ownerId = req.user.id;
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    // Table-qualified: the per-supplier query joins users, which also has a
    // created_at column, so an unqualified reference makes SQLite error with
    // "ambiguous column name: created_at".
    let where = 'rr.owner_id = ?';
    const params = [ownerId];
    if (from) {
      where += ' AND date(rr.created_at) >= date(?)';
      params.push(from);
    }
    if (to) {
      where += ' AND date(rr.created_at) <= date(?)';
      params.push(to);
    }

    const byStatus = db
      .prepare(`SELECT status, COUNT(*) AS c FROM restock_requests rr WHERE ${where} GROUP BY status`)
      .all(...params)
      .reduce((acc, r) => {
        acc[r.status] = r.c;
        return acc;
      }, {});

    const perSupplier = db
      .prepare(
        `SELECT rr.supplier_id, u.name AS supplier_name,
                COUNT(*) AS total,
                SUM(CASE WHEN rr.status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN rr.status = 'discrepancy' THEN 1 ELSE 0 END) AS discrepancy,
                SUM(CASE WHEN rr.status = 'declined' THEN 1 ELSE 0 END) AS declined
         FROM restock_requests rr JOIN users u ON u.id = rr.supplier_id
         WHERE ${where}
         GROUP BY rr.supplier_id, u.name
         ORDER BY total DESC`
      )
      .all(...params)
      .map((r) => ({
        supplierId: r.supplier_id,
        supplierName: r.supplier_name,
        total: r.total,
        completed: r.completed,
        discrepancy: r.discrepancy,
        declined: r.declined,
      }));

    const discrepancyCount = db
      .prepare(`SELECT COUNT(*) AS c FROM restock_requests rr WHERE ${where} AND status = 'discrepancy'`)
      .get(...params).c;

    const payload = {
      range: { from: from || null, to: to || null },
      summary: { byStatus, discrepancyCount, totalRequests: Object.values(byStatus).reduce((a, b) => a + b, 0) },
      perSupplier,
    };
    sendMaybeCsv(
      req,
      res,
      payload,
      perSupplier,
      [
        { label: 'Supplier', key: 'supplierName' },
        { label: 'Total', key: 'total' },
        { label: 'Completed', key: 'completed' },
        { label: 'Discrepancy', key: 'discrepancy' },
        { label: 'Declined', key: 'declined' },
      ]
    );
  } catch (e) {
    next(e);
  }
}
