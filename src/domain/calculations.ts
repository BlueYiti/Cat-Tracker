// Pure business calculations. No React, no IndexedDB — fully unit-testable.
// Every function guards against NaN/Infinity/negative/zero-day inputs and
// returns safe values (often null for "insufficient data") instead.

import { daysUsed } from './dates';
import type { IDate } from './types';

// ---------- Core ratios (spec §15) ----------

function guardRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator <= 0) return null; // never divide by zero or negative
  if (numerator < 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** Days used = finished - opened. Returns 0 for same-day, null when invalid. */
export function calculateDaysUsed(openedAt: IDate, finishedAt: IDate): number | null {
  return daysUsed(openedAt, finishedAt);
}

/** Per-day household consumption (same unit as quantity). */
export function calculateDailyConsumption(quantityConsumed: number, days: number): number | null {
  if (days === 0) {
    // Same-day supply: consumption rate is technically infinite for the day.
    // We report "no meaningful rate" rather than Infinity.
    return null;
  }
  return guardRatio(quantityConsumed, days);
}

/** Per-day consumption per cat (household rate / historical cat count). */
export function calculatePerCatConsumption(
  householdDaily: number | null,
  activeCatCount: number,
): number | null {
  if (householdDaily == null) return null;
  if (!Number.isInteger(activeCatCount) || activeCatCount <= 0) return null;
  return guardRatio(householdDaily, activeCatCount);
}

/** Cost per day = price / days used. */
export function calculateCostPerDay(price: number, days: number): number | null {
  if (days === 0) return null;
  return guardRatio(price, days);
}

/** Cost per cat per day = price / days / catCount. */
export function calculateCostPerCatPerDay(
  price: number,
  days: number,
  activeCatCount: number,
): number | null {
  if (days === 0) return null;
  if (!Number.isInteger(activeCatCount) || activeCatCount <= 0) return null;
  return guardRatio(price, days * activeCatCount);
}

// ---------- Historical averages (spec §16) ----------

export interface CompletedPeriod {
  quantityConsumed: number; // quantity that was consumed (units of `unit`)
  days: number; // days used, >= 1 for completed supplies contributing to history
  unitKind: 'weight' | 'count';
  price: number;
  activeCatCount: number;
}

export interface HistoricalStats {
  dailyHouseholdConsumption: number | null;
  dailyPerCatConsumption: number | null;
  costPerDay: number | null;
  costPerCatPerDay: number | null;
  completedSupplyCount: number;
  totalQuantity: number;
  totalDays: number;
  unitKind: 'weight' | 'count';
}

/**
 * Weighted historical aggregation for a single product (or unit-kind group).
 * Prefers ΣQuantity / ΣDays over the mean of per-period rates.
 */
export function calculateHistoricalStats(periods: CompletedPeriod[]): HistoricalStats {
  const usable = periods.filter(
    (p) =>
      Number.isFinite(p.days) &&
      p.days > 0 &&
      Number.isFinite(p.quantityConsumed) &&
      p.quantityConsumed >= 0,
  );

  const totalQuantity = usable.reduce((acc, p) => acc + p.quantityConsumed, 0);
  const totalDays = usable.reduce((acc, p) => acc + p.days, 0);
  const totalPrice = usable.reduce((acc, p) => acc + (Number.isFinite(p.price) && p.price >= 0 ? p.price : 0), 0);
  const totalCatDays = usable.reduce((acc, p) => acc + p.days * Math.max(1, Math.round(p.activeCatCount)), 0);
  const completedCount = usable.length;

  const household = totalDays > 0 ? totalQuantity / totalDays : null;
  const perCat = totalCatDays > 0 ? totalQuantity / totalCatDays : null;
  const costPerDay = totalDays > 0 ? totalPrice / totalDays : null;
  const costPerCatPerDay = totalCatDays > 0 ? totalPrice / totalCatDays : null;

  return {
    dailyHouseholdConsumption: safeNumber(household),
    dailyPerCatConsumption: safeNumber(perCat),
    costPerDay: safeNumber(costPerDay),
    costPerCatPerDay: safeNumber(costPerCatPerDay),
    completedSupplyCount: completedCount,
    totalQuantity: totalQuantity,
    totalDays: totalDays,
    unitKind: usable[0]?.unitKind ?? 'weight',
  };
}

function safeNumber(n: number | null): number | null {
  return n != null && Number.isFinite(n) ? n : null;
}

// ---------- Predictions (spec §17) ----------

export interface PredictionResult {
  estimatedDaysRemaining: number | null; // null = not enough history
  estimatedFinishDate: IDate | null;
  hasEnoughHistory: boolean;
  reason?: 'no-completed-history' | 'no-rate' | 'zero-remaining';
}

export interface PredictionInput {
  remainingQuantity: number | null;
  averageDailyConsumption: number | null; // same unit as remainingQuantity
  today: IDate;
  isFinished: boolean;
}

/** We require at least one completed, non-zero-duration supply of the same product
 *  before estimating. `averageDailyConsumption` must be > 0 and finite. */
export function calculateEstimatedDaysRemaining(
  remainingQuantity: number | null,
  averageDailyConsumption: number | null,
): number | null {
  if (remainingQuantity == null || averageDailyConsumption == null) return null;
  if (!Number.isFinite(remainingQuantity) || !Number.isFinite(averageDailyConsumption)) return null;
  if (remainingQuantity < 0) return null;
  if (averageDailyConsumption <= 0) return null;
  const result = remainingQuantity / averageDailyConsumption;
  return Number.isFinite(result) ? Math.max(0, result) : null;
}

export function calculateEstimatedFinishDate(
  remainingQuantity: number | null,
  averageDailyConsumption: number | null,
  today: IDate,
  isFinished: boolean,
): PredictionResult {
  if (isFinished) {
    return { estimatedDaysRemaining: 0, estimatedFinishDate: null, hasEnoughHistory: true };
  }
  if (averageDailyConsumption == null) {
    return {
      estimatedDaysRemaining: null,
      estimatedFinishDate: null,
      hasEnoughHistory: false,
      reason: 'no-completed-history',
    };
  }
  if (remainingQuantity == null || remainingQuantity <= 0) {
    return {
      estimatedDaysRemaining: null,
      estimatedFinishDate: null,
      hasEnoughHistory: false,
      reason: 'zero-remaining',
    };
  }
  const days = calculateEstimatedDaysRemaining(remainingQuantity, averageDailyConsumption);
  if (days == null) {
    return {
      estimatedDaysRemaining: null,
      estimatedFinishDate: null,
      hasEnoughHistory: false,
      reason: 'no-rate',
    };
  }
  return {
    estimatedDaysRemaining: days,
    estimatedFinishDate: addDaysLocal(today, Math.ceil(days)),
    hasEnoughHistory: true,
  };
}

function addDaysLocal(date: IDate, days: number): IDate {
  const d = parseLocal(date);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseLocal(s: IDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// ---------- Expenses (spec §20) ----------

export interface ExpenseRecord {
  amount: number;
  date: IDate;
  category: string;
}

export function calculateMonthlyExpenses(expenses: ExpenseRecord[], month: string): number {
  return expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((sum, e) => sum + (Number.isFinite(e.amount) && e.amount > 0 ? e.amount : 0), 0);
}

export function calculateCategoryTotals(
  expenses: ExpenseRecord[],
  month: string | null,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of expenses) {
    if (month != null && !e.date.startsWith(month)) continue;
    const amount = Number.isFinite(e.amount) && e.amount > 0 ? e.amount : 0;
    totals[e.category] = (totals[e.category] ?? 0) + amount;
  }
  return totals;
}

/** Monthly spend per active cat, using the CURRENT active cat count. */
export function calculateMonthlyCostPerCat(monthlyTotal: number, activeCatCount: number): number | null {
  if (!Number.isInteger(activeCatCount) || activeCatCount <= 0) return null;
  return guardRatio(monthlyTotal, activeCatCount);
}

// ---------- Derived quantities (spec §4/§10) ----------

/** Quantity consumed so far = original - remaining. Never negative. */
export function calculateConsumedQuantity(
  originalQuantity: number,
  remainingQuantity: number | null,
): number | null {
  if (remainingQuantity == null) return null;
  if (!Number.isFinite(originalQuantity) || !Number.isFinite(remainingQuantity)) return null;
  const consumed = originalQuantity - remainingQuantity;
  if (consumed <= 0) return 0;
  // Round to 3 decimals to avoid float artifacts like 3.5999999999999996.
  return Math.round(consumed * 1000) / 1000;
}

/** Whether a completed supply has enough data to contribute to history. */
export function isHistoricalEligible(openedAt: IDate, finishedAt: IDate, quantityConsumed: number): boolean {
  const days = daysUsed(openedAt, finishedAt);
  return days != null && days > 0 && Number.isFinite(quantityConsumed) && quantityConsumed > 0;
}