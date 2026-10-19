import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root (two levels up from src/config)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// TRUST_PROXY accepts a hop count ("1") or a boolean-ish string ("true"/"false").
function coerceTrustProxy(raw) {
  const s = String(raw).trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `TRUST_PROXY must be a non-negative integer (number of proxy hops) or "true"/"false", got "${raw}"`
    );
  }
  return n;
}

const nodeEnv = process.env.NODE_ENV || 'development';
// Compare case-insensitively: NODE_ENV=Production must not skip the guards below.
const isProduction = String(nodeEnv).toLowerCase() === 'production';
const DEV_JWT_SECRET = 'dev-insecure-secret-change-me';

// Known dummy values that must never reach production, regardless of length.
// Length alone is not enough — "change-me-to-a-long-random-secret-string" is 40 chars.
const WEAK_SECRETS = [
  DEV_JWT_SECRET,
  'change-me-to-a-long-random-secret-string',
  'change-me',
  'changeme',
  'secret',
  'your-secret-here',
  'replace-me',
];
const WEAK_PATTERN = /(change[-_ ]?me|replace[-_ ]?me|your[-_ ]?secret|example|insecure|placeholder|todo)/i;

// Refuse to boot in production with a missing, placeholder, or too-short signing key.
// In development the fallback is kept so a fresh clone can run without a .env file.
const jwtSecret = process.env.JWT_SECRET || DEV_JWT_SECRET;
if (isProduction) {
  const reason =
    jwtSecret === DEV_JWT_SECRET
      ? 'it is missing (the development fallback would be used)'
      : jwtSecret.length < 32
        ? `it is only ${jwtSecret.length} characters (minimum 32)`
        : WEAK_SECRETS.includes(jwtSecret.toLowerCase()) || WEAK_PATTERN.test(jwtSecret)
          ? 'it is a known placeholder value'
          : null;

  if (reason) {
    throw new Error(
      `JWT_SECRET must be a random string of at least 32 characters when NODE_ENV=production — ${reason}. ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64url\'))"'
    );
  }
}

const env = {
  nodeEnv,
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret,
  dbPath: process.env.DB_PATH
    ? path.resolve(path.resolve(__dirname, '../..'), process.env.DB_PATH)
    : path.resolve(__dirname, '../../data/bentatrack.db'),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Number of trusted reverse-proxy hops, or null to trust none (the default,
  // which is the safe choice: without it a client could spoof X-Forwarded-For).
  trustProxy: process.env.TRUST_PROXY ? coerceTrustProxy(process.env.TRUST_PROXY) : null,
};

// An empty CORS_ORIGINS would otherwise make the API reachable from any origin.
// Require an explicit allowlist in production, for the same reason JWT_SECRET is required.
if (isProduction && env.corsOrigins.length === 0) {
  throw new Error(
    'CORS_ORIGINS must list at least one allowed origin when NODE_ENV=production, ' +
      'e.g. CORS_ORIGINS=https://yourapp.example.com'
  );
}

export default env;
