// Central validation for all domain entities.
// Invalid data must be rejected BEFORE it reaches the database.

import type {
  BackupData,
  Cat,
  Expense,
  Product,
  Supply,
  UsagePeriod,
  EntityId,
  FoodType,
  UnitCode,
} from './types';
import { isValidDateString } from './dates';
import { isCountUnit, isWeightUnit, UNIT_KIND_BY_CODE } from './units';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ---------- Generic helpers ----------

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isISODateTime(v: unknown): boolean {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) && /^\d{4}-\d{2}-\d{2}T/.test(v);
}

function isEntityId(v: unknown): v is EntityId {
  return typeof v === 'string' && v.length > 0 && v.length <= 64;
}

// Record-level validators return a string[] of problems (empty = valid).
// Collecting a list (rather than throwing on first) gives better UX for forms
// and better backup-import reporting.

// ---------- Cat ----------

export function validateCat(cat: unknown): string[] {
  const problems: string[] = [];
  if (typeof cat !== 'object' || cat === null) return ['cat must be an object'];
  const c = cat as Record<string, unknown>;

  if (!isEntityId(c.id)) problems.push(`cat[${String(c.id)}]: invalid or missing id`);

  if (!isNonEmptyString(c.name)) {
    problems.push(`cat[${String(c.id)}]: name is required`);
  } else if (c.name.length > 80) {
    problems.push(`cat[${String(c.id)}]: name too long`);
  }

  if (c.dateOfBirth != null && !isValidDateString(c.dateOfBirth)) {
    problems.push(`cat[${String(c.id)}]: invalid dateOfBirth`);
  }

  if (c.weightKg != null && (!isFiniteNumber(c.weightKg) || c.weightKg <= 0 || c.weightKg > 100)) {
    problems.push(`cat[${String(c.id)}]: weightKg must be > 0 and <= 100`);
  }

  if (typeof c.isActive !== 'boolean') {
    problems.push(`cat[${String(c.id)}]: isActive must be a boolean`);
  }
  if (typeof c.isDemo !== 'boolean') {
    problems.push(`cat[${String(c.id)}]: isDemo must be a boolean`);
  }

  if (!isISODateTime(c.createdAt) || !isISODateTime(c.updatedAt)) {
    problems.push(`cat[${String(c.id)}]: createdAt/updatedAt must be ISO datetime strings`);
  }

  return problems;
}

// ---------- Product ----------

const FOOD_TYPES: FoodType[] = ['dry', 'wet', 'treat', 'other'];

export function validateProduct(product: unknown): string[] {
  const problems: string[] = [];
  if (typeof product !== 'object' || product === null) return ['product must be an object'];
  const p = product as Record<string, unknown>;

  if (!isEntityId(p.id)) problems.push(`product[${String(p.id)}]: invalid or missing id`);

  if (!isNonEmptyString(p.brand)) {
    problems.push(`product[${String(p.id)}]: brand is required`);
  }
  if (!isNonEmptyString(p.name)) {
    problems.push(`product[${String(p.id)}]: name is required`);
  }

  if (p.category !== 'food' && p.category !== 'litter') {
    problems.push(`product[${String(p.id)}]: category must be food or litter`);
  }

  if (p.category === 'food' && (typeof p.foodType !== 'string' || !FOOD_TYPES.includes(p.foodType as FoodType))) {
    problems.push(`product[${String(p.id)}]: foodType must be one of ${FOOD_TYPES.join(', ')}`);
  }
  if (p.category === 'litter' && p.foodType != null) {
    problems.push(`product[${String(p.id)}]: litter products must not have a foodType`);
  }

  if (p.unitKind !== 'weight' && p.unitKind !== 'count') {
    problems.push(`product[${String(p.id)}]: unitKind must be weight or count`);
  }

  if (!isValidUnit(p.defaultUnit)) {
    problems.push(`product[${String(p.id)}]: defaultUnit is invalid`);
  } else if (p.unitKind === 'weight' && !isWeightUnit(p.defaultUnit as UnitCode)) {
    problems.push(`product[${String(p.id)}]: defaultUnit must be a weight unit`);
  } else if (p.unitKind === 'count' && !isCountUnit(p.defaultUnit as UnitCode)) {
    problems.push(`product[${String(p.id)}]: defaultUnit must be a count unit`);
  }

  if (typeof p.isActive !== 'boolean') {
    problems.push(`product[${String(p.id)}]: isActive must be a boolean`);
  }
  if (typeof p.isDemo !== 'boolean') {
    problems.push(`product[${String(p.id)}]: isDemo must be a boolean`);
  }
  if (!isISODateTime(p.createdAt) || !isISODateTime(p.updatedAt)) {
    problems.push(`product[${String(p.id)}]: createdAt/updatedAt must be ISO datetime strings`);
  }

  return problems;
}

