# Notes — add `cif_number` column for Operations (2026-06-01)

## Goal
Capture the customer's Jack Henry CIF number on every `note` row so the Operations team can join/filter notes by CIF without going through `customer_id`. Server populates the value automatically; UI/API contracts do not change.

## Decisions (locked in)
- **Source of CIF:** server-side lookup from `customer_id` → `customer.jack_henry_cif_number`. Client never sends CIF.
- **Account-scoped notes (`target_type='account'`):** resolve CIF via `account_ownership.is_primary_owner = true` → `customer.jack_henry_cif_number`. If no primary owner exists, leave NULL.
- **Existing rows:** add column nullable; **no backfill**. Only new writes populate CIF.
- **API/UI exposure:** none. Column is DB-only (not returned by GET endpoints, not shown in UI).
- **Write paths that populate CIF:**
  - CREATE (`createNoteSqlServer`, Drizzle `createNote`) — always
  - UPDATE (`updateNoteSqlServer`, Drizzle `updateNote`) — only when current value is NULL (defensive forward-fill for legacy rows that get edited)
  - Soft-delete / restore / pin — no change

## Files to change

### Schema — `shared/schema.ts`
- [ ] Add `cifNumber: varchar("cif_number", { length: 20 })` to the `note` table definition (~lines 570–595, after `isPinned` or before timestamps). Nullable, no default.

### Drizzle migration (PostgreSQL)
- [ ] Run `npx drizzle-kit generate` to produce a migration under `./migrations/` adding `cif_number VARCHAR(20)` to `note`. Commit the generated SQL.
- [ ] Verify the generated migration is additive only.

### SQL Server schema (manual — no migration framework)
- [ ] New file `Insert Queries/Schema Changes/note_add_cif_number.sql`:
  ```sql
  IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = 'cif_number' AND Object_ID = OBJECT_ID('dbo.note')
  )
  BEGIN
    ALTER TABLE dbo.note ADD cif_number VARCHAR(20) NULL;
  END
  ```
- [ ] Call out in PR description: Ops/DBA must apply this in each SQL Server environment.

### Server — CIF resolver helper
- [ ] Add `resolveCifForNote({ customerId, accountId })` (one for SQL Server in `sqlServerNotes.ts`, one for Drizzle in `storage.ts` — or co-locate in a new `server/storage/notesCifResolver.ts` if cleaner):
  - If `customerId` present → `SELECT jack_henry_cif_number FROM customer WHERE customer_id = @customerId`
  - Else if `accountId` present → join `account_ownership` (filter `is_primary_owner = 1`) → `customer`, return CIF
  - Returns `string | null`

### SQL Server notes — `server/storage/sqlServerNotes.ts`
- [ ] `createNoteSqlServer` (~lines 156–166): resolve CIF before INSERT; add `cif_number` to column list + `@cifNumber` parameter binding.
- [ ] `updateNoteSqlServer`: read existing `cif_number`; if NULL, include it in the `SET` clause of the same UPDATE (resolved from customer/account).
- [ ] No changes to `getNotesSqlServer`, version, restore, pin, delete flows.

### Drizzle notes — `server/storage.ts`
- [ ] `createNote` (~lines 3600–3610): resolve CIF, add `cifNumber: resolvedCif` to `.values({...})`.
- [ ] `updateNote`: if existing `cifNumber` is NULL, include `cifNumber: resolvedCif` in update payload.

### Routes — `server/routes.ts`
- [ ] **No changes.** Existing payload contracts (`customerId` / `accountId` / `targetType`) provide what the server needs.

### Client
- [ ] **No changes.** UI does not surface CIF on notes.

