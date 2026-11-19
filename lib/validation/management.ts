import { z } from "zod";
import { assetPathSchema } from "./workspace";
export const groupFieldsSchema = z.strictObject({
  name: z.string().trim().min(1).max(100), groupType: z.enum(["event", "department", "membership", "other"]),
  description: z.string().max(2000).nullable().optional(), startsAt: z.iso.datetime({ offset: true }).nullable().optional(), endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export const groupCreateSchema = groupFieldsSchema.extend({ workspaceId: z.uuid() });
export const groupEditSchema = groupFieldsSchema.partial().refine((value) => Object.keys(value).length > 0);
export const organizationEditSchema = z.strictObject({
  workspaceId: z.uuid(), name: z.string().trim().min(1).max(100).optional(), industry: z.enum(["tech","edu","event","other"]).optional(),
  description: z.string().max(2000).nullable().optional(), logoPath: assetPathSchema.optional(),
  timezone: z.string().max(100).refine((zone) => { try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; } }).optional(),
});
