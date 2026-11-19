# API contracts

## Conventions

Private routes require a confirmed Supabase user in SSR cookies. Missing/foreign resources return
404; missing authentication returns 401. Strict JSON bodies reject unknown fields and exceedance
of 64 KiB. Mutations require an exact allowed `Origin`; cross-site fetch metadata is rejected.
These are same-origin browser APIs, not a public bearer-token integration API.

Success: `{success:true,data:...}`. Error: `{success:false,error:{code,message,details?}}`.
Field details are sanitized. Responses include no-store, `X-Request-Id`, and `nosniff` headers.
Status codes: 400 invalid, 401 unauthenticated, 403 origin, 404 missing/foreign, 409 conflict,
413 too large, 429 limited, 500 internal, 503 dependency unavailable. Preserve request IDs when
reporting failures; never log credentials, CSV contents or verification URLs.

## Accounts, workspaces and assets

Auth forms use server actions. `/auth/callback` exchanges PKCE codes and accepts only fixed signup/
recovery destinations. Account metadata grants no permissions.

| Method / route | Input and result |
| --- | --- |
| GET `/api/workspaces` | Array of owned workspaces |
| POST `/api/workspaces` | `{workspaceType:"personal"}` or `organization`; idempotently provisions mode |
| PATCH `/api/onboarding` | Personal `{workspaceId,defaultPassName,avatarPath?}`; org `{workspaceId,name,industry,logoPath?}` |
| GET `/api/organizations?workspaceId=...` | Owned organization settings |
| PATCH `/api/organizations` | `{workspaceId,name?,industry?,description?,timezone?,logoPath?}` |
| POST `/api/uploads` | Multipart `file`, `workspaceId`, `purpose`; returns `{path}` |
| GET `/api/uploads?workspaceId=...&path=...` | Returns `{url}` signed for 60 seconds |
| GET `/api/uploads/content?workspaceId=...&path=...` | Authenticated no-store WebP bytes |
| DELETE `/api/uploads` | JSON `{workspaceId}`; returns `{removed}` abandoned uploads |

Industry: tech/edu/event/other. Personal name ≤40, organization name ≤100. Timezone: recognized IANA
zone, default Asia/Kolkata. Organization changes affect future issuer snapshots, not existing passes.
Upload purposes: photo (both modes), avatar (personal), logo (organization). Max image 4 MiB with
bounded multipart overhead. Cleanup claims up to 100 unreferenced, unattached uploads older than
24 hours before removal, preventing concurrent attachment; attached files are retained.

## Pass issuance and management

POST `/api/passes` requires `Idempotency-Key` (8–128 URL-safe characters) and JSON:

```json
{
  "workspaceId": "<owned-workspace-uuid>",
  "templateId": "corporate-navy",
  "holderName": "Alex Morgan",
  "holderTitle": "Engineer",
  "externalId": "0007",
  "groupId": "<owned-group-uuid>",
  "photoPath": "<path-returned-by-upload>",
  "expiresAt": "2027-05-31T18:30:00Z"
}
```

External ID, group, photo and expiry are optional except personal passes require a photo. Expiry
is future or null. Names/titles are 1–40 characters; external ID 1–20, unique per workspace and
preserves leading zeros. Issuer, owner, pass number and token are server-derived. Same key and
normalized payload returns the original pass; changed payload returns 409. HTTP 201 data contains
`id,passNumber,holderName,status,workspaceType,verificationUrl`.

Personal IDs: design-1…design-6. Organization IDs: corporate-navy, executive-gold,
conference-attendee, visitor-pass, contractor-access, campus-id, healthcare-staff, event-staff.