## Verification
- [ ] `npx tsc --noEmit` passes (no new errors in changed files).
- [ ] Start server, create a customer-scoped note via UI → SELECT confirms `cif_number = customer.jack_henry_cif_number`.
- [ ] Create an account-scoped note on an account with a primary owner → CIF populated.
- [ ] Edit a pre-existing note where `cif_number` is NULL → UPDATE populates it.
- [ ] Edit a note that already has CIF → CIF NOT overwritten.
- [ ] Create a note for a customer whose `jack_henry_cif_number` is NULL → row inserts with `cif_number = NULL`, no error.
- [ ] GET responses do NOT leak `cif_number` (check `.returning()` path in Drizzle `createNote` — strip from API shape if it appears).

## Risks
- **Account notes with no primary owner:** plan leaves CIF NULL. Confirm with Ops if a fallback (any owner) is preferred.
- **SQL Server drift:** no migration framework — schema change applied manually. Mitigated by checking the .sql file into the repo and calling it out in the PR.
- **`.returning()` leakage:** verify Drizzle `createNote` result doesn't flow `cif_number` into the API response; if it does, omit it from the route's response shape.

## Review

- **`shared/schema.ts`**: added `cifNumber: varchar("cif_number", { length: 20 })` to the `note` table + `idx_note_cif_number` index. Nullable, no default. No constraint on target_type — column can be NULL for any row.
- **`server/storage/sqlServerNotes.ts`**:
  - New `resolveCifNumberSqlServer(transaction, customerId, accountId)` helper. Customer-scoped → direct SELECT on `customer.jack_henry_cif_number`. Account-scoped → join `account_ownership` filtered by `is_primary_owner = 1`. Returns `null` when no CIF can be determined.
  - `createNoteSqlServer`: resolves CIF before the INSERT (inside the same transaction); INSERT column list + VALUES now include `cif_number` / `@cifNumber`.
  - `updateNoteSqlServer`: existence check extended to fetch `customer_id`, `account_id`, `cif_number`. If existing `cif_number` is NULL, resolves it once and folds the assignment into the existing metadata UPDATE (so we don't issue a second statement). The UPDATE block now also fires when *only* a CIF backfill is needed.
- **`server/storage.ts`**:
  - New `DatabaseStorage.resolveCifNumberPg(customerId, accountId)` private method — Drizzle equivalent of the SQL Server helper, using `customer.jackHenryCifNumber` + `accountOwnership.isPrimaryOwner`.
  - `createNote` (PG path): resolves CIF and passes `cifNumber` in the insert payload.
  - `updateNote` (PG path): selects the raw `note` row for `customerId / accountId / cifNumber` (the existing `getNote` shape omits cif), and if NULL, resolves + includes `cifNumber` in the conditional metadata `db.update(note).set(...)`. The conditional also fires when only the backfill is needed.
- **`Insert Queries/Schema Changes/note_add_cif_number.sql`**: idempotent SQL Server DDL — `ALTER TABLE dbo.note ADD cif_number VARCHAR(20) NULL` + `CREATE INDEX idx_note_cif_number`, each guarded by `IF NOT EXISTS`. To be applied manually per SQL Server environment.
- **Drizzle migration**: attempted `npx drizzle-kit generate`; it produced a full baseline (`0000_*.sql`, 49KB) because `migrations/` was previously empty — would have tried to CREATE every existing table. Reverted. The team isn't using checked-in Drizzle migrations today; `shared/schema.ts` is the source of truth for the PG path. If/when migrations are adopted, the cif_number column is already in the schema and will be baselined naturally.
- **API/UI**: no changes — confirmed `NoteWithCurrentVersion` (the API response shape) does not include `cifNumber`, so neither `OUTPUT INSERTED.*` nor `.returning()` leaks the column to the client.
- **Typecheck**: `npx tsc --noEmit` — no new errors in modified files. `server/storage.ts` is at the same pre-existing `db is possibly null` baseline noted in the prior Deposits review. `shared/schema.ts` errors are at lines 165 & 1152 (household / unrelated). `server/storage/sqlServerNotes.ts` is clean.
- **Still TODO before merge**: manual smoke test (create customer-scoped note → verify cif_number in DB matches customer; create account-scoped note → verify resolved via primary owner; edit a legacy note → verify forward-fill).
