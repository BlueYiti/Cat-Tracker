// First-run welcome page. Offers demo data or a fresh start.

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { loadDemoData } from '../db/seed';

export function WelcomePage() {
  const hasData = useLiveQuery(async () => (await db.cats.count()) > 0, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleLoadDemo() {
    setLoading(true);
    setError(null);
    try {
      await loadDemoData();
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo data.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="welcome">
      <div className="welcome__hero" aria-hidden="true">
        🐱
      </div>
      <h1>Welcome to Cat Care Tracker</h1>
      <p>
        Track food, litter, expenses, and supplies — all offline, right on this device. See how much you spend
        and when you are likely to run out.
      </p>
      <div className="welcome__actions">
        <button className="btn btn--primary btn--block" onClick={handleLoadDemo} disabled={loading || hasData === true}>
          {loading ? 'Loading…' : 'Load demo data'}
        </button>
        <Link className="btn btn--secondary btn--block" to="/cats">
          Add your first cat
        </Link>
      </div>
      {hasData === true ? (
        <p className="welcome__hint">Your household already has cats — start tracking from the dashboard.</p>
      ) : null}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}