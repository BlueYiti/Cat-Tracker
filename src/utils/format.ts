// Display formatting helpers.

import { formatQuantity } from '../domain/units';
import type { UnitCode } from '../domain/types';

/** Display a calculated rate with a sensible unit label. */
export function formatRate(value: number | null, unit: UnitCode, per: 'day' | 'cat-day'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const q = formatQuantity(value, unit);
  return per === 'day' ? `${q}/day` : `${q}/cat/day`;
}

/** Format a currency amount using the device locale with a custom symbol. */
export function formatMoney(amount: number, symbol: string): string {
  if (!Number.isFinite(amount)) return `${symbol}0`;
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

/** Round-trip display for estimated days. */
export function formatDays(days: number | null): string {
  if (days == null || !Number.isFinite(days)) return '—';
  return `~${Math.ceil(days)} days`;
}