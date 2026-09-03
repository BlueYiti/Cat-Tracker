// Settings page: preferences, backup/restore, CSV export, demo data, danger zone.

import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { ThemeMode } from '../domain/types';
import { getSettings, saveSettings, exportBackup, importBackup, parseBackup, clearAllData } from '../services/backupService';
import { loadDemoData, removeDemoData } from '../db/seed';
import { catsToCsv, expensesToCsv, productsToCsv, suppliesToCsv } from '../services/csvService';
import { downloadTextFile } from '../utils/download';
import { todayLocal } from '../domain/dates';
import { Modal, ConfirmDialog } from '../components/ui';

type CsvKind = 'expenses' | 'supplies' | 'cats' | 'products';

export function SettingsPage() {
  const settings = useLiveQuery(() => getSettings(), []);
  const hasAnyData = useLiveQuery(
    async () => (await db.cats.count()) > 0 || (await db.products.count()) > 0,
    [],
  );

  const [currency, setCurrency] = useState('PHP');
  const [currencySymbol, setCurrencySymbol] = useState('₱');
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [dirty, setDirty] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ raw: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const [confirmDemoRemove, setConfirmDemoRemove] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const isDemoLoaded = settings?.isDemoDataLoaded === true;

  useEffect(() => {
    if (settings && !dirty) {
      setCurrency(settings.currency);
      setCurrencySymbol(settings.currencySymbol);
      setTheme(settings.theme);
    }
  }, [settings, dirty]);

  async function handleSaveSettings() {
    setError(null);
    setSavedMessage(null);
    const cleanedCurrency = currency.trim() || 'PHP';
    const cleanedSymbol = currencySymbol.trim() || '₱';
    try {
      await saveSettings({
        id: 'app',
        currency: cleanedCurrency,
        currencySymbol: cleanedSymbol,
        theme,
        isDemoDataLoaded: isDemoLoaded,
        updatedAt: new Date().toISOString(),
      });
      setDirty(false);
      setSavedMessage('Settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings.');
    }
  }

  async function handleExportBackup() {
    setError(null);
    setReport(null);
    try {
      const raw = await exportBackup();
      downloadTextFile(`cat-care-backup-${todayLocal()}.json`, raw, 'application/json');
      setReport('Backup exported.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export backup.');
    }
  }

  function handleImportFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result ?? '');
        parseBackup(raw); // throws if invalid — validated before any DB change
        setPendingImport({ raw, name: file.name });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid backup file.');
      }
    };
    reader.onerror = () => setError('Could not read the selected file.');
    reader.readAsText(file);
  }

  async function runImport(mode: 'merge' | 'replace') {
    if (!pendingImport) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const result = await importBackup(pendingImport.raw, mode);
      setPendingImport(null);
      setReport(
        `Imported ${result.imported} records${result.replaced > 0 ? ` · ${result.replaced} re-keyed to avoid collisions` : ''}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }
async function handleLoadDemo() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      await loadDemoData();
      setReport('Demo data loaded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo data.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveDemo() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      await removeDemoData();
      setReport('Demo data removed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove demo data.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      await clearAllData();
      setConfirmClear(false);
      setReport('All data cleared.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear data.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExportCsv(kind: CsvKind) {
    setError(null);
    setReport(null);
    try {
      let filename = '';
      let content = '';
      if (kind === 'cats') {
        content = catsToCsv(await db.cats.toArray());
        filename = 'cats.csv';
      } else if (kind === 'products') {
        content = productsToCsv(await db.products.toArray());
        filename = 'products.csv';
      } else if (kind === 'supplies') {
        const [supplies, products] = await Promise.all([db.supplies.toArray(), db.products.toArray()]);
        content = suppliesToCsv(supplies, new Map(products.map((p) => [p.id, p] as const)));
        filename = 'supplies.csv';
      } else {
        content = expensesToCsv(await db.expenses.toArray());
        filename = 'expenses.csv';
      }
      downloadTextFile(filename, content, 'text/csv;charset=utf-8');
      setReport(`${filename} exported.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export CSV.');
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      {error ? (
        <div className="card mb-3">
          <span className="field__error" role="alert">
            {error}
          </span>
        </div>
      ) : null}
      {report ? (
        <div className="card mb-3">
          <div className="row-item__sub">{report}</div>
        </div>
      ) : null}

      <section className="mb-3">
        <h2 className="section-title">Preferences</h2>
        <div className="card">
          <div className="form">
            <div className="form-row">
              <div className="field">
                <label htmlFor="cur" className="field__label">
                  Currency code
                </label>
                <input
                  id="cur"
                  className="field__input"
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="e.g. PHP"
                />
              </div>
              <div className="field">
                <label htmlFor="cursym" className="field__label">
                  Currency symbol
                </label>
                <input
                  id="cursym"
                  className="field__input"
                  value={currencySymbol}
                  onChange={(e) => {
                    setCurrencySymbol(e.target.value);
                    setDirty(true);
                  }}
                  placeholder="e.g. ₱"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="theme" className="field__label">
                Theme
              </label>
              <select
                id="theme"
                className="field__select"
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value as ThemeMode);
                  setDirty(true);
                }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <button className="btn btn--primary" onClick={handleSaveSettings} disabled={busy}>
              Save settings
            </button>
            {savedMessage ? <span className="field__hint">{savedMessage}</span> : null}
          </div>
        </div>
      </section>
