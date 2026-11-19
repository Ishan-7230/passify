import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/config/server";
import { ApiError } from "@/lib/http/errors";

/** Shared PostgreSQL limiter. No raw emails/user identifiers in its keys. */
export async function rateLimit(operation: string, subject: string, limit: number, windowSeconds: number) {
  const digest = createHmac("sha256", getServerEnv().SUPABASE_SECRET_KEY).update(subject).digest("hex");
  const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
    p_key: `${operation}:${digest}`, p_limit: limit, p_window_seconds: windowSeconds,
  });
  if (error) throw new ApiError("UNAVAILABLE", "The service is temporarily unavailable.");
  if (!data) throw new ApiError("RATE_LIMITED", "Too many attempts. Please try again later.");
}
