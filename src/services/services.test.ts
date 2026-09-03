import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { db, CatTrackerDB } from '../db/database';
import { getActiveCats, createCat } from './catService';
import { createProduct, deleteProduct, getActiveProducts } from './productService';
import {
  createSupply,
  deleteSupply,
  finishSupply,
  openSupply,
  updateRemainingQuantity,
  getOpenSupplies,
  getFinishedSupplies,
} from './supplyService';
import { createExpense, deleteExpense } from './expenseService';
import {
  exportBackup,
  importBackup,
  clearAllData,
  parseBackup,
} from './backupService';
import { loadDemoData, removeDemoData } from '../db/seed';
import { getHistoricalStatsForProduct, getOpenSupplyStats } from './statsService';
import { todayLocal, addDays } from '../domain/dates';

function now() {
  return new Date().toISOString();
}

const T = todayLocal();

beforeAll(async () => {
  await db.open();
});

afterAll(async () => {
  db.close();
});

beforeEach(async () => {
  await clearAllData();
});

describe('cat service', () => {
  it('creates, archives, and reactivates cats', async () => {
    const cat = await createCat({ name: 'Mochi', dateOfBirth: '2024-01-01', weightKg: 4.2, photo: null });
    expect(cat.id).toBeTruthy();
    expect(cat.isActive).toBe(true);

    const cats = await getActiveCats();
    expect(cats).toHaveLength(1);
    expect(cats[0]?.name).toBe('Mochi');

    // Archive (never delete)
    await db.cats.put({ ...cat, isActive: false, updatedAt: now() });
    const active = await getActiveCats();
    expect(active).toHaveLength(0);
    expect(await db.cats.count()).toBe(1); // still present
  });
});

describe('supply lifecycle (transactional)', () => {
  it('openSupply captures active cats in the UsagePeriod snapshot', async () => {
    const cat1 = await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const cat2 = await createCat({ name: 'Luna', dateOfBirth: null, weightKg: null, photo: null });
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });

    const supply = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -3),
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    expect(supply.status).toBe('purchased');
    expect(supply.remainingQuantity).toBeNull();

    const opened = await openSupply(supply.id, addDays(T, -2));
    expect(opened.status).toBe('opened');
    expect(opened.remainingQuantity).toBe(10);

    const periods = await db.usagePeriods.toArray();
    expect(periods).toHaveLength(1);
    expect(periods[0]?.supplyId).toBe(supply.id);
    expect(periods[0]?.activeCatCount).toBe(2);
    expect(periods[0]?.activeCatIds.sort()).toEqual([cat1.id, cat2.id].sort());
    expect(periods[0]?.finishedAt).toBeNull();
  });

  it('finishSupply finalizes the UsagePeriod atomically', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    const supply = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -15),
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await openSupply(supply.id, addDays(T, -14));

    const finished = await finishSupply(supply.id, addDays(T, -3));
    expect(finished.status).toBe('finished');
    expect(finished.remainingQuantity).toBe(0);
    expect(finished.finishedDate).toBe(addDays(T, -3));

    const periods = await db.usagePeriods.toArray();
    expect(periods).toHaveLength(1);
    expect(periods[0]?.finishedAt).toBe(addDays(T, -3));

    const finishedSupplies = await getFinishedSupplies();
    expect(finishedSupplies).toHaveLength(1);
    const open = await getOpenSupplies();
    expect(open).toHaveLength(0);
  });

  it('updateRemainingQuantity never creates or modifies UsagePeriods', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    const supply = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -5),
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await openSupply(supply.id, addDays(T, -4));

    const periodsBefore = await db.usagePeriods.toArray();
    expect(periodsBefore).toHaveLength(1);

    const updated = await updateRemainingQuantity(supply.id, 6.4);
    expect(updated.remainingQuantity).toBe(6.4);
    expect(updated.status).toBe('opened'); // NOT finished
    expect(updated.finishedDate).toBeNull();

    const periodsAfter = await db.usagePeriods.toArray();
    expect(periodsAfter).toHaveLength(1); // no new period
    expect(periodsAfter[0]?.finishedAt).toBeNull(); // not finalized
    expect(periodsAfter[0]?.quantity).toBe(10); // still original; remaining is on supply only
  });

  it('rejects finishing a purchased supply (illegal transition)', async () => {
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    const supply = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: T,
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await expect(finishSupply(supply.id, T)).rejects.toThrow(/status/i);
  });

  it('rejects opened date before purchase date', async () => {
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    const supply = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: T,
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await expect(openSupply(supply.id, addDays(T, -1))).rejects.toThrow(/before/i);
  });

  it('rejects remaining > original', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    const supply = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: T,
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await openSupply(supply.id, T);
    await expect(updateRemainingQuantity(supply.id, 15)).rejects.toThrow(/exceed/i);
  });

  it('validates negative quantity on create', async () => {
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    await expect(
      createSupply({
        productId: product.id,
        quantity: -10,
        unit: 'kg',
        price: 850,
        purchaseDate: T,
        openedDate: null,
        remainingQuantity: null,
        notes: '',
      }),
    ).rejects.toThrow(/quantity/i);
  });
});

