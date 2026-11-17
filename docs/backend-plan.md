# Passify backend implementation and approval gates

Source: `Passify_Backend_Master_Prompt.pdf`, v1.0, supplied by the user on 17 November 2026.
The user's instruction groups the PDF's 13 phases into five checkpoints. The user subsequently
authorized completing all remaining phases without stopping at each checkpoint. Each report must distinguish
implemented code, executed checks, blocked checks, and deferred work. No push, deployment,
production modification, or database reset is authorized.

## Five phases

| Phase | Scope and PDF mapping | Acceptance |
| --- | --- | --- |
| 1. Foundation and database | Repository audit; PDF 1-2; environment, clients, request/error helpers, schema, seeds, private bucket, permissions, generated types, test harness | Migrations run on an empty database; constraints and database-role boundaries tested; lint/type/build results recorded |
| 2. Accounts and onboarding | PDF 3 and 7; Supabase auth replacement, proxy refresh, callback/confirmation/recovery, provisioning, ownership guards, onboarding transactions, validated private uploads | Confirmed users can onboard both workspace types; reload/logout/session expiry and cross-tenant asset isolation tested |
| 3. Pass lifecycle | PDF 4-6; API contracts, atomic issuance/audits/idempotency, status, QR, public verification, revocation, durable rate limiting | Pass persists; retry creates no duplicate; active/expired/revoked/unknown/outage verification; unauthorized access rejected |
| 4. Management and UI | PDF 8-11; real builders, all dashboards, organizations/groups, search/filter/pagination/stats, edits, transactional CSV imports, PNG/PDF/print | Both real frontend flows work; imports are all-or-nothing; 14 templates render real QR and persisted data |
| 5. Security and handoff | PDF 12-13; full security matrix, integration/E2E/mobile/desktop/export tests, retention procedures, setup/API/architecture docs, deployment checklist | Actual test outcomes documented; reproducible setup; remaining external/manual checks explicit; deployment requires separate approval |

## Repository inventory at start

- Branch `main`, commit `2737207` (matches the PDF baseline); clean tracked/untracked working tree.
- Work takes place on `codex/backend`.
- Next.js 16.3.8, React 19.2.8, TypeScript 5, Tailwind 4; import alias `@/*`.
- `lib/auth/users.ts`: JSON file account store. `lib/auth/session.ts`: HMAC session cookie.
- `lib/auth/actions.ts`: server actions consumed by `WorkspaceAuthForm` and `LogoutButton`.
- Dashboard layouts check the existing custom session.
- Onboarding uses simulated saves; organization builder uses local `setCreated(true)`;
  personal builder has no completed issuance flow.
- Organization dashboard contains four mock records and fixed counts; personal dashboard
  has no saved pass data. These remain until their scheduled integration phases.
- Six personal templates and eight organization templates verified by ID and display name.
- No API route handlers, migrations, backend unit/integration tests, or E2E harness at baseline.
- Existing `data/users.json` is ignored and is not read, migrated, or deleted by Phase 1.

### Existing route map

| Routes | Role now / integration destination |
| --- | --- |
| `/`, `/get-started`, `/personal`, `/organization` | Public marketing/workspace selection |
| `/login`, `/login/personal`, `/login/organization` | Workspace login; Phase 2 Supabase actions |
| `/register`, `/register/personal`, `/register/organization` | Workspace registration; Phase 2 confirmation-aware signup |
| `/onboarding/personal`, `/onboarding/organization` | Phase 2 verified-user and workspace guard; persistent onboarding |
| `/dashboard/personal`, `/dashboard/organization` | Phase 2 identity guard; Phase 4 real data |
| `/dashboard/{personal,organization}/templates` | Existing template selectors retained |
| `/dashboard/{personal,organization}/builder` | Phase 4 upload/issuance/results integration |

### Planned API map (not implemented in Phase 1)

All private routes will verify the user and resolve owned resources server-side.
All cookie-authenticated mutations will check an explicit allowed origin.

