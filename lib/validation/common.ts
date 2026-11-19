import { z } from "zod";

export const workspaceTypeSchema = z.enum(["personal", "organization"]);
export const uuidSchema = z.uuid();
export const holderNameSchema = z.string().trim().min(1).max(40);
export const holderTitleSchema = z.string().trim().min(1).max(40);
export const verificationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
export const paginationSchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