<section className="mb-3">
        <h2 className="section-title">Data</h2>
        <div className="card">
          <div className="flex-row">
            <button className="btn btn--secondary" onClick={handleExportBackup} disabled={busy}>
              Export Backup
            </button>
            <button className="btn btn--secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              Import Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFileSelected}
              aria-label="Choose a backup file to import"
            />
          </div>
          <div className="section-title mt-3">Export CSV</div>
          <div className="flex-row">
            <button className="btn btn--sm btn--secondary" onClick={() => handleExportCsv('expenses')} disabled={busy}>
              Expenses
            </button>
            <button className="btn btn--sm btn--secondary" onClick={() => handleExportCsv('supplies')} disabled={busy}>
              Supplies
            </button>
            <button className="btn btn--sm btn--secondary" onClick={() => handleExportCsv('cats')} disabled={busy}>
              Cats
            </button>
            <button className="btn btn--sm btn--secondary" onClick={() => handleExportCsv('products')} disabled={busy}>
              Products
            </button>
          </div>
        </div>
      </section>

      <section className="mb-3">
        <h2 className="section-title">Demo data</h2>
        <div className="card">
          <p className="row-item__sub mb-2">
            Demo data shows realistic consumption stats and predictions. It is clearly marked and can be
            removed at any time.
          </p>
          <div className="flex-row">
            {isDemoLoaded ? (
              <button
                className="btn btn--sm btn--secondary"
                onClick={() => setConfirmDemoRemove(true)}
                disabled={busy}
              >
                Remove demo data
              </button>
            ) : (
              <button
                className="btn btn--sm btn--secondary"
                onClick={handleLoadDemo}
                disabled={busy || hasAnyData === true}
              >
                Load demo data
              </button>
            )}
          </div>
          {!isDemoLoaded && hasAnyData === true ? (
            <p className="field__hint mt-2">Demo data can only be loaded on an empty database.</p>
          ) : null}
        </div>
      </section>

      <section className="mb-3">
        <h2 className="section-title">Danger zone</h2>
        <div className="card">
          <p className="row-item__sub mb-2">
            Permanently deletes ALL local data, including cats, products, supplies, usage history, expenses,
            and settings.
          </p>
          <button className="btn btn--danger" onClick={() => setConfirmClear(true)} disabled={busy}>
            Clear All Data
          </button>
        </div>
      </section>

      <section>
        <h2 className="section-title">About</h2>
        <div className="card">
          <div className="row-item__sub">
            Cat Care Tracker v1.0.0 — Offline-first household tracker for cat food, litter, and expenses. All data
            stays on this device.
          </div>
        </div>
      </section>

      {pendingImport ? (
        <Modal title={`Import "${pendingImport.name}"?`} onClose={() => setPendingImport(null)}>
          <p>The backup was validated successfully. Choose how to import:</p>
          <div className="flex-row mt-3">
            <button className="btn btn--secondary" onClick={() => setPendingImport(null)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={() => runImport('merge')} disabled={busy}>
              Merge
            </button>
            <button className="btn btn--danger" onClick={() => runImport('replace')} disabled={busy}>
              Replace
            </button>
          </div>
          <p className="field__hint mt-2">
            Merge keeps existing data and re-keys colliding records. Replace wipes current data first.
          </p>
        </Modal>
      ) : null}

      {confirmDemoRemove ? (
        <ConfirmDialog
          title="Remove demo data?"
          message="This removes all demo-marked records. Your own records are kept."
          confirmLabel="Remove"
          onCancel={() => setConfirmDemoRemove(false)}
          onConfirm={async () => {
            setConfirmDemoRemove(false);
            await handleRemoveDemo();
          }}
        />
      ) : null}

      {confirmClear ? (
        <ConfirmDialog
          title="Clear all data?"
          message="This permanently deletes ALL local data. This cannot be undone. Consider exporting a backup first."
          confirmLabel="Clear all"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={handleClearAll}
        />
      ) : null}
    </>
  );
}