function isValidUnit(v: unknown): v is UnitCode {
  return v === 'g' || v === 'kg' || v === 'can' || v === 'pouch' || v === 'piece';
}

// ---------- Supply ----------

export function validateSupply(supply: unknown, productIndex: ReadonlyMap<EntityId, Product>): string[] {
  const problems: string[] = [];
  if (typeof supply !== 'object' || supply === null) return ['supply must be an object'];
  const s = supply as Record<string, unknown>;

  if (!isEntityId(s.id)) problems.push(`supply[${String(s.id)}]: invalid or missing id`);

  if (!isEntityId(s.productId)) {
    problems.push(`supply[${String(s.id)}]: missing productId`);
  } else if (!productIndex.has(s.productId)) {
    problems.push(`supply[${String(s.id)}]: broken product reference (${String(s.productId)})`);
  }

  if (!isFiniteNumber(s.quantity) || s.quantity <= 0) {
    problems.push(`supply[${String(s.id)}]: quantity must be a positive finite number`);
  }

  if (!isValidUnit(s.unit)) {
    problems.push(`supply[${String(s.id)}]: invalid unit`);
  } else {
    const product = s.productId ? productIndex.get(s.productId as EntityId) : undefined;
    if (product) {
      const productKind = UNIT_KIND_BY_CODE[product.defaultUnit];
      const supplyKind = UNIT_KIND_BY_CODE[s.unit as UnitCode];
      if (productKind !== supplyKind) {
        problems.push(
          `supply[${String(s.id)}]: unit kind (${String(s.unit)}) does not match product kind (${product.defaultUnit})`,
        );
      }
    }
  }

  if (!isFiniteNumber(s.price) || s.price < 0) {
    problems.push(`supply[${String(s.id)}]: price must be a non-negative finite number`);
  }

  const quantity = s.quantity;
  const purchaseDate = s.purchaseDate;
  const openedDate = s.openedDate;
  const finishedDate = s.finishedDate;
  const remainingQuantity = s.remainingQuantity;

  if (!isValidDateString(purchaseDate)) {
    problems.push(`supply[${String(s.id)}]: purchaseDate must be a valid date`);
  }

  if (openedDate != null) {
    if (!isValidDateString(openedDate)) {
      problems.push(`supply[${String(s.id)}]: openedDate must be a valid date`);
    } else if (typeof purchaseDate === 'string' && openedDate < purchaseDate) {
      problems.push(`supply[${String(s.id)}]: openedDate cannot be before purchaseDate`);
    }
  }

  if (finishedDate != null) {
    if (!isValidDateString(finishedDate)) {
      problems.push(`supply[${String(s.id)}]: finishedDate must be a valid date`);
    } else if (!openedDate) {
      problems.push(`supply[${String(s.id)}]: cannot be finished without an openedDate`);
    } else if (typeof openedDate === 'string' && finishedDate < openedDate) {
      problems.push(`supply[${String(s.id)}]: finishedDate cannot be before openedDate`);
    }
  }

  if (remainingQuantity != null) {
    if (!isFiniteNumber(remainingQuantity) || remainingQuantity < 0) {
      problems.push(`supply[${String(s.id)}]: remainingQuantity must be a non-negative finite number`);
    } else if (typeof quantity === 'number' && remainingQuantity > quantity) {
      problems.push(`supply[${String(s.id)}]: remainingQuantity cannot exceed original quantity`);
    }
  }

  const status = s.status;
  if (status !== 'purchased' && status !== 'opened' && status !== 'finished') {
    problems.push(`supply[${String(s.id)}]: status must be purchased, opened, or finished`);
  } else {
    if (status === 'opened' && !openedDate) {
      problems.push(`supply[${String(s.id)}]: status opened requires openedDate`);
    }
    if (status === 'finished') {
      if (!openedDate || !finishedDate) {
        problems.push(`supply[${String(s.id)}]: status finished requires openedDate and finishedDate`);
      }
      if (typeof remainingQuantity === 'number' && remainingQuantity > 0) {
        problems.push(`supply[${String(s.id)}]: finished supply must have remainingQuantity 0`);
      }
    }
    if (status === 'purchased' && openedDate != null) {
      problems.push(`supply[${String(s.id)}]: status purchased cannot have openedDate`);
    }
  }

  if (typeof s.notes !== 'string') {
    problems.push(`supply[${String(s.id)}]: notes must be a string`);
  }
  if (typeof s.isDemo !== 'boolean') {
    problems.push(`supply[${String(s.id)}]: isDemo must be a boolean`);
  }
  if (!isISODateTime(s.createdAt) || !isISODateTime(s.updatedAt)) {
    problems.push(`supply[${String(s.id)}]: createdAt/updatedAt must be ISO datetime strings`);
  }

  return problems;
}

