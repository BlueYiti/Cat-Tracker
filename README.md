# Cat Care Tracker

A mobile-first, **offline-first** PWA for tracking cat food, litter, supplies, and expenses — built for one household, one local user.

It answers three questions at a glance:

1. **How much am I spending on my cats?**
2. **How quickly are my cats consuming food and litter?**
3. **When am I likely to run out?**

All data lives locally in the browser (IndexedDB). There is **no backend, no authentication, and no cloud sync** — nothing ever leaves your device.

## Features

- **Cats** — add, archive, and reactivate cats
- **Supplies & products** — track food, litter, and other supplies with purchase/inventory lifecycle
- **Expenses** — log purchases with confirmation-guarded deletion
- **Stats & predictions** — consumption rates, historical trends, estimated remaining supply, and run-out dates
- **Demo data** — load sample data on first run to explore the app instantly
- **CSV export** — export cats, products, supplies, and expenses
- **Backup & restore** — export/import a full JSON backup
- **Installable PWA** — add to home screen / desktop, works fully offline via a service worker

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + react-router-dom 7 |
| Language | TypeScript ~5.8 |
| Build tool | Vite 7 |
| Storage | Dexie 4 (IndexedDB) + dexie-react-hooks |
| PWA | vite-plugin-pwa (Workbox, auto-updating service worker) |
| Testing | Vitest (unit/integration), Playwright (e2e) |
| Linting | ESLint 9 (typescript-eslint, react-hooks) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)

### Install & run in development

```powershell
npm install
npm run dev
```

Then open **http://localhost:5173**.

On first run you'll be guided through a welcome page where you can load **demo data** to explore the dashboard, stats, and predictions immediately.

> **Note on ports:** the dev server uses `strictPort: true` on **5173** and the production preview uses **4174**. If a server is already running on the port, startup will fail rather than silently using another port.

### Production build & preview

```powershell
npm run build      # type-checks (tsc -b) then builds to dist/
npm run preview    # serves the production build at http://localhost:4174
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server with hot reload (port 5173) |
| `npm run build` | Type-check and build for production to `dist/` |
| `npm run preview` | Serve the production build locally (port 4174) |
| `npm test` | Run all unit/integration tests once (Vitest) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run typecheck` | TypeScript project-wide type-check (`tsc -b`) |
| `npm run lint` | ESLint across the repo |
| `npm run generate:icons` | Regenerate PWA icons (`scripts/generate-icons.mjs`) |

## Testing

The testing strategy is documented in detail in [testing-guide.md](testing-guide.md).

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit / integration | **Vitest** | 182 tests across 8 files — domain logic (calculations, dates, units, validation), services (CRUD, stats, expenses, backup, CSV), utils, ID generation |
| End-to-end | **Playwright** | 10 tests — first-run welcome flow, demo data, cat/expense management, form validation, navigation, backup import/export, and a full offline scenario |

```powershell
npm test                          # unit/integration
npm run test:watch                # watch mode
npm run build && npm run test:e2e # e2e (builds first, then runs against vite preview on port 4174)
```

The Playwright suite uses `reuseExistingServer: true`, so an already-running server on port 4174 is reused rather than started again.

## Offline / PWA Behavior

- The service worker (Workbox, `autoUpdate`) precaches all app assets (`js`, `css`, `html`, `svg`, `png`, `ico`, `woff2`) and serves `index.html` as the navigation fallback.
- The app performs **zero network requests** at runtime — all data lives in IndexedDB and all calculations run locally, so it works completely offline after the first load.
- Installable on mobile and desktop (`display: standalone`) via the web app manifest.

## Project Structure

```
├── e2e/                  # Playwright e2e tests (app.spec.ts, data.spec.ts, helpers.ts)
├── public/               # Static assets (PWA icons, etc.)
├── scripts/              # Icon generation script
├── src/
│   ├── components/       # Reusable UI components
│   ├── db/               # Dexie database schema and setup
│   ├── domain/           # Pure domain logic: calculations, dates, units, validation
│   ├── pages/            # Route-level pages
│   ├── services/         # Business services: CRUD, stats, backup, CSV, ID generation
│   ├── styles/           # Styling
│   └── utils/            # Formatting helpers
├── vite.config.ts        # Vite + PWA configuration (dev: 5173, preview: 4174)
├── vitest.config.ts      # Unit test configuration
├── playwright.config.ts  # E2E test configuration
└── PRODUCT_REQUIREMENTS.md
```

## Data & Privacy

- **Local only:** all records are stored in the browser's IndexedDB. No accounts, no telemetry, no server round-trips.
- **Backups:** export a full JSON backup from the app and re-import it on any device to move or restore your data (import-replace requires explicit confirmation, as does clearing all data).
- **CSV export:** per-entity CSV files for spreadsheet analysis.

## Further Documentation

- [testing-guide.md](testing-guide.md) — full testing strategy, coverage details, and troubleshooting notes
- [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) — original product requirements
