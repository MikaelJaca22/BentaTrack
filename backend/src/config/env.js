import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root (two levels up from src/config)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  dbPath: process.env.DB_PATH
    ? path.resolve(path.resolve(__dirname, '../..'), process.env.DB_PATH)
    : path.resolve(__dirname, '../../data/bentatrack.db'),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export default env;
