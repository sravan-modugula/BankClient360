# Lessons

## 2026-06-04 — ETL pivot from account_id → account_number

**Mistake to avoid:** When refactoring queries because a source column became unreliable, sweep ALL surfaces before designing the fix — not just the one the user mentions. The user asked about the Client and Account pages, but the same broken join (`ft.account_id`) showed up in Relationship Summary, single-account balance history, the `/api/transactions` generic endpoint, and a diagnostics route. Missing any one of those would have left the app silently returning empty data on that surface.

**Pattern to apply:** Before drafting an implementation plan for an ETL/schema pivot, run an inventory pass — grep for every reference to the broken column in both DB code paths (PG Drizzle + SQL Server raw SQL), in both filter (`WHERE`) and join (`ON`) positions. Group by file. Distinguish:
- Direct WHERE filters
- JOINs back to the source table
- Subqueries / CTEs
- Mappers and ORM column reads
- Aggregations / window-function PARTITION BY

**Other catches:**
- Drizzle has an `IBankingStorage` interface in the same file as the implementation; changing a facade method's signature requires updating both. Easy to miss because the interface lives at the top of a 3500-line file.
- The deposits trend helper uses an "account_id" field name as a pure identity key — it doesn't actually care whether the value is a numeric id or a string number. Rename in the interface; behavior is identical.
- `req.query` and `req.params` are typed as `string | string[]` in Express; many `parseInt(req.params.X)` calls in this codebase already error on baseline. Don't introduce new ones unless you also wrap in `String(...)`.
- `for (const x of someMap.keys())` errors under this project's tsconfig (downlevelIteration off). Use `Array.from(map.keys()).forEach(...)` or convert the Map to a plain array first.
