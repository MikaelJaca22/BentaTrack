import db from './connection.js';

// Migration creates tables and indexes only. No seed rows, no demo data.
export function migrate() {
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
      price         REAL NOT NULL DEFAULT 0,
      cost          REAL NOT NULL DEFAULT 0,
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
      total           REAL NOT NULL,
      amount_tendered REAL NOT NULL,
      change_due      REAL NOT NULL,
      payment_method  TEXT NOT NULL DEFAULT 'cash',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (owner_id, receipt_no)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id               INTEGER NOT NULL REFERENCES sales(id),
      product_id            INTEGER NOT NULL REFERENCES products(id),
      product_name_snapshot TEXT NOT NULL,
      unit_price_snapshot   REAL NOT NULL,
      quantity              INTEGER NOT NULL,
      line_total            REAL NOT NULL
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
  `);

  // Partial unique index: enforce UNIQUE(owner_id, product_code) only when code is not null.
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_owner_code
      ON products(owner_id, product_code)
      WHERE product_code IS NOT NULL;
  `);
}
