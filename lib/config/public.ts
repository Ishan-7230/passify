import { publicEnvSchema } from "./env-schema";

export function getPublicEnv() {
  // Literal accesses are required for Next.js browser build-time substitution.
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!result.success) throw new Error("Invalid public Supabase configuration. See .env.example.");
  return result.data;
}
