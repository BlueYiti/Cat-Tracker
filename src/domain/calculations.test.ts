import { describe, expect, it } from 'vitest';
import {
  calculateCategoryTotals,
  calculateConsumedQuantity,
  calculateCostPerCatPerDay,
  calculateCostPerDay,
  calculateDailyConsumption,
  calculateDaysUsed,
  calculateEstimatedDaysRemaining,
  calculateEstimatedFinishDate,
  calculateHistoricalStats,
  calculateMonthlyCostPerCat,
  calculateMonthlyExpenses,
  calculatePerCatConsumption,
} from './calculations';

describe('calculateDaysUsed', () => {
  it('returns days between opened and finished', () => {
    expect(calculateDaysUsed('2026-08-01', '2026-08-14')).toBe(13);
  });

  it('returns 0 for same-day usage', () => {
    expect(calculateDaysUsed('2026-08-01', '2026-08-01')).toBe(0);
  });

  it('returns null when finished before opened', () => {
    expect(calculateDaysUsed('2026-08-14', '2026-08-01')).toBeNull();
  });

  it('returns null for invalid dates', () => {
    expect(calculateDaysUsed('not-a-date', '2026-08-01')).toBeNull();
    expect(calculateDaysUsed('2026-08-01', '2026-13-99')).toBeNull();
  });

  it('handles month boundaries', () => {
    expect(calculateDaysUsed('2026-07-31', '2026-08-01')).toBe(1);
    expect(calculateDaysUsed('2026-02-28', '2026-03-01')).toBe(1);
  });
});

describe('calculateDailyConsumption', () => {
  it('computes household daily consumption', () => {
    expect(calculateDailyConsumption(10000, 12)).toBeCloseTo(833.333, 2);
  });

  it('returns null for zero days (same-day)', () => {
    expect(calculateDailyConsumption(10000, 0)).toBeNull();
  });

  it('returns null for negative days', () => {
    expect(calculateDailyConsumption(10000, -5)).toBeNull();
  });

  it('returns null for negative quantity', () => {
    expect(calculateDailyConsumption(-100, 5)).toBeNull();
  });

  it('never returns NaN or Infinity', () => {
    expect(calculateDailyConsumption(NaN, 5)).toBeNull();
    expect(calculateDailyConsumption(100, Infinity)).toBeNull();
    expect(calculateDailyConsumption(Infinity, 5)).toBeNull();
  });
});

describe('calculatePerCatConsumption', () => {
  it('divides household rate by cat count', () => {
    expect(calculatePerCatConsumption(833.333, 4)).toBeCloseTo(208.333, 2);
  });

  it('returns null for zero cats', () => {
    expect(calculatePerCatConsumption(833.333, 0)).toBeNull();
  });

  it('returns null for negative cats', () => {
    expect(calculatePerCatConsumption(833.333, -2)).toBeNull();
  });

  it('returns null for null household rate', () => {
    expect(calculatePerCatConsumption(null, 4)).toBeNull();
  });
});

describe('calculateCostPerDay', () => {
  it('computes cost per day', () => {
    expect(calculateCostPerDay(850, 12)).toBeCloseTo(70.833, 2);
  });

  it('returns null for zero days', () => {
    expect(calculateCostPerDay(850, 0)).toBeNull();
  });

  it('returns null for negative price', () => {
    expect(calculateCostPerDay(-850, 12)).toBeNull();
  });
});

describe('calculateCostPerCatPerDay', () => {
  it('computes cost per cat per day', () => {
    expect(calculateCostPerCatPerDay(850, 12, 4)).toBeCloseTo(17.708, 2);
  });

  it('returns null for zero cats', () => {
    expect(calculateCostPerCatPerDay(850, 12, 0)).toBeNull();
  });

  it('returns null for zero days', () => {
    expect(calculateCostPerCatPerDay(850, 0, 4)).toBeNull();
  });
});

describe('calculateHistoricalStats (weighted)', () => {
  it('prefers ΣQ/ΣD over mean of rates', () => {
    const stats = calculateHistoricalStats([
      { quantityConsumed: 10000, days: 12, unitKind: 'weight', price: 850, activeCatCount: 2 },
      { quantityConsumed: 10000, days: 11, unitKind: 'weight', price: 850, activeCatCount: 2 },
      { quantityConsumed: 10000, days: 13, unitKind: 'weight', price: 880, activeCatCount: 4 },
    ]);
    // Total 30000g / 36 days = 833.33 g/day
    expect(stats.dailyHouseholdConsumption).toBeCloseTo(833.333, 2);
    expect(stats.completedSupplyCount).toBe(3);
    expect(stats.totalDays).toBe(36);
  });

  it('computes per-cat using cat-days', () => {
    const stats = calculateHistoricalStats([
      { quantityConsumed: 10000, days: 12, unitKind: 'weight', price: 850, activeCatCount: 2 },
      { quantityConsumed: 10000, days: 12, unitKind: 'weight', price: 850, activeCatCount: 4 },
    ]);
    // 20000g / (12*2 + 12*4) = 20000/72 = 277.78 g/cat/day
    expect(stats.dailyPerCatConsumption).toBeCloseTo(277.778, 2);
  });

  it('returns nulls for empty input', () => {
    const stats = calculateHistoricalStats([]);
    expect(stats.dailyHouseholdConsumption).toBeNull();
    expect(stats.dailyPerCatConsumption).toBeNull();
    expect(stats.completedSupplyCount).toBe(0);
  });

  it('filters out zero-day periods', () => {
    const stats = calculateHistoricalStats([
      { quantityConsumed: 10000, days: 0, unitKind: 'weight', price: 850, activeCatCount: 2 },
      { quantityConsumed: 5000, days: 5, unitKind: 'weight', price: 400, activeCatCount: 2 },
    ]);
    expect(stats.completedSupplyCount).toBe(1);
    expect(stats.dailyHouseholdConsumption).toBe(1000);
  });

  it('never outputs NaN/Infinity', () => {
    const stats = calculateHistoricalStats([
      { quantityConsumed: NaN, days: 5, unitKind: 'weight', price: 850, activeCatCount: 2 },
      { quantityConsumed: 10000, days: Infinity, unitKind: 'weight', price: 850, activeCatCount: 2 },
    ]);
    expect(stats.dailyHouseholdConsumption).toBeNull();
    expect(stats.dailyPerCatConsumption).toBeNull();
    expect(stats.costPerDay).toBeNull();
    expect(stats.costPerCatPerDay).toBeNull();
  });
});

