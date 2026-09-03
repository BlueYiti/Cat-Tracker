// Realistic demo data. All records are marked isDemo: true so they can be
// removed in one tap from Settings → Data. Dates are computed relative to
// "today" so the demo always looks current.

import { db } from './database';
import { addDays, todayLocal } from '../domain/dates';
import type { Cat, Expense, Product, Settings, Supply, UsagePeriod } from '../domain/types';

const now = () => new Date().toISOString();
const T = todayLocal();

function id(prefix: string, n: number): string {
  return `demo-${prefix}-${n}`;
}

export async function loadDemoData(): Promise<void> {
  const existing = await db.cats.count();
  if (existing > 0) {
    throw new Error('Cannot load demo data: database already contains data.');
  }

  const cats: Cat[] = [
    {
      id: id('cat', 1),
      name: 'Mochi',
      dateOfBirth: addDays(T, -730),
      weightKg: 4.2,
      photo: null,
      isActive: true,
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('cat', 2),
      name: 'Luna',
      dateOfBirth: addDays(T, -540),
      weightKg: 3.8,
      photo: null,
      isActive: true,
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('cat', 3),
      name: 'Simba',
      dateOfBirth: addDays(T, -300),
      weightKg: 5.1,
      photo: null,
      isActive: true,
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('cat', 4),
      name: 'Milo',
      dateOfBirth: addDays(T, -120),
      weightKg: 2.9,
      photo: null,
      isActive: true,
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const products: Product[] = [
    {
      id: id('prod', 1),
      category: 'litter',
      brand: 'Fresh Step',
      name: 'Unscented Clumping',
      foodType: null,
      unitKind: 'weight',
      defaultUnit: 'kg',
      isActive: true,
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('prod', 2),
      category: 'food',
      brand: 'Royal Canin',
      name: 'Kitten Dry',
      foodType: 'dry',
      unitKind: 'weight',
      defaultUnit: 'kg',
      isActive: true,
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('prod', 3),
      category: 'food',
      brand: 'Whiskas',
      name: 'Wet Pouch',
      foodType: 'wet',
      unitKind: 'count',
      defaultUnit: 'pouch',
      isActive: true,
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  // Completed litter supplies — different historical cat counts.
  const litterSupplies: Supply[] = [
    {
      id: id('sup', 1),
      productId: id('prod', 1),
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -60),
      openedDate: addDays(T, -58),
      finishedDate: addDays(T, -46),
      remainingQuantity: 0,
      status: 'finished',
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('sup', 2),
      productId: id('prod', 1),
      quantity: 10,
      unit: 'kg',
      price: 850,
      purchaseDate: addDays(T, -45),
      openedDate: addDays(T, -44),
      finishedDate: addDays(T, -33),
      remainingQuantity: 0,
      status: 'finished',
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('sup', 3),
      productId: id('prod', 1),
      quantity: 10,
      unit: 'kg',
      price: 880,
      purchaseDate: addDays(T, -32),
      openedDate: addDays(T, -31),
      finishedDate: addDays(T, -19),
      remainingQuantity: 0,
      status: 'finished',
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    // Open litter supply
    {
      id: id('sup', 4),
      productId: id('prod', 1),
      quantity: 10,
      unit: 'kg',
      price: 880,
      purchaseDate: addDays(T, -18),
      openedDate: addDays(T, -17),
      finishedDate: null,
      remainingQuantity: 6.4,
      status: 'opened',
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  // Completed food supplies.
  const foodSupplies: Supply[] = [
    {
      id: id('sup', 5),
      productId: id('prod', 2),
      quantity: 5,
      unit: 'kg',
      price: 1200,
      purchaseDate: addDays(T, -70),
      openedDate: addDays(T, -68),
      finishedDate: addDays(T, -40),
      remainingQuantity: 0,
      status: 'finished',
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('sup', 6),
      productId: id('prod', 2),
      quantity: 5,
      unit: 'kg',
      price: 1200,
      purchaseDate: addDays(T, -38),
      openedDate: addDays(T, -37),
      finishedDate: addDays(T, -12),
      remainingQuantity: 0,
      status: 'finished',
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    // Open food supply
    {
      id: id('sup', 7),
      productId: id('prod', 2),
      quantity: 5,
      unit: 'kg',
      price: 1250,
      purchaseDate: addDays(T, -10),
      openedDate: addDays(T, -9),
      finishedDate: null,
      remainingQuantity: 2.0,
      status: 'opened',
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    // Wet food pouches (count-based)
    {
      id: id('sup', 8),
      productId: id('prod', 3),
      quantity: 24,
      unit: 'pouch',
      price: 480,
      purchaseDate: addDays(T, -30),
      openedDate: addDays(T, -29),
      finishedDate: addDays(T, -15),
      remainingQuantity: 0,
      status: 'finished',
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('sup', 9),
      productId: id('prod', 3),
      quantity: 24,
      unit: 'pouch',
      price: 480,
      purchaseDate: addDays(T, -14),
      openedDate: addDays(T, -13),
      finishedDate: null,
      remainingQuantity: 9,
      status: 'opened',
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const supplies = [...litterSupplies, ...foodSupplies];

  // Usage periods — capture the active cats at open time.
  // Earlier supplies: 2 cats (Mochi, Luna). Later: 4 cats.
  const usagePeriods: UsagePeriod[] = [
    {
      id: id('up', 1),
      supplyId: id('sup', 1),
      openedAt: addDays(T, -58),
      finishedAt: addDays(T, -46),
      quantity: 10,
      unit: 'kg',
      activeCatIds: [id('cat', 1), id('cat', 2)],
      activeCatCount: 2,
      isDemo: true,
      createdAt: now(),
    },
    {
      id: id('up', 2),
      supplyId: id('sup', 2),
      openedAt: addDays(T, -44),
      finishedAt: addDays(T, -33),
      quantity: 10,
      unit: 'kg',
      activeCatIds: [id('cat', 1), id('cat', 2)],
      activeCatCount: 2,
      isDemo: true,
      createdAt: now(),
    },
    {
      id: id('up', 3),
      supplyId: id('sup', 3),
      openedAt: addDays(T, -31),
      finishedAt: addDays(T, -19),
      quantity: 10,
      unit: 'kg',
      activeCatIds: [id('cat', 1), id('cat', 2), id('cat', 3), id('cat', 4)],
      activeCatCount: 4,
      isDemo: true,
      createdAt: now(),
    },
    {
      id: id('up', 4),
      supplyId: id('sup', 4),
      openedAt: addDays(T, -17),
      finishedAt: null,
      quantity: 10,
      unit: 'kg',
      activeCatIds: [id('cat', 1), id('cat', 2), id('cat', 3), id('cat', 4)],
      activeCatCount: 4,
      isDemo: true,
      createdAt: now(),
    },
    {
      id: id('up', 5),
      supplyId: id('sup', 5),
      openedAt: addDays(T, -68),
      finishedAt: addDays(T, -40),
      quantity: 5,
      unit: 'kg',
      activeCatIds: [id('cat', 1), id('cat', 2)],
      activeCatCount: 2,
      isDemo: true,
      createdAt: now(),
    },
    {
      id: id('up', 6),
      supplyId: id('sup', 6),
      openedAt: addDays(T, -37),
      finishedAt: addDays(T, -12),
      quantity: 5,
      unit: 'kg',
      activeCatIds: [id('cat', 1), id('cat', 2), id('cat', 3), id('cat', 4)],
      activeCatCount: 4,
      isDemo: true,
      createdAt: now(),
    },
    {
      id: id('up', 7),
      supplyId: id('sup', 7),
      openedAt: addDays(T, -9),
      finishedAt: null,
      quantity: 5,
      unit: 'kg',
      activeCatIds: [id('cat', 1), id('cat', 2), id('cat', 3), id('cat', 4)],
      activeCatCount: 4,
      isDemo: true,
      createdAt: now(),
    },
    {
      id: id('up', 8),
      supplyId: id('sup', 8),
      openedAt: addDays(T, -29),
      finishedAt: addDays(T, -15),
      quantity: 24,
      unit: 'pouch',
      activeCatIds: [id('cat', 1), id('cat', 2), id('cat', 3), id('cat', 4)],
      activeCatCount: 4,
      isDemo: true,
      createdAt: now(),
    },
    {
      id: id('up', 9),
      supplyId: id('sup', 9),
      openedAt: addDays(T, -13),
      finishedAt: null,
      quantity: 24,
      unit: 'pouch',
      activeCatIds: [id('cat', 1), id('cat', 2), id('cat', 3), id('cat', 4)],
      activeCatCount: 4,
      isDemo: true,
      createdAt: now(),
    },
  ];

  // Expenses across the current and previous month.
  const expenses: Expense[] = [
    {
      id: id('exp', 1),
      category: 'Litter',
      item: 'Fresh Step 10kg',
      amount: 880,
      quantity: 1,
      date: addDays(T, -18),
      supplyId: id('sup', 4),
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('exp', 2),
      category: 'Food',
      item: 'Royal Canin Kitten 5kg',
      amount: 1250,
      quantity: 1,
      date: addDays(T, -10),
      supplyId: id('sup', 7),
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('exp', 3),
      category: 'Food',
      item: 'Whiskas Wet Pouch 24-pack',
      amount: 480,
      quantity: 1,
      date: addDays(T, -14),
      supplyId: id('sup', 9),
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('exp', 4),
      category: 'Vet',
      item: 'Vaccination',
      amount: 1500,
      quantity: 1,
      date: addDays(T, -5),
      supplyId: null,
      notes: 'Annual checkup',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('exp', 5),
      category: 'Toys',
      item: 'Feather wand',
      amount: 250,
      quantity: 1,
      date: addDays(T, -3),
      supplyId: null,
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('exp', 6),
      category: 'Litter',
      item: 'Fresh Step 10kg',
      amount: 850,
      quantity: 1,
      date: addDays(T, -45),
      supplyId: id('sup', 2),
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: id('exp', 7),
      category: 'Food',
      item: 'Royal Canin Kitten 5kg',
      amount: 1200,
      quantity: 1,
      date: addDays(T, -38),
      supplyId: id('sup', 6),
      notes: '',
      isDemo: true,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const settings: Settings = {
    id: 'app',
    currency: 'PHP',
    currencySymbol: '₱',
    theme: 'system',
    isDemoDataLoaded: true,
    updatedAt: now(),
  };

  await db.transaction(
    'rw',
    [db.cats, db.products, db.supplies, db.usagePeriods, db.expenses, db.settings],
    async () => {
      await db.cats.bulkAdd(cats);
      await db.products.bulkAdd(products);
      await db.supplies.bulkAdd(supplies);
      await db.usagePeriods.bulkAdd(usagePeriods);
      await db.expenses.bulkAdd(expenses);
      await db.settings.put(settings);
    },
  );
}

export async function removeDemoData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.cats, db.products, db.supplies, db.usagePeriods, db.expenses, db.settings],
    async () => {
      await db.cats.filter((c) => c.isDemo).delete();
      await db.products.filter((p) => p.isDemo).delete();
      await db.supplies.filter((s) => s.isDemo).delete();
      await db.usagePeriods.filter((u) => u.isDemo).delete();
      await db.expenses.filter((e) => e.isDemo).delete();
      const settings = await db.settings.get('app');
      if (settings) {
        await db.settings.put({ ...settings, isDemoDataLoaded: false, updatedAt: now() });
      }
    },
  );
}