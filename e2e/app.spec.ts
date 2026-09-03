// End-to-end smoke tests — first run, dashboard, navigation, CRUD.
// Run against the production build: `npm run build && npm run test:e2e`.

import { test, expect } from '@playwright/test';
import { gotoWithRetry, loadDemoData } from './helpers';

test('first run routes through the welcome page', async ({ page }) => {
  await gotoWithRetry(page, '/');
  await expect(page.getByRole('heading', { name: /Welcome to Cat Care Tracker/i })).toBeVisible();
});

test('demo data loads and dashboard shows stats and predictions', async ({ page }) => {
  await loadDemoData(page);
  await expect(page.getByText('Active cats')).toBeVisible();
  await expect(page.getByText('4', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Current supplies')).toBeVisible();
  // Demo history is sufficient, so a run-out estimate is shown.
  await expect(page.getByText('Next estimated run-out')).toBeVisible();
});

test('add a cat, archive and reactivate', async ({ page }) => {
  await loadDemoData(page);
  await gotoWithRetry(page, '/#/cats');
  // The page briefly shows an empty state before live data resolves; both buttons
  // have the same label, so target the header action explicitly.
  await page.getByRole('button', { name: 'Add Cat' }).first().click();
  await page.locator('#catname').fill('Whiskers');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Whiskers')).toBeVisible();

  await page.getByRole('button', { name: 'Archive Whiskers' }).click();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.locator('section', { hasText: 'Archived' })).toContainText('Whiskers');

  await page.getByRole('button', { name: 'Reactivate' }).click();
  await expect(page.locator('section', { hasText: 'Active' })).toContainText('Whiskers');
});

test('add, then delete, an expense with confirmation', async ({ page }) => {
  await loadDemoData(page);
  await gotoWithRetry(page, '/#/expenses');
  await page.getByRole('button', { name: 'Add Expense' }).first().click();
  await page.locator('#expitem').fill('Heated cat bed');
  await page.locator('#expamt').fill('3500');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Heated cat bed')).toBeVisible();
  await expect(page.getByText('₱3,500').first()).toBeVisible();

  await page.getByRole('button', { name: 'Delete Heated cat bed' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Heated cat bed')).toHaveCount(0);
});

test('deleting supplies removes them (history and open)', async ({ page }) => {
  await loadDemoData(page);
  await gotoWithRetry(page, '/#/litter');

  // History: delete a finished litter supply. Wait for live data first —
  // the page renders its empty state until the IndexedDB query resolves.
  const historyDelete = page.getByRole('button', { name: 'Delete supply' });
  await expect(historyDelete.first()).toBeVisible();
  const historyBefore = await historyDelete.count();
  expect(historyBefore).toBeGreaterThan(0);
  await historyDelete.first().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete supply' })).toHaveCount(historyBefore - 1);

  // Open: delete the open litter supply.
  const openDelete = page.getByRole('button', { name: 'Delete open supply' });
  await expect(openDelete).toHaveCount(1);
  await openDelete.click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('No open supplies right now.')).toBeVisible();
});

test('rejects negative price in the supply form', async ({ page }) => {
  await loadDemoData(page);
  await gotoWithRetry(page, '/#/litter');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // The form's mode depends on whether products had loaded when it mounted:
  // it shows either the product picker or the "new product" fields (with a
  // toggle once products load). Handle both, then force the picker so the
  // price validation is reached.
  const productSelect = page.locator('#product');
  if ((await productSelect.count()) === 0) {
    await page.getByRole('button', { name: /Choose existing product/i }).click();
  }
  await productSelect.selectOption({ index: 1 });
  await page.locator('#qty').fill('10');
  await page.locator('#price').fill('-5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Price must be zero or a positive number/i)).toBeVisible();
  // Dialog stays open — no invalid data was saved.
  await expect(page.locator('#price')).toBeVisible();
});

test('bottom navigation reaches every primary area', async ({ page }) => {
  await loadDemoData(page);
  const nav = page.locator('.bottom-nav');

  await nav.getByText('Cats').click();
  await expect(page).toHaveURL(/#\/cats/);
  await nav.getByText('Litter').click();
  await expect(page).toHaveURL(/#\/litter/);
  await nav.getByText('Food').click();
  await expect(page).toHaveURL(/#\/food/);
  await nav.getByText('More').click();
  await expect(page).toHaveURL(/#\/more/);
  await nav.getByText('Dashboard').click();
  await expect(page).toHaveURL(/#\/$/);

  // From More, the menu links to Expenses and Settings.
  await nav.getByText('More').click();
  await page.getByRole('link', { name: 'Expenses' }).click();
  await expect(page).toHaveURL(/#\/expenses/);
  await nav.getByText('More').click();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/#\/settings/);
});

test('no horizontal scroll on any route at a narrow (360px) viewport', async ({ page }) => {
  // This viewport is set per-test; explicitly size it to a common small phone.
  await page.setViewportSize({ width: 360, height: 740 });
  await loadDemoData(page);

  const routes = ['/', '/cats', '/litter', '/food', '/expenses', '/more', '/settings'];
  for (const route of routes) {
    await gotoWithRetry(page, `/#${route}`);
    // Wait for the page to settle, then assert nothing overflows horizontally.
    await expect(page.locator('.app-main')).toBeVisible();
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(
      overflow.scrollWidth,
      `${route || '/'} overflows horizontally: doc ${overflow.scrollWidth}px vs window ${overflow.innerWidth}px`,
    ).toBeLessThanOrEqual(overflow.innerWidth + 1);
  }
});