// ---------- UsagePeriod ----------

export function validateUsagePeriod(
  period: unknown,
  supplyIndex: ReadonlyMap<EntityId, Supply>,
  catIds: ReadonlySet<EntityId>,
): string[] {
  const problems: string[] = [];
  if (typeof period !== 'object' || period === null) return ['usagePeriod must be an object'];
  const u = period as Record<string, unknown>;

  if (!isEntityId(u.id)) problems.push(`usagePeriod[${String(u.id)}]: invalid or missing id`);
  if (!isEntityId(u.supplyId)) {
    problems.push(`usagePeriod[${String(u.id)}]: missing supplyId`);
  } else if (!supplyIndex.has(u.supplyId)) {
    problems.push(`usagePeriod[${String(u.id)}]: broken supply reference (${String(u.supplyId)})`);
  }

  if (!isValidDateString(u.openedAt)) {
    problems.push(`usagePeriod[${String(u.id)}]: openedAt must be a valid date`);
  }
  if (u.finishedAt != null && !isValidDateString(u.finishedAt)) {
    problems.push(`usagePeriod[${String(u.id)}]: finishedAt must be a valid date`);
  } else if (u.finishedAt != null && u.openedAt != null && u.finishedAt < u.openedAt) {
    problems.push(`usagePeriod[${String(u.id)}]: finishedAt cannot be before openedAt`);
  }

  if (!isFiniteNumber(u.quantity) || u.quantity <= 0) {
    problems.push(`usagePeriod[${String(u.id)}]: quantity must be a positive finite number`);
  }
  if (!isValidUnit(u.unit)) {
    problems.push(`usagePeriod[${String(u.id)}]: unit is invalid`);
  }

  if (!Array.isArray(u.activeCatIds)) {
    problems.push(`usagePeriod[${String(u.id)}]: activeCatIds must be an array`);
  } else {
    for (const catId of u.activeCatIds) {
      if (typeof catId !== 'string' || !catIds.has(catId)) {
        problems.push(`usagePeriod[${String(u.id)}]: activeCatIds contains unknown cat (${String(catId)})`);
      }
    }
  }

  if (!isFiniteNumber(u.activeCatCount) || u.activeCatCount < 0 || u.activeCatCount !== Math.floor(u.activeCatCount)) {
    problems.push(`usagePeriod[${String(u.id)}]: activeCatCount must be a non-negative integer`);
  } else if (Array.isArray(u.activeCatIds) && u.activeCatCount !== u.activeCatIds.length) {
    problems.push(`usagePeriod[${String(u.id)}]: activeCatCount must equal activeCatIds.length`);
  }

  if (typeof u.isDemo !== 'boolean') {
    problems.push(`usagePeriod[${String(u.id)}]: isDemo must be a boolean`);
  }
  if (!isISODateTime(u.createdAt)) {
    problems.push(`usagePeriod[${String(u.id)}]: createdAt must be an ISO datetime string`);
  }

  return problems;
}

// ---------- Expense ----------

const EXPENSE_CATEGORY_LIST = [
  'Food',
  'Litter',
  'Treats',
  'Toys',
  'Grooming',
  'Cleaning',
  'Vet',
  'Medicine',
  'Supplies',
  'Other',
];

