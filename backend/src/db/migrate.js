import db from './connection.js';

// Money columns are INTEGER minor units (centavos). See utils/money.js for why.
const MONEY_COLUMNS = {
  products: ['price', 'cost'],
  sales: ['total', 'amount_tendered', 'change_due'],
  sale_items: ['unit_price_snapshot', 'line_total'],
};

// Migration creates tables and indexes only. No seed rows, no demo data.
export function migrate() {
  migrateMoneyColumns();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      role          TEXT NOT NULL CHECK (role IN ('store_owner','supplier')),
      name          TEXT NOT NULL,
      username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id      INTEGER NOT NULL REFERENCES users(id),
      product_code  TEXT,
      name          TEXT NOT NULL,
      category      TEXT,
      unit          TEXT NOT NULL DEFAULT 'pc',
      price         INTEGER NOT NULL DEFAULT 0,
      cost          INTEGER NOT NULL DEFAULT 0,
      stock_qty     INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
      reorder_level INTEGER NOT NULL DEFAULT 0,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id        INTEGER NOT NULL REFERENCES users(id),
      receipt_no      TEXT NOT NULL,
      total           INTEGER NOT NULL,
      amount_tendered INTEGER NOT NULL,
      change_due      INTEGER NOT NULL,
      payment_method  TEXT NOT NULL DEFAULT 'cash',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (owner_id, receipt_no)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id               INTEGER NOT NULL REFERENCES sales(id),
      product_id            INTEGER NOT NULL REFERENCES products(id),
      product_name_snapshot TEXT NOT NULL,
      unit_price_snapshot   INTEGER NOT NULL,
      quantity              INTEGER NOT NULL,
      line_total            INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_suppliers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id    INTEGER NOT NULL REFERENCES users(id),
      supplier_id INTEGER NOT NULL REFERENCES users(id),
      linked_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (owner_id, supplier_id)
    );

    CREATE TABLE IF NOT EXISTS restock_requests (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id       INTEGER NOT NULL REFERENCES users(id),
      supplier_id    INTEGER NOT NULL REFERENCES users(id),
      status         TEXT NOT NULL CHECK (status IN ('pending','declined','accepted','delivered','discrepancy','completed')),
      note           TEXT,
      decline_reason TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restock_items (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id         INTEGER NOT NULL REFERENCES restock_requests(id),
      product_id         INTEGER NOT NULL REFERENCES products(id),
      product_name_snapshot TEXT NOT NULL,
      quantity_requested INTEGER NOT NULL,
      quantity_delivered INTEGER,
      quantity_received  INTEGER
    );

    CREATE TABLE IF NOT EXISTS restock_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES restock_requests(id),
      actor_id   INTEGER NOT NULL REFERENCES users(id),
      event_type TEXT NOT NULL,
      message    TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      type          TEXT NOT NULL,
      title         TEXT NOT NULL,
      body          TEXT NOT NULL,
      reference_type TEXT,
      reference_id  INTEGER,
      is_read       INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_owner        ON products(owner_id);
    CREATE INDEX IF NOT EXISTS idx_products_owner_name   ON products(owner_id, name);
    CREATE INDEX IF NOT EXISTS idx_sales_owner           ON sales(owner_id);
    CREATE INDEX IF NOT EXISTS idx_sales_owner_created   ON sales(owner_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale       ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product    ON sale_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_store_suppliers_owner ON store_suppliers(owner_id);
    CREATE INDEX IF NOT EXISTS idx_store_suppliers_sup   ON store_suppliers(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_restock_owner         ON restock_requests(owner_id);
    CREATE INDEX IF NOT EXISTS idx_restock_supplier      ON restock_requests(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_restock_owner_status  ON restock_requests(owner_id, status);
    CREATE INDEX IF NOT EXISTS idx_restock_sup_status    ON restock_requests(supplier_id, status);
    CREATE INDEX IF NOT EXISTS idx_restock_items_req     ON restock_items(request_id);
    CREATE INDEX IF NOT EXISTS idx_restock_items_product ON restock_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_restock_events_req    ON restock_events(request_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
    -- Supports the default notifications list (user_id + newest first).
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created
      ON notifications(user_id, created_at DESC, id DESC);
    -- Supports the unread badge count and ?unread=true filter.
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
      ON notifications(user_id, is_read);
  `);

  // Partial unique index: enforce UNIQUE(owner_id, product_code) only when code is not null.
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_owner_code
      ON products(owner_id, product_code)
      WHERE product_code IS NOT NULL;
  `);
}

// Convert REAL money columns to INTEGER minor units in an existing database.
//
// SQLite cannot change a column's type with ALTER TABLE, so each affected table
// is rebuilt using the documented procedure: create a new table with the
// desired schema, copy rows with the value converted, drop the old table, and
// rename. This runs only when a REAL column is actually detected, so a fresh
// database skips it entirely and re-running migrate() is a no-op.
//
// Foreign keys are disabled for the swap (dropping a referenced table would
// otherwise cascade-delete children) and the whole rebuild is one transaction,
// so an interrupted migration leaves the original data untouched.
function migrateMoneyColumns() {
  const rebuilds = {
    products: `
      CREATE TABLE products_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id      INTEGER NOT NULL REFERENCES users(id),
        product_code  TEXT,
        name          TEXT NOT NULL,
        category      TEXT,
        unit          TEXT NOT NULL DEFAULT 'pc',
        price         INTEGER NOT NULL DEFAULT 0,
        cost          INTEGER NOT NULL DEFAULT 0,
        stock_qty     INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
        reorder_level INTEGER NOT NULL DEFAULT 0,
        is_active     INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
    sales: `
      CREATE TABLE sales_new (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id        INTEGER NOT NULL REFERENCES users(id),
        receipt_no      TEXT NOT NULL,
        total           INTEGER NOT NULL,
        amount_tendered INTEGER NOT NULL,
        change_due      INTEGER NOT NULL,
        payment_method  TEXT NOT NULL DEFAULT 'cash',
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (owner_id, receipt_no)
      );`,
    sale_items: `
      CREATE TABLE sale_items_new (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id               INTEGER NOT NULL REFERENCES sales(id),
        product_id            INTEGER NOT NULL REFERENCES products(id),
        product_name_snapshot TEXT NOT NULL,
        unit_price_snapshot   INTEGER NOT NULL,
        quantity              INTEGER NOT NULL,
        line_total            INTEGER NOT NULL
      );`,
  };

  const nonMoney = {
    products:
      'id, owner_id, product_code, name, category, unit, stock_qty, reorder_level, is_active, created_at, updated_at',
    sales: 'id, owner_id, receipt_no, payment_method, created_at',
    sale_items: 'id, sale_id, product_id, product_name_snapshot, quantity',
  };

  const pending = Object.keys(rebuilds).filter((table) => hasRealMoneyColumn(table));

  if (pending.length === 0) return;

  const foreignKeysWereOn = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const table of pending) {
        const money = MONEY_COLUMNS[table];
        // CAST(round(x * 100) AS INTEGER) converts major units to minor units.
        // A NULL or non-finite legacy value becomes 0 rather than failing the
        // NOT NULL constraint and aborting the whole migration.
        const moneySelect = money
          .map((c) => `CAST(ROUND(COALESCE(${c}, 0) * 100) AS INTEGER) AS ${c}`)
          .join(', ');
        db.exec(rebuilds[table]);
        db.exec(
          `INSERT INTO ${table}_new (${nonMoney[table]}, ${money.join(', ')})
           SELECT ${nonMoney[table]}, ${moneySelect} FROM ${table};`
        );
        db.exec(`DROP TABLE ${table};`);
        db.exec(`ALTER TABLE ${table}_new RENAME TO ${table};`);
      }
    })();
  } finally {
    if (foreignKeysWereOn) db.pragma('foreign_keys = ON');
  }
}

// True if the table exists and still stores any money column as REAL.
function hasRealMoneyColumn(table) {
  const exists = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table);
  if (!exists) return false;
  const columns = db.pragma(`table_info(${table})`);
  return columns.some((c) => MONEY_COLUMNS[table].includes(c.name) && /REAL/i.test(c.type));
}
