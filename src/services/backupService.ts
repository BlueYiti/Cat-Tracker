// Backup/restore service. Versioned JSON format (version 1).
// Backups are validated fully BEFORE any database modification.

import { db } from '../db/database';
import type { BackupData, Cat, Expense, Product, Settings, Supply, UsagePeriod } from '../domain/types';
import { validateBackup } from '../domain/validation';

export const BACKUP_VERSION = 1;

export type ImportMode = 'merge' | 'replace';

export async function exportBackup(): Promise<string> {
  const [cats, products, supplies, usagePeriods, expenses, settings] = await Promise.all([
    db.cats.toArray(),
    db.products.toArray(),
    db.supplies.toArray(),
    db.usagePeriods.toArray(),
    db.expenses.toArray(),
    db.settings.toArray(),
  ]);

  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    cats,
    products,
    supplies,
    usagePeriods,
    expenses,
    settings: settings[0] ?? null,
  };

  return JSON.stringify(backup, null, 2);
}

export async function exportBackupData(): Promise<BackupData> {
  return JSON.parse(await exportBackup()) as BackupData;
}

/** Parse + validate a backup JSON string. Returns the parsed data or throws. */
export function parseBackup(raw: string): BackupData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  const problems = validateBackup(parsed);
  if (problems.length > 0) {
    throw new Error(`Invalid backup:\n${problems.join('\n')}`);
  }
  return parsed as BackupData;
}

/**
 * Import a backup.
 *
 * - 'replace': wipes all tables, then restores backup data. Atomic.
 * - 'merge':   re-keys records whose IDs collide with existing data, then
 *              inserts everything. Atomic.
 */
export async function importBackup(raw: string, mode: ImportMode): Promise<{ imported: number; replaced: number }> {
  const backup = parseBackup(raw);

  if (mode === 'replace') {
    await db.transaction(
      'rw',
      [db.cats, db.products, db.supplies, db.usagePeriods, db.expenses, db.settings],
      async () => {
        await Promise.all([
          db.cats.clear(),
          db.products.clear(),
          db.supplies.clear(),
          db.usagePeriods.clear(),
          db.expenses.clear(),
          db.settings.clear(),
        ]);
        await db.cats.bulkAdd(backup.cats);
        await db.products.bulkAdd(backup.products);
        await db.supplies.bulkAdd(backup.supplies);
        await db.usagePeriods.bulkAdd(backup.usagePeriods);
        await db.expenses.bulkAdd(backup.expenses);
        if (backup.settings) await db.settings.put(backup.settings);
      },
    );
    return { imported: backup.cats.length + backup.products.length + backup.supplies.length + backup.usagePeriods.length + backup.expenses.length, replaced: 0 };
  }

  // ---- Merge mode ----
  let replaced = 0;
  const collisionId = (id: string) => `merge-${Date.now().toString(36)}-${id}`;

  await db.transaction(
    'rw',
    [db.cats, db.products, db.supplies, db.usagePeriods, db.expenses, db.settings],
    async () => {
      const existingCats = new Set((await db.cats.toArray()).map((c) => c.id));
      const existingProducts = new Set((await db.products.toArray()).map((p) => p.id));
      const existingSupplies = new Set((await db.supplies.toArray()).map((s) => s.id));
      const existingPeriods = new Set((await db.usagePeriods.toArray()).map((u) => u.id));
      const existingExpenses = new Set((await db.expenses.toArray()).map((e) => e.id));

      const catMap = new Map<string, string>();
      const productMap = new Map<string, string>();
      const supplyMap = new Map<string, string>();

      const remapCat = (id: string): string => {
        if (existingCats.has(id)) {
          replaced++;
          const nid = collisionId(id);
          catMap.set(id, nid);
          return nid;
        }
        return id;
      };
      const remapProduct = (id: string): string => {
        if (existingProducts.has(id)) {
          replaced++;
          const nid = collisionId(id);
          productMap.set(id, nid);
          return nid;
        }
        return id;
      };
      const remapSupply = (id: string): string => {
        if (existingSupplies.has(id)) {
          replaced++;
          const nid = collisionId(id);
          supplyMap.set(id, nid);
          return nid;
        }
        return id;
      };

      const mappedCats: Cat[] = backup.cats.map((c) => ({ ...c, id: remapCat(c.id) }));
      const mappedProducts: Product[] = backup.products.map((p) => ({ ...p, id: remapProduct(p.id) }));
      const mappedSupplies: Supply[] = backup.supplies.map((s) => ({
        ...s,
        id: remapSupply(s.id),
        productId: productMap.get(s.productId) ?? s.productId,
      }));
      const mappedPeriods: UsagePeriod[] = backup.usagePeriods.map((u) => {
        const newSupplyId = supplyMap.get(u.supplyId) ?? u.supplyId;
        const newCatIds = u.activeCatIds.map((cid) => catMap.get(cid) ?? cid);
        return { ...u, id: existingPeriods.has(u.id) ? collisionId(u.id) : u.id, supplyId: newSupplyId, activeCatIds: newCatIds };
      });
      const mappedExpenses: Expense[] = backup.expenses.map((e) => ({
        ...e,
        id: existingExpenses.has(e.id) ? collisionId(e.id) : e.id,
        supplyId: e.supplyId ? (supplyMap.get(e.supplyId) ?? e.supplyId) : null,
      }));

      await db.cats.bulkPut(mappedCats);
      await db.products.bulkPut(mappedProducts);
      await db.supplies.bulkPut(mappedSupplies);
      await db.usagePeriods.bulkPut(mappedPeriods);
      await db.expenses.bulkPut(mappedExpenses);
      if (backup.settings) {
        const existingSettings = await db.settings.get('app');
        await db.settings.put(existingSettings ?? backup.settings);
      }
    },
  );

  const imported = backup.cats.length + backup.products.length + backup.supplies.length + backup.usagePeriods.length + backup.expenses.length;
  return { imported, replaced };
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.cats, db.products, db.supplies, db.usagePeriods, db.expenses, db.settings],
    async () => {
      await Promise.all([
        db.cats.clear(),
        db.products.clear(),
        db.supplies.clear(),
        db.usagePeriods.clear(),
        db.expenses.clear(),
        db.settings.clear(),
      ]);
    },
  );
}

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get('app');
  if (existing) return existing;
  // No settings record yet (fresh database). Return defaults so live queries
  // always emit a concrete value — useLiveQuery cannot surface `undefined`
  // results, which would leave the UI stuck in a loading state.
  return {
    id: 'app',
    currency: 'PHP',
    currencySymbol: '₱',
    theme: 'system',
    isDemoDataLoaded: false,
    updatedAt: new Date().toISOString(),
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (settings.id !== 'app') throw new Error('Settings id must be "app".');
  await db.settings.put({ ...settings, updatedAt: new Date().toISOString() });
}