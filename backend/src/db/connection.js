import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import env from '../config/env.js';

// Ensure the data directory exists before opening the SQLite file.
const dbDir = path.dirname(env.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(env.dbPath);

// Enable foreign keys and WAL mode for concurrency + durability.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
