import "server-only";
import { createHash, randomBytes } from "node:crypto";
export function newPassCredentials() { return { passNumber: `PSF-${randomBytes(6).toString("hex").toUpperCase()}`, token: randomBytes(32).toString("base64url") }; }
export function payloadHash(value: unknown): string {
  const canonical = (input: unknown): unknown => Array.isArray(input) ? input.map(canonical) : input && typeof input === "object"
    ? Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : input;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
