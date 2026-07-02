# Task: Modernize ClientIQ / Banking Client 360 Documentation (2026-07-01)

## Goal
Update the ~19 technical/operational docs (outdated wiki exports in `docs/`) to reflect the
CURRENT application state. Deliver each as `.md` **and** `.docx` under `docs/latest/`.

## Decisions (confirmed with user)
- Scope: all technical + operational docs; skip governance (RACI, Identified Risks).
- Mode: **gap report first** for review, THEN rewrite. (Report approved; rewriting all 19.)
- Output: new `docs/latest/` folder; each doc as `.md` + `.docx` (DOCX via anthropic-skills:docx).

## AUTHORITATIVE ground truth (user-confirmed 2026-07-01)
- **DB: Microsoft SQL Server ONLY** — do not mention Postgres/trigram/dual-DB at all.
- **Web tier: IIS** (not Nginx) — TLS terminator + reverse proxy to Node :5000.
- **Envs: dev, test, preprod, prod**; CI/CD = Azure DevOps; GitHub main deploys nowhere.
- **Topology:** dev/test/preprod = single app server + DB each; prod = HA (2 app servers).
- **SSO/SAML: ON in preprod + prod only**; dev/test SAML_ENABLED=false (local/mock auth).
- Unverifiable specifics -> `> **[CONFIRM]**` markers, never invented.
- Retire the aspirational enterprise-architecture blueprint; regenerate ui-file-usage from code.
- (Saved to memory: bankclient360-infra-topology.md)

## Plan
- [x] Pull latest (ff to 65a6b49)
- [x] Extract all PDF/DOCX -> text (scratchpad/doc_text)
- [x] Confirm tooling (pdftotext OK; docx gen at rewrite phase)
- [x] Phase 1: Ground-truth facts from code (7 domains) -> scratchpad/facts/*.md
- [x] Phase 2: Per-doc gap analysis vs ground truth (19 docs, 274 findings)
- [x] Phase 3: Consolidated docs/latest/GAP-REPORT.md + gaps.json  <-- REVIEW CHECKPOINT (awaiting user)
- [x] Phase 4: Rewrite all 19 docs -> docs/latest/*.md (SQL Server only, IIS, 4 envs, SSO preprod/prod)
- [x] Phase 4b: Verify all 19 (17 clean first pass; 2 trivial term-leaks fixed by hand) -> 19/19 clean
- [x] Phase 4c: README.md index + consolidated [CONFIRM] checklist (~194 markers)
- [x] Phase 5: Generated docs/latest/*.docx (docx-js converter, styled) — 21 .docx
- [x] Phase 6: Validated all 21 .docx (OOXML valid) + structural fidelity spot-check
- [x] Phase 7: Installed mermaid-cli; rendered 27 Mermaid diagrams to PNG and embedded in .docx
      - Fixed 2 mermaid parse errors in architecture.md SAML sequence (unicode arrow + semicolon)
      - Visual QA of diagrams (ER, SAML sequence, component + deploy flowcharts) — all legible/accurate
      - QA found + fixed Postgres TYPE vocabulary in ER/design docs: bigserial->bigint IDENTITY,
        jsonb->nvarchar(max), boolean->bit, text->nvarchar(max), uuid->uniqueidentifier, timestamp->datetime2
        (database-erd.md 83 tokens; plus stray (uuid)/(jsonb) in field-mapping, architecture, technical-requirements)
      - Final: 0 pg/Nginx/pg-type leaks; 21 .docx valid; 27 diagrams embedded
- [x] Phase 8: Fixed Word "cannot open" errors + restyled to black-and-white enterprise
      - Root causes (found via real OOXML schema validator, deps installed locally to avoid PEP668):
        (a) buildDoc never attached numbering config -> numId placeholders {ul-0}/{ol0-0} left unresolved
        (b) markdown #anchor links became broken EXTERNAL relationships
        (c) docx-js Bookmark assigned duplicate w:id='1' -> abandoned bookmarks; #links now styled plain text
      - Restyle: mermaid theme -> grayscale (no purple); docx accent green -> charcoal (B&W enterprise)
      - Result: 21/21 pass REAL OOXML schema validation (open cleanly in Word)
- [x] Phase 9: Architecture rework + global copyedit (user review round 2)
      - Removed Streamlit from all docs (product decision); RBRShell backend flagged retired
      - Redesigned layered architecture diagram (enterprise B&W tiers)
      - Added SOR -> VAULT -> SPOT -> ClientIQ data lineage (prose + diagram) in architecture §7
      - Removed all 795 em/en dashes across the 19 deliverables + regenerated README (0 dashes, 0 streamlit)
      - Reduced AI-writing tells (filler transitions, hype words) without touching facts
      - Regenerated 21 .docx; 21/21 pass real OOXML validation; diagrams B&W (no purple)
      - Note: GAP-REPORT.md (internal audit) left as-is

## Review
- Delivered: 19 modernized technical/operational docs + README index + GAP-REPORT, each as .md AND .docx
  (21 .md + 21 .docx) in docs/latest/, plus gaps.json (structured findings, provenance).
- All docs: SQL Server only (0 Postgres/Nginx leakage), IIS web tier, 4 envs, SSO preprod/prod only, ADO CI/CD.
- 206 [CONFIRM] markers flag facts a human must supply (hostnames, certs, SLAs, owners, capacity, compliance).
  Consolidated per-doc in docs/latest/README.md.
- DOCX generated via docx-js (marked lexer -> docx-js) in scratchpad/md2docx; US Letter, green table headers,
  amber [CONFIRM] callouts, page numbers. Mermaid ER diagram renders as source code block in Word (no renderer).
- Not committed (untracked). preprod/prod deploy from ADO branches, not GitHub main — commit/push only on request.

