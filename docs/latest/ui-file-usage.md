# UI File Usage Guide

*Last reviewed: 2026-07-02 - Source of truth: application code*

## Purpose / Overview

This guide classifies the files under `client/src/` by whether they are **actively rendered in
production**, **imported but unreachable** (dead branch or commented-out render), or **not wired in
at all** (alternate design variants, examples, and unused scaffolding). The goal is to let a
developer trace the real import chain from the application root and avoid editing files that no
longer affect the running app.

ClientIQ (Banking Client 360) is a React + MUI single-page app (`client/`), written in TypeScript,
using TanStack Query for data fetching and the `wouter` router. It talks to a Node/Express API which
reads from Microsoft SQL Server. All classifications below were verified by import analysis against
the current source; every claim is cited as `file:line` where useful.

> Classification method: a file is **Active** only if it is reachable from `client/src/App.tsx`
> through a mounted route and is actually rendered (not inside a commented-out block or an
> unreachable conditional branch). "Imported" alone is not sufficient; several files are imported
> by an active module but never rendered.

---

## 1. Application shell

The shell is composed of three top-level pieces mounted directly in `App.tsx`. The old `TopBar`
component is **not** part of the shell (see §5).

`client/src/App.tsx:206-222` mounts, inside the root layout `Box`:

| Element | File | Role |
|---|---|---|
| `<CssBaseline />` | MUI | CSS reset |
| `<Header />` | `client/src/components/header/Header.tsx` | Fixed top app bar (green `#1b4d20`): drawer toggle, breadcrumbs, and the global `CustomerSearch` box |
| `<Navbar />` | `client/src/components/navbar/Navbar.tsx` | Persistent left drawer (width `258px`, `client/src/constants.tsx:1`), data-driven from `client/src/projects.tsx` |
| `<Router drawerOpen={...} />` | inline in `App.tsx:157-184` | Main content outlet (`wouter <Switch>`) |

Provider nesting (`App.tsx:199-230`, outermost → innermost):
`QueryClientProvider` → `AuthProvider` → `EventTrackingProvider` → MUI `ThemeProvider`
→ `TooltipProvider` → `ErrorBoundary(module="app-root")` → layout `Box`.

The shell theme is a neutral gray theme defined in `App.tsx`. Individual page bodies re-theme to the
green/gold banking palette (`CustomerDashboard` and `HouseholdPage` each wrap their content in a
second `ThemeProvider`).

### 1.1 Shell subdirectories

These two subdirectories under `client/src/components/` form the app frame and are **Active**:

| File | Imported by | Role |
|---|---|---|
| `header/Header.tsx` | `App.tsx:22` | Top app bar; imports `CustomerSearch`, `PanelIcon`, and `PROJECTS` for breadcrumbs (`Header.tsx:9,14,15`) |
| `header/PanelIcon.tsx` | `Header.tsx:9` | Drawer toggle icon |
| `navbar/Navbar.tsx` | `App.tsx:23` | Left drawer nav; imports `Logo` and `PROJECTS` (`Navbar.tsx:29-31`) |
| `navbar/Logo.tsx` | `Navbar.tsx:31` | Brand logo in the drawer header |

Navigation structure is defined once in `client/src/projects.tsx` (`PROJECTS`) and consumed by both
`Header` (breadcrumbs) and `Navbar` (drawer items).

---

## 2. Routing configuration

`client/src/App.tsx:166-180` (`wouter <Switch>`):

```tsx
<Switch>
  <Route path="/" component={() => <Redirect to="/ciq/client" />} />
  <Route path="/ciq/household" component={HouseholdPage} />
  <Route path="/ciq/:tabView" component={CustomerDashboard} />
  <Route path="/admin/users" component={UserManagement} />
  <Route path="/account/:accountId">{(params) => <AccountDetailOption2 accountId={params.accountId} />}</Route>
  <Route path="/rbr" component={RBRShell} />
  {/*
    <Route path="/household/customer/:customerId" component={HouseholdPage} />
    <Route path="/household/:id" component={HouseholdPage} />
    <Route path="/household/option1" component={HouseholdPageOption1} />
    <Route path="/household/option2" component={HouseholdPageOption2} />
  */}
  <Route component={NotFound} />
</Switch>
```