| Method / route | Contract |
| --- | --- |
| GET `/api/passes` | Query workspaceId, page (1–100000), limit (1–100), search (≤100), status (all/active/expired/revoked), optional groupId; returns `{items,total,page,limit}` |
| GET `/api/passes/[id]` | Persisted detail, derived status, verification URL, protected photo URL, timezone |
| PATCH `/api/passes/[id]` | Nonempty subset holderName, holderTitle, expiresAt, photoPath, groupId |
| POST `/api/passes/[id]/revoke` | `{reason}` 1–500 characters; repeated revocation idempotent |
| GET `/api/passes/[id]/qr` | Owner-only 512px PNG, black/white, M correction, four-module quiet zone |
| GET `/api/dashboard/stats?workspaceId=...` | `{total,active,expired,revoked}` at one instant |
| GET `/api/groups?workspaceId=...` | Up to 1000 groups |
| POST `/api/groups` | `{workspaceId,name,groupType,description?,startsAt?,endsAt?}` |
| PATCH `/api/groups/[id]` | Nonempty subset of group fields, excluding workspaceId |

List filtering precedes pagination; order is created_at DESC, id DESC. Tokens are excluded from
list items. Revoked passes cannot be edited/reactivated. Expired non-revoked passes can explicitly
be extended to a future expiry or have expiry cleared. Unchanged past expiry permits name edits.
Groups: event/department/membership/other; name ≤100, description ≤2000, ISO timestamps with zone,
end after start. Group deletion is not exposed.

## Public verification

GET `/api/verify/[token]` and `/verify/[token]` need no login. Tokens are 32 random bytes encoded
as 43 base64url characters. API data:

```json
{"valid":true,"status":"active","passNumber":"PSF-...","organization":"Arcade Labs","issuedAt":"...","expiresAt":null}
```

Expired/revoked return HTTP 200 with valid false. Unknown/malformed return 404 with
`{valid:false,status:"not_found"}` inside the success envelope. Outage returns a 503 error rather
than valid/not-found. No holder name, email, internal ID, photo, private path or reason is public.
API/page set no-store, noindex and no-referrer. QR verifies the record, not identity.

## CSV import

POST `/api/passes/bulk`: multipart file, workspaceId, templateId, optional groupId, idempotencyKey,
dryRun (literal true/false). Organization-only, ≤500 data records and 512 KiB.

```csv
name,role,external_id,valid_until
Alex Morgan,Student,ST001,2027-05-31
Sam Kumar,Volunteer,0002,2027-05-31
```

Headers normalize whitespace/case but all four must occur once. Empty records are skipped.
Error numbers count CSV records (header 1), not physical lines inside quoted multiline cells.
Dates are inclusive through the local day in the organization's timezone, converted to next
midnight UTC. Blank expiry means no expiry. Duplicate nonempty external IDs in the file or
workspace are rejected.

First submit dryRun:true, display validation, then confirm the exact content/options/key with
dryRun:false. Confirmation revalidates. Validation errors return HTTP 200, zero created, the whole
batch failed, and row errors. Success returns `{importId,totalRows,created,failed,rowErrors}`.
Same key/content returns the original job; changed content 409. A transaction failure rolls back
all passes/receipts/audits then records a sanitized failed job if the database is reachable. Use
a new key after correcting a recorded failed job. There is no CSV export.

## Shared limits

| Operation | Budget |
| --- | --- |
| Login | 10 / 15 min per normalized email |
| Signup / recovery | Each 5 / hour per email |
| Password change | 5 / hour per user |
| Provision workspace | 20 / 10 min per user |
| Upload | 30 / 10 min per user |
| Organization settings | 30 / 10 min per user |
| Abandoned upload cleanup | 5 / hour per user |
| Issue / edit / revoke / groups | Each 60 / 10 min per user |
| CSV requests, including dry runs | 10 / 10 min per user |
| Verification | 600 / minute globally and 60 / minute per token |

Counters are PostgreSQL-backed and HMAC subject keys contain no raw emails/tokens. Outages fail
closed. Hosting/Auth protections should also be configured in production; a public flood can
exhaust the global verification budget.
