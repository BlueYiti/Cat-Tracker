// Aggregation service: turns DB records into dashboard statistics using the
// pure calculation engine. All calculations run locally.

import { db } from '../db/database';
import {
  calculateConsumedQuantity,
  calculateEstimatedFinishDate,
  calculateHistoricalStats,
  type CompletedPeriod,
  type HistoricalStats,
} from '../domain/calculations';
import { daysUsed, todayLocal } from '../domain/dates';
import type { IDate, Product, Supply } from '../domain/types';
import { isWeightUnit, toGrams, UNIT_KIND_BY_CODE } from '../domain/units';

// ---------- Supply with product ----------

export interface SupplyWithProduct extends Supply {
  product: Product;
}

export async function getOpenSuppliesWithProducts(): Promise<SupplyWithProduct[]> {
  const [openSupplies, products] = await Promise.all([
    db.supplies.where('status').equals('opened').toArray(),
    db.products.toArray(),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p] as const));
  return openSupplies
    .map((s) => ({ ...s, product: productMap.get(s.productId) }))
    .filter((s): s is SupplyWithProduct => Boolean(s.product))
    .sort((a, b) => (a.openedDate ?? '').localeCompare(b.openedDate ?? ''));
}

// ---------- Historical stats per product ----------

function emptyStats(): HistoricalStats {
  return {
    dailyHouseholdConsumption: null,
    dailyPerCatConsumption: null,
    costPerDay: null,
    costPerCatPerDay: null,
    completedSupplyCount: 0,
    totalQuantity: 0,
    totalDays: 0,
    unitKind: 'weight',
  };
}

/**
 * Weighted historical stats for a product, computed only from COMPLETED
 * supplies (status = finished). Open supplies never pollute historical
 * averages.
 *
 * Weight quantities are normalized to grams so the daily average is always
 * expressed in grams/day for weight-kind products. Count-kind quantities are
 * kept in the product's default unit.
 */
export async function getHistoricalStatsForProduct(productId: string): Promise<HistoricalStats> {
  const product = await db.products.get(productId);
  if (!product) return emptyStats();

  const supplies = await db.supplies.where('productId').equals(productId).toArray();
  const supplyById = new Map(supplies.map((s) => [s.id, s] as const));
  const periods = await db.usagePeriods.toArray();

  const completedPeriods: CompletedPeriod[] = [];

  for (const period of periods) {
    const supply = supplyById.get(period.supplyId);
    if (!supply) continue; // skip broken references (should not happen)
    if (supply.status !== 'finished') continue; // only completed history
    if (!supply.finishedDate) continue;

    const days = daysUsed(period.openedAt, supply.finishedDate);
    if (days == null || days <= 0) continue; // same-day or invalid: not eligible

    let consumed: number;
    if (supply.remainingQuantity != null) {
      const c = calculateConsumedQuantity(supply.quantity, supply.remainingQuantity);
      if (c == null) continue;
      consumed = c;
    } else {
      consumed = supply.quantity;
    }
    if (consumed <= 0) continue;

    const kind = UNIT_KIND_BY_CODE[supply.unit] ?? 'weight';

    // Normalize weight consumption to grams so ratios are unit-consistent.
    let quantityConsumed = consumed;
    if (kind === 'weight' && isWeightUnit(supply.unit)) {
      quantityConsumed = toGrams(consumed, supply.unit);
    }

    // For count kind, only aggregate supplies recorded in the product's
    // default count unit (mismatches would corrupt the average).
    if (kind === 'count' && supply.unit !== product.defaultUnit) continue;

    completedPeriods.push({
      quantityConsumed,
      days,
      unitKind: kind,
      price: supply.price,
      activeCatCount: period.activeCatCount,
    });
  }

  return calculateHistoricalStats(completedPeriods);
}

// ---------- Predictions for open supplies ----------

export interface OpenSupplyStats extends SupplyWithProduct {
  historicalStats: HistoricalStats;
  remainingQuantityDisplay: number;
  estimatedDaysRemaining: number | null;
  estimatedFinishDate: IDate | null;
  hasEnoughHistory: boolean;
  message: string | null;
}

/**
 * Stats for open supplies: remaining, historical rate, prediction.
 *
 * - Weight-kind products: historical avg is grams/day; the open supply's
 *   remaining quantity is converted to grams before predicting.
 * - Count-kind products: historical avg is in the product's default count
 *   unit; the supply must use that same unit to predict.
 */
export async function getOpenSupplyStats(today: IDate = todayLocal()): Promise<OpenSupplyStats[]> {
  const openSupplies = await getOpenSuppliesWithProducts();

  const result: OpenSupplyStats[] = [];
  for (const supply of openSupplies) {
    const stats = await getHistoricalStatsForProduct(supply.productId);
    const remaining = supply.remainingQuantity;

    let avgDaily = stats.dailyHouseholdConsumption;
    let remainingForPrediction: number | null = remaining;

    const kind = UNIT_KIND_BY_CODE[supply.unit] ?? 'weight';
    if (kind === 'weight') {
      // Convert remaining to grams to match the grams/day average.
      if (remaining != null && isWeightUnit(supply.unit)) {
        remainingForPrediction = toGrams(remaining, supply.unit);
      }
      // avgDaily is already grams/day from normalization.
    } else {
      // Count kind: prediction only valid if the unit matches the product default.
      if (supply.unit !== supply.product.defaultUnit) {
        avgDaily = null;
        remainingForPrediction = null;
      }
    }

    const prediction = calculateEstimatedFinishDate(remainingForPrediction, avgDaily, today, false);

    result.push({
      ...supply,
      product: supply.product,
      historicalStats: stats,
      remainingQuantityDisplay: remaining ?? supply.quantity,
      estimatedDaysRemaining: prediction.estimatedDaysRemaining,
      estimatedFinishDate: prediction.estimatedFinishDate,
      hasEnoughHistory: prediction.hasEnoughHistory,
      message: prediction.hasEnoughHistory
        ? null
        : prediction.reason === 'no-completed-history' || prediction.reason === 'no-rate'
          ? 'Not enough history to estimate remaining days.'
          : null,
    });
  }

  return result;
}