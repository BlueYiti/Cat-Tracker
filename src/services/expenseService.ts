// Expense CRUD service.

import { db } from '../db/database';
import type { Expense, ExpenseCategory, IDate } from '../domain/types';
import { validateExpense } from '../domain/validation';
import { newId } from './id';

export interface ExpenseInput {
  category: ExpenseCategory;
  item: string;
  amount: number;
  quantity: number;
  date: IDate;
  supplyId: string | null;
  notes: string;
}

function now(): string {
  return new Date().toISOString();
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const expense: Expense = {
    id: newId(),
    category: input.category,
    item: input.item.trim(),
    amount: input.amount,
    quantity: input.quantity,
    date: input.date,
    supplyId: input.supplyId,
    notes: input.notes,
    isDemo: false,
    createdAt: now(),
    updatedAt: now(),
  };

  const supplyIds = new Set((await db.supplies.toArray()).map((s) => s.id));
  const problems = validateExpense(expense, supplyIds);
  if (problems.length > 0) throw new Error(problems.join('; '));

  await db.expenses.add(expense);
  return expense;
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Expense> {
  const existing = await db.expenses.get(id);
  if (!existing) throw new Error(`Expense not found: ${id}`);

  const updated: Expense = {
    ...existing,
    category: input.category,
    item: input.item.trim(),
    amount: input.amount,
    quantity: input.quantity,
    date: input.date,
    supplyId: input.supplyId,
    notes: input.notes,
    updatedAt: now(),
  };

  const supplyIds = new Set((await db.supplies.toArray()).map((s) => s.id));
  const problems = validateExpense(updated, supplyIds);
  if (problems.length > 0) throw new Error(problems.join('; '));

  await db.expenses.put(updated);
  return updated;
}

export async function deleteExpense(id: string): Promise<void> {
  await db.expenses.delete(id);
}

export async function getExpense(id: string): Promise<Expense | undefined> {
  return db.expenses.get(id);
}

export async function getAllExpenses(): Promise<Expense[]> {
  return db.expenses.orderBy('date').reverse().toArray();
}

export async function getExpensesByMonth(month: string): Promise<Expense[]> {
  return db.expenses.filter((e) => e.date.startsWith(month)).sortBy('date');
}