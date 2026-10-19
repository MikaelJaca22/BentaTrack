// Single client config constant for currency. Philippine peso.
// The "BentaTrack" brand name is rendered separately above this tagline,
// so SYSTEM_TITLE is the tagline only.
export const SYSTEM_TITLE = 'General Retail Sales & Supply Coordination System';

export const CURRENCY_SYMBOL = '₱';

export function formatMoney(amount) {
  const n = Number(amount || 0);
  return `${CURRENCY_SYMBOL}${n.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
