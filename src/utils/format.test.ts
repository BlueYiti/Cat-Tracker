import { describe, expect, it } from 'vitest';
import { formatDays, formatMoney, formatRate } from './format';

describe('formatMoney', () => {
  it('formats with currency symbol', () => {
    expect(formatMoney(1200, '₱')).toBe('₱1,200');
  });

  it('formats with decimal for fractional amounts', () => {
    expect(formatMoney(1234.5, '₱')).toBe('₱1,234.50');
  });

  it('formats round numbers without decimals', () => {
    expect(formatMoney(5000, '$')).toBe('$5,000');
  });

  it('handles zero', () => {
    expect(formatMoney(0, '₱')).toBe('₱0');
  });

  it('handles negative amounts', () => {
    expect(formatMoney(-100, '₱')).toBe('₱-100');
  });

  it('returns symbol+0 for NaN', () => {
    expect(formatMoney(NaN, '₱')).toBe('₱0');
  });

  it('returns symbol+0 for Infinity', () => {
    expect(formatMoney(Infinity, '₱')).toBe('₱0');
  });
});

describe('formatDays', () => {
  it('formats positive days with ceil rounding', () => {
    expect(formatDays(7.68)).toBe('~8 days');
    expect(formatDays(3)).toBe('~3 days');
  });

  it('returns em-dash for null', () => {
    expect(formatDays(null)).toBe('—');
  });

  it('returns em-dash for NaN', () => {
    expect(formatDays(NaN)).toBe('—');
  });

  it('returns em-dash for Infinity', () => {
    expect(formatDays(Infinity)).toBe('—');
  });

  // NOTE: formatDays does not guard against negative values — it renders "~-5 days".
  // This is an observed edge case; callers like calculateEstimatedDaysRemaining already
  // return null for negative remaining, so negative days shouldn't reach this formatter in practice.
  it('renders negative values without guarding (observed behavior)', () => {
    expect(formatDays(-5)).toBe('~-5 days');
  });
});

describe('formatRate', () => {
  it('formats a per-day rate', () => {
    expect(formatRate(833.333, 'g', 'day')).toBe('833.33 g/day');
  });

  it('formats a per-cat-day rate', () => {
    expect(formatRate(208.333, 'g', 'cat-day')).toBe('208.33 g/cat/day');
  });

  it('uses kg for large values', () => {
    expect(formatRate(1500, 'g', 'day')).toBe('1.5 kg/day');
  });

  it('returns em-dash for null', () => {
    expect(formatRate(null, 'g', 'day')).toBe('—');
  });

  it('returns em-dash for NaN', () => {
    expect(formatRate(NaN, 'g', 'day')).toBe('—');
  });

  it('returns em-dash for Infinity', () => {
    expect(formatRate(Infinity, 'g', 'day')).toBe('—');
  });
});
