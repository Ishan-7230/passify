import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/http/errors";
import { processImage, MAX_UPLOAD_BYTES } from "@/lib/storage/image";
import { assetPathSchema, workspaceQuerySchema } from "@/lib/validation/workspace";
import { databaseError } from "./database-error";
import { rateLimit } from "./rate-limit.service";

const BUCKET = "passify-assets";
export const uploadFieldsSchema = workspaceQuerySchema.extend({ purpose: z.enum(["photo", "avatar", "logo"]) });
const directories = { photo: "photos", avatar: "avatars", logo: "logos" } as const;

export async function uploadImage(fields: unknown, file: File) {
  const { workspaceId, purpose } = uploadFieldsSchema.parse(fields);
  const { user, workspace, db } = await requireWorkspace(workspaceId);
  if ((purpose === "avatar" && workspace.workspace_type !== "personal") || (purpose === "logo" && workspace.workspace_type !== "organization")) {
    throw new ApiError("INVALID_INPUT", "This image purpose does not match the workspace.");
  }
  await rateLimit("upload", user.id, 30, 600);
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE", "Images must be 4 MiB or smaller.");
  const bytes = await processImage(new Uint8Array(await file.arrayBuffer()));
  const path = `${workspace.id}/${directories[purpose]}/${randomUUID()}.webp`;
  const { error: storageError } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: false, cacheControl: "0" });
  if (storageError) throw new ApiError("INTERNAL_ERROR", "Image upload failed. Please try again.");
  const { error } = await db.from("uploads").insert({ workspace_id: workspace.id, object_path: path, purpose, byte_size: bytes.byteLength });
  if (error) {
    const { error: cleanupError } = await db.storage.from(BUCKET).remove([path]);
    if (cleanupError) console.error(JSON.stringify({ event: "upload_compensation_failed" }));
    throw new ApiError("INTERNAL_ERROR", "Image upload could not be saved. Please try again.");
  }
  return { path };
}

export async function signOwnedAsset(workspaceId: string, objectPath: string) {
  const { workspace, db } = await requireWorkspace(workspaceId);
  const path = assetPathSchema.parse(objectPath);
  const { data, error } = await db.from("uploads").select("id").eq("workspace_id", workspace.id).eq("object_path", path).is("deletion_started_at", null).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new ApiError("NOT_FOUND", "Image not found.");
  const result = await db.storage.from(BUCKET).createSignedUrl(path, 60);
  if (result.error || !result.data) throw new ApiError("INTERNAL_ERROR", "Image preview is temporarily unavailable.");
  return { url: result.data.signedUrl, expiresIn: 60 };
}

export async function cleanupAbandonedUploads(workspaceId: string) {
  const { user, workspace, db } = await requireWorkspace(workspaceId);
  await rateLimit("upload-cleanup", user.id, 5, 3600);
  const { data, error } = await db.rpc("claim_abandoned_uploads", { p_actor_id: user.id, p_workspace_id: workspace.id });
  if (error) databaseError(error);
  const claimed = z.array(z.object({ id: z.uuid(), object_path: assetPathSchema })).parse(data);
  if (!claimed.length) return { removed: 0 };
  const result = await db.storage.from(BUCKET).remove(claimed.map((row) => row.object_path));
  if (result.error) throw new ApiError("INTERNAL_ERROR", "Cleanup could not finish. It can be retried safely.");
  const deletion = await db.from("uploads").delete().eq("workspace_id", workspace.id).in("id", claimed.map((row) => row.id)).not("deletion_started_at", "is", null);
  if (deletion.error) databaseError(deletion.error);
  return { removed: claimed.length };
}

export async function readOwnedAsset(workspaceId: string, objectPath: string) {
  const { workspace, db } = await requireWorkspace(workspaceId);
  const path = assetPathSchema.parse(objectPath);
  const { data, error } = await db.from("uploads").select("id").eq("workspace_id", workspace.id).eq("object_path", path).is("deletion_started_at", null).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new ApiError("NOT_FOUND", "Image not found.");
  const result = await db.storage.from(BUCKET).download(path);
  if (result.error || !result.data) throw new ApiError("NOT_FOUND", "Image not found.");
  return result.data;
}
