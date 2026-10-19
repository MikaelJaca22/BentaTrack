import db from '../db/connection.js';

function pad(n, width = 4) {
  return String(n).padStart(width, '0');
}

// Local YYYYMMDD for the store owner's receipt numbering.
function dateKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1, 2);
  const dd = pad(d.getDate(), 2);
  return `${yyyy}${mm}${dd}`;
}

// Generate the next sequential receipt number for a store owner for a given day.
// Format: BT-YYYYMMDD-0001 (sequential per store per day).
// Must be called inside the sale transaction so counts are consistent.
export function nextReceiptNo(ownerId, now = new Date()) {
  const key = dateKey(now);
  const prefix = `BT-${key}-`;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM sales WHERE owner_id = ? AND receipt_no LIKE ?`
    )
    .get(ownerId, `${prefix}%`);
  const seq = (row?.c || 0) + 1;
  return `${prefix}${pad(seq, 4)}`;
}

export { dateKey };
