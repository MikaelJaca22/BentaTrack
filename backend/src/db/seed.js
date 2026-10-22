// Opt-in sample data loader. Run with: npm run seed
//
// Seeds the store owner (Kael Jaca) and supplier (Jasmine) accounts plus the
// product catalogue from the provided list. Idempotent: existing rows are
// skipped rather than duplicated.

import db from './connection.js';
import { migrate } from './migrate.js';
import bcrypt from 'bcryptjs';

migrate();

const OWNER = { role: 'store_owner', name: 'Kael Jaca', username: 'kaeljaca', password: 'kael1234' };
const SUPPLIER = { role: 'supplier', name: 'Jasmine', username: 'jasmine', password: 'jasmine1234' };

// Product catalogue (brand + name) from the provided seed list.
const CATALOGUE = [
  { brand: 'NESTEA', name: 'Apple' },
  { brand: 'NESTEA', name: 'Lemon' },
  { brand: 'NESTLE', name: 'Coffee Mate' },
  { brand: 'NESTLE', name: 'Bear Brand' },
  { brand: 'NESTLE', name: 'Milo' },
  { brand: 'NESCAFE', name: 'Original' },
  { brand: 'NESCAFE', name: 'Creamy White' },
  { brand: 'NESCAFE', name: 'Creamy Latte' },
  { brand: 'KNORR', name: 'Original (Liquid Seasoning)' },
  { brand: 'KNORR', name: 'Sinigang (Isda)' },
  { brand: 'KNORR', name: 'Sinigang Sampalok Mix (Gabi)' },
  { brand: 'KNORR', name: 'Original' },
  { brand: 'KNORR', name: 'Beef' },
  { brand: 'KNORR', name: 'Chicken' },
  { brand: 'AJINOMOTO', name: 'Seasoning Mix (Pepper)' },
  { brand: 'AJINOMOTO', name: 'Seasoning Mix (Garlic)' },
  { brand: 'AJINOMOTO', name: 'Oyster Sauce' },
  { brand: 'AJINOMOTO', name: 'Soup Mix' },
  { brand: 'AJINOMOTO', name: 'Flavor Seasoning Mix' },
  { brand: 'AJINOMOTO', name: 'All-in-One Seasoning Mix' },
  { brand: 'AJINOMOTO', name: 'Umami Seasoning Mix' },
  { brand: 'AJINOMOTO', name: 'Tasty Boy All Purpose Breading Mix (Regular)' },
  { brand: 'AJINOMOTO', name: 'Crispy Fry (Garlic)' },
  { brand: 'AJINOMOTO', name: 'Crispy Fry (Spicy) Party Pack' },
  { brand: 'AJINOMOTO', name: 'Crispy Fry (Original) Party Pack' },
  { brand: 'MC CORMICK', name: 'Seasoning Mix' },
  { brand: 'MAGGI', name: 'Oyster Sauce' },
  { brand: 'MC CODY', name: 'Chicken Seasoning Mix' },
  { brand: 'Silver Swan', name: 'Soy Sauce' },
  { brand: 'Datu Puti', name: 'Vinegar' },
  { brand: null, name: 'Sweet Chili Sauce' },
  { brand: null, name: 'Barbeque Marinate' },
];

function upsertUser({ role, name, username, password }) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return existing.id;
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (role, name, username, password_hash) VALUES (?, ?, ?, ?)')
    .run(role, name, username, hash);
  return info.lastInsertRowid;
}

const ownerId = upsertUser(OWNER);
const supplierId = upsertUser(SUPPLIER);

// Link supplier to owner if not already linked.
const link = db
  .prepare('SELECT id FROM store_suppliers WHERE owner_id = ? AND supplier_id = ?')
  .get(ownerId, supplierId);
if (!link) {
  db.prepare('INSERT INTO store_suppliers (owner_id, supplier_id) VALUES (?, ?)').run(ownerId, supplierId);
}

// Seed products (idempotent by owner + name).
const insertProduct = db.prepare(
  `INSERT INTO products
     (owner_id, product_code, name, category, unit, price, cost, stock_qty, reorder_level, is_active)
   VALUES (?, NULL, ?, ?, 'pc', 0, 0, 0, 0, 1)`
);
const existingNames = new Set(
  db.prepare('SELECT name FROM products WHERE owner_id = ?').all(ownerId).map((r) => r.name)
);

let inserted = 0;
let skipped = 0;
const run = db.transaction(() => {
  for (const item of CATALOGUE) {
    const name = item.brand ? `${item.brand} ${item.name}` : item.name;
    if (existingNames.has(name)) {
      skipped++;
      continue;
    }
    insertProduct.run(ownerId, name, item.brand || null);
    existingNames.add(name);
    inserted++;
  }
});
run();

console.log(`Seed complete.`);
console.log(`  Owner: ${OWNER.username} (id ${ownerId})`);
console.log(`  Supplier: ${SUPPLIER.username} (id ${supplierId})`);
console.log(`  Products inserted: ${inserted}, skipped: ${skipped}`);
console.log(`  Total products for owner: ${db.prepare('SELECT COUNT(*) AS c FROM products WHERE owner_id = ?').get(ownerId).c}`);
