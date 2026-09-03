// CSV export service. Pure functions that turn domain records into
// spreadsheet-friendly CSV strings (RFC 4180-style escaping).
//
// All functions are unit-testable and do not touch IndexedDB.

import type { Cat, Expense, Product, Supply } from '../domain/types';

/** Escape a single cell: quote when it contains a comma, quote, or line break. */
export function escapeCsvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Join rows into a CSV document using CRLF line endings. */
export function toCsv(rows: unknown[][], headers?: string[]): string {
  const all = headers ? [headers, ...rows] : rows;
  return all.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

export function catsToCsv(cats: Cat[]): string {
  return toCsv(
    cats.map((c) => [
      c.id,
      c.name,
      c.dateOfBirth,
      c.weightKg,
      c.isActive ? 'active' : 'archived',
      c.isDemo,
      c.createdAt,
      c.updatedAt,
    ]),
    ['id', 'name', 'dateOfBirth', 'weightKg', 'status', 'isDemo', 'createdAt', 'updatedAt'],
  );
}

export function productsToCsv(products: Product[]): string {
  return toCsv(
    products.map((p) => [
      p.id,
      p.category,
      p.brand,
      p.name,
      p.foodType ?? '',
      p.unitKind,
      p.defaultUnit,
      p.isActive ? 'active' : 'archived',
      p.isDemo,
      p.createdAt,
      p.updatedAt,
    ]),
    ['id', 'category', 'brand', 'name', 'foodType', 'unitKind', 'defaultUnit', 'status', 'isDemo', 'createdAt', 'updatedAt'],
  );
}

export function suppliesToCsv(supplies: Supply[], productById?: ReadonlyMap<string, Product>): string {
  return toCsv(
    supplies.map((s) => {
      const product = productById?.get(s.productId);
      return [
        s.id,
        s.productId,
        product ? `${product.brand} ${product.name}` : '',
        s.quantity,
        s.unit,
        s.price,
        s.purchaseDate,
        s.openedDate,
        s.finishedDate,
        s.remainingQuantity,
        s.status,
        s.notes,
        s.isDemo,
        s.createdAt,
        s.updatedAt,
      ];
    }),
    [
      'id',
      'productId',
      'product',
      'quantity',
      'unit',
      'price',
      'purchaseDate',
      'openedDate',
      'finishedDate',
      'remainingQuantity',
      'status',
      'notes',
      'isDemo',
      'createdAt',
      'updatedAt',
    ],
  );
}

export function expensesToCsv(expenses: Expense[]): string {
  return toCsv(
    expenses.map((e) => [
      e.id,
      e.category,
      e.item,
      e.amount,
      e.quantity,
      e.date,
      e.supplyId,
      e.notes,
      e.isDemo,
      e.createdAt,
      e.updatedAt,
    ]),
    ['id', 'category', 'item', 'amount', 'quantity', 'date', 'supplyId', 'notes', 'isDemo', 'createdAt', 'updatedAt'],
  );
}