import { z } from "zod";
import { uuidSchema, workspaceTypeSchema } from "./common";

export const workspaceCreateSchema = z.strictObject({ workspaceType: workspaceTypeSchema });
export const workspaceQuerySchema = z.strictObject({ workspaceId: uuidSchema });
export const assetPathSchema = z.string().max(200).regex(/^[0-9a-f-]{36}\/(photos|avatars|logos)\/[0-9a-f-]{36}\.webp$/);
export const personalOnboardingSchema = z.strictObject({
  workspaceId: uuidSchema, defaultPassName: z.string().trim().min(1).max(40), avatarPath: assetPathSchema.optional(),
});
export const organizationOnboardingSchema = z.strictObject({
  workspaceId: uuidSchema, name: z.string().trim().min(1).max(100),
  industry: z.enum(["tech", "edu", "event", "other"]), logoPath: assetPathSchema.optional(),
});
export const onboardingSchema = z.union([personalOnboardingSchema, organizationOnboardingSchema]);
export const workspaceRecordSchema = z.object({
  id: uuidSchema, owner_id: uuidSchema, workspace_type: workspaceTypeSchema,
  name: z.string(), default_pass_name: z.string().nullable(), avatar_path: z.string().nullable(),
  onboarding_completed: z.boolean(), created_at: z.string(),
});
