// Dexie database setup with schema versioning.
// Schema migrations and backup-format versioning are separate concerns.

import Dexie, { type Table } from 'dexie';
import type { Cat, Expense, Product, Settings, Supply, UsagePeriod } from '../domain/types';

export class CatTrackerDB extends Dexie {
  cats!: Table<Cat, string>;
  products!: Table<Product, string>;
  supplies!: Table<Supply, string>;
  usagePeriods!: Table<UsagePeriod, string>;
  expenses!: Table<Expense, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'cat-care-tracker') {
    super(name);
    this.version(1).stores({
      cats: 'id, name, createdAt',
      products: 'id, category, brand, name, createdAt',
      supplies: 'id, productId, status, purchaseDate, openedDate, finishedDate, createdAt',
      usagePeriods: 'id, supplyId, openedAt, finishedAt, createdAt',
      expenses: 'id, category, date, createdAt',
      settings: 'id',
    });
    // v2: `supplyId` index on expenses so deleteSupply can unlink linked
    // expenses with an indexed query (where('supplyId')) instead of a
    // table scan. Dexie migrates existing rows automatically.
    this.version(2).stores({
      expenses: 'id, category, date, createdAt, supplyId',
    });
  }
}

export const db = new CatTrackerDB();

// Table groups used for multi-record transactions.
export const ALL_TABLES = [
  'cats',
  'products',
  'supplies',
  'usagePeriods',
  'expenses',
  'settings',
] as const;

export type TableName = (typeof ALL_TABLES)[number];

export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', [db.cats, db.products, db.supplies, db.usagePeriods, db.expenses, db.settings], async () => {
    await Promise.all([
      db.cats.clear(),
      db.products.clear(),
      db.supplies.clear(),
      db.usagePeriods.clear(),
      db.expenses.clear(),
      db.settings.clear(),
    ]);
  });
}
