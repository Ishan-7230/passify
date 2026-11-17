import "server-only";
import type { z } from "zod";
import { getServerEnv } from "@/lib/config/server";
import { ApiError } from "./errors";

export function assertMutationOrigin(request: Request, allowedOrigins?: readonly string[]) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const env = allowedOrigins ? null : getServerEnv();
  const allowed = allowedOrigins ?? [env!.APP_URL, ...env!.ALLOWED_ORIGINS];
  const origin = request.headers.get("origin");
  // Never derive trusted origins from caller-controlled Host/forwarded headers.
  if (!origin || !allowed.includes(origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError("FORBIDDEN", "Request origin is not allowed.");
  }
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T, maxBytes = 64 * 1024): Promise<z.output<T>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ApiError("INVALID_INPUT", "Expected application/json.");
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE", "Request body is too large.");
  if (!request.body) throw new ApiError("INVALID_INPUT", "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError("PAYLOAD_TOO_LARGE", "Request body is too large.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError("INVALID_INPUT", "Malformed JSON."); }
  return schema.parse(body);
}
