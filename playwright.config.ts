import { defineConfig } from '@playwright/test';

// End-to-end tests run against the production build via `vite preview`.
// Run `npm run build` first (or let CI build before this stage).
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: 2, // e2e can hit intermittent localhost network blocks (see testing-guide.md)
  reporter: 'list',
  // Run serially: the offline test mutates network state and reloads from the
  // service worker; running workers concurrently against one preview server was
  // observed to cause flaky interference in CI-like environments.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:4174',
    headless: true,
    viewport: { width: 390, height: 844 }, // mobile-first
  },
  webServer: {
    command: 'npm run preview',
    port: 4174,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});