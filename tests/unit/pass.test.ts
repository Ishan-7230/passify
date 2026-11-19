import { describe, expect, it } from "vitest";
import { dateToExpiry, expiryToDate, getPassStatus } from "@/lib/utils/pass";
import { newPassCredentials, payloadHash } from "@/lib/utils/identifiers";
import { parseCsv } from "@/lib/services/csv.service";
describe("pass values and CSV", () => {
  it("uses unpredictable identifiers with the required formats", () => {
    const values = Array.from({ length:100 },newPassCredentials);
    expect(new Set(values.map((v) => v.token)).size).toBe(100);
    for (const value of values) { expect(value.passNumber).toMatch(/^PSF-[A-F0-9]{12}$/); expect(value.token).toMatch(/^[A-Za-z0-9_-]{43}$/); }
    expect(payloadHash({ b:2,a:1 })).toBe(payloadHash({ a:1,b:2 }));
  });
  it("handles exact expiry and revocation precedence", () => {
    const now = new Date("2030-01-01T00:00:00Z");
    expect(getPassStatus({ revoked_at:null,expires_at:now.toISOString() },now)).toBe("expired");
    expect(getPassStatus({ revoked_at:null,expires_at:null },now)).toBe("active");
    expect(getPassStatus({ revoked_at:now.toISOString(),expires_at:now.toISOString() },now)).toBe("revoked");
  });
  it("converts inclusive calendar days in Kolkata and across DST", () => {
    expect(dateToExpiry("2030-01-01")).toBe("2030-01-01T18:30:00Z");
    expect(dateToExpiry("2030-03-10","America/New_York")).toBe("2030-03-11T04:00:00Z");
    expect(expiryToDate(dateToExpiry("2030-11-03","America/New_York"),"America/New_York")).toBe("2030-11-03");
    expect(() => dateToExpiry("2030-02-30")).toThrow();
  });
  const header = "name,role,external_id,valid_until\n";
  it("preserves leading zeros, accepts a BOM and normalizes names", () => {
    const result = parseCsv(`\uFEFF${header}\"Alex  Morgan\",Engineer,0007,2099-01-01`,"Asia/Kolkata","corporate-navy");
    expect(result.rowErrors).toEqual([]); expect(result.rows[0]).toMatchObject({ holderName:"Alex Morgan",externalId:"0007",expiresAt:"2099-01-01T18:30:00Z" });
  });
  it("reports original record numbers after invalid rows", () => {
    const result = parseCsv(`${header},Engineer,1,\nAlex,Engineer,2,\nBob,Lead,2,`,"Asia/Kolkata","corporate-navy");
    expect(result.rowNumbers).toEqual([3]); expect(result.rowErrors.map((v) => v.row)).toEqual([2,4]);
  });
  it("rejects missing/duplicate headers and batches over 500", () => {
    for (const csv of ["name,name,external_id,valid_until\nAlex,Lead,1,",`${header}${"Alex,Lead,,\n".repeat(501)}`]) expect(() => parseCsv(csv,"Asia/Kolkata","corporate-navy")).toThrow();
    expect(parseCsv(`${header}${"Alex,Lead,,\n".repeat(500)}`,"Asia/Kolkata","corporate-navy").rows).toHaveLength(500);
  });
  it("rejects malformed, invalid-date and past-date records without partial approval", () => {
    for (const row of ["Alex,Lead,1,2020-01-01","Alex,Lead,1,2099-02-30","Alex,Lead,1,,extra"]) expect(parseCsv(header+row,"Asia/Kolkata","corporate-navy").rowErrors.length).toBeGreaterThan(0);
  });
});