| Methods | Route | Phase |
| --- | --- | --- |
| GET, POST | `/api/workspaces` | 2 |
| PATCH | `/api/onboarding` | 2 |
| POST | `/api/uploads` | 2 |
| GET | `/auth/callback` | 2 |
| GET, POST | `/api/passes` | 3 (listing extended in 4) |
| GET | `/api/passes/[id]` | 3 |
| POST | `/api/passes/[id]/revoke` | 3 |
| GET | `/api/passes/[id]/qr` | 3 |
| GET | `/api/verify/[token]`, `/verify/[token]` | 3 (public) |
| GET, PATCH | `/api/organizations` | 4 |
| GET, POST | `/api/groups` | 4 |
| PATCH | `/api/groups/[id]`, `/api/passes/[id]` | 4 |
| GET | `/api/dashboard/stats` | 4 |
| POST | `/api/passes/bulk` | 4 |

### Planned changes by checkpoint

1. Add `lib/config`, `lib/supabase`, `lib/http`, `lib/validation`, `instrumentation.ts`,
   `supabase/`, test/config scripts and docs. Update dependency lock, scripts and ignores.
2. Replace `lib/auth` implementation, add permission/services modules and `proxy.ts`,
   add callback and workspace/onboarding/upload handlers, connect onboarding/auth UI.
3. Add pass/verification services and SQL transaction RPCs; pass/QR/verification routes/page.
4. Connect builders, previews and dashboards; add group/profile/import services and exports.
5. Complete cross-cutting tests, security refinements, documentation and handoff.

No fake endpoints or empty domain-service implementations are added just to match a directory tree.

## Baseline checks (before backend changes)

- `npm.cmd run lint`: **failed**, 3 errors and 7 warnings. Errors are animation state updates
  in effects in `app/page.tsx` and `app/get-started/page.tsx`, plus `Math.random()` during render
  in `app/get-started/page.tsx`. Warnings include unused imports and an unoptimized preview image.
- `npx.cmd tsc --noEmit`: **passed**.
- `npm.cmd run build`: **failed** fetching existing Geist/Geist Mono Google fonts under restricted
  networking. Retried outside the sandbox: **failed** with a Turbopack PostCSS worker exiting before
  connection. Neither failure resulted from backend code.
- `docker info`: Docker Desktop Linux engine not running. Supabase Auth/Storage HTTP and full
  local-stack checks require the engine (or a dedicated development/test project) later.
- PowerShell blocks `npm.ps1`; use `npm.cmd` / `npx.cmd` on this machine.

## Decisions

- Modular Next.js App Router monolith; Supabase Auth, PostgreSQL and private Storage.
- Application data access is server-mediated. RLS is enabled, browser roles have no table grants,
  and privileged clients are server-only. RLS does **not** substitute for service ownership checks.
- Seed template IDs/names in a versioned migration so fresh non-local deployments receive them too.
- Add `issuance_requests` for single-pass idempotency, separate from CSV import jobs.
- Supplied external IDs must be unique within a workspace (null is allowed). Services normalize blank
  values to null. CSV will reject duplicates and preserve leading zeros.
- Store an organization timezone, default `Asia/Kolkata`; exclusive next-midnight UTC expiry conversion
  belongs in the issuance/import services. Expired non-revoked passes may be extended only to a future
  instant by an explicit audited edit. Revoked records cannot be edited or reactivated.
- Reject direct browser Storage access even if another broad project policy exists. Only processed
  WebP files go into `passify-assets`; signed readbacks require server authorization.
- Database tests use disposable embedded PostgreSQL (PGlite), with minimal Auth/Storage schema fixtures.
  This executes actual SQL/constraints/RLS/roles; it does not emulate Supabase Auth or Storage HTTP.
- Database types are generated from the migrated PostgreSQL catalogs, including enum and composite
  foreign-key metadata. Future transaction RPCs must be added to the type-generation workflow.
- Browser/server Auth clients are prepared in Phase 1 but not connected to the old login flow.
  `proxy.ts` and verified-user guards arrive with the Phase 2 replacement.

## Approval log

- Phase 1: implemented and checked; see `phase-1-report.md`.
- Phase 2: explicitly authorized, implemented; live integration validation in progress.
- Phases 3-5: authorized by the user's follow-up to complete all phases.
