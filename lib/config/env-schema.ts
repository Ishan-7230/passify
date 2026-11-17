import { z } from "zod";

const httpUrl = z.string().url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "Must be an HTTP(S) URL without credentials");

const origin = httpUrl.refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.pathname === "/" && !url.search && !url.hash;
}, "Must be an origin without a path, query or fragment").transform((value) => new URL(value).origin);

const key = z.string().trim().min(20).refine(
  (value) => !/replace-with|placeholder|\.\.\./i.test(value),
  "Replace placeholder credentials",
);

// This is a configuration mistake check, not JWT authentication/signature validation.
function hasLegacyRole(value: string, role: string) {
  try {
    const payload = value.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))?.role === role;
  } catch { return false; }
}

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: origin.refine((value) => URL.canParse(value) && new URL(value).hostname !== "project.supabase.co", "Replace placeholder project URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key.refine(
    (value) => value.startsWith("sb_publishable_") || hasLegacyRole(value, "anon"),
    "Use a publishable or legacy anon key; a secret key must never be public",
  ),
});

export const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SECRET_KEY: key.refine((value) => value.startsWith("sb_secret_") || hasLegacyRole(value, "service_role"), "Use a server secret or legacy service-role key"),
  APP_URL: origin,
  ALLOWED_ORIGINS: z.string().default("").transform((value) => value.split(",").map((item) => item.trim()).filter(Boolean)).pipe(z.array(origin)),
});

export function parseServerEnv(input: Record<string, string | undefined>) {
  const result = serverEnvSchema.safeParse(input);
  if (!result.success) {
    // Report names only: Zod issues/inputs can contain credentials.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path[0]))];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}. See .env.example.`);
  }
  if (input.NODE_ENV === "production") {
    const urls = [result.data.APP_URL, result.data.NEXT_PUBLIC_SUPABASE_URL, ...result.data.ALLOWED_ORIGINS];
    if (urls.some((value) => new URL(value).protocol !== "https:")) {
      throw new Error("Production APP_URL, Supabase URL and allowed origins must use HTTPS.");
    }
  }
  return result.data;
}
