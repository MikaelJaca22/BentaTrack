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

// Product catalogue (brand + name) with configured price, cost, stock and
// reorder level. Values are stored as integer minor units (centavos) for
// money columns, matching the database convention.
const CATALOGUE = [
  { brand: 'NESTEA', name: 'Apple', price: 2070, cost: 1650, stock: 50, reorder: 10 },
  { brand: 'NESTEA', name: 'Lemon', price: 2070, cost: 1650, stock: 50, reorder: 10 },
  { brand: 'NESTLE', name: 'Coffee Mate', price: 12500, cost: 10000, stock: 50, reorder: 10 },
  { brand: 'NESTLE', name: 'Bear Brand', price: 10000, cost: 8000, stock: 50, reorder: 10 },
  { brand: 'NESTLE', name: 'Milo', price: 899, cost: 700, stock: 50, reorder: 10 },
  { brand: 'NESCAFE', name: 'Original', price: 700, cost: 560, stock: 50, reorder: 10 },
  { brand: 'NESCAFE', name: 'Creamy White', price: 790, cost: 630, stock: 50, reorder: 10 },
  { brand: 'NESCAFE', name: 'Creamy Latte', price: 790, cost: 630, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Original (Liquid Seasoning)', price: 6480, cost: 5200, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Sinigang (Isda)', price: 2200, cost: 1760, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Sinigang Sampalok Mix (Gabi)', price: 2950, cost: 2360, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Original', price: 575, cost: 460, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Beef', price: 575, cost: 460, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Chicken', price: 575, cost: 460, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Seasoning Mix (Pepper)', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Seasoning Mix (Garlic)', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Oyster Sauce', price: 8400, cost: 6700, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Soup Mix', price: 2000, cost: 1600, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Flavor Seasoning Mix', price: 500, cost: 400, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'All-in-One Seasoning Mix', price: 500, cost: 400, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Umami Seasoning Mix', price: 1625, cost: 1300, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Tasty Boy All Purpose Breading Mix (Regular)', price: 2500, cost: 2000, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Crispy Fry (Garlic)', price: 2100, cost: 1680, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Crispy Fry (Spicy) Party Pack', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Crispy Fry (Original) Party Pack', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: 'MC CORMICK', name: 'Seasoning Mix', price: 1000, cost: 800, stock: 50, reorder: 10 },
  { brand: 'MAGGI', name: 'Oyster Sauce', price: 8000, cost: 6400, stock: 50, reorder: 10 },
  { brand: 'MC CODY', name: 'Chicken Seasoning Mix', price: 4000, cost: 3200, stock: 50, reorder: 10 },
  { brand: 'Silver Swan', name: 'Soy Sauce', price: 6500, cost: 5200, stock: 50, reorder: 10 },
  { brand: 'Datu Puti', name: 'Vinegar', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: null, name: 'Sweet Chili Sauce', price: 4400, cost: 3500, stock: 50, reorder: 10 },
  { brand: null, name: 'Barbeque Marinate', price: 4500, cost: 3600, stock: 50, reorder: 10 },
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
   VALUES (?, NULL, ?, ?, 'pc', ?, ?, ?, ?, 1)`
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
    insertProduct.run(ownerId, name, item.brand || null, item.price, item.cost, item.stock, item.reorder);
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