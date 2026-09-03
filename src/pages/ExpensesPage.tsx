// Expenses page: add, edit, delete, filter, sort, monthly and category totals.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Expense, ExpenseCategory } from '../domain/types';
import { EXPENSE_CATEGORIES } from '../domain/types';
import { getSettings } from '../services/backupService';
import { deleteExpense } from '../services/expenseService';
import { calculateCategoryTotals, calculateMonthlyExpenses } from '../domain/calculations';
import { formatDate, formatMonth, monthKey } from '../domain/dates';
import { formatMoney } from '../utils/format';
import { ExpenseForm } from '../components/ExpenseForm';
import { EmptyState, ConfirmDialog } from '../components/ui';
import { PlusIcon, EditIcon, TrashIcon } from '../components/icons';

type SortMode = 'newest' | 'oldest';

export function ExpensesPage() {
  const liveExpenses = useLiveQuery(() => db.expenses.toArray(), []);
  const liveSupplies = useLiveQuery(() => db.supplies.toArray(), []);
  const liveProducts = useLiveQuery(() => db.products.toArray(), []);
  const settings = useLiveQuery(() => getSettings(), []);

  const expenses = useMemo(() => liveExpenses ?? [], [liveExpenses]);
  const supplies = useMemo(() => liveSupplies ?? [], [liveSupplies]);
  const products = useMemo(() => liveProducts ?? [], [liveProducts]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<Expense | undefined>(undefined);
  const [month, setMonth] = useState<string>('');
  const [category, setCategory] = useState<'all' | ExpenseCategory>('all');
  const [sort, setSort] = useState<SortMode>('newest');

  const symbol = settings?.currencySymbol ?? '₱';

  const months = useMemo(() => {
    const set = new Set(expenses.map((e) => monthKey(e.date)));
    return [...set].sort().reverse();
  }, [expenses]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p] as const)), [products]);

  const visible = useMemo(() => {
    const filtered = expenses.filter((e) => {
      if (month && monthKey(e.date) !== month) return false;
      if (category !== 'all' && e.category !== category) return false;
      return true;
    });
    return [...filtered].sort((a, b) =>
      sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    );
  }, [expenses, month, category, sort]);

  const total = useMemo(() => {
    if (month === '') {
      return expenses.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0);
    }
    return calculateMonthlyExpenses(expenses, month);
  }, [expenses, month]);

  const categoryTotals = useMemo(
    () => calculateCategoryTotals(expenses, month === '' ? null : month),
    [expenses, month],
  );

  const supplyLabel = (sid: string | null): string => {
    if (!sid) return '';
    const s = supplies.find((x) => x.id === sid);
    if (!s) return '';
    const p = productById.get(s.productId);
    return p ? `${p.brand} ${p.name} (${s.purchaseDate})` : `Supply ${s.purchaseDate}`;
  };

  const sortedTotals = Object.entries(categoryTotals)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="page-head">
        <h1>Expenses</h1>
        <button
          className="btn btn--sm btn--primary"
          onClick={() => {
            setEditing(undefined);
            setShowForm(true);
          }}
        >
          <PlusIcon size={16} /> Add Expense
        </button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          emoji="💸"
          title="No expenses yet"
          onAction={() => {
            setEditing(undefined);
            setShowForm(true);
          }}
          actionLabel="Add Expense"
        >
          Record cat purchases to see where your money goes.
        </EmptyState>
      ) : (
        <>
          <div className="card mb-3">
            <div className="stat-card__value">{formatMoney(total, symbol)}</div>
            <div className="row-item__sub">
              {month === '' ? 'Total across all time' : `Total for ${formatMonth(month)}`}
            </div>
            {sortedTotals.length > 0 ? (
              <div className="mt-2">
                {sortedTotals.map(([cat, amount]) => (
                  <div className="flex-row" key={cat} style={{ justifyContent: 'space-between' }}>
                    <span className="row-item__sub">{cat}</span>
                    <span className="row-item__sub">{formatMoney(amount, symbol)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
<div className="card mb-3">
            <div className="form-row">
              <div className="field">
                <label htmlFor="expmonth" className="field__label">
                  Month
                </label>
                <select id="expmonth" className="field__select" value={month} onChange={(e) => setMonth(e.target.value)}>
                  <option value="">All time</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {formatMonth(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="expcat" className="field__label">
                  Category
                </label>
                <select
                  id="expcat"
                  className="field__select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'all' | ExpenseCategory)}
                >
                  <option value="all">All</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-row mt-2">
              <button
                className={`btn btn--sm ${sort === 'newest' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setSort('newest')}
              >
                Newest first
              </button>
              <button
                className={`btn btn--sm ${sort === 'oldest' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setSort('oldest')}
              >
                Oldest first
              </button>
            </div>
          </div>

          <section>
            <h2 className="section-title">All expenses</h2>
            {visible.length === 0 ? (
              <div className="card">
                <div className="row-item__sub">No expenses match this filter.</div>
              </div>
            ) : (
              visible.map((e) => (
                <div className="card" key={e.id}>
                  <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="row-item__title">{e.item}</div>
                      <div className="row-item__sub">
                        {e.category} · {formatDate(e.date)}
                      </div>
                      {supplyLabel(e.supplyId) ? (
                        <div className="row-item__sub">{supplyLabel(e.supplyId)}</div>
                      ) : null}
                      {e.notes ? <div className="row-item__sub">{e.notes}</div> : null}
                    </div>
                    <div className="flex-row" style={{ flexShrink: 0 }}>
                      <div className="row-item__title">{formatMoney(e.amount, symbol)}</div>
                      <button
                        className="btn btn--sm btn--ghost"
                        aria-label={`Edit ${e.item}`}
                        onClick={() => {
                          setEditing(e);
                          setShowForm(true);
                        }}
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        className="btn btn--sm btn--ghost"
                        aria-label={`Delete ${e.item}`}
                        onClick={() => setConfirmDelete(e)}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      {showForm ? (
        <ExpenseForm
          expense={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(undefined);
          }}
          onSaved={() => setEditing(undefined)}
        />
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          title="Delete expense?"
          message={`${confirmDelete.item} (${formatMoney(confirmDelete.amount, symbol)}) will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(undefined)}
          onConfirm={async () => {
            await deleteExpense(confirmDelete.id);
            setConfirmDelete(undefined);
          }}
        />
      ) : null}
    </>
  );
}