describe('supply deletion (referential cleanup)', () => {
  async function makeLitterSupply(overrides: { openedDate?: string | null; price?: number } = {}) {
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    return createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: overrides.price ?? 850,
      purchaseDate: addDays(T, -14),
      openedDate: overrides.openedDate === undefined ? addDays(T, -13) : overrides.openedDate,
      remainingQuantity: overrides.openedDate === null ? null : 10,
      notes: '',
    });
  }

  it('deletes a finished supply, its usage period, and unlinks its expense', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const supply = await makeLitterSupply();
    const expense = await createExpense({
      category: 'Litter',
      item: 'Fresh Step 10kg',
      amount: 850,
      quantity: 1,
      date: addDays(T, -14),
      supplyId: supply.id,
      notes: '',
    });
    await finishSupply(supply.id, T);
    expect(await db.usagePeriods.where('supplyId').equals(supply.id).count()).toBe(1);

    await deleteSupply(supply.id);

    // Supply and its usage history are gone.
    expect(await db.supplies.get(supply.id)).toBeUndefined();
    expect(await db.usagePeriods.where('supplyId').equals(supply.id).count()).toBe(0);
    // The linked expense survives, but is no longer linked.
    const kept = await db.expenses.get(expense.id);
    expect(kept).toBeDefined();
    expect(kept?.supplyId).toBeNull();
  });

  it('deletes a purchased (never-opened) supply with no usage period', async () => {
    const supply = await makeLitterSupply({ openedDate: null });
    expect(supply.status).toBe('purchased');

    await deleteSupply(supply.id);

    expect(await db.supplies.get(supply.id)).toBeUndefined();
    expect(await db.usagePeriods.where('supplyId').equals(supply.id).count()).toBe(0);
  });

  it('deleting an unlinked supply leaves expenses untouched', async () => {
    const supply = await makeLitterSupply({ openedDate: null });
    const expense = await createExpense({
      category: 'Toys',
      item: 'Feather wand',
      amount: 250,
      quantity: 1,
      date: T,
      supplyId: null,
      notes: '',
    });

    await deleteSupply(supply.id);

    const kept = await db.expenses.get(expense.id);
    expect(kept).toBeDefined();
    expect(kept?.supplyId).toBeNull();
  });
});

describe('product archival (referential protection)', () => {
  it('cannot delete a referenced product — it archives instead', async () => {
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: T,
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });

    const deleted = await deleteProduct(product.id);
    expect(deleted).toBe(false); // archived, not deleted

    const stillThere = await db.products.get(product.id);
    expect(stillThere).toBeDefined();
    expect(stillThere?.isActive).toBe(false);

    const active = await getActiveProducts('litter');
    expect(active).toHaveLength(0);
  });

  it('deletes an unreferenced product', async () => {
    const product = await createProduct({
      category: 'food',
      brand: 'Royal Canin',
      name: 'Kitten',
      foodType: 'dry',
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    const deleted = await deleteProduct(product.id);
    expect(deleted).toBe(true);
    expect(await db.products.get(product.id)).toBeUndefined();
  });
});

