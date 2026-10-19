// Opt-in sample data loader. NOT part of the app boot path.
//
// migrate.js and server.js deliberately insert nothing (the project rule is that a
// fresh database starts completely empty). This script is a developer convenience
// for populating a catalogue during manual testing and is only ever executed via
//   npm run seed            # auto-detects the single store owner
//   npm run seed -- kaeljaca
//
// It never creates users. The target owner must already be registered, because
// products are owner-scoped rows that require a real users.id foreign key.

import db from './connection.js';
import { migrate } from './migrate.js';
import { createProductSchema } from '../controllers/products.controller.js';
import { toMinor } from '../utils/money.js';

// Ten general-retail items with Philippine peso pricing.
// A few are deliberately at or below their reorder level so the low-stock
// filter, low-stock alerts and the restock flow can be exercised immediately.
const SAMPLE_PRODUCTS = [
  { productCode: 'BT-1001', name: 'Royalty Bottled Water 500ml', category: 'Beverages', unit: 'pc', price: 15, cost: 11, stockQty: 120, reorderLevel: 24 },
  { productCode: 'BT-1002', name: 'Coca-Cola 1.5L', category: 'Beverages', unit: 'pc', price: 78, cost: 66, stockQty: 10, reorderLevel: 12 },
  { productCode: 'BT-1003', name: 'Skyflakes Potato Crackers 60g', category: 'Snacks', unit: 'pc', price: 22, cost: 16.5, stockQty: 65, reorderLevel: 15 },
  { productCode: 'BT-1004', name: 'Piattos Taro Chips 60g', category: 'Snacks', unit: 'pc', price: 24, cost: 18, stockQty: 50, reorderLevel: 15 },
  { productCode: 'BT-1005', name: 'Nissin Cup Noodles Beef 65g', category: 'Instant Noodles', unit: 'pc', price: 18, cost: 13.5, stockQty: 200, reorderLevel: 40 },
  { productCode: 'BT-1006', name: 'Milo Sachet 24g', category: 'Beverages', unit: 'pc', price: 9.5, cost: 7.25, stockQty: 300, reorderLevel: 60 },
  { productCode: 'BT-1007', name: 'Tide Powder Detergent 454g', category: 'Household', unit: 'pc', price: 128, cost: 108, stockQty: 18, reorderLevel: 8 },
  { productCode: 'BT-1008', name: 'Joy Dishwashing Liquid 250ml', category: 'Household', unit: 'pc', price: 55, cost: 44, stockQty: 30, reorderLevel: 10 },
  { productCode: 'BT-1009', name: 'Dove Beauty Bar 90g', category: 'Personal Care', unit: 'pc', price: 42, cost: 34, stockQty: 9, reorderLevel: 12 },
  // Intentionally left without a product_code to exercise the "no code" path.
  { productCode: '', name: 'AAA Battery 2-Pack', category: 'Household', unit: 'pc', price: 35, cost: 27, stockQty: 6, reorderLevel: 10 },
];

function log(message) {
  // eslint-disable-next-line no-console
  console.log(message);
}

// Resolve the store owner the sample products belong to.
function resolveOwner(usernameArg) {
  const owners = db
    .prepare("SELECT id, name, username FROM users WHERE role = 'store_owner' ORDER BY id")
    .all();

  if (owners.length === 0) {
    throw new Error(
      'No store owner exists yet. Register one in the app first, then re-run the seed.'
    );
  }

  if (usernameArg) {
    const match = owners.find((o) => o.username.toLowerCase() === usernameArg.toLowerCase());
    if (!match) {
      const known = owners.map((o) => o.username).join(', ');
      throw new Error(`No store owner named "${usernameArg}". Known owners: ${known}`);
    }
    return match;
  }

  if (owners.length > 1) {
    const known = owners.map((o) => o.username).join(', ');
    throw new Error(
      `Multiple store owners found (${known}). Re-run with a username, e.g. npm run seed -- kaeljaca`
    );
  }

  return owners[0];
}

export function seedProducts(ownerId) {
  const insert = db.prepare(
    `INSERT INTO products
      (owner_id, product_code, name, category, unit, price, cost, stock_qty, reorder_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const existingCodes = new Set(
    db
      .prepare('SELECT product_code FROM products WHERE owner_id = ? AND product_code IS NOT NULL')
      .all(ownerId)
      .map((r) => r.product_code)
  );
  const existingNames = new Set(
    db
      .prepare('SELECT name FROM products WHERE owner_id = ?')
      .all(ownerId)
      .map((r) => r.name.toLowerCase())
  );

  const inserted = [];
  const skipped = [];

  const run = db.transaction(() => {
    for (const item of SAMPLE_PRODUCTS) {
      // Validate against the same zod schema the POST /api/products route uses,
      // so sample data can never drift from the API contract.
      const parsed = createProductSchema.safeParse(item);
      if (!parsed.success) {
        throw new Error(
          `Sample product "${item.name}" is invalid: ${parsed.error.issues
            .map((i) => `${i.path.join('.') || '(root)'} ${i.message}`)
            .join('; ')}`
        );
      }

      const p = parsed.data;
      const code = p.productCode ? p.productCode : null;
      const key = p.name.toLowerCase();

      // Idempotent: never duplicate a code (unique index) or a name for this owner.
      if ((code && existingCodes.has(code)) || existingNames.has(key)) {
        skipped.push(p.name);
        continue;
      }

      insert.run(
        ownerId,
        code,
        p.name,
        p.category || null,
        p.unit || 'pc',
        // The literal values above are in pesos for readability; the column
        // stores integer minor units.
        toMinor(p.price),
        toMinor(p.cost),
        p.stockQty,
        p.reorderLevel
      );

      if (code) existingCodes.add(code);
      existingNames.add(key);
      inserted.push(p.name);
    }
  });

  run();
  return { inserted, skipped };
}

function main() {
  migrate();

  const owner = resolveOwner(process.argv[2]);
  const { inserted, skipped } = seedProducts(owner.id);

  log(`Seed complete for store owner "${owner.username}" (${owner.name}).`);
  log(`  Inserted: ${inserted.length}`);

  if (skipped.length > 0) {
    log(`  Skipped (already present): ${skipped.length}`);
    for (const name of skipped) log(`    - ${name}`);
  }

  const total = db
    .prepare('SELECT COUNT(*) AS c FROM products WHERE owner_id = ?')
    .get(owner.id).c;
  const lowStock = db
    .prepare(
      'SELECT COUNT(*) AS c FROM products WHERE owner_id = ? AND reorder_level > 0 AND stock_qty <= reorder_level'
    )
    .get(owner.id).c;

  log(`  Owner now has ${total} product(s), ${lowStock} at or below reorder level.`);
}

main();