import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { assertMutationOrigin, readJson } from "@/lib/http/request";
import { ApiError } from "@/lib/http/errors";
import { success, withApiErrors } from "@/lib/http/response";
import { paginationSchema } from "@/lib/validation/common";

const schema = z.strictObject({ name: z.string().min(1) });
function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://passify.example/api/test", { method: "POST", body, headers: { "Content-Type": "application/json", ...headers } });
}

describe("request boundaries", () => {
  it("allows only exact mutation origins", () => {
    const allowed = ["https://passify.example"];
    expect(() => assertMutationOrigin(request("{}", { origin: allowed[0] }), allowed)).not.toThrow();
    for (const origin of ["https://passify.example.evil.test", "null", "http://passify.example"]) {
      expect(() => assertMutationOrigin(request("{}", { origin }), allowed)).toThrow(ApiError);
    }
    expect(() => assertMutationOrigin(request("{}", { host: "passify.example" }), allowed)).toThrow(ApiError);
    expect(() => assertMutationOrigin(request("{}", { origin: allowed[0], "sec-fetch-site": "cross-site" }), allowed)).toThrow(ApiError);
  });
  it("accepts valid JSON but rejects malformed JSON and unknown fields", async () => {
    await expect(readJson(request('{"name":"Alex"}'), schema)).resolves.toEqual({ name: "Alex" });
    await expect(readJson(request("{"), schema)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(readJson(request('{"name":"Alex","ownerId":"other"}'), schema)).rejects.toBeInstanceOf(z.ZodError);
  });
  it("bounds actual bytes even with no Content-Length or a false low value", async () => {
    const headerCases: Record<string, string>[] = [{}, { "content-length": "1" }];
    for (const headers of headerCases) {
      await expect(readJson(request('{"name":"Alex"}', headers), schema, 4)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    }
    await expect(readJson(request("{}", { "content-type": "text/plain" }), schema)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("caps pagination and rejects unsupported query fields", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    for (const value of [{ limit: 101 }, { page: 0 }, { limit: "NaN" }, { limit: 1.5 }, { random: "x" }]) {
      expect(paginationSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("safe API envelopes", () => {
  it("returns no-store and a server-generated request ID on success", async () => {
    const response = await withApiErrors(async () => success({ id: "example" }, 201));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(await response.json()).toEqual({ success: true, data: { id: "example" } });
  });
  it("does not leak raw errors, tokens or stack traces into responses or logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await withApiErrors(async () => { throw new Error("password=private TOKEN=private SQL=private"); });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private");
    } finally { log.mockRestore(); }
  });
  it("preserves safe domain status codes", async () => {
    const response = await withApiErrors(async () => { throw new ApiError("NOT_FOUND", "Pass not found."); });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });
});
