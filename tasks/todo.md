# Deposits Overview — scale fix for large account sets (2026-05-21)

## Problem
Customer 8484989 has 167 deposit accounts. `/api/customers/:id/deposit-analytics`
returns HTTP 500, leaving the entire Deposits Overview region as empty
skeletons. Other parts of the page load fine. `staleTime: Infinity, retry: false`
means it stays broken on the client until reload.

## Plan summary
Split the mega-endpoint into three independent endpoints, rewrite the slow trend
SQL to be set-based with a parameterized customer scope, lazy-load the trend
chart so it only fires on scroll, and silently hide the trend card if it still
errors. (Full plan in `~/.claude/plans/image-8-image-9-zippy-yao.md`.)

## Tasks
- [ ] **Backend SQL rewrite + split** (`server/storage/sqlServerDashboard.ts`)
  - [ ] Add `getDepositSummarySqlServer` (just balances) — extracted from the
        existing function's first 50 lines
  - [ ] Add `getDepositRecentTransactionsSqlServer` — scope via
        `account_ownership` subquery, not a string-interpolated IN list
  - [ ] Add `getDepositTrendSqlServer` with set-based ROW_NUMBER query +
        TS carry-forward (single parameter `@customerId`)
  - [ ] Convert `getDepositAccountAnalyticsSqlServer` into a Promise.all
        wrapper over the three new functions (backward-compat shim)
- [ ] **Postgres path** (`server/storage.ts`) — same three-method split
- [ ] **Routes** (`server/routes.ts`)
  - [ ] `GET /api/customers/:id/deposit-summary`
  - [ ] `GET /api/customers/:id/deposit-trend?range=ytd|quarterly|monthly`
  - [ ] `GET /api/customers/:id/deposit-recent-transactions?limit=5`
  - [ ] Keep `/deposit-analytics` as parallel fan-out shim
- [ ] **Frontend** (`client/src/components/Deposits.tsx`)
  - [ ] Replace single useQuery with three (summary, trend, recent)
  - [ ] Inline `useInView` hook (no new dep — IntersectionObserver native)
  - [ ] Gate trend query with `enabled: inView`
  - [ ] Add `retry: 1` only to trend query
  - [ ] Silently hide trend card on error (`{!trendError && ...}`)
  - [ ] Per-card loading states (no whole-section spinner)
- [ ] **Verify**
  - [ ] `npx tsc --noEmit` clean (no new errors in modified files)
  - [ ] Manual: load 8484989, hero + recent appear fast, trend lazy-loads
  - [ ] Regression: load a small-account customer, looks identical to before

## Review
- `server/storage/sqlServerDashboard.ts`: split the 250-line
  `getDepositAccountAnalyticsSqlServer` into three exports —
  `getDepositSummarySqlServer` (pure SUM, sub-second), `getDepositTrendSqlServer`
  (set-based ROW_NUMBER + parameterized `@customerId` + TS carry-forward —
  no more correlated subquery or string-interpolated IN list), and
  `getDepositRecentTransactionsSqlServer` (TOP @limit via account_ownership
  subquery). Old function kept as a Promise.all shim so existing
  `/deposit-analytics` callers don't break. Each function emits a structured
  `info` log with `durationMs` so we can measure the win.
- `server/storage.ts`: added matching `getDepositTrend` /
  `getDepositRecentTransactions` storage methods. Postgres path uses the
  same rewritten set-based SQL with `db.execute(sql\`...\`)` and the same
  TS carry-forward logic. Interface (lines 204-228) extended.
- `server/routes.ts`: added three new routes — `/deposit-summary`,
  `/deposit-trend?months=12`, `/deposit-recent-transactions?limit=5`.
  Existing `/deposit-analytics` left in place as a back-compat shim.
- `client/src/components/Deposits.tsx`: replaced the single useQuery with
  three. Added a tiny inline `useInView` hook (native IntersectionObserver,
  no new dep). The trend chart is gated by `enabled: trendInView` and
  `retry: 1`; on error the entire trend Grid is silently hidden
  (`{!trendError && ...}`). Summary still drives the page-level loading
  skeleton so hero numbers don't flash $0. Recent transactions show their
  own inline skeleton inside the Recent Activity card.
- Typecheck: zero errors in `Deposits.tsx` and `sqlServerDashboard.ts`.
  `server/storage.ts` and `server/routes.ts` are at the pre-existing error
  baseline (same `db is possibly null` / `string | string[]` patterns that
  were already there).
- Verification still TODO before commit: hit the three endpoints with curl
  for timing, then a manual smoke test against customer 8484989.

