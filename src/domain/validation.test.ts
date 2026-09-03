import { describe, expect, it } from 'vitest';
import {
  isBackupData,
  validateBackup,
  validateCat,
  validateExpense,
  validateProduct,
  validateSupply,
  validateUsagePeriod,
} from './validation';
import type { Cat, Expense, Product, Supply, UsagePeriod } from './types';

const now = '2026-08-19T12:00:00.000Z';

function makeCat(overrides: Partial<Cat> = {}): Cat {
  return {
    id: 'cat-1',
    name: 'Mochi',
    dateOfBirth: '2024-08-19',
    weightKg: 4.2,
    photo: null,
    isActive: true,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    category: 'litter',
    brand: 'Fresh Step',
    name: 'Unscented',
    foodType: null,
    unitKind: 'weight',
    defaultUnit: 'kg',
    isActive: true,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeSupply(overrides: Partial<Supply> = {}): Supply {
  return {
    id: 'sup-1',
    productId: 'prod-1',
    quantity: 10,
    unit: 'kg',
    price: 850,
    purchaseDate: '2026-08-01',
    openedDate: '2026-08-02',
    finishedDate: null,
    remainingQuantity: 6.4,
    status: 'opened',
    notes: '',
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeUsagePeriod(overrides: Partial<UsagePeriod> = {}): UsagePeriod {
  return {
    id: 'up-1',
    supplyId: 'sup-1',
    openedAt: '2026-08-02',
    finishedAt: null,
    quantity: 10,
    unit: 'kg',
    activeCatIds: ['cat-1'],
    activeCatCount: 1,
    isDemo: false,
    createdAt: now,
    ...overrides,
  };
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    category: 'Food',
    item: 'Royal Canin',
    amount: 1200,
    quantity: 1,
    date: '2026-08-10',
    supplyId: null,
    notes: '',
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('validateCat', () => {
  it('accepts a valid cat', () => {
    expect(validateCat(makeCat())).toEqual([]);
  });

  it('rejects missing name', () => {
    expect(validateCat(makeCat({ name: '' })).length).toBeGreaterThan(0);
  });

  it('rejects invalid dateOfBirth', () => {
    expect(validateCat(makeCat({ dateOfBirth: '2026-13-99' })).length).toBeGreaterThan(0);
  });

  it('rejects negative weight', () => {
    expect(validateCat(makeCat({ weightKg: -5 })).length).toBeGreaterThan(0);
  });

  it('rejects missing isDemo', () => {
    const record: Record<string, unknown> = { ...makeCat() };
    delete record.isDemo;
    expect(validateCat(record).length).toBeGreaterThan(0);
  });
});

describe('validateProduct', () => {
  it('accepts a valid product', () => {
    expect(validateProduct(makeProduct())).toEqual([]);
  });

  it('rejects food product without foodType', () => {
    expect(validateProduct(makeProduct({ category: 'food', foodType: null })).length).toBeGreaterThan(0);
  });

  it('rejects litter product with foodType', () => {
    expect(validateProduct(makeProduct({ foodType: 'dry' })).length).toBeGreaterThan(0);
  });

  it('rejects weight product with count default unit', () => {
    expect(validateProduct(makeProduct({ unitKind: 'weight', defaultUnit: 'pouch' })).length).toBeGreaterThan(0);
  });

  it('rejects count product with weight default unit', () => {
    expect(validateProduct(makeProduct({ unitKind: 'count', defaultUnit: 'kg' })).length).toBeGreaterThan(0);
  });
});

describe('validateSupply', () => {
  const productIndex = new Map([[makeProduct().id, makeProduct()]]);

  it('accepts a valid supply', () => {
    expect(validateSupply(makeSupply(), productIndex)).toEqual([]);
  });

  it('rejects negative quantity', () => {
    expect(validateSupply(makeSupply({ quantity: -10 }), productIndex).length).toBeGreaterThan(0);
  });

  it('rejects zero quantity', () => {
    expect(validateSupply(makeSupply({ quantity: 0 }), productIndex).length).toBeGreaterThan(0);
  });

  it('rejects negative price', () => {
    expect(validateSupply(makeSupply({ price: -1 }), productIndex).length).toBeGreaterThan(0);
  });

  it('rejects finished before opened', () => {
    expect(
      validateSupply(
        makeSupply({ openedDate: '2026-08-10', finishedDate: '2026-08-05', status: 'finished', remainingQuantity: 0 }),
        productIndex,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('rejects opened before purchased', () => {
    expect(
      validateSupply(makeSupply({ purchaseDate: '2026-08-10', openedDate: '2026-08-05' }), productIndex).length,
    ).toBeGreaterThan(0);
  });

  it('rejects remaining > original', () => {
    expect(validateSupply(makeSupply({ quantity: 10, remainingQuantity: 15 }), productIndex).length).toBeGreaterThan(0);
  });

  it('rejects broken product reference', () => {
    expect(validateSupply(makeSupply({ productId: 'missing' }), productIndex).length).toBeGreaterThan(0);
  });

  it('rejects unit kind mismatch', () => {
    expect(validateSupply(makeSupply({ unit: 'pouch' }), productIndex).length).toBeGreaterThan(0);
  });

  it('rejects finished supply with remaining > 0', () => {
    expect(
      validateSupply(
        makeSupply({ status: 'finished', finishedDate: '2026-08-15', remainingQuantity: 2 }),
        productIndex,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('rejects purchased supply with openedDate', () => {
    expect(validateSupply(makeSupply({ status: 'purchased', openedDate: '2026-08-02' }), productIndex).length).toBeGreaterThan(0);
  });
});

describe('validateUsagePeriod', () => {
  const supplyIndex = new Map([[makeSupply().id, makeSupply()]]);
  const catIds = new Set(['cat-1']);

  it('accepts a valid period', () => {
    expect(validateUsagePeriod(makeUsagePeriod(), supplyIndex, catIds)).toEqual([]);
  });

  it('rejects broken supply reference', () => {
    expect(validateUsagePeriod(makeUsagePeriod({ supplyId: 'missing' }), supplyIndex, catIds).length).toBeGreaterThan(0);
  });

  it('rejects unknown cat in activeCatIds', () => {
    expect(
      validateUsagePeriod(makeUsagePeriod({ activeCatIds: ['ghost'] }), supplyIndex, catIds).length,
    ).toBeGreaterThan(0);
  });

  it('rejects activeCatCount mismatch', () => {
    expect(
      validateUsagePeriod(makeUsagePeriod({ activeCatIds: ['cat-1'], activeCatCount: 2 }), supplyIndex, catIds).length,
    ).toBeGreaterThan(0);
  });

  it('rejects finished before opened', () => {
    expect(
      validateUsagePeriod(makeUsagePeriod({ openedAt: '2026-08-10', finishedAt: '2026-08-05' }), supplyIndex, catIds)
        .length,
    ).toBeGreaterThan(0);
  });
});

describe('validateExpense', () => {
  const supplyIds = new Set(['sup-1']);

  it('accepts a valid expense', () => {
    expect(validateExpense(makeExpense(), supplyIds)).toEqual([]);
  });

  it('rejects negative amount', () => {
    expect(validateExpense(makeExpense({ amount: -100 }), supplyIds).length).toBeGreaterThan(0);
  });

  it('rejects zero quantity', () => {
    expect(validateExpense(makeExpense({ quantity: 0 }), supplyIds).length).toBeGreaterThan(0);
  });

  it('rejects invalid date', () => {
    expect(validateExpense(makeExpense({ date: '2026-13-01' }), supplyIds).length).toBeGreaterThan(0);
  });

  it('rejects broken supply reference', () => {
    expect(validateExpense(makeExpense({ supplyId: 'missing' }), supplyIds).length).toBeGreaterThan(0);
  });

  it('rejects invalid category', () => {
    expect(validateExpense(makeExpense({ category: 'Nope' as Expense['category'] }), supplyIds).length).toBeGreaterThan(0);
  });
});

describe('validateBackup', () => {
  function makeBackup() {
    const cat = makeCat();
    const product = makeProduct();
    const supply = makeSupply();
    const period = makeUsagePeriod();
    const expense = makeExpense();
    return {
      version: 1 as const,
      exportedAt: now,
      cats: [cat],
      products: [product],
      supplies: [supply],
      usagePeriods: [period],
      expenses: [expense],
      settings: {
        id: 'app' as const,
        currency: 'PHP',
        currencySymbol: '₱',
        theme: 'system' as const,
        isDemoDataLoaded: false,
        updatedAt: now,
      },
    };
  }

  it('accepts a valid backup', () => {
    expect(validateBackup(makeBackup())).toEqual([]);
    expect(isBackupData(makeBackup())).toBe(true);
  });

  it('rejects wrong version', () => {
    const backup = makeBackup() as Record<string, unknown>;
    backup.version = 2;
    expect(validateBackup(backup).length).toBeGreaterThan(0);
  });

  it('rejects non-object', () => {
    expect(validateBackup(null).length).toBeGreaterThan(0);
    expect(validateBackup('string').length).toBeGreaterThan(0);
  });

  it('rejects duplicate IDs across tables', () => {
    const backup = makeBackup();
    backup.expenses = [{ ...makeExpense(), id: 'cat-1' }];
    expect(validateBackup(backup).some((p) => p.includes('duplicate id'))).toBe(true);
  });

  it('rejects broken references', () => {
    const backup = makeBackup();
    backup.supplies = [{ ...makeSupply(), productId: 'missing-product' }];
    expect(validateBackup(backup).some((p) => p.includes('broken product reference'))).toBe(true);
  });

  it('rejects corrupted records', () => {
    const backup = makeBackup();
    backup.cats = [{ ...makeCat(), name: '' }];
    expect(validateBackup(backup).length).toBeGreaterThan(0);
  });
});