export function validateExpense(expense: unknown, supplyIds: ReadonlySet<EntityId>): string[] {
  const problems: string[] = [];
  if (typeof expense !== 'object' || expense === null) return ['expense must be an object'];
  const e = expense as Record<string, unknown>;

  if (!isEntityId(e.id)) problems.push(`expense[${String(e.id)}]: invalid or missing id`);

  if (typeof e.category !== 'string' || !EXPENSE_CATEGORY_LIST.includes(e.category)) {
    problems.push(`expense[${String(e.id)}]: invalid category`);
  }

  if (!isNonEmptyString(e.item)) {
    problems.push(`expense[${String(e.id)}]: item text is required`);
  }

  if (!isFiniteNumber(e.amount) || e.amount < 0) {
    problems.push(`expense[${String(e.id)}]: amount must be a non-negative finite number`);
  }

  if (!isFiniteNumber(e.quantity) || e.quantity <= 0) {
    problems.push(`expense[${String(e.id)}]: quantity must be a positive finite number`);
  }

  if (!isValidDateString(e.date)) {
    problems.push(`expense[${String(e.id)}]: date must be a valid date`);
  }

  if (e.supplyId != null) {
    if (!isEntityId(e.supplyId) || !supplyIds.has(e.supplyId)) {
      problems.push(`expense[${String(e.id)}]: broken supply reference (${String(e.supplyId)})`);
    }
  }

  if (typeof e.notes !== 'string') {
    problems.push(`expense[${String(e.id)}]: notes must be a string`);
  }
  if (typeof e.isDemo !== 'boolean') {
    problems.push(`expense[${String(e.id)}]: isDemo must be a boolean`);
  }
  if (!isISODateTime(e.createdAt) || !isISODateTime(e.updatedAt)) {
    problems.push(`expense[${String(e.id)}]: createdAt/updatedAt must be ISO datetime strings`);
  }

  return problems;
}

// ---------- Backup ----------

export function validateBackup(data: unknown): string[] {
  const problems: string[] = [];
  if (typeof data !== 'object' || data === null) {
    return ['backup must be a JSON object'];
  }
  const b = data as Record<string, unknown>;

  if (b.version !== 1) {
    problems.push(`unsupported backup version: ${String(b.version)} (expected 1)`);
  }
  if (!isISODateTime(b.exportedAt)) {
    problems.push('backup: exportedAt must be an ISO datetime string');
  }

  // Build indexes first so record validators can check references.
  const cats = Array.isArray(b.cats) ? (b.cats as Cat[]) : [];
  const products = Array.isArray(b.products) ? (b.products as Product[]) : [];
  const supplies = Array.isArray(b.supplies) ? (b.supplies as Supply[]) : [];
  const usagePeriods = Array.isArray(b.usagePeriods) ? (b.usagePeriods as UsagePeriod[]) : [];
  const expenses = Array.isArray(b.expenses) ? (b.expenses as Expense[]) : [];

  const catIds = new Set(cats.map((c) => (c as unknown as Record<string, unknown>).id as string));
  const productIndex = new Map(
    products.map((p) => [(p as unknown as Record<string, unknown>).id as string, p] as const),
  );
  const supplyIndex = new Map(
    supplies.map((s) => [(s as unknown as Record<string, unknown>).id as string, s] as const),
  );
  const supplyIds = new Set(supplyIndex.keys());

  // Duplicate ID detection across all tables.
  const seen = new Map<string, string>(); // id -> table
  const checkDuplicates = (records: unknown[], table: string) => {
    for (const r of records) {
      const id = (r as Record<string, unknown>).id;
      if (typeof id === 'string') {
        if (seen.has(id)) {
          problems.push(`duplicate id "${id}" in ${table} (also in ${seen.get(id)})`);
        } else {
          seen.set(id, table);
        }
      }
    }
  };
  checkDuplicates(cats, 'cats');
  checkDuplicates(products, 'products');
  checkDuplicates(supplies, 'supplies');
  checkDuplicates(usagePeriods, 'usagePeriods');
  checkDuplicates(expenses, 'expenses');

  for (const cat of cats) problems.push(...validateCat(cat));
  for (const product of products) problems.push(...validateProduct(product));
  for (const supply of supplies) problems.push(...validateSupply(supply, productIndex));
  for (const period of usagePeriods) problems.push(...validateUsagePeriod(period, supplyIndex, catIds));
  for (const expense of expenses) problems.push(...validateExpense(expense, supplyIds));

  if (b.settings != null) {
    if (typeof b.settings !== 'object') {
      problems.push('backup: settings must be an object or null');
    } else {
      const s = b.settings as Record<string, unknown>;
      if (s.id !== 'app') problems.push('backup: settings.id must be "app"');
      if (typeof s.currency !== 'string' || s.currency.length === 0) {
        problems.push('backup: settings.currency is required');
      }
      if (typeof s.currencySymbol !== 'string' || s.currencySymbol.length === 0) {
        problems.push('backup: settings.currencySymbol is required');
      }
      if (s.theme !== 'light' && s.theme !== 'dark' && s.theme !== 'system') {
        problems.push('backup: settings.theme must be light, dark, or system');
      }
    }
  }

  return problems;
}

export function isBackupData(data: unknown): data is BackupData {
  return validateBackup(data).length === 0;
}