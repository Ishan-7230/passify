# Phase 1 checkpoint: foundation and database

Implemented on `codex/backend`. No commit, push, remote migration or deployment was performed.
Phase 2 has not started. The user's approval is required to continue.

## Delivered

- Five-phase plan, repository inventory, route map, proposed changes and baseline check results.
- Supabase SSR/browser and isolated server-only privileged clients, using generated database types.
- Startup configuration validation, public/secret key separation, exact origin allowlist configuration,
  `.env.example`, ignored environment files and Node 24 runtime declaration.
- Shared strict validation, bounded JSON reader, mutation-origin check, safe API error envelopes,
  generated request IDs and no-store responses. These helpers are ready for later API handlers.
- Two versioned migrations: 11 application tables, five enums, indexes, composite tenant foreign keys,
  one workspace per owner/type, template matching, asset references, retry receipts and import jobs.
- Database protection for issued identifiers and irreversible revocation; expiry/date constraints;
  RLS, least-privilege service grants, no browser table privileges, restricted future function defaults.
- Exact 14 frontend template IDs/names seeded through migration.
- Private `passify-assets` bucket with 4 MiB/WebP restriction and restrictive browser-access policies.
- Reproducible generated TypeScript database types from actual migrated PostgreSQL catalogs.
- Vitest/PostgreSQL test harness, Playwright desktop/mobile configuration and local Supabase configuration.
- Setup instructions and architecture/entity diagrams.

## Executed validation

| Check | Actual outcome |
| --- | --- |
| Backend dependency installation | Passed; lockfile updated |
| `npm.cmd test` | **39 passed**: 27 PostgreSQL schema/permission tests and 12 configuration/HTTP tests |
| Fresh PostgreSQL migrations | Both migrations applied in disposable PGlite databases; Auth/Storage managed-schema fixtures documented |
| `npm.cmd run db:types` | Passed; generated public-schema types with enum and relationship metadata |
| `npm.cmd run db:types:check` | Passed; generated output matches migrations |
| `npm.cmd run lint:backend` | Passed, no warnings/errors |
| `npm.cmd run typecheck` | Passed, including Next route type generation |
| `npm.cmd run build -- --webpack` | **Passed**, compiled and generated all existing pages |
| `npm.cmd run lint` | Same baseline **3 errors, 7 warnings**; no added backend errors |
| Default Turbopack build | Baseline failed: Google-font network access, then PostCSS worker connection; Webpack verified instead |
| `git diff --check` | Passed |
| Git environment exclusions | `.env.local`, `.env.production`, `.env.test` ignored; `.env.example` available to track |
| Supabase CLI help | Verified installed CLI 3: migrations are local by default; no obsolete `--local` flag |
| `npm.cmd audit --json` | 8 findings: 1 critical package (existing Next.js), 7 moderate lint-tool dependency findings |

The build used temporary, clearly fake process environment values to validate compilation, not real
Supabase credentials. It made no authenticated Supabase calls and does not prove backend connectivity.
Actual local/project configuration is required before running the server. No fake values were saved to
`.env.local`. The npm scripts still use the normal Turbopack default; Webpack was a verification fallback.

The first test iteration caught and fixed a throwing URL refinement and PostgreSQL's global default
PUBLIC function EXECUTE grant (a per-schema revoke alone cannot remove it). TypeScript also caught a
test fixture union; it was corrected before the final passing run.

## Test coverage and limits

Database tests execute PostgreSQL constraints, triggers, transactions, grants, RLS and restrictive Storage
policies. They include two unrelated owners, cross-workspace group/photo/actor/receipt attempts, wrong
template/workspace types, duplicate workspaces/tokens/numbers/import keys, expiry boundaries, revocation
immutability, referenced-asset deletion, transaction rollback, and exact template seed comparisons.

Auth/Storage schemas in this harness are minimal test fixtures. Live Supabase Auth, PostgREST and Storage
HTTP behavior was **not tested**: Docker's Linux engine is not running and no development project is
configured. Application-service tenant guards and E2E tests will be added with those services in later
phases. No phone-scan/export claims are made at this checkpoint.

## Known work before release

- Replace custom JSON/HMAC auth, add refresh proxy/confirmation/recovery, verified identity and ownership
  checks, and connect persistent onboarding/uploads in Phase 2. Existing UI and local users are intact.
- Implement remaining lifecycle/management/frontend features in Phases 3-4. Mock dashboard records and
  simulated onboarding are still present until those integrations; this checkpoint is not a completed MVP.
- Resolve existing animation lint errors during frontend hardening.
- Upgrade and verify the existing Next.js 16.3.8 security advisories and lint-tool transitive dependencies
  before release. Audit proposed Next.js 16.4.6 as the available non-major fix; verify current advisories
  and installed guides when upgrading. No force/major dependency upgrade was performed in this phase.
- Run full Supabase and browser/mobile integration checks once local Docker or a dedicated dev/test
  project is available. Keep development/test separate from production.

## Next approval

Approve Phase 2 to replace authentication and implement workspace provisioning/ownership, transactional
onboarding, and validated private photo/avatar/logo uploads. This is the checkpoint requested by the user,
not an additional approval requirement introduced by a skill.
