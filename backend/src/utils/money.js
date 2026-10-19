// Money is stored in SQLite as INTEGER minor units (centavos for PHP pesos),
// never as REAL.
//
// A REAL column cannot represent 0.1 exactly, so summing prices eventually
// drifts: a sale of three items at 0.10 each can total 0.30000000000000004.
// Worse, SQLite has no DECIMAL type, so a REAL column happily stores Infinity.
// Working in integers removes both problems: sums are exact and the value
// space is unbounded-but-integral rather than float.
//
// The API still speaks major units (123.45), so nothing changes for clients.

// Convert an API-supplied major-unit amount to integer minor units.
// Rounds rather than truncating, because a price of 10.005 should be stored as
// 1001, not silently dropped to 1000.
export function toMinor(major) {
  return Math.round(Number(major) * 100);
}

// Convert stored minor units back to a major-unit number for the API.
export function toMajor(minor) {
  return Number(minor) / 100;
}

// Sum a list of minor-unit integers. Safe because the inputs are integers.
export function sumMinor(values) {
  return values.reduce((acc, v) => acc + v, 0);
}