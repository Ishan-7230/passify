import { Temporal } from "@js-temporal/polyfill";

export type PassStatus = "active" | "expired" | "revoked";
export function getPassStatus(pass: { revoked_at: string | null; expires_at: string | null }, now = new Date()): PassStatus {
  return pass.revoked_at ? "revoked" : pass.expires_at && Date.parse(pass.expires_at) <= now.getTime() ? "expired" : "active";
}
/** The chosen calendar day is valid through local midnight (exclusive), including DST. */
export function dateToExpiry(date: string, timezone = "Asia/Kolkata") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Use a YYYY-MM-DD date.");
  return Temporal.PlainDate.from(date, { overflow: "reject" }).add({ days: 1 }).toZonedDateTime(timezone).toInstant().toString();
}
export function expiryToDate(expiry: string, timezone = "Asia/Kolkata") {
  return Temporal.Instant.from(expiry).subtract({ nanoseconds: 1 }).toZonedDateTimeISO(timezone).toPlainDate().toString();
}
