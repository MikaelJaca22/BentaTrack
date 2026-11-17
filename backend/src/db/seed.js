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
  { brand: 'NESTEA', name: 'Apple', image: '01-nestea-apple.jpg', price: 2070, cost: 1650, stock: 50, reorder: 10 },
  { brand: 'NESTEA', name: 'Lemon', image: '02-nestea-lemon.jpg', price: 2070, cost: 1650, stock: 50, reorder: 10 },
  { brand: 'NESTLE', name: 'Coffee Mate', image: '03-nestle-coffee-mate.jpg', price: 12500, cost: 10000, stock: 50, reorder: 10 },
  { brand: 'NESTLE', name: 'Bear Brand', image: '04-nestle-bear-brand.jpg', price: 10000, cost: 8000, stock: 50, reorder: 10 },
  { brand: 'NESTLE', name: 'Milo', image: '05-nestle-milo.jpg', price: 899, cost: 700, stock: 50, reorder: 10 },
  { brand: 'NESCAFE', name: 'Original', image: '06-nescafe-original.jpg', price: 700, cost: 560, stock: 50, reorder: 10 },
  { brand: 'NESCAFE', name: 'Creamy White', image: '07-nescafe-creamy-white.jpg', price: 790, cost: 630, stock: 50, reorder: 10 },
  { brand: 'NESCAFE', name: 'Creamy Latte', image: '08-nescafe-creamy-latte.jpg', price: 790, cost: 630, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Original (Liquid Seasoning)', image: '09-knorr-original-liquid-seasoning.jpg', price: 6480, cost: 5200, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Sinigang (Isda)', image: '10-knorr-sinigang-isda.jpg', price: 2200, cost: 1760, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Sinigang Sampalok Mix (Gabi)', image: '11-knorr-sinigang-sampalok-gabi.jpg', price: 2950, cost: 2360, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Original', image: '12-knorr-original.jpg', price: 575, cost: 460, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Beef', image: '13-knorr-beef.jpg', price: 575, cost: 460, stock: 50, reorder: 10 },
  { brand: 'KNORR', name: 'Chicken', image: '14-knorr-chicken.jpg', price: 575, cost: 460, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Seasoning Mix (Pepper)', image: '15-ajinomoto-seasoning-mix-pepper.jpg', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Seasoning Mix (Garlic)', image: '16-ajinomoto-seasoning-mix-garlic.jpg', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Oyster Sauce', image: '17-ajinomoto-oyster-sauce.jpg', price: 8400, cost: 6700, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Soup Mix', image: '18-ajinomoto-soup-mix.jpg', price: 2000, cost: 1600, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Flavor Seasoning Mix', image: '19-ajinomoto-flavor-seasoning-mix.jpg', price: 500, cost: 400, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'All-in-One Seasoning Mix', image: '20-ajinomoto-all-in-one-seasoning-mix.jpg', price: 500, cost: 400, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Umami Seasoning Mix', image: '21-ajinomoto-umami-seasoning-mix.jpg', price: 1625, cost: 1300, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Tasty Boy All Purpose Breading Mix (Regular)', image: '22-ajinomoto-tasty-boy.jpg', price: 2500, cost: 2000, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Crispy Fry (Garlic)', image: '23-ajinomoto-crispy-fry-garlic.jpg', price: 2100, cost: 1680, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Crispy Fry (Spicy) Party Pack', image: '24-ajinomoto-crispy-fry-spicy-party-pack.jpg', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: 'AJINOMOTO', name: 'Crispy Fry (Original) Party Pack', image: '25-ajinomoto-crispy-fry-original-party-pack.jpg', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: 'MC CORMICK', name: 'Seasoning Mix', image: '26-mccormick-seasoning-mix.jpg', price: 1000, cost: 800, stock: 50, reorder: 10 },
  { brand: 'MAGGI', name: 'Oyster Sauce', image: '27-maggi-oyster-sauce.jpg', price: 8000, cost: 6400, stock: 50, reorder: 10 },
  { brand: 'MC CODY', name: 'Chicken Seasoning Mix', image: '28-mc-cody-chicken-seasoning-mix.jpg', price: 4000, cost: 3200, stock: 50, reorder: 10 },
  { brand: 'Silver Swan', name: 'Soy Sauce', image: '29-silver-swan-soy-sauce.jpg', price: 6500, cost: 5200, stock: 50, reorder: 10 },
  { brand: 'Datu Puti', name: 'Vinegar', image: '30-datu-puti-vinegar.jpg', price: 6000, cost: 4800, stock: 50, reorder: 10 },
  { brand: null, name: 'Sweet Chili Sauce', image: '31-sweet-chili-sauce.jpg', price: 4400, cost: 3500, stock: 50, reorder: 10 },
  { brand: null, name: 'Barbeque Marinate', image: '32-barbeque-marinate.jpg', price: 4500, cost: 3600, stock: 50, reorder: 10 },
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

// Seed products (idempotent by owner + name). Existing catalogue rows from
// databases created before product photos existed get their image_url filled
// in without duplicating the product.
const imageUrl = (item) => `/media/products/${item.image}`;
const insertProduct = db.prepare(
  `INSERT INTO products
     (owner_id, product_code, name, category, unit, price, cost, stock_qty, reorder_level, image_url, is_active)
   VALUES (?, NULL, ?, ?, 'pc', ?, ?, ?, ?, ?, 1)`
);
const updateImage = db.prepare('UPDATE products SET image_url = ? WHERE id = ?');
const existingByName = new Map(
  db
    .prepare('SELECT id, name, image_url FROM products WHERE owner_id = ?')
    .all(ownerId)
    .map((r) => [r.name, r])
);

let inserted = 0;
let skipped = 0;
let imagesBackfilled = 0;
const run = db.transaction(() => {
  for (const item of CATALOGUE) {
    const name = item.brand ? `${item.brand} ${item.name}` : item.name;
    const existing = existingByName.get(name);
    if (existing) {
      if (!existing.image_url) {
        updateImage.run(imageUrl(item), existing.id);
        existing.image_url = imageUrl(item);
        imagesBackfilled++;
      }
      skipped++;
      continue;
    }
    insertProduct.run(
      ownerId,
      name,
      item.brand || null,
      item.price,
      item.cost,
      item.stock,
      item.reorder,
      imageUrl(item)
    );
    existingByName.set(name, { id: null, name, image_url: imageUrl(item) });
    inserted++;
  }
});
run();

console.log(`Seed complete.`);
console.log(`  Owner: ${OWNER.username} (id ${ownerId})`);
console.log(`  Supplier: ${SUPPLIER.username} (id ${supplierId})`);
console.log(`  Products inserted: ${inserted}, skipped: ${skipped}`);
console.log(`  Product images backfilled: ${imagesBackfilled}`);
console.log(`  Total products for owner: ${db.prepare('SELECT COUNT(*) AS c FROM products WHERE owner_id = ?').get(ownerId).c}`);