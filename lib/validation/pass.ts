import { z } from "zod";
import { assetPathSchema } from "./workspace";
import { holderNameSchema, holderTitleSchema, paginationSchema, uuidSchema, workspaceTypeSchema } from "./common";

export const passFieldsSchema = z.strictObject({
  templateId: z.string().min(1).max(80), holderName: holderNameSchema, holderTitle: holderTitleSchema,
  externalId: z.string().trim().min(1).max(20).optional(), groupId: uuidSchema.optional(),
  photoPath: assetPathSchema.optional(), expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const passCreateSchema = passFieldsSchema.extend({ workspaceId: uuidSchema });
export const passEditSchema = z.strictObject({
  holderName: holderNameSchema.optional(), holderTitle: holderTitleSchema.optional(),
  expiresAt: z.iso.datetime({ offset: true }).nullable().optional(), photoPath: assetPathSchema.nullable().optional(), groupId: uuidSchema.nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one field is required.");
export const passListSchema = paginationSchema.extend({
  workspaceId: uuidSchema, search: z.string().trim().max(100).default(""),
  status: z.enum(["all", "active", "expired", "revoked"]).default("all"), groupId: uuidSchema.optional(),
});
export const revokeSchema = z.strictObject({ reason: z.string().trim().min(1).max(500) });
export const passRecordSchema = z.object({
  id: uuidSchema, workspace_id: uuidSchema, workspace_type: workspaceTypeSchema,
  template_id: z.string(), group_id: uuidSchema.nullable(), pass_number: z.string(), verification_token: z.string(),
  holder_name: z.string(), holder_title: z.string(), organization_name: z.string().nullable(), external_id: z.string().nullable(), photo_path: z.string().nullable(),
  issued_at: z.string(), expires_at: z.string().nullable(), revoked_at: z.string().nullable(), revocation_reason: z.string().nullable(), created_at: z.string(), updated_at: z.string(),
});
export const passListResultSchema = z.object({
  items: z.array(passRecordSchema.omit({ verification_token: true }).extend({ status: z.enum(["active", "expired", "revoked"]) })),
  total: z.number(), page: z.number(), limit: z.number(),
});
export type PassListResult = z.infer<typeof passListResultSchema>;
export type PassDetail = Omit<z.infer<typeof passRecordSchema>, "verification_token"> & { status: "active" | "expired" | "revoked"; verificationUrl: string; photoUrl: string | null; timezone: string };
