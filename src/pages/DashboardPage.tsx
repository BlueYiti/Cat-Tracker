// Dashboard: household status at a glance.

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/database';
import { getActiveCats } from '../services/catService';
import { getSettings } from '../services/backupService';
import { getOpenSupplyStats } from '../services/statsService';
import { currentMonthKey, formatDateShort, monthKey, todayLocal } from '../domain/dates';
import { formatQuantity } from '../domain/units';
import { formatMoney, formatDays } from '../utils/format';
import { AlertIcon, LitterIcon, FoodIcon, WalletIcon } from '../components/icons';
import { EmptyState } from '../components/ui';
import { SupplyForm } from '../components/SupplyForm';
import { ExpenseForm } from '../components/ExpenseForm';

export function DashboardPage() {
  const liveCats = useLiveQuery(() => getActiveCats(), []);
  const liveOpenSupplyStats = useLiveQuery(() => getOpenSupplyStats(todayLocal()), []);
  const liveExpenses = useLiveQuery(() => db.expenses.toArray(), []);
  const settings = useLiveQuery(() => getSettings(), []);

  const cats = useMemo(() => liveCats ?? [], [liveCats]);
  const openSupplyStats = useMemo(() => liveOpenSupplyStats ?? [], [liveOpenSupplyStats]);
  const expenses = useMemo(() => liveExpenses ?? [], [liveExpenses]);

  const [showLitterForm, setShowLitterForm] = useState(false);
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

  const symbol = settings?.currencySymbol ?? '₱';
  const monthlyTotal = useMemo(() => {
    return expenses
      .filter((e) => monthKey(e.date) === selectedMonth)
      .reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0);
  }, [expenses, selectedMonth]);

  const activeCatCount = cats.length;

  const nextRunOut = useMemo(() => {
    const withPrediction = openSupplyStats.filter((s) => s.hasEnoughHistory && s.estimatedDaysRemaining != null);
    if (withPrediction.length === 0) return null;
    return withPrediction.sort((a, b) => (a.estimatedDaysRemaining ?? Infinity) - (b.estimatedDaysRemaining ?? Infinity))[0];
  }, [openSupplyStats]);

  if (cats.length === 0 && openSupplyStats.length === 0 && expenses.length === 0 && !settings?.isDemoDataLoaded) {
    return (
      <EmptyState
        emoji="🐱"
        title="Welcome to Cat Care Tracker"
        onAction={() => setShowLitterForm(true)}
        actionLabel="Add your first supply"
      >
        Add your cats and first supply to start tracking your household.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="page-head__actions">
          <button className="btn btn--sm btn--secondary" onClick={() => setShowLitterForm(true)}>
            <LitterIcon size={16} /> Litter
          </button>
          <button className="btn btn--sm btn--secondary" onClick={() => setShowFoodForm(true)}>
            <FoodIcon size={16} /> Food
          </button>
          <button className="btn btn--sm btn--primary" onClick={() => setShowExpenseForm(true)}>
            <WalletIcon size={16} /> Expense
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Active cats</div>
          <div className="stat-card__value">{activeCatCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Open supplies</div>
          <div className="stat-card__value">{openSupplyStats.length}</div>
        </div>
      </div>

      {nextRunOut ? (
        <div className="card runout-card">
          <div className="stat-card__label">
            <AlertIcon size={14} /> Next estimated run-out
          </div>
          <div className="runout-card__title">
            {nextRunOut.product.brand} {nextRunOut.product.name}
          </div>
          <div className="runout-card__detail">
            {formatQuantity(nextRunOut.remainingQuantityDisplay, nextRunOut.unit)} remaining
            {' · '}
            <strong>{formatDays(nextRunOut.estimatedDaysRemaining)}</strong>
            {nextRunOut.estimatedFinishDate ? ` (est. ${formatDateShort(nextRunOut.estimatedFinishDate)})` : ''}
          </div>
        </div>
      ) : null}

      <section>
        <h2 className="section-title">Current supplies</h2>
        {openSupplyStats.length === 0 ? (
          <EmptyState
            emoji="📦"
            title="No open supplies"
            onAction={() => setShowLitterForm(true)}
            actionLabel="Add supply"
          >
            Open supplies show here with their usage rate and estimated run-out.
          </EmptyState>
        ) : (
          openSupplyStats.map((s) => (
            <div className="card" key={s.id}>
              <div className="row-item__title">
                {s.product.brand} {s.product.name}
              </div>
              <div className="row-item__sub">
                {formatQuantity(s.quantity, s.unit)} purchased
                {s.remainingQuantityDisplay != null
                  ? ` · ${formatQuantity(s.remainingQuantityDisplay, s.unit)} remaining`
                  : ''}
              </div>
              {s.hasEnoughHistory && s.estimatedDaysRemaining != null ? (
                <div className="mt-2">
                  <div className="row-item__sub">
                    Estimated usage:{' '}
                    {formatQuantity(s.historicalStats.dailyHouseholdConsumption ?? 0, s.unit)}
                    /day
                  </div>
                  <div className="row-item__sub">
                    <strong>~{formatDays(s.estimatedDaysRemaining)} remaining</strong>
                    {s.estimatedFinishDate ? ` · est. ${formatDateShort(s.estimatedFinishDate)}` : ''}
                  </div>
                </div>
              ) : (
                <div className="row-item__sub mt-2">Not enough history to estimate remaining days.</div>
              )}
              <div className="flex-row mt-2">
                <Link
                  className="btn btn--sm btn--secondary"
                  to={s.product.category === 'litter' ? '/litter' : '/food'}
                >
                  Manage
                </Link>
              </div>
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="section-title">Spending</h2>
        <div className="card">
          <div className="flex-row" style={{ justifyContent: 'space-between' }}>
            <label htmlFor="month" className="field__label">
              Month
            </label>
            <input
              id="month"
              className="field__input"
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              style={{ width: 'auto', minHeight: 40 }}
            />
          </div>
          <div className="stat-card__value mt-2">{formatMoney(monthlyTotal, symbol)}</div>
          <div className="row-item__sub">Total for {selectedMonth}</div>
        </div>
      </section>

      {showLitterForm ? <SupplyForm category="litter" onClose={() => setShowLitterForm(false)} /> : null}
      {showFoodForm ? <SupplyForm category="food" onClose={() => setShowFoodForm(false)} /> : null}
      {showExpenseForm ? <ExpenseForm onClose={() => setShowExpenseForm(false)} /> : null}
    </>
  );
}