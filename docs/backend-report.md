# Backend implementation report

Work began 17 November 2026 and continued 18 November 2026 on `codex/backend`. The supplied PDF's
13 implementation sections were grouped into five phases. After approving Phase 2, the user
authorized completing all remaining phases without checkpoint pauses. The supplied document was
used as a specification; it was not treated as evidence that any code or deployment already existed.

The original baseline is `2737207`. On resuming, implementation through the first verification pass
was already committed as `f0be256` (`Add backend and Supabase integration files`). This continuation
preserves that commit and adds fixes, validation and documentation in the working tree. No remote
push, production migration or deployment was performed.

## Delivered scope

| Phase | Implementation |
| --- | --- |
| 1 — Foundation | Environment validation, server/browser/SSR clients, HTTP guards/errors, five migrations, template seeds, private bucket, RLS/grants, generated types, test harness |
| 2 — Accounts | Supabase signup/login/confirmation/recovery/logout, verified-user guards, one workspace per mode, atomic provisioning/onboarding, private processed images and cleanup |
| 3 — Pass lifecycle | Atomic audited issuance, random identifiers, idempotency, status derivation, QR, minimal public verification, irreversible revocation, shared rate limits |
| 4 — Management/UI | Both real builders, dashboards/search/filters/pagination/counts, pass edits, organization settings/groups, CSV dry-run/atomic import, 14 templates, PNG/PDF/print |
| 5 — Verification/handoff | SQL/unit and real local-stack browser tests, dependency updates, export checks, setup/API/architecture/operations documentation |

The legacy JSON authentication implementation was removed; the local data file was not read,
migrated or deleted. Existing template definitions/art and the pink/cyan visual theme were retained.
Mock dashboard records and simulated saves were replaced. Public marketing counters were changed
to factual feature counts. Baseline render/effect lint errors were fixed with deterministic decoration.

## Verification fixes

- Preserved original CSV record numbers after invalid records; date errors now have bounded messages.
- Invalid/foreign pass detail pages show not-found instead of a generic rendering failure.
- Manual client forms remain disabled until hydration, preventing early native submission and lost input.
- Export requests respect strict private-image query schemas; cache keys include photo path parameters.
- Export capture removes centering margins that otherwise clipped the right side of badges/QRs.
- Print CSS removes surrounding layout rather than leaving invisible content occupying extra pages.
- Constrained the mobile badge grid to prevent a fixed-width preview from widening the page;
  browser tests now assert that pass details fit the viewport.
- Preserved Next.js request-time rendering signals outside the authentication error handler;
  the production build exposed this issue even though development browser flows passed.
- Updated Next.js 16.3.8 to 16.4.6 and applied compatible dependency fixes; explicit Webpack scripts
  avoid the original Windows Turbopack/PostCSS worker failure.

## Executed checks

- `npm test`: **81 passed** across eight files. Real migration/SQL tests cover roles, constraints,
  ownership, atomic audits/import rollback, idempotency, expiry, revocation, filtering, counters,
  bounded verification logging and cleanup. Unit tests cover validation, dates/DST, identifiers,
  malformed/oversized/animated images, CSV and fail-closed verification outages/rate limits.
- `npm run lint`: **passed**, no warnings/errors.
- `npm run typecheck`: **passed**.
- `npm run db:types:check`: **passed**.
- `npm run build`: **passed** with Next.js 16.4.6/Webpack. All authenticated and API routes were
  classified dynamic. The first build found the caught request-context signal described above;
  the corrected build passed compilation, TypeScript and prerendering.
- `node scripts/check-client-secrets.mjs`: **passed**, the configured server secret was absent
  from 73 client artifacts. Git tracks only `.env.example`, not local credentials/test artifacts.
- `git diff --check`: **passed**.
- Local Supabase Auth/PostgreSQL/PostgREST/Storage/email stack: started; all five migrations applied.
- `npx playwright test --workers=1 --output=test-results/final-e2e`: **4 passed** in 5.7 minutes,
  covering desktop Chromium and Pixel 7 emulation. Both modes exercise real Auth/Storage, builders,
  saved data, edits/revocation, two-tenant access rejection, groups, CSV validation/import/retry,
  search/counts and all 14 PNG/PDF downloads. Every exported PNG's QR was decoded and compared
  to its stored pass URL. Screenshots were inspected, then the mobile grid received the additional
  overflow fix described above.
- Targeted mobile rerun after that fix: **passed** in 2.5 minutes, including the no-overflow
  assertion and all 14 exports. The 14 PDFs from this corrected mobile run were also rasterized
  and their QR codes successfully compared with their PNGs.
- Focused desktop account regression after the authentication/build fix: **passed** in one minute,
  covering signup/confirmation, both workspaces, private assets, logout and password recovery.
- `render-export-pdfs.py` plus `check-export-pdfs.mjs`: **passed** for 14 badge PDFs and two
  print-to-PDF outputs. All contain exactly one page and decode to their corresponding PNG's URL.
  The 14-template contact sheet was visually inspected for clipping and QR placement.
- `npm audit --omit=dev`: **zero vulnerabilities** on 18 November 2026.
- Full `npm audit`: **16 high development dependency findings**, all arising through picomatch's
  unpatched glob ReDoS advisory. See [operations](operations.md); this is not reported as a clean audit.

Earlier browser runs caught the form/export issues above and are not counted as passing acceptance
runs. A resumed run also failed while local services were stopped. Automatic approval review once
blocked a rerun because of its usage limit; after the user resumed, approval and execution succeeded.

The production compile check used process-scoped HTTPS validation origins
(`APP_URL=https://passify.example.com`, `NEXT_PUBLIC_SUPABASE_URL=https://127.0.0.1:54321`)
and existing local keys. It did not connect to a production project or change `.env.local`.
That artifact is a compile check, not a configured deployment: set real production HTTPS values
and rebuild before release. Browser acceptance used the actual local HTTP app and Supabase stack.

## Handoff and remaining external checks

Use [README](../README.md) and [setup](backend-setup.md) for local reproduction,
[API contracts](api.md) for integration, and [operations](operations.md) for release preparation.

Production SMTP, hosted migrations, Vercel environment configuration, backups, retention scheduling
and provider log redaction must be configured for the actual deployment. They were not performed
against a live account. Physical phone/printer scans cannot be claimed from automated browser tests;
they remain explicit release checks using the final HTTPS APP_URL. Browser emulation is not a
physical-device test. The remaining development dependency advisory needs monitoring for a patch.

All five implementation phases are complete for local handoff. The development app was left running
at `http://localhost:3000` with the isolated Passify Supabase stack. Latest fixes/documentation remain
uncommitted in the working tree for review; no push or deployment was performed.
