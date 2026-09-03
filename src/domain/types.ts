// Domain entity types for Cat Care Tracker.

export type EntityId = string;

export type IDate = string; // local date string "YYYY-MM-DD" — no timezone shifting
export type ISODateTime = string; // new Date().toISOString()

// ---------- Cats ----------

export type CatPhoto = { dataUrl: string; updatedAt: ISODateTime } | null;

export interface Cat {
  id: EntityId;
  name: string;
  dateOfBirth: IDate | null;
  weightKg: number | null;
  photo: CatPhoto;
  isActive: boolean;
  isDemo: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------- Products ----------

export type ProductCategory = 'food' | 'litter';
export type FoodType = 'dry' | 'wet' | 'treat' | 'other';
export type UnitKind = 'weight' | 'count';
export type WeightUnitCode = 'g' | 'kg';
export type CountUnitCode = 'can' | 'pouch' | 'piece';

export type UnitCode = WeightUnitCode | CountUnitCode;

export interface Product {
  id: EntityId;
  category: ProductCategory;
  brand: string;
  name: string;
  foodType: FoodType | null; // only for food
  unitKind: UnitKind;
  defaultUnit: UnitCode;
  isActive: boolean; // archived products = isActive false (never deleted if referenced)
  isDemo: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------- Supplies ----------

export type SupplyStatus = 'purchased' | 'opened' | 'finished';

export interface Supply {
  id: EntityId;
  productId: EntityId;
  quantity: number; // in product.defaultUnit
  unit: UnitCode;
  price: number; // >= 0
  purchaseDate: IDate;
  openedDate: IDate | null;
  finishedDate: IDate | null;
  remainingQuantity: number | null;
  status: SupplyStatus;
  notes: string;
  isDemo: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------- Usage history ----------

export interface UsagePeriod {
  id: EntityId;
  supplyId: EntityId;
  openedAt: IDate;
  finishedAt: IDate | null; // set when supply finished
  quantity: number; // the supply's original quantity in its unit
  unit: UnitCode;
  activeCatIds: EntityId[];
  activeCatCount: number;
  isDemo: boolean;
  createdAt: ISODateTime;
}

// ---------- Expenses ----------

export type ExpenseCategory =
  | 'Food'
  | 'Litter'
  | 'Treats'
  | 'Toys'
  | 'Grooming'
  | 'Cleaning'
  | 'Vet'
  | 'Medicine'
  | 'Supplies'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
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

export interface Expense {
  id: EntityId;
  category: ExpenseCategory;
  item: string;
  amount: number; // >= 0
  quantity: number; // >= 1 when supplied, else 1
  date: IDate;
  supplyId: EntityId | null;
  notes: string;
  isDemo: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ---------- Settings ----------

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Settings {
  id: 'app';
  currency: string; // e.g. "PHP"
  currencySymbol: string; // e.g. "₱"
  theme: ThemeMode;
  isDemoDataLoaded: boolean;
  updatedAt: ISODateTime;
}

// ---------- Backup ----------

export interface BackupData {
  version: 1;
  exportedAt: ISODateTime;
  cats: Cat[];
  products: Product[];
  supplies: Supply[];
  usagePeriods: UsagePeriod[];
  expenses: Expense[];
  settings: Settings | null;
}