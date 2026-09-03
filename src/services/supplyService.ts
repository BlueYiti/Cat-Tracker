// Supply lifecycle service.
//
// State machine: purchased → opened → finished
//
// - Opening a supply captures the currently active cats into a UsagePeriod
//   (historical snapshot — never recalculated later).
// - Finishing a supply finalizes that UsagePeriod.
// - Updating remainingQuantity only touches the supply record. It never
//   creates or modifies UsagePeriods, and never implies "finished".
//
// All multi-record operations run inside Dexie transactions.

import { db } from '../db/database';
import { todayLocal } from '../domain/dates';
import type { IDate, Supply, UnitCode, UsagePeriod } from '../domain/types';
import { validateSupply } from '../domain/validation';
import { newId } from './id';

function now(): string {
  return new Date().toISOString();
}

export interface SupplyInput {
  productId: string;
  quantity: number;
  unit: UnitCode;
  price: number;
  purchaseDate: IDate;
  openedDate: IDate | null;
  remainingQuantity: number | null;
  notes: string;
}

export async function createSupply(input: SupplyInput): Promise<Supply> {
  const product = await db.products.get(input.productId);
  if (!product) throw new Error(`Product not found: ${input.productId}`);

  const supply: Supply = {
    id: newId(),
    productId: input.productId,
    quantity: input.quantity,
    unit: input.unit,
    price: input.price,
    purchaseDate: input.purchaseDate,
    openedDate: input.openedDate,
    finishedDate: null,
    remainingQuantity: input.openedDate != null ? input.remainingQuantity : null,
    status: input.openedDate != null ? 'opened' : 'purchased',
    notes: input.notes,
    isDemo: false,
    createdAt: now(),
    updatedAt: now(),
  };

  const problems = validateSupply(supply, new Map([[product.id, product]]));
  if (problems.length > 0) throw new Error(problems.join('; '));

  await db.transaction('rw', [db.supplies, db.usagePeriods, db.cats], async () => {
    await db.supplies.add(supply);
    if (supply.status === 'opened' && supply.openedDate) {
      const period = await buildUsagePeriod(supply);
      await db.usagePeriods.add(period);
    }
  });

  return supply;
}

export async function updateSupply(id: string, input: SupplyInput): Promise<Supply> {
  const existing = await db.supplies.get(id);
  if (!existing) throw new Error(`Supply not found: ${id}`);
  const product = await db.products.get(input.productId);
  if (!product) throw new Error(`Product not found: ${input.productId}`);

  // Editing a supply that was already opened/finished: keep lifecycle dates.
  const wasOpened = existing.status !== 'purchased';
  const wasFinished = existing.status === 'finished';

  const supply: Supply = {
    ...existing,
    productId: input.productId,
    quantity: input.quantity,
    unit: input.unit,
    price: input.price,
    purchaseDate: input.purchaseDate,
    openedDate: wasOpened ? existing.openedDate : input.openedDate,
    finishedDate: wasFinished ? existing.finishedDate : null,
    remainingQuantity: wasFinished ? 0 : input.remainingQuantity,
    status: wasFinished ? 'finished' : wasOpened ? 'opened' : input.openedDate != null ? 'opened' : 'purchased',
    notes: input.notes,
    updatedAt: now(),
  };

  const problems = validateSupply(supply, new Map([[product.id, product]]));
  if (problems.length > 0) throw new Error(problems.join('; '));

  await db.transaction('rw', [db.supplies, db.usagePeriods], async () => {
    await db.supplies.put(supply);
    // If this supply was opened and has a UsagePeriod, keep it in sync with
    // the supply's dates/quantity (but never the cat snapshot).
    const period = await db.usagePeriods.where('supplyId').equals(id).first();
    if (period && supply.openedDate) {
      await db.usagePeriods.put({
        ...period,
        openedAt: supply.openedDate,
        finishedAt: supply.finishedDate,
        quantity: supply.quantity,
        unit: supply.unit,
      });
    }
  });

  return supply;
}