describe('stats service / historical purity', () => {
  it('only completed supplies contribute to historical averages', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });

    // Completed supply: 10kg over 10 days = 1000 g/day
    const s1 = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -25),
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await openSupply(s1.id, addDays(T, -20));
    await finishSupply(s1.id, addDays(T, -10));

    // Open supply: must NOT change history
    const s2 = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -9),
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await openSupply(s2.id, addDays(T, -8));
    await updateRemainingQuantity(s2.id, 9.5); // consumed 0.5kg in 8 days — would change avg if counted

    const stats = await getHistoricalStatsForProduct(product.id);
    expect(stats.completedSupplyCount).toBe(1);
    expect(stats.dailyHouseholdConsumption).toBe(1000); // 10000g / 10 days
    expect(stats.totalDays).toBe(10);
  });

  it('uses historical cat count, not current', async () => {
    const cat1 = await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });

    // Open with 1 active cat, then add a second cat later
    const s = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -25),
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await openSupply(s.id, addDays(T, -20));
    await createCat({ name: 'Luna', dateOfBirth: null, weightKg: null, photo: null }); // added later
    await finishSupply(s.id, addDays(T, -10));

    const period = await db.usagePeriods.where('supplyId').equals(s.id).first();
    expect(period?.activeCatCount).toBe(1); // snapshot preserved despite later cat

    const stats = await getHistoricalStatsForProduct(product.id);
    // 10000g / 10 days / 1 cat = 1000 g/cat/day
    expect(stats.dailyPerCatConsumption).toBe(1000);
    expect(cat1).toBeTruthy();
  });
});

describe('open supply predictions', () => {
  it('shows prediction when history exists', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });

    const s1 = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -25),
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await openSupply(s1.id, addDays(T, -20));
    await finishSupply(s1.id, addDays(T, -10)); // 1000 g/day

    const s2 = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -9),
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await openSupply(s2.id, addDays(T, -8));
    await updateRemainingQuantity(s2.id, 5); // 5kg left @ 1kg/day = 5 days

    const statsList = await getOpenSupplyStats(T);
    const open = statsList.find((s) => s.id === s2.id);
    expect(open).toBeDefined();
    expect(open?.hasEnoughHistory).toBe(true);
    expect(open?.estimatedDaysRemaining).toBeCloseTo(5, 1);
    expect(open?.estimatedFinishDate).toBe(addDays(T, 5));
  });

  it('does not invent prediction without history', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const product = await createProduct({
      category: 'litter',
      brand: 'New Brand',
      name: 'Fresh Product',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    const s = await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: T,
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });
    await openSupply(s.id, T);

    const statsList = await getOpenSupplyStats(T);
    const open = statsList.find((x) => x.id === s.id);
    expect(open?.hasEnoughHistory).toBe(false);
    expect(open?.estimatedDaysRemaining).toBeNull();
    expect(open?.estimatedFinishDate).toBeNull();
    expect(open?.message).toBe('Not enough history to estimate remaining days.');
  });
});

describe('expense service', () => {
  it('creates, edits, and deletes expenses', async () => {
    const exp = await createExpense({
      category: 'Food',
      item: 'Royal Canin',
      amount: 1200,
      quantity: 1,
      date: T,
      supplyId: null,
      notes: '',
    });
    expect(exp.id).toBeTruthy();

    const updated = await updateExpenseForTest(exp.id, { ...exp, amount: 1300 });
    expect(updated.amount).toBe(1300);

    await deleteExpense(exp.id);
    expect(await db.expenses.count()).toBe(0);
  });

  it('rejects negative amount', async () => {
    await expect(
      createExpense({
        category: 'Food',
        item: 'Test',
        amount: -5,
        quantity: 1,
        date: T,
        supplyId: null,
        notes: '',
      }),
    ).rejects.toThrow(/amount/i);
  });
});

async function updateExpenseForTest(id: string, expense: Parameters<typeof db.expenses.put>[0]) {
  const { updateExpense } = await import('./expenseService');
  return updateExpense(id, {
    category: expense.category,
    item: expense.item,
    amount: expense.amount,
    quantity: expense.quantity,
    date: expense.date,
    supplyId: expense.supplyId,
    notes: expense.notes,
  });
}

