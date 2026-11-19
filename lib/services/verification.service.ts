import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificationTokenSchema } from "@/lib/validation/common";
import { ApiError } from "@/lib/http/errors";
import { rateLimit } from "./rate-limit.service";

const resultSchema = z.object({ valid: z.boolean(), status: z.enum(["active", "expired", "revoked", "not_found"]), passNumber: z.string().optional(), organization: z.string().optional(), issuedAt: z.string().optional(), expiresAt: z.string().nullable().optional() });
export async function verifyPass(token: string) {
  if (!verificationTokenSchema.safeParse(token).success) return { valid: false, status: "not_found" as const };
  try {
    // A global budget bounds random-token floods; per-token limit bounds log/lookup pressure.
    await rateLimit("verify-global", "public", 600, 60);
    await rateLimit("verify-token", token, 60, 60);
    const { data, error } = await createAdminClient().rpc("verify_pass", { p_token: token });
    if (error) throw error;
    return resultSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && error.code === "RATE_LIMITED") throw error;
    throw new ApiError("UNAVAILABLE", "Verification is temporarily unavailable. Please try again.");
  }
}