| Path | Component | File | Status |
|---|---|---|---|
| `/` | Redirect → `/ciq/client` | n/a | Active |
| `/ciq/household` | `HouseholdPage` | `client/src/pages/HouseholdPage.tsx` | Active |
| `/ciq/:tabView` | `CustomerDashboard` | `client/src/components/CustomerDashboard.tsx` | Active: catch-all driving the `client` / `accounts` views |
| `/admin/users` | `UserManagement` | `client/src/pages/UserManagement.tsx` | Active |
| `/account/:accountId` | `AccountDetailOption2` | `client/src/components/AccountDetailOption2.tsx` | Active: standalone account detail |
| `/rbr` | `RBRShell` | `client/src/components/RBRShell.tsx` | Active but **environment-gated** (see §2.1) |
| (fallback) | `NotFound` | `client/src/pages/not-found.tsx` | Active |

> The `/household/customer/:customerId`, `/household/:id`, `/household/option1`, and
> `/household/option2` routes are **commented out** (`App.tsx:173-178`). `HouseholdPageOption1.tsx`
> and `HouseholdPageOption2.tsx` are still `import`-ed at the top of `App.tsx` (lines 17-18) but are
> not reachable at any route, so treat them as unused (see §5).

`CustomerDashboard` is mounted at `/ciq/:tabView`, **not** at `/`. The `:tabView` URL segment drives
the active view (`client`, `accounts`); the `accounts` segment maps internally to the
`accountSummary` view. There is no on-screen tab strip; the on-page MUI `<Tabs>` block is commented
out (`CustomerDashboard.tsx:673`), so switching between Client / Accounts / Household happens through
the **left navbar + URL**.

### 2.1 RBR environment gating

`RBRShell.tsx` renders an embedded `<iframe>` for the "Relationship Based Review" app. Its navbar
entry is added only when the hostname includes `dev`, `test`, or `localhost`
(`client/src/projects.tsx:44-62`). The `/rbr` route itself is always registered, but the nav link to
it does not appear in preprod/prod hostnames.

> **[CONFIRM]** The RBR embedded reporting backend has been retired. Confirm whether `RBRShell.tsx`,
> its `/rbr` route, and the navbar entry should now be removed, since the iframe target still coded
> in `RBRShell.tsx` no longer resolves to a live backend.

---

## 3. Pages directory

Location: `client/src/pages/`

