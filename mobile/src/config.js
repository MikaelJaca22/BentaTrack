// Client config. Currency set by one constant.
// The "BentaTrack" brand name is rendered separately above this tagline,
// so SYSTEM_TITLE is the tagline only.
export const SYSTEM_TITLE = 'General Retail Sales & Supply Coordination System';

export const CURRENCY_SYMBOL = '₱';

export function formatMoney(amount) {
  const n = Number(amount || 0);
  return `${CURRENCY_SYMBOL}${n.toFixed(2)}`;
}

import Constants from 'expo-constants';

// In Expo Go the dev server's host is the computer running the backend, so
// derive the API address from it. This keeps the app working when the
// computer's LAN IP changes (DHCP), instead of hardcoding an IP in .env.
function devServerHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost;
  if (!hostUri) return null;
  // hostUri looks like "192.168.1.14:8081" or "exp://192.168.1.14:8081".
  const host = String(hostUri)
    .replace(/^[a-z]+:\/\//i, '')
    .split('/')[0]
    .split(':')[0];
  return host && host !== 'localhost' && host !== '127.0.0.1' ? host : null;
}

// Resolve the backend URL. EXPO_PUBLIC_API_URL (e.g. in .env) wins when set;
// otherwise use the Expo dev-server host with the backend port.
function resolveBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const host = devServerHost();
  if (host) return `http://${host}:4000/api`;
  return 'http://localhost:4000/api';
}

export const API_URL = resolveBaseUrl();
