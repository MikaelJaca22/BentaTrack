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
//
// Uses MAX(seq) rather than COUNT(*). COUNT(*) silently reuses a number if a
// row is ever deleted, which would hand two different sales the same receipt
// number. MAX(seq) always moves forward, so it stays correct after deletions.
//
// Must be called inside the sale transaction so the read and the insert that
// consumes the number are atomic.
export function nextReceiptNo(ownerId, now = new Date()) {
  const key = dateKey(now);
  const prefix = `BT-${key}-`;
  // SQLite substr() is 1-based, so the start position is the prefix length + 1.
  const seqStart = prefix.length + 1;
  const row = db
    .prepare(
      `SELECT MAX(CAST(substr(receipt_no, ?) AS INTEGER)) AS seq
       FROM sales
       WHERE owner_id = ? AND receipt_no LIKE ?`
    )
    .get(seqStart, ownerId, `${prefix}%`);
  const seq = (row?.seq ?? 0) + 1;
  return `${prefix}${pad(seq, 4)}`;
}

export { dateKey };