# Testing Guide — Cat Care Tracker

This guide documents the testing strategy and setup for the Cat Care Tracker web app.

## Testing Stack

| Layer | Tool | Status | What it covers |
|-------|------|--------|----------------|
| Unit / Integration | **Vitest** | ✅ Set up | Pure functions, domain logic, services (with fake-indexeddb) |
| Component | **@testing-library/react** + Vitest + jsdom | ❌ Not set up | React components & pages |
| E2E | **Playwright** | ✅ Set up | Full browser flows against the production build |

Run all unit/integration tests:
```
npm test
```

Watch mode:
```
npm run test:watch
```

End-to-end (builds first, then runs against `vite preview`):
```
npm run build && npm run test:e2e
```

The Playwright web server runs on **port 4174** (non-default) to avoid
colliding with a manually-running dev/preview server. With
`reuseExistingServer: true`, a server already listening on 4174 is reused
instead of started again.

---

## What's Tested (186 unit/integration tests)

- `src/domain/calculations.test.ts` — consumption rates, historical stats, finish dates, expense totals
- `src/domain/dates.test.ts` — date validation, parsing, formatting, month helpers
- `src/domain/units.test.ts` — unit conversion and formatting
- `src/domain/validation.test.ts` — entity validation (cats, products, supplies, periods, expenses, backup)
- `src/services/services.test.ts` — cat CRUD, supply lifecycle, **supply deletion + referential cleanup**, product archival, stats, expenses, backup, demo data, v1→v2 schema migration
- `src/services/csvService.test.ts` — CSV escaping and row generation for cats, products, supplies, expenses
- `src/services/id.test.ts` — ID generation
- `src/utils/format.test.ts` — money, days, and rate formatting

## E2E Coverage (11 tests)

`e2e/app.spec.ts`:

- First run routes through the welcome page
- Demo data loads and the dashboard shows stats and predictions
- Add / archive / reactivate a cat
- Add then delete an expense with confirmation
- **Delete supplies (history and open) with confirmation**
- Negative price is rejected in the supply form
- Bottom navigation reaches every primary area

`e2e/data.spec.ts`:

- Backup export downloads a JSON file
- Import-replace restores data from a backup file
- Clear-all requires confirmation
- **Full offline scenario** — the service worker is activated, the device is
  taken offline (`context.setOffline(true)`), the app is reloaded from the
  service worker, records are created/edited, calculations run, and data
  persists across page close/reopen.

## Known environmental note — outbound firewall / EACCES

The application itself performs **zero network requests** (offline-first by
construction — all data lives in IndexedDB and all calculations run locally).
A grep of `src/` finds no `fetch`, `axios`, `XMLHttpRequest`, or `WebSocket`
usage.

If you see an error like:

```
connect EACCES 35.186.247.105:443
```

during e2e runs, that is a **local/network-layer block** (OS firewall,
antivirus, or proxy policy denying an outbound socket to a Google Cloud
infrastructure IP). It is not initiated by this app and is not initiated by
Playwright's Chromium (Playwright launches Chromium with
`--disable-background-networking`). The offline e2e test, which passes with
networking disabled for the whole test, proves the app does not depend on
that IP.

To diagnose the connectivity from your machine:

```powershell
Test-NetConnection 35.186.247.105 -Port 443   # want TcpTestSucceeded : True
curl.exe -v https://35.186.247.105/           # or a Google-owned host
```

If the connection is blocked, whitelist the host in your firewall/antivirus —
the repository needs no code changes for this.

## What's Not Covered

1. **Component tests** — UI pages/components are exercised through the
   Playwright e2e suite instead of jsdom component tests. This keeps the MVP
   small while still covering user-facing flows.