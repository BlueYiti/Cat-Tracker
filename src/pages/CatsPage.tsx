// Cats page: add, edit, archive, reactivate.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Cat, IDate } from '../domain/types';
import { createCat, updateCat, archiveCat, reactivateCat } from '../services/catService';
import { formatDate, todayLocal } from '../domain/dates';
import { EmptyState, ConfirmDialog, Modal, FieldError } from '../components/ui';
import { PlusIcon, EditIcon, ArchiveIcon } from '../components/icons';

function CatForm({
  cat,
  onClose,
  onSaved,
}: {
  cat?: Cat;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [name, setName] = useState(cat?.name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(cat?.dateOfBirth ?? '');
  const [weightKg, setWeightKg] = useState(cat?.weightKg != null ? String(cat.weightKg) : '');
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError('Please enter a name.');
      return;
    }
    let weight: number | null = null;
    if (weightKg.trim()) {
      weight = Number(weightKg);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
        setError('Weight must be between 0 and 100 kg.');
        return;
      }
    }
    const input = {
      name,
      dateOfBirth: (dateOfBirth || null) as IDate | null,
      weightKg: weight,
    };
    try {
      if (cat) {
        await updateCat(cat.id, { ...input, photo: cat.photo });
      } else {
        await createCat({ ...input, photo: null });
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save cat.');
    }
  }

  return (
    <Modal title={cat ? 'Edit Cat' : 'Add Cat'} onClose={onClose}>
      <div className="form">
        <div className="field">
          <label htmlFor="catname" className="field__label">Name</label>
          <input id="catname" className="field__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mochi" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="catdob" className="field__label">Date of birth</label>
          <input id="catdob" className="field__input" type="date" max={todayLocal()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="catwt" className="field__label">Weight (kg)</label>
          <input id="catwt" className="field__input" type="number" inputMode="decimal" min="0" step="any" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="e.g. 4.2" />
        </div>
        <FieldError message={error ?? undefined} />
        <button className="btn btn--primary btn--block" onClick={handleSave}>Save</button>
      </div>
    </Modal>
  );
}

export function CatsPage() {
  const cats = useLiveQuery(() => db.cats.orderBy('name').toArray(), []) ?? [];
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cat | undefined>(undefined);
  const [confirmArchive, setConfirmArchive] = useState<Cat | undefined>(undefined);

  const active = cats.filter((c) => c.isActive);
  const archived = cats.filter((c) => !c.isActive);

  return (
    <>
      <div className="page-head">
        <h1>Cats</h1>
        <button className="btn btn--sm btn--primary" onClick={() => { setEditing(undefined); setShowForm(true); }}>
          <PlusIcon size={16} /> Add Cat
        </button>
      </div>

      {cats.length === 0 ? (
        <EmptyState emoji="🐱" title="No cats yet" onAction={() => { setEditing(undefined); setShowForm(true); }} actionLabel="Add Cat">
          Add your cats to start tracking household consumption.
        </EmptyState>
      ) : (
        <>
          {active.length > 0 ? (
            <section className="mb-3">
              <h2 className="section-title">Active</h2>
              <div className="card">
                <div className="row-list">
                  {active.map((c) => (
                    <div className="row-item" key={c.id}>
                      <div className="row-item__main">
                        <div className="row-item__title">{c.name}</div>
                        <div className="row-item__sub">
                          {c.weightKg != null ? `${c.weightKg} kg` : ''}
                          {c.dateOfBirth ? ` · Born ${formatDate(c.dateOfBirth)}` : ''}
                        </div>
                      </div>
                      <div className="row-item__actions">
                        <button className="btn btn--sm btn--ghost" aria-label={`Edit ${c.name}`} onClick={() => { setEditing(c); setShowForm(true); }}>
                          <EditIcon size={16} />
                        </button>
                        <button className="btn btn--sm btn--ghost" aria-label={`Archive ${c.name}`} onClick={() => setConfirmArchive(c)}>
                          <ArchiveIcon size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {archived.length > 0 ? (
            <section>
              <h2 className="section-title">Archived</h2>
              <div className="card">
                <div className="row-list">
                  {archived.map((c) => (
                    <div className="row-item" key={c.id}>
                      <div className="row-item__main">
                        <div className="row-item__title">{c.name}</div>
                      </div>
                      <div className="row-item__actions">
                        <button className="btn btn--sm btn--secondary" onClick={() => reactivateCat(c.id)}>
                          Reactivate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {showForm ? (
        <CatForm
          cat={editing}
          onClose={() => { setShowForm(false); setEditing(undefined); }}
          onSaved={() => { setEditing(undefined); }}
        />
      ) : null}

      {confirmArchive ? (
        <ConfirmDialog
          title="Archive cat?"
          message={`${confirmArchive.name} will no longer appear as an active cat. Historical records are preserved.`}
          confirmLabel="Archive"
          danger
          onCancel={() => setConfirmArchive(undefined)}
          onConfirm={async () => {
            await archiveCat(confirmArchive.id);
            setConfirmArchive(undefined);
          }}
        />
      ) : null}
    </>
  );
}