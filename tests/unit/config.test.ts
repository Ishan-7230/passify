import { describe, expect, it } from "vitest";
import { parseServerEnv, publicEnvSchema } from "@/lib/config/env-schema";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_value_for_tests",
  SUPABASE_SECRET_KEY: "sb_secret_example_value_for_tests",
  APP_URL: "http://localhost:3000/",
};

describe("configuration boundaries", () => {
  it("normalizes explicit origins", () => {
    expect(parseServerEnv({ ...valid, ALLOWED_ORIGINS: " https://preview.example.com/ " })).toMatchObject({
      APP_URL: "http://localhost:3000", ALLOWED_ORIGINS: ["https://preview.example.com"],
    });
  });
  it("rejects missing and placeholder config without revealing keys", () => {
    expect(() => parseServerEnv({ ...valid, APP_URL: "invalid" })).toThrow("APP_URL");
    expect(() => parseServerEnv({ ...valid, APP_URL: "invalid" })).not.toThrow(valid.SUPABASE_SECRET_KEY);
    expect(() => parseServerEnv({ ...valid, SUPABASE_SECRET_KEY: "replace-with-server-only-secret-key" })).toThrow("SUPABASE_SECRET_KEY");
    expect(() => parseServerEnv({})).toThrow("Invalid environment configuration");
  });
  it("rejects a secret key in browser configuration", () => {
    expect(publicEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valid.SUPABASE_SECRET_KEY }).success).toBe(false);
  });
  it("accepts local legacy roles but never a privileged JWT in public configuration", () => {
    const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.test-signature`;
    expect(parseServerEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("anon"), SUPABASE_SECRET_KEY: jwt("service_role") })).toBeDefined();
    expect(publicEnvSchema.safeParse({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("service_role") }).success).toBe(false);
    expect(() => parseServerEnv({ ...valid, SUPABASE_SECRET_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY })).toThrow("SUPABASE_SECRET_KEY");
  });
  it("requires HTTPS in production and disallows path or credential URLs", () => {
    expect(() => parseServerEnv({ ...valid, NODE_ENV: "production" })).toThrow("HTTPS");
    for (const APP_URL of ["https://example.com/path", "https://u:p@example.com", "javascript:alert(1)", "https://example.com?x=1"]) {
      expect(() => parseServerEnv({ ...valid, APP_URL })).toThrow("APP_URL");
    }
  });
});
