import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, daysUsed, formatDate, formatMonth, isValidDateString, monthEnd, monthKey, monthStart, parseDate, todayLocal } from './dates';

describe('isValidDateString', () => {
  it('accepts valid dates', () => {
    expect(isValidDateString('2026-08-19')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true); // leap year
  });

  it('rejects invalid dates', () => {
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2025-02-29')).toBe(false);
    expect(isValidDateString('08/19/2026')).toBe(false);
    expect(isValidDateString('20260819')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });
});

describe('daysBetween', () => {
  it('computes whole days', () => {
    expect(daysBetween('2026-08-19', '2026-08-01')).toBe(18);
    expect(daysBetween('2026-08-01', '2026-08-01')).toBe(0);
  });

  it('handles month and year boundaries', () => {
    expect(daysBetween('2026-01-01', '2025-12-31')).toBe(1);
  });
});

describe('daysUsed', () => {
  it('returns 0 for same day', () => {
    expect(daysUsed('2026-08-19', '2026-08-19')).toBe(0);
  });

  it('returns negative days as null', () => {
    expect(daysUsed('2026-08-19', '2026-08-18')).toBeNull();
  });
});

describe('addDays', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
  });
});

describe('parseDate', () => {
  it('creates local dates without timezone shifting', () => {
    const d = parseDate('2026-08-19');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // 0-indexed
    expect(d.getDate()).toBe(19);
  });
});

describe('formatDate', () => {
  it('formats a date', () => {
    const formatted = formatDate('2026-08-19');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Aug');
  });

  it('returns input for invalid date', () => {
    expect(formatDate('bogus')).toBe('bogus');
  });
});

describe('month helpers', () => {
  it('extracts month key', () => {
    expect(monthKey('2026-08-19')).toBe('2026-08');
  });

  it('formats month', () => {
    expect(formatMonth('2026-08')).toContain('2026');
  });

  it('computes month start and end', () => {
    expect(monthStart('2026-08')).toBe('2026-08-01');
    expect(monthEnd('2026-08')).toBe('2026-08-31');
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(monthEnd('2024-02')).toBe('2024-02-29'); // leap year
  });
});

describe('todayLocal', () => {
  it('returns a valid local date string', () => {
    const t = todayLocal();
    expect(isValidDateString(t)).toBe(true);
  });
});