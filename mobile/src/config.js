// Client config. Currency set by one constant.
// The "BentaTrack" brand name is rendered separately above this tagline,
// so SYSTEM_TITLE is the tagline only.
export const SYSTEM_TITLE = 'General Retail Sales & Supply Coordination System';

export const CURRENCY_SYMBOL = '₱';

export function formatMoney(amount) {
  const n = Number(amount || 0);
  return `${CURRENCY_SYMBOL}${n.toFixed(2)}`;
}

// Resolve the backend URL. Prefer EXPO_PUBLIC_API_URL. When running on a
// physical device, replace "localhost" with your computer's LAN IP.
function resolveBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  return 'http://localhost:4000/api';
}

export const API_URL = resolveBaseUrl();
