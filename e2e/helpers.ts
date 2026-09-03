import { expect, type Page } from '@playwright/test';

/**
 * Navigate with retry. This environment intermittently fails localhost
 * navigations with net::ERR_NETWORK_ACCESS_DENIED (see testing-guide.md),
 * so give each goto a few attempts before giving up.
 */
export async function gotoWithRetry(page: Page, url: string, attempts = 3): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await page.goto(url);
      return;
    } catch (e) {
      lastError = e;
      await page.waitForTimeout(500);
    }
  }
  throw lastError;
}

/** Go through first-run and load the demo dataset, landing on the dashboard. */
export async function loadDemoData(page: Page): Promise<void> {
  await gotoWithRetry(page, '/#/welcome');
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

/**
 * Wait for the service worker to finish installing/activating, then reload so
 * the active worker controls the page. This is more reliable than
 * `navigator.serviceWorker.ready` in headless Chromium.
 */
export async function waitForActiveServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.active);
    },
    { timeout: 20_000 },
  );
  // Reload so the activated worker takes control of this page.
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 15_000 });
}