describe('calculateEstimatedDaysRemaining', () => {
  it('computes days remaining', () => {
    expect(calculateEstimatedDaysRemaining(6400, 833.333)).toBeCloseTo(7.68, 2);
  });

  it('returns null for null remaining', () => {
    expect(calculateEstimatedDaysRemaining(null, 833.333)).toBeNull();
  });

  it('returns null for null average', () => {
    expect(calculateEstimatedDaysRemaining(6400, null)).toBeNull();
  });

  it('returns null for zero average', () => {
    expect(calculateEstimatedDaysRemaining(6400, 0)).toBeNull();
  });

  it('returns null for negative average', () => {
    expect(calculateEstimatedDaysRemaining(6400, -10)).toBeNull();
  });

  it('returns null for negative remaining', () => {
    expect(calculateEstimatedDaysRemaining(-100, 833.333)).toBeNull();
  });

  it('returns 0 for zero remaining', () => {
    expect(calculateEstimatedDaysRemaining(0, 833.333)).toBe(0);
  });
});

describe('calculateEstimatedFinishDate', () => {
  it('computes finish date from today', () => {
    const result = calculateEstimatedFinishDate(6400, 800, '2026-08-19', false);
    expect(result.hasEnoughHistory).toBe(true);
    expect(result.estimatedDaysRemaining).toBe(8);
    expect(result.estimatedFinishDate).toBe('2026-08-27');
  });

  it('reports insufficient history when no average', () => {
    const result = calculateEstimatedFinishDate(6400, null, '2026-08-19', false);
    expect(result.hasEnoughHistory).toBe(false);
    expect(result.estimatedDaysRemaining).toBeNull();
    expect(result.estimatedFinishDate).toBeNull();
    expect(result.reason).toBe('no-completed-history');
  });

  it('reports zero-remaining when nothing left', () => {
    const result = calculateEstimatedFinishDate(0, 800, '2026-08-19', false);
    expect(result.hasEnoughHistory).toBe(false);
    expect(result.reason).toBe('zero-remaining');
  });

  it('handles finished supplies', () => {
    const result = calculateEstimatedFinishDate(0, null, '2026-08-19', true);
    expect(result.hasEnoughHistory).toBe(true);
    expect(result.estimatedDaysRemaining).toBe(0);
  });

  it('never invents a prediction without history', () => {
    const result = calculateEstimatedFinishDate(6400, null, '2026-08-19', false);
    expect(result.estimatedFinishDate).toBeNull();
  });
});

describe('calculateMonthlyExpenses', () => {
  const expenses = [
    { amount: 100, date: '2026-08-01', category: 'Food' },
    { amount: 200, date: '2026-08-15', category: 'Litter' },
    { amount: 300, date: '2026-07-31', category: 'Food' },
    { amount: -50, date: '2026-08-20', category: 'Toys' },
    { amount: NaN, date: '2026-08-21', category: 'Other' },
  ];

  it('sums only expenses in the month', () => {
    expect(calculateMonthlyExpenses(expenses, '2026-08')).toBe(300);
  });

  it('returns 0 for empty month', () => {
    expect(calculateMonthlyExpenses(expenses, '2026-09')).toBe(0);
  });

  it('ignores negative and NaN amounts', () => {
    expect(calculateMonthlyExpenses(expenses, '2026-08')).toBe(300);
  });
});

describe('calculateCategoryTotals', () => {
  const expenses = [
    { amount: 100, date: '2026-08-01', category: 'Food' },
    { amount: 200, date: '2026-08-15', category: 'Litter' },
    { amount: 300, date: '2026-07-31', category: 'Food' },
  ];

  it('totals by category for a month', () => {
    const totals = calculateCategoryTotals(expenses, '2026-08');
    expect(totals.Food).toBe(100);
    expect(totals.Litter).toBe(200);
    expect(totals.Toys).toBeUndefined();
  });

  it('totals across all months when month is null', () => {
    const totals = calculateCategoryTotals(expenses, null);
    expect(totals.Food).toBe(400);
    expect(totals.Litter).toBe(200);
  });
});

describe('calculateMonthlyCostPerCat', () => {
  it('divides by active cat count', () => {
    expect(calculateMonthlyCostPerCat(4850, 4)).toBeCloseTo(1212.5, 2);
  });

  it('returns null for zero cats', () => {
    expect(calculateMonthlyCostPerCat(4850, 0)).toBeNull();
  });
});

describe('calculateConsumedQuantity', () => {
  it('computes consumed = original - remaining', () => {
    expect(calculateConsumedQuantity(10, 6.4)).toBe(3.6);
  });

  it('returns null when remaining is null', () => {
    expect(calculateConsumedQuantity(10, null)).toBeNull();
  });

  it('never returns negative', () => {
    expect(calculateConsumedQuantity(10, 15)).toBe(0);
  });
});