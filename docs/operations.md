# Deployment, security and operations

## Deployment checklist

No production deployment is performed by local setup. Use separate development, test and production
Supabase projects. Review the source, migrations and validation report before publishing.

1. Configure Vercel's Node.js 24 runtime, install locked dependencies and use `npm run build`.
2. Configure all `.env.example` values separately per environment. `APP_URL` must be the permanent
   canonical HTTPS origin, not a temporary preview URL. Never prefix the secret key with NEXT_PUBLIC.
3. Review/apply the ordered SQL migrations using the approved remote Supabase workflow. Do not run
   database reset. Verify all 14 templates, RLS, grants, RPC execution restrictions and the private bucket.
4. Configure Auth Site URL and exact `/auth/callback` redirects for each intended origin. Keep email
   confirmation and secure password changes enabled. Configure production SMTP and test delivery.
5. Configure hosting/Auth abuse limits, TLS, monitoring and log redaction. Validate body/time limits
   for 4 MiB image input and a 500-row CSV on the chosen hosting plan. Adjust quotas only after measurement.
6. Enable suitable PostgreSQL backup/PITR and a separate Storage backup policy. Rehearse restoration
   into an isolated project, including Auth identities and matching private object paths.
7. Smoke-test registration, confirmation, both workspaces, image upload, issuance, dashboard reload,
   exports, public verification, expiry, revocation and logout on the actual deployment.
8. Scan exported PNG, PDF and physical prints from a separate phone; revoke and rescan the same QR.
   Repeat all template layouts. Local localhost links cannot validate cross-device reachability.

Remote migration, push/merge and production deployment require separate explicit authorization.
Do not put production credentials into the local browser test fixture configuration.

## Logging and privacy

Application API errors log only an event, request ID and safe error code. Next development request
logging is disabled to avoid callback codes, signed URLs and server-action arguments. Configure
hosting/reverse-proxy/observability products to redact callback query strings, `/verify/*` path
credentials, cookies, authorization headers and signed Storage URLs. Application settings alone
cannot control provider access logs. Do not capture request bodies or full Supabase errors.

Verification reveals only issuer, public pass number, status and dates. It does not reveal the holder
or prove identity. Treat the unguessable verification URL as a shareable credential; revoke a pass
if its continued use is inappropriate. A copied QR cannot be distinguished from the original.

SSR cookies use SameSite=Lax and Secure in production, with supported Supabase SSR refresh handling.
The SSR client can access Auth cookies; do not add an unsupported HttpOnly scheme without changing
the Auth architecture. Apply normal XSS prevention and keep dependencies current.

## Retention and cleanup

MVP defaults retain passes, idempotency receipts and audits; no background deletion runs automatically.
Decide contractual retention before production. Avoid removing receipts while clients may retry old
keys. Verification stores no IP/user-agent/holder data and writes at most once per pass/status/minute.
Rate buckets are capped and expired buckets are opportunistically pruned, but retention still needs
an operator schedule on a live system.

Suggested starting policy, subject to organizational requirements: retain verification events for
30 days and expired rate buckets for one day; retain audits according to the organization's policy.
Run any maintenance as a trusted operator with a preview count, bounded batches and a backup.
Example verification pruning after approval:

```sql
delete from public.verification_logs
where id in (
  select id from public.verification_logs
  where verified_at < now() - interval '30 days'
  order by verified_at limit 10000
);
```

The owned cleanup API/UI safely removes unattached uploads older than 24 hours, up to 100 per call.
Claim markers prevent races and support retries after Storage failures. Never delete objects by
prefix alone: match validated upload metadata and all references. Upload metadata failure triggers
compensation of only the newly uploaded object. If compensation fails, a safe event is logged;
reconcile object inventory against metadata under operator review before deleting orphans.

Replaced previously attached assets are deliberately retained by automatic cleanup. To reclaim them,
review all pass/workspace/profile/organization references first. Do not delete referenced assets.

## Account/privacy deletion procedure

There is no public account-deletion endpoint in this MVP. A trusted operator must:

1. Verify the account holder and applicable retention requirements; preview exact owned workspace IDs.
2. Suspend the account/revoke sessions and prevent new mutations; record a protected deletion manifest.
3. Inventory its validated Storage paths. Resolve any required retention/export before deletion.
4. Delete the account/application records through a reviewed database/Auth operation, respecting
   foreign keys; delete only the inventoried private objects through the Storage API.
5. Verify no owned workspaces, objects or application records remain. If either system fails,
   resume from the manifest, not an inferred path prefix. Apply the backup expiry policy and record
   completion without retaining unnecessary personal data.

Database cascade behavior does not remove Storage objects. Do not delete Auth users casually or
claim deletion is complete until both database and object inventory have been checked.

## Dependency advisory

Next.js was updated from 16.3.8 to 16.4.6, and compatible dependency fixes were applied. The recorded
production-only npm audit returned zero vulnerabilities. Full audit still reports development-tool
findings from [picomatch GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), which
listed no patched release when reviewed. These affect lint/test glob tooling, not application routes.
Do not run developer tools as exposed network services or feed untrusted glob patterns into them.
Recheck the advisory and update when a patch is available; do not use `npm audit fix --force` to
silently downgrade the framework or test runner. Audit status is a dated check, not a permanent guarantee.

## Limits and release checks

The MVP has one owner per workspace, no multi-user roles, no payments, no multi-pass PDF and no group
deletion. These were not required. Group listing caps at 1000. The shared global verification budget
can be exhausted; host abuse controls and monitoring are needed in production. No scheduled retention
job, hosted SMTP, backup configuration or physical printer/phone check has been performed locally.

Do not cache authenticated pages/APIs or verification at a CDN. Test failure behavior as well as success:
database/Auth/Storage outages must remain unavailable, not valid/not-found or false success.