| File | Status | Route | Notes |
|---|---|---|---|
| `HouseholdPage.tsx` | **Active** | `/ciq/household` | Household summary, members table, aggregated accounts (reuses `AccountList`'s `AccountTable`), household notes |
| `UserManagement.tsx` | **Active** | `/admin/users` | Admin user/role table; reachable in-nav only at privilege level ≥ 4 |
| `not-found.tsx` | **Active** | fallback | 404 for unmatched routes |
| `HouseholdPageOption1.tsx` | **Unused** | none (route commented out) | Alternate household layout; imported by `App.tsx:17` but not routed |
| `HouseholdPageOption2.tsx` | **Unused** | none (route commented out) | Alternate household layout; imported by `App.tsx:18` but not routed |

---

## 4. Active components

Location: `client/src/components/` (and the `header/` + `navbar/` subdirectories in §1.1).

All entries below are rendered on a reachable route. "Imported by" names the nearest active parent.

| File | Imported by | Role |
|---|---|---|
| `CustomerDashboard.tsx` | `App.tsx` (`/ciq/:tabView`) | Customer-360 view; hosts the Client and Accounts views |
| `CustomerSearch.tsx` | `header/Header.tsx:15` | Global unified search box in the app bar (clients/accounts/households) |
| `CustomerOverview.tsx` | `CustomerDashboard:41` | Client profile card (chips, CIF, masked Tax ID); opens `CustomerDetailModal` and `MaintenanceItems` |
| `CustomerDetailModal.tsx` | `CustomerOverview.tsx:25` | "View Full Details" modal (`/api/customers/:id/details`) |
| `MaintenanceItems.tsx` | `CustomerOverview.tsx:28` | Maintenance-items modal (invoked from the overview card; trigger currently visually hidden) |
| `ContactInformation.tsx` | `CustomerDashboard:45` | Contacts card (`/api/customers/:id/contacts`) |
| `Officers.tsx` | `CustomerDashboard:46` | Assigned-officer card (`/api/customers/:id/officers`) |
| `Middle.tsx` | `CustomerDashboard:63` | Relationship / QoQ KPI band (Total Deposits, Total Loans, Last Login, Recent Contacts); gated by `customer.view.relationship_summary` |
| `ClientEngagement.tsx` | `CustomerDashboard:50` | Engagement metrics card (`/api/customers/:id/client-engagement`) |
| `RecentContactHistory_VariantC.tsx` | `CustomerDashboard:52` | Recent-contact card (the wired variant); gated by `customer.view.recent_activity` |
| `Deposits.tsx` | `CustomerDashboard:49` | Deposits card; gated by `customer.view.deposits` |
| `AccountList.tsx` | `CustomerDashboard:47`, `HouseholdPage` | Owned/affiliated account tables; exports the internal `AccountTable` reused by `HouseholdPage` |
| `AccountSummaryTableVersion.tsx` | `CustomerDashboard:42` | Accounts-view portfolio table; opens `DebitCardDetailModal` |
| `TransactionHistory.tsx` | `CustomerDashboard:48` | Transaction table (account/customer-scoped) |
| `AccountDetailOption2.tsx` | `App.tsx` (`/account/:accountId`), `CustomerDashboard:43` | Canonical account-detail screen (inline in dashboard **and** the standalone route) |
| `AccountBalanceTrends.tsx` | `AccountDetailOption2.tsx:37` | Balance-trend chart rendered inside account detail (`AccountDetailOption2.tsx:303`) |
| `DebitCardDetailModal.tsx` | `AccountSummaryTableVersion.tsx:43`, `AccountDetailOption2.tsx:36` | Debit-card detail modal |
| `FormatTransactionAmount.tsx` | `Deposits.tsx:48`, `AccountDetailOption2.tsx:40` | Transaction-amount formatting helper component |
| `NotesSection.tsx` | `CustomerDashboard:53` | Customer/account notes (`targetType`); create/edit/delete/restore |
| `NoteEditorModal.tsx` | `NotesSection.tsx:48`, `HouseholdPage:62` | Note create/edit modal |
| `NoteVersionHistoryModal.tsx` | `NotesSection.tsx:49` | Note version-history viewer |
| `PermissionGuard.tsx` | `CustomerDashboard` and others | Declarative RBAC wrapper (`permissionCode` / `requireAny` / `requireAll` / `minPrivilegeLevel`) |
| `ErrorBoundary.tsx` | `App.tsx:11` | Root and per-module error boundary |
| `SectionLabel.tsx` | `CustomerDashboard:64` | Section heading label |
| `PanelTitle.tsx` | `ContactInformation`, `CustomerOverview`, `Middle` | Card title header used across active cards |
| `BackButton.tsx` | `CustomerDashboard:55` (+ others) | In-page back-navigation button |
| `RBRShell.tsx` | `App.tsx` (`/rbr`) | RBR iframe (env-gated nav, §2.1) |
| `header/Header.tsx`, `header/PanelIcon.tsx`, `navbar/Navbar.tsx`, `navbar/Logo.tsx` | `App.tsx` | Shell (§1.1) |

> Note on `NoteVersionHistoryModal.tsx`: it is imported by the active `NotesSection.tsx:49` **and** by
> the unused `NotesTab.tsx:32`. It is Active by virtue of the `NotesSection` path.

---

## 5. Imported-but-unreachable components (dead branches / rendered-out)

These files are `import`-ed by an active module but are **never rendered on a reachable path**. The
render site is either commented out or inside an unreachable conditional branch. They will not affect
the running app until re-wired.

| File | Imported by | Why it is dead |
|---|---|---|
| `TotalRelationshipSummary.tsx` | `CustomerDashboard:51` | Its render block is **commented out** (`CustomerDashboard.tsx:849-855`). The live relationship KPI band is `Middle.tsx`. |
| `HouseholdRelationships.tsx` | `CustomerDashboard:44` | Rendered only inside the household-tab branch of `CustomerDashboard` (`:793`), which is unreachable. Household relationships in production come from `pages/HouseholdPage.tsx` (routed at `/ciq/household`). |
| `HouseholdPageOption1.tsx`, `HouseholdPageOption2.tsx` | `App.tsx:17-18` | Imported but their routes are commented out (`App.tsx:173-178`). |

---

## 6. Not-wired components (alternate variants, replaced designs)

These files are not imported by any active module (or are imported only by another unused file). They
are safe to ignore when tracing production behavior.

| File | Status | Notes |
|---|---|---|
| `TopBar.tsx` | Unused / legacy | **Not** imported by `App.tsx`. The real shell is `Header` + `Navbar` (§1). No non-example importer exists. |
| `RiskCompliance.tsx` | Unused | No non-example importer. Only `components/examples/RiskCompliance.tsx` remains as a reference stub. |
| `AccountCard.tsx` | Unused | Imported only by the also-unused `AccountSummary.tsx:41`. |
| `AccountSummary.tsx` | Unused | Replaced by `AccountSummaryTableVersion.tsx`. No active importer. |
| `NotesTab.tsx` | Unused | Alternate notes container; no active importer. |
| `RecentContactHistory.tsx` | Unused | Base recent-contact design; superseded by `RecentContactHistory_VariantC.tsx`. |
| `RecentContactHistory_VariantA.tsx` | Unused | Rejected design variant. |
| `RecentContactHistory_VariantB.tsx` | Unused | Rejected design variant. |
| `AccountDetailOption1.tsx` | Unused | Alternate account-detail layout. Only Option2 is wired. |
| `AccountDetailOption3.tsx` | Unused | Alternate account-detail layout. |
| `AccountDetailCD.tsx` | Unused | Type-specific detail variant (CD); not routed. |
| `AccountDetailCreditCard.tsx` | Unused | Type-specific detail variant (credit card). |
| `AccountDetailHELOC.tsx` | Unused | Type-specific detail variant (HELOC). |
| `AccountDetailMortgage.tsx` | Unused | Type-specific detail variant (mortgage). |
| `AccountDetailSavings.tsx` | Unused | Type-specific detail variant (savings). |

> `AccountBalanceTrends.tsx` and `FormatTransactionAmount.tsx` are **not** in this list; both are
> imported and rendered by the active `AccountDetailOption2` / `Deposits` path (see §4).

---

## 7. Examples directory

Location: `client/src/components/examples/` (**8 files**), none imported anywhere in the production
codebase. Kept as reference implementations / design explorations only.

```
AccountSummary.tsx
ContactInformation.tsx
CustomerDashboard.tsx
CustomerOverview.tsx
CustomerSearch.tsx
HouseholdRelationships.tsx
RiskCompliance.tsx
TransactionHistory.tsx
```

These are same-named copies of production components and must not be confused with the top-level
`client/src/components/*` files. All are Unused.

---

## 8. UI primitives directory (shadcn/Radix)

Location: `client/src/components/ui/` (**47 files**, not "50+").

The application UI is predominantly **MUI**, not shadcn. Most of the `ui/*` shadcn/Radix primitives
are unused scaffolding in the active screens. Only a subset is imported anywhere in `client/src`:

```
button   card   dialog   input   label   separator
sheet    skeleton   toast   toaster   toggle   tooltip
```

Of those, only `toaster` and `tooltip` are wired into the app root (`App.tsx:5-6` →
`<Toaster />` and `<TooltipProvider />`). The remaining ~35 files in `ui/` have no importer in the
active tree.

> Do not treat the `ui/*` directory as an active production component library. When building a new
> screen, follow the existing MUI patterns used by the Active components in §4 rather than reaching
> for these primitives.

---

## 9. File status summary

Counts reflect the classification above (top-level `client/src/components/*.tsx` and `client/src/pages/*`,
excluding `header/`, `navbar/`, `examples/`, and `ui/`, which are summarized separately).

| Status | Count | Description |
|---|---|---|
| Active (components) | 25 | Rendered on a reachable route (§4) |
| Active (pages) | 3 | `HouseholdPage`, `UserManagement`, `not-found` |
| Active (shell subdirs) | 4 | `header/` (2) + `navbar/` (2) |
| Imported-but-unreachable | 5 | 3 components (§5) + `HouseholdPageOption1/2` |
| Not-wired (variants) | 15 | Alternate/replaced components (§6) |
| Examples | 8 | Reference copies (§7) |
| UI primitives | 47 | Mostly unused scaffolding; ~12 imported, 2 wired at root (§8) |

> The prior guide's counts ("ACTIVE 23 / DEMO 2 / UNUSED 4 / EXAMPLE 8 / UI 50+") and its
> `/` → `CustomerDashboard`, `TopBar`-shell, and `/household/*` routing are all obsolete and were
> replaced by this audit.

---

## 10. Import chain (from App.tsx)

```
App.tsx
├── Header (shell)
│   ├── PanelIcon
│   └── CustomerSearch            (global search box)
├── Navbar (shell)
│   └── Logo
├── Router (<Switch>)
│   ├── "/"                → Redirect → /ciq/client
│   ├── /ciq/household     → HouseholdPage
│   │   ├── AccountList (AccountTable, reused)
│   │   └── NoteEditorModal
│   ├── /ciq/:tabView      → CustomerDashboard
│   │   ├── CustomerOverview
│   │   │   ├── CustomerDetailModal
│   │   │   ├── MaintenanceItems
│   │   │   └── PanelTitle
│   │   ├── ContactInformation (PanelTitle)
│   │   ├── Officers
│   │   ├── Middle (PanelTitle)
│   │   ├── ClientEngagement
│   │   ├── RecentContactHistory_VariantC
│   │   ├── Deposits
│   │   │   ├── FormatTransactionAmount
│   │   │   └── DebitCardDetailModal
│   │   ├── AccountList (AccountTable)
│   │   ├── AccountSummaryTableVersion
│   │   │   └── DebitCardDetailModal
│   │   ├── AccountDetailOption2
│   │   │   ├── AccountBalanceTrends
│   │   │   ├── FormatTransactionAmount
│   │   │   └── DebitCardDetailModal
│   │   ├── TransactionHistory
│   │   ├── NotesSection
│   │   │   ├── NoteEditorModal
│   │   │   └── NoteVersionHistoryModal
│   │   ├── SectionLabel / BackButton
│   │   ├── PermissionGuard        (wraps gated sections)
│   │   ├── TotalRelationshipSummary   [rendered-out, commented]
│   │   └── HouseholdRelationships     [dead branch, unreachable household tab]
│   ├── /admin/users       → UserManagement
│   ├── /account/:accountId → AccountDetailOption2  (see subtree above)
│   ├── /rbr               → RBRShell   (env-gated nav)
│   └── (fallback)         → NotFound
├── ErrorBoundary (module="app-root")
├── Toaster (ui/toaster)
└── TooltipProvider (ui/tooltip)
```

Bracketed nodes are imported but not rendered on a reachable path (§5).

---

## 11. Guidance on deleting unused files

The files in §5, §6, and §7 (and the unused `HouseholdPageOption1/2` pages) are not reachable and
could be removed without affecting the running app. Whether to delete them or keep them for design
history / rollback is a **team governance decision**, not something derivable from the code. The
code only tells us which files are currently unimported.

> **[CONFIRM]** Whether the frontend owner wants the alternate account-detail variants,
> `RecentContactHistory` A/B/base, `AccountSummary` / `AccountCard`, `NotesTab`, `RiskCompliance`,
> `TopBar`, `TotalRelationshipSummary`, `HouseholdRelationships`, and `HouseholdPageOption1/2`
> deleted or retained. Re-run the import analysis in §4-§6 before removing any file, since a variant
> can be re-wired at any time.

> **[CONFIRM]** The authoritative application/version string. The prior "ClientIQ v3" label is not
> derivable from the frontend source.
