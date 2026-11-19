# Passify

Pass issuance and verification for personal and organization workspaces, using Next.js,
Supabase Auth/PostgreSQL/private Storage, TypeScript and Zod. Includes all 14 original templates,
private images, QR verification, management, groups, CSV import and PNG/PDF/print export.

## Local setup

Use Node.js 24 and Docker Desktop with Linux containers. On Windows, use `.cmd` shims if
PowerShell blocks npm scripts.

```powershell
npm.cmd ci
npm.cmd run db:start
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
# Fill .env.local with the local Supabase URL and keys printed by Supabase.
npm.cmd run db:migrate
npm.cmd run dev
```

Open http://localhost:3000. Register, then open the confirmation email in the local mail inbox
at http://127.0.0.1:54324 using the same browser. One confirmed account can create one workspace
of each type. There are no default account credentials. The old JSON user store is no longer used;
old demo accounts must register again.

## Validation

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run db:types:check
npm.cmd run build
npx.cmd playwright install chromium
# Keep the local app and Supabase running in separate terminals:
npm.cmd run test:e2e -- --workers=1
```

Unit/database tests need no credentials or Docker. Browser tests require the isolated local stack
and create unique test users. Webpack is selected explicitly because the original Turbopack/PostCSS
worker failed on this Windows setup.

- [Setup and architecture](docs/backend-setup.md)
- [API contracts](docs/api.md)
- [Deployment, security and operations](docs/operations.md)
- [Implementation and validation report](docs/backend-report.md)
- [Five-phase plan](docs/backend-plan.md)
- [Historical Phase 1 report](docs/phase-1-report.md)

QR codes check the current pass record; they do not prove the presenter's identity. A downloaded
pass still verifies against current expiry/revocation status.
