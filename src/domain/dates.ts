// Local-date helpers. All date-only values are stored as local "YYYY-MM-DD" strings.
// We never round-trip through UTC so timezone boundaries can't shift a day.
import type { IDate } from './types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayLocal(): IDate {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isValidDateString(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function parseDate(s: IDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight, no UTC shift
}

/** Whole days from a to b (a - b). Safe for same-day (returns 0), never negative if a >= b. */
export function daysBetween(a: IDate, b: IDate): number {
  const da = parseDate(a).getTime();
  const db = parseDate(b).getTime();
  return Math.round((da - db) / 86_400_000);
}

/** Whole days used = finished - opened. Returns 0 for same-day, null if invalid. */
export function daysUsed(openedAt: IDate, finishedAt: IDate): number | null {
  if (!isValidDateString(openedAt) || !isValidDateString(finishedAt)) return null;
  const d = daysBetween(finishedAt, openedAt);
  if (d < 0) return null; // finished before opened
  return d;
}

export function addDays(date: IDate, days: number): IDate {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(s: IDate): string {
  if (!isValidDateString(s)) return s;
  const d = parseDate(s);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateShort(s: IDate): string {
  if (!isValidDateString(s)) return s;
  const d = parseDate(s);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "YYYY-MM" for month grouping. */
export function monthKey(date: IDate): string {
  return date.slice(0, 7);
}

/** Month label e.g. "August 2026". */
export function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

export function currentMonthKey(): string {
  return monthKey(todayLocal());
}

export function monthStart(key: string): IDate {
  return `${key}-01`;
}

/** Last day of the month, inclusive. */
export function monthEnd(key: string): IDate {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${key}-${pad(last)}`;
}