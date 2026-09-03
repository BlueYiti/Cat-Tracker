// Expense entry form.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Expense, ExpenseCategory } from '../domain/types';
import { EXPENSE_CATEGORIES } from '../domain/types';
import { createExpense, updateExpense } from '../services/expenseService';
import { todayLocal } from '../domain/dates';
import { Modal, FieldError } from './ui';

interface Props {
  expense?: Expense;
  onClose: () => void;
  onSaved?: () => void;
}

export function ExpenseForm({ expense, onClose, onSaved }: Props) {
  const supplies = useLiveQuery(() => db.supplies.orderBy('purchaseDate').reverse().toArray(), []) ?? [];
  const products = useLiveQuery(() => db.products.toArray(), []) ?? [];

  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'Food');
  const [item, setItem] = useState(expense?.item ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [quantity, setQuantity] = useState(expense ? String(expense.quantity) : '1');
  const [date, setDate] = useState(expense?.date ?? todayLocal());
  const [supplyId, setSupplyId] = useState(expense?.supplyId ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const productById = new Map(products.map((p) => [p.id, p] as const));
  const supplyLabel = (sid: string) => {
    const s = supplies.find((x) => x.id === sid);
    if (!s) return '';
    const p = productById.get(s.productId);
    return p ? `${p.brand} ${p.name} (${s.purchaseDate})` : `Supply ${s.purchaseDate}`;
  };

  async function handleSave() {
    setError(null);
    const amt = Number(amount);
    const qty = Number(quantity);

    if (!item.trim()) {
      setError('Please enter an item description.');
      return;
    }
    if (!Number.isFinite(amt) || amt < 0) {
      setError('Amount must be zero or a positive number.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }
    if (!date) {
      setError('Please select a date.');
      return;
    }

    setSaving(true);
    try {
      const input = {
        category,
        item: item.trim(),
        amount: amt,
        quantity: qty,
        date,
        supplyId: supplyId || null,
        notes: notes.trim(),
      };
      if (expense) {
        await updateExpense(expense.id, input);
      } else {
        await createExpense(input);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={expense ? 'Edit Expense' : 'Add Expense'} onClose={onClose}>
      <div className="form">
        <div className="field">
          <label htmlFor="expcat" className="field__label">Category</label>
          <select id="expcat" className="field__select" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="expitem" className="field__label">Item</label>
          <input id="expitem" className="field__input" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Royal Canin 5kg" />
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="expamt" className="field__label">Amount</label>
            <input id="expamt" className="field__input" type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="field">
            <label htmlFor="expoqty" className="field__label">Quantity</label>
            <input id="expoqty" className="field__input" type="number" inputMode="decimal" min="1" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="expdate" className="field__label">Date</label>
          <input id="expdate" className="field__input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="expsupply" className="field__label">Linked supply (optional)</label>
          <select id="expsupply" className="field__select" value={supplyId} onChange={(e) => setSupplyId(e.target.value)}>
            <option value="">None</option>
            {supplies.map((s) => (
              <option key={s.id} value={s.id}>{supplyLabel(s.id)}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="expnotes" className="field__label">Notes</label>
          <input id="expnotes" className="field__input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <FieldError message={error ?? undefined} />

        <button className="btn btn--primary btn--block" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}