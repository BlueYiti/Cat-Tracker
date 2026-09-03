import { describe, expect, it } from 'vitest';
import {
  catsToCsv,
  escapeCsvCell,
  expensesToCsv,
  productsToCsv,
  suppliesToCsv,
  toCsv,
} from './csvService';
import type { Cat, Expense, Product, Supply } from '../domain/types';

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

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    category: 'Food',
    item: 'Royal Canin, Kitten',
    amount: 1200,
    quantity: 1,
    date: '2026-08-10',
    supplyId: null,
    notes: 'line one\nline two',
    isDemo: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('escapeCsvCell', () => {
  it('passes plain values through', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell(42)).toBe('42');
    expect(escapeCsvCell(true)).toBe('true');
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });

  it('quotes values containing commas, quotes, or newlines', () => {
    expect(escapeCsvCell('has, comma')).toBe('"has, comma"');
    expect(escapeCsvCell('has "quote"')).toBe('"has ""quote"""');
    expect(escapeCsvCell('has\nnewline')).toBe('"has\nnewline"');
  });
});

describe('toCsv', () => {
  it('emits headers followed by rows with CRLF endings', () => {
    const csv = toCsv(
      [
        [1, 'a'],
        [2, 'b'],
      ],
      ['id', 'letter'],
    );
    expect(csv).toBe('id,letter\r\n1,a\r\n2,b');
  });

  it('works without headers', () => {
    expect(toCsv([['x']])).toBe('x');
  });
});

describe('catsToCsv', () => {
  it('includes header and a row', () => {
    const csv = catsToCsv([makeCat()]);
    expect(csv).toContain('id,name,dateOfBirth,weightKg,status,isDemo,createdAt,updatedAt');
    expect(csv).toContain(`cat-1,Mochi,2024-08-19,4.2,active,false,${now},${now}`);
  });

  it('labels archived cats', () => {
    const csv = catsToCsv([makeCat({ isActive: false })]);
    expect(csv).toContain('archived');
  });
});

describe('productsToCsv', () => {
  it('includes header and a row', () => {
    const csv = productsToCsv([makeProduct()]);
    expect(csv).toContain('id,category,brand,name,foodType,unitKind,defaultUnit,status,isDemo,createdAt,updatedAt');
    expect(csv).toContain(`prod-1,litter,Fresh Step,Unscented,,weight,kg,active,false,${now},${now}`);
  });
});

describe('suppliesToCsv', () => {
  it('includes header and a row', () => {
    const csv = suppliesToCsv([makeSupply()]);
    expect(csv).toContain('id,productId,product,quantity,unit,price,purchaseDate,openedDate,finishedDate,remainingQuantity,status,notes,isDemo,createdAt,updatedAt');
    expect(csv).toContain(`sup-1,prod-1,,10,kg,850,2026-08-01,2026-08-02,,6.4,opened,,false,${now},${now}`);
  });

  it('resolves product names when a product map is provided', () => {
    const products = new Map([[makeProduct().id, makeProduct()]]);
    const csv = suppliesToCsv([makeSupply()], products);
    expect(csv).toContain('Fresh Step Unscented');
  });

  it('escapes notes with newlines', () => {
    const csv = suppliesToCsv([makeSupply({ notes: 'a\nb' })]);
    expect(csv).toContain('"a\nb"');
  });
});

describe('expensesToCsv', () => {
  it('includes header and a row with CSV-safe quoting', () => {
    const csv = expensesToCsv([makeExpense()]);
    expect(csv).toContain('id,category,item,amount,quantity,date,supplyId,notes,isDemo,createdAt,updatedAt');
    expect(csv).toContain(`exp-1,Food,"Royal Canin, Kitten",1200,1,2026-08-10,,`);
    expect(csv).toContain('"line one\nline two"');
  });

  it('handles empty arrays with just a header', () => {
    expect(expensesToCsv([])).toBe('id,category,item,amount,quantity,date,supplyId,notes,isDemo,createdAt,updatedAt');
  });
});