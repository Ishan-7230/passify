import { z } from "zod";
import { workspaceTypeSchema } from "./common";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(128);
export const loginSchema = z.strictObject({ workspace: workspaceTypeSchema, email: emailSchema, password: z.string().min(1).max(128) });
export const signupSchema = loginSchema.extend({ name: z.string().trim().min(1).max(100), password: passwordSchema });
export const recoverySchema = z.strictObject({ workspace: workspaceTypeSchema, email: emailSchema });
export const passwordUpdateSchema = z.strictObject({
  workspace: workspaceTypeSchema, password: passwordSchema, confirmPassword: passwordSchema,
}).refine((input) => input.password === input.confirmPassword, { message: "Passwords must match.", path: ["confirmPassword"] });