describe('backup service', () => {
  it('exports and imports a backup (replace)', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const raw = await exportBackup();
    const backup = parseBackup(raw);
    expect(backup.version).toBe(1);
    expect(backup.cats.length).toBe(1);

    // Modify DB after export
    await clearAllData();
    expect(await db.cats.count()).toBe(0);

    await importBackup(raw, 'replace');
    expect(await db.cats.count()).toBe(1);
    expect((await db.cats.toArray())[0]?.name).toBe('Mochi');
  });

  it('merge mode re-keys collisions and keeps both records', async () => {
    // Original data
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const backupRaw = await exportBackup();

    // Same "Mochi" added again, different id
    await createCat({ name: 'Luna', dateOfBirth: null, weightKg: null, photo: null });

    await importBackup(backupRaw, 'merge');
    expect(await db.cats.count()).toBe(3); // original Mochi + Luna + re-keyed Mochi
  });

  it('rejects corrupt JSON', async () => {
    await expect(importBackup('not json', 'replace')).rejects.toThrow(/JSON/i);
  });

  it('rejects invalid version', async () => {
    await expect(importBackup('{"version":99}', 'replace')).rejects.toThrow(/version/i);
  });

  it('rejects broken references inside backup', async () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      cats: [],
      products: [],
      supplies: [{ id: 's1', productId: 'missing' }],
      usagePeriods: [],
      expenses: [],
      settings: null,
    });
    await expect(importBackup(raw, 'replace')).rejects.toThrow(/reference/i);
  });
});

describe('demo data', () => {
  it('loads and removes demo data', async () => {
    await loadDemoData();
    expect(await db.cats.count()).toBe(4);
    expect(await db.products.count()).toBe(3);
    expect(await db.supplies.count()).toBe(9);
    expect(await db.expenses.count()).toBeGreaterThan(0);

    await removeDemoData();
    expect(await db.cats.count()).toBe(0);
    expect(await db.products.count()).toBe(0);
    expect(await db.supplies.count()).toBe(0);
  });

  it('refuses to load demo data when data exists', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    await expect(loadDemoData()).rejects.toThrow(/already contains/i);
  });
});

describe('clear all data', () => {
  it('clears everything atomically', async () => {
    await createCat({ name: 'Mochi', dateOfBirth: null, weightKg: null, photo: null });
    const product = await createProduct({
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
    });
    await createSupply({
      productId: product.id,
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: T,
      openedDate: null,
      remainingQuantity: null,
      notes: '',
    });

    await clearAllData();
    expect(await db.cats.count()).toBe(0);
    expect(await db.products.count()).toBe(0);
    expect(await db.supplies.count()).toBe(0);
    expect(await db.usagePeriods.count()).toBe(0);
    expect(await db.expenses.count()).toBe(0);
  });
});

describe('schema migration (v1 → v2 expenses.supplyId index)', () => {
  it('upgrades an existing v1 database so expenses are queryable by supplyId', async () => {
    // Build a database with the ORIGINAL v1 schema (no supplyId index).
    type LegacyTables = { expenses: { add: (record: Record<string, unknown>) => Promise<unknown> } };
    const legacy = new Dexie('legacy-upgrade-test') as Dexie & LegacyTables;
    legacy.version(1).stores({
      cats: 'id, name, createdAt',
      products: 'id, category, brand, name, createdAt',
      supplies: 'id, productId, status, purchaseDate, openedDate, finishedDate, createdAt',
      usagePeriods: 'id, supplyId, openedAt, finishedAt, createdAt',
      expenses: 'id, category, date, createdAt',
      settings: 'id',
    });
    await legacy.open();
    await legacy.expenses.add({ id: 'exp-legacy', supplyId: 'sup-x', amount: 5, category: 'Food' });
    legacy.close();

    // Reopen through the app schema, which declares v2 (adds the index).
    const upgraded = new CatTrackerDB('legacy-upgrade-test');
    await upgraded.open();

    // The query that used to throw SchemaError now works, and existing data survived.
    const linked = await upgraded.expenses.where('supplyId').equals('sup-x').toArray();
    expect(linked).toHaveLength(1);
    expect(linked[0]?.id).toBe('exp-legacy');

    upgraded.close();
  });
});