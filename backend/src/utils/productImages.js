import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Generated product photos live in backend/public/products and are served by
// app.js at /media/products. The manifest maps catalogue names to files so
// products created before the image column existed still get their photo.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_FILE = path.resolve(__dirname, '../../public/products/manifest.json');

export const PRODUCT_MEDIA_PREFIX = '/media/products';

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const imageByName = new Map();
try {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  for (const item of manifest.products || []) {
    if (item?.name && item?.file) {
      imageByName.set(normalizeName(item.name), `${PRODUCT_MEDIA_PREFIX}/${item.file}`);
    }
  }
} catch {
  // A missing manifest must not stop the API from booting. Products simply
  // fall back to having no image.
}

// Look up a generated image by product name (manifest fallback).
export function generatedImageUrl(name) {
  return imageByName.get(normalizeName(name)) || null;
}

// Resolve the stored image column, falling back to the generated manifest.
export function resolveProductImage(row) {
  if (!row) return null;
  if (row.image_url) return row.image_url;
  return generatedImageUrl(row.name ?? row.product_name_snapshot);
}

// Accept a full URL, an absolute media path, or a bare filename from the
// generated product folder. Empty values clear the image.
export function normalizeImageUrl(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  if (raw.startsWith('/')) return raw;
  if (raw.includes('/')) return `/${raw}`;
  return `${PRODUCT_MEDIA_PREFIX}/${raw}`;
}
