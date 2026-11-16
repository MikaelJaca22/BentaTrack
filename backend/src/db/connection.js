import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import env from '../config/env.js';

// Ensure the data directory exists before opening the SQLite file.
const dbDir = path.dirname(env.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;
try {
  db = new Database(env.dbPath);
} catch (err) {
  // Native modules are built per Node ABI. After switching Node majors this
  // fails with a raw dlopen stack; point at the one-line fix instead.
  if (/NODE_MODULE_VERSION|different Node\.js version/.test(err.message)) {
    console.error(
      `\nbetter-sqlite3 was built for a different Node.js version (running ${process.version}).` +
        '\nFix it from backend/ with: npm rebuild better-sqlite3\n'
    );
  }
  throw err;
}

// Enable foreign keys and WAL mode for concurrency + durability.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
