import { z } from 'zod';

// Shared query-string schemas and pagination helpers.
//
// Query strings are always strings, so numeric fields arrive as text ("50").
// These helpers coerce and bound them, and clamp out-of-range values rather
// than erroring, so a bad page number degrades to page 1 instead of a 400.

// A page number or offset cap keeps a hostile ?limit=999999 from pulling the
// whole table into memory. 200 rows is well above any realistic single screen.
export const MAX_PAGE_SIZE = 200;
export const DEFAULT_PAGE_SIZE = 50;

// Accepts a non-negative integer, or an undefined/empty value.
// Out-of-range and malformed values fall back to `fallback` rather than
// throwing, so ?limit=abc behaves like ?limit=<default>.
export function coerceInt(raw, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

// Standard ?limit=&offset= block for list endpoints.
export function parsePagination(query, { defaultLimit = DEFAULT_PAGE_SIZE } = {}) {
  const limit = coerceInt(query.limit, {
    min: 1,
    max: MAX_PAGE_SIZE,
    fallback: defaultLimit,
  });
  const offset = coerceInt(query.offset, { min: 0, max: 1_000_000, fallback: 0 });
  return { limit, offset };
}

// Dates arrive as YYYY-MM-DD. Anything else is ignored rather than passed
// through to SQLite, where it would silently match nothing.
export function parseDate(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

// ?unread=true / ?lowStock=true style flags.
export function parseBool(raw) {
  return String(raw ?? '').toLowerCase() === 'true';
}

// Escape LIKE wildcards so a search for "%" does not match every row.
export function likePattern(term) {
  return `%${String(term).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// ESCAPE clause matching likePattern's escaping.
export const LIKE_ESCAPE = "ESCAPE '\\'";

export { z };