/** Open a purchased supply. Captures active cats into a UsagePeriod atomically. */
export async function openSupply(id: string, openedDate: IDate = todayLocal()): Promise<Supply> {
  const supply = await db.supplies.get(id);
  if (!supply) throw new Error(`Supply not found: ${id}`);
  if (supply.status !== 'purchased') {
    throw new Error(`Cannot open a supply with status "${supply.status}". Only "purchased" supplies can be opened.`);
  }
  if (openedDate < supply.purchaseDate) {
    throw new Error('Opened date cannot be before purchase date.');
  }

  const updated: Supply = {
    ...supply,
    openedDate,
    status: 'opened',
    remainingQuantity: supply.remainingQuantity ?? supply.quantity,
    updatedAt: now(),
  };

  await db.transaction('rw', [db.supplies, db.usagePeriods, db.cats], async () => {
    await db.supplies.put(updated);
    const period = await buildUsagePeriod(updated);
    await db.usagePeriods.add(period);
  });

  return updated;
}

/** Finish an opened supply. Finalizes its UsagePeriod atomically. */
export async function finishSupply(id: string, finishedDate: IDate = todayLocal()): Promise<Supply> {
  const supply = await db.supplies.get(id);
  if (!supply) throw new Error(`Supply not found: ${id}`);
  if (supply.status !== 'opened') {
    throw new Error(`Cannot finish a supply with status "${supply.status}". Only "opened" supplies can be finished.`);
  }
  if (!supply.openedDate) {
    throw new Error('Supply has no opened date.');
  }
  if (finishedDate < supply.openedDate) {
    throw new Error('Finished date cannot be before opened date.');
  }

  const updated: Supply = {
    ...supply,
    finishedDate,
    remainingQuantity: 0,
    status: 'finished',
    updatedAt: now(),
  };

  await db.transaction('rw', [db.supplies, db.usagePeriods, db.cats], async () => {
    await db.supplies.put(updated);
    const period = await db.usagePeriods.where('supplyId').equals(id).first();
    if (period) {
      await db.usagePeriods.put({ ...period, finishedAt: finishedDate });
    } else {
      // Safety: if a period is missing (e.g. legacy data), create one.
      const rebuilt = await buildUsagePeriod(updated);
      await db.usagePeriods.add({ ...rebuilt, finishedAt: finishedDate });
    }
  });

  return updated;
}

/**
 * Update the user's current physical inventory estimate.
 * This NEVER creates or modifies UsagePeriods and NEVER implies finished.
 */
export async function updateRemainingQuantity(id: string, remainingQuantity: number): Promise<Supply> {
  const supply = await db.supplies.get(id);
  if (!supply) throw new Error(`Supply not found: ${id}`);
  if (supply.status !== 'opened') {
    throw new Error(`Only opened supplies can have their remaining quantity updated (status: "${supply.status}").`);
  }
  if (!Number.isFinite(remainingQuantity) || remainingQuantity < 0) {
    throw new Error('Remaining quantity must be a non-negative finite number.');
  }
  if (remainingQuantity > supply.quantity) {
    throw new Error('Remaining quantity cannot exceed the original quantity.');
  }

  const updated: Supply = {
    ...supply,
    remainingQuantity,
    updatedAt: now(),
  };

  await db.supplies.put(updated);
  return updated;
}

export async function deleteSupply(id: string): Promise<void> {
  await db.transaction('rw', [db.supplies, db.usagePeriods, db.expenses], async () => {
    await db.usagePeriods.where('supplyId').equals(id).delete();
    await db.expenses.where('supplyId').equals(id).modify((expense) => {
      expense.supplyId = null;
    });
    await db.supplies.delete(id);
  });
}

export async function getSupply(id: string): Promise<Supply | undefined> {
  return db.supplies.get(id);
}

export async function getSuppliesByProduct(productId: string): Promise<Supply[]> {
  return db.supplies.where('productId').equals(productId).sortBy('purchaseDate');
}

export async function getOpenSupplies(): Promise<Supply[]> {
  return db.supplies.where('status').equals('opened').sortBy('openedDate');
}

export async function getFinishedSupplies(): Promise<Supply[]> {
  return db.supplies.where('status').equals('finished').sortBy('finishedDate');
}

export async function getAllSupplies(): Promise<Supply[]> {
  return db.supplies.orderBy('purchaseDate').reverse().toArray();
}

async function buildUsagePeriod(supply: Supply): Promise<UsagePeriod> {
  const activeCats = await db.cats.filter((c) => c.isActive).toArray();
  const activeCatIds = activeCats.map((c) => c.id);
  return {
    id: newId(),
    supplyId: supply.id,
    openedAt: supply.openedDate ?? todayLocal(),
    finishedAt: null,
    quantity: supply.quantity,
    unit: supply.unit,
    activeCatIds,
    activeCatCount: activeCatIds.length,
    isDemo: supply.isDemo,
    createdAt: now(),
  };
}