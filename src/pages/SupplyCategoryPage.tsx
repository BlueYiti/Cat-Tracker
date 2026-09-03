// Shared page for Litter and Food categories.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { ProductCategory, Supply, UnitCode } from '../domain/types';
import { getOpenSupplyStats } from '../services/statsService';
import { finishSupply, updateRemainingQuantity, deleteSupply } from '../services/supplyService';
import { formatQuantity } from '../domain/units';
import { formatDays } from '../utils/format';
import { SupplyForm } from '../components/SupplyForm';
import { EmptyState, ConfirmDialog, Modal, FieldError, StatusChip } from '../components/ui';
import { PlusIcon, EditIcon, TrashIcon } from '../components/icons';

function UpdateRemainingModal({
  supply,
  unit,
  originalQuantity,
  onClose,
  onSaved,
}: {
  supply: Supply;
  unit: UnitCode;
  originalQuantity: number;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(
    supply.remainingQuantity != null ? String(supply.remainingQuantity) : String(originalQuantity),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setError('Please enter a non-negative number.');
      return;
    }
    if (n > originalQuantity) {
      setError(`Cannot exceed original quantity (${originalQuantity} ${unit}).`);
      return;
    }
    setSaving(true);
    try {
      await updateRemainingQuantity(supply.id, n);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Update remaining" onClose={onClose}>
      <div className="form">
        <div className="field">
          <label htmlFor="updrem" className="field__label">
            Remaining quantity ({unit})
          </label>
          <input
            id="updrem"
            className="field__input"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <span className="field__hint">
            Current physical inventory estimate (max {originalQuantity} {unit}).
          </span>
        </div>
        <FieldError message={error ?? undefined} />
        <button className="btn btn--primary btn--block" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Modal>
  );
}
export function SupplyCategoryPage({ category }: { category: ProductCategory }) {
  const liveSupplies = useLiveQuery(() => db.supplies.orderBy('purchaseDate').reverse().toArray(), []);
  const liveProducts = useLiveQuery(() => db.products.toArray(), []);
  const liveOpenStats = useLiveQuery(() => getOpenSupplyStats(), []);

  const supplies = useMemo(() => liveSupplies ?? [], [liveSupplies]);
  const products = useMemo(() => liveProducts ?? [], [liveProducts]);
  const openStats = useMemo(() => liveOpenStats ?? [], [liveOpenStats]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supply | undefined>(undefined);
  const [updating, setUpdating] = useState<Supply | undefined>(undefined);
  const [confirmFinish, setConfirmFinish] = useState<Supply | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<Supply | undefined>(undefined);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p] as const)), [products]);
  const supplyById = useMemo(() => new Map(supplies.map((s) => [s.id, s] as const)), [supplies]);
  const categorySupplies = useMemo(
    () => supplies.filter((s) => productById.get(s.productId)?.category === category),
    [supplies, productById, category],
  );
  const openForCategory = openStats.filter((s) => s.product.category === category);
  const title = category === 'litter' ? 'Litter' : 'Food';

  return (
    <>
      <div className="page-head">
        <h1>{title}</h1>
        <button
          className="btn btn--sm btn--primary"
          onClick={() => {
            setEditing(undefined);
            setShowForm(true);
          }}
        >
          <PlusIcon size={16} /> Add
        </button>
      </div>

      {categorySupplies.length === 0 ? (
        <EmptyState
          emoji={category === 'litter' ? '🪣' : '🍖'}
          title={`No ${title.toLowerCase()} yet`}
          onAction={() => {
            setEditing(undefined);
            setShowForm(true);
          }}
          actionLabel={category === 'litter' ? 'Add Litter' : 'Add Food'}
        >
          Record your first purchase to start tracking consumption.
        </EmptyState>
      ) : (
        <>
          {openForCategory.length > 0 ? (
            <section className="mb-3">
              <h2 className="section-title">Open</h2>
              {openForCategory.map((stats) => {
                const supply = supplyById.get(stats.id);
                if (!supply) return null;
                return (
                  <div className="card" key={stats.id}>
                    <div className="row-item__title">
                      {stats.product.brand} {stats.product.name}
                    </div>
                    <div className="row-item__sub">
                      {formatQuantity(stats.quantity, stats.unit)} purchased
                      {stats.remainingQuantityDisplay != null
                        ? ` · ${formatQuantity(stats.remainingQuantityDisplay, stats.unit)} remaining`
                        : ''}
                    </div>
                    {stats.hasEnoughHistory && stats.estimatedDaysRemaining != null ? (
                      <div className="mt-2">
                        <div className="row-item__sub">
                          Est. usage{' '}
                          {formatQuantity(stats.historicalStats.dailyHouseholdConsumption ?? 0, stats.unit)}
                          /day · <strong>{formatDays(stats.estimatedDaysRemaining)} left</strong>
                          {stats.estimatedFinishDate ? ` · est. ${stats.estimatedFinishDate}` : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="row-item__sub mt-2">Not enough history to estimate remaining days.</div>
                    )}
                    <div className="flex-row mt-2">
                      <button className="btn btn--sm btn--secondary" onClick={() => setUpdating(supply)}>
                        Update Remaining
                      </button>
                      <button className="btn btn--sm btn--primary" onClick={() => setConfirmFinish(supply)}>
                        Mark Finished
                      </button>
                      <button
                        className="btn btn--sm btn--ghost"
                        aria-label="Edit supply"
                        onClick={() => {
                          setEditing(supply);
                          setShowForm(true);
                        }}
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        className="btn btn--sm btn--ghost"
                        aria-label="Delete open supply"
                        onClick={() => setConfirmDelete(supply)}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : (
            <div className="card mb-3">
              <div className="row-item__sub">No open supplies right now.</div>
            </div>
          )}
<section>
            <h2 className="section-title">History</h2>
            {categorySupplies.filter((s) => s.status !== 'opened').length === 0 ? (
              <div className="card">
                <div className="row-item__sub">No history yet.</div>
              </div>
            ) : (
              categorySupplies
                .filter((s) => s.status !== 'opened')
                .map((s) => {
                  const product = productById.get(s.productId);
                  return (
                    <div className="card" key={s.id}>
                      <div className="row-item__title">
                        {product ? `${product.brand} ${product.name}` : 'Unknown product'}
                      </div>
                      <div className="row-item__sub">
                        {formatQuantity(s.quantity, s.unit)} · Purchase {s.purchaseDate}
                        {s.openedDate ? ` · Opened ${s.openedDate}` : ''}
                        {s.finishedDate ? ` · Finished ${s.finishedDate}` : ''}
                        {s.status !== 'finished'
                          ? ` · ${formatQuantity(s.remainingQuantity ?? s.quantity, s.unit)} remaining`
                          : ''}
                        <StatusChip status={s.status} />
                      </div>
                      <div className="flex-row mt-2">
                        <button
                          className="btn btn--sm btn--secondary"
                          onClick={() => {
                            setEditing(s);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--sm btn--ghost"
                          aria-label="Delete supply"
                          onClick={() => setConfirmDelete(s)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </section>
        </>
      )}

      {showForm ? (
        <SupplyForm
          category={category}
          supply={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(undefined);
          }}
          onSaved={() => setEditing(undefined)}
        />
      ) : null}
      {updating ? (
        <UpdateRemainingModal
          supply={updating}
          unit={updating.unit}
          originalQuantity={updating.quantity}
          onClose={() => setUpdating(undefined)}
          onSaved={() => setUpdating(undefined)}
        />
      ) : null}
      {confirmFinish ? (
        <ConfirmDialog
          title="Mark as finished?"
          message="This finalizes the usage period. Consumption history will be updated."
          confirmLabel="Finish"
          onCancel={() => setConfirmFinish(undefined)}
          onConfirm={async () => {
            await finishSupply(confirmFinish.id);
            setConfirmFinish(undefined);
          }}
        />
      ) : null}
      {confirmDelete ? (
        <ConfirmDialog
          title="Delete supply?"
          message={
            confirmDelete.status === 'opened'
              ? 'This permanently removes the open supply and its usage history. Linked expenses will be unlinked.'
              : 'This permanently removes the supply and its usage history. Linked expenses will be unlinked.'
          }
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDelete(undefined)}
          onConfirm={async () => {
            await deleteSupply(confirmDelete.id);
            setConfirmDelete(undefined);
          }}
        />
      ) : null}
    </>
  );
}