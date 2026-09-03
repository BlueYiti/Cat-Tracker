// End-to-end smoke tests — backup/restore, data safety, and real offline operation.
// Run against the production build: `npm run build && npm run test:e2e`.

import { test, expect } from '@playwright/test';
import { gotoWithRetry, loadDemoData, waitForActiveServiceWorker } from './helpers';

test('backup export downloads a JSON file', async ({ page }) => {
  await loadDemoData(page);
  await gotoWithRetry(page, '/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cat-care-backup-.*\.json$/);
});

test('import replace restores data from a backup file', async ({ page }) => {
  // Load demo data first so the first-run gate lets us reach Settings.
  await loadDemoData(page);

  const raw = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    cats: [
      {
        id: 'imported-cat-1',
        name: 'Imported Cat',
        dateOfBirth: null,
        weightKg: null,
        photo: null,
        isActive: true,
        isDemo: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    products: [],
    supplies: [],
    usagePeriods: [],
    expenses: [],
    settings: null,
  });

  await gotoWithRetry(page, '/#/settings');
  await page.setInputFiles('input[aria-label="Choose a backup file to import"]', {
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw, 'utf-8'),
  });
  await page.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByText(/Imported 1 records/)).toBeVisible();

  await gotoWithRetry(page, '/#/cats');
  await expect(page.getByText('Imported Cat')).toBeVisible();
});

test('clear all data requires confirmation', async ({ page }) => {
  await loadDemoData(page);
  await gotoWithRetry(page, '/#/settings');
  await page.getByRole('button', { name: 'Clear All Data' }).click();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();

  // Clearing empties the database, so the first-run gate takes over the current
  // page with an SPA redirect to the welcome route. Wait for it here — this
  // also gives the async clear transaction time to commit before we reload.
  await expect(page.getByRole('heading', { name: /Welcome to Cat Care Tracker/i })).toBeVisible();

  // Reload: the empty state persists (welcome again), and no dashboard data.
  await gotoWithRetry(page, '/');
  await expect(page.getByRole('heading', { name: /Welcome to Cat Care Tracker/i })).toBeVisible();
  await expect(page.getByText('Mochi')).toHaveCount(0);
});

test('fully works offline: reload, CRUD, calculations, persistence', async ({ page, context }) => {
  // Online first: load demo data and let the service worker take control.
  await loadDemoData(page);
  await waitForActiveServiceWorker(page);

  // Go offline for real.
  await context.setOffline(true);

  // 1. Reload — the app shell must load from the service worker.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // 2. Create records offline.
  await gotoWithRetry(page, '/#/cats');
  await page.getByRole('button', { name: 'Add Cat' }).first().click();
  await page.locator('#catname').fill('Offline Cat');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Offline Cat')).toBeVisible();

  await gotoWithRetry(page, '/#/expenses');
  await page.getByRole('button', { name: 'Add Expense' }).first().click();
  await page.locator('#expitem').fill('Offline toy');
  await page.locator('#expamt').fill('99');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Offline toy')).toBeVisible();

  // 3. Edit a record offline (update remaining quantity on an open litter supply).
  await gotoWithRetry(page, '/#/litter');
  await page.getByRole('button', { name: 'Update Remaining' }).first().click();
  await page.locator('#updrem').fill('8');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('8 kg remaining').first()).toBeVisible();

  // 4. Dashboard calculations still work offline.
  await gotoWithRetry(page, '/');
  await expect(page.getByText('Current supplies')).toBeVisible();

  // 5. Close and reopen in a new page — data persists (same context).
  const page2 = await context.newPage();
  await gotoWithRetry(page2, '/#/cats');
  await expect(page2.getByText('Offline Cat')).toBeVisible();
  await page2.close();
});