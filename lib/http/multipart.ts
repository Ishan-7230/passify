import "server-only";
import { ApiError } from "./errors";

/** Bound multipart bytes before asking the platform parser to allocate parts. */
export async function readMultipart(request: Request, maxBytes = 4 * 1024 * 1024 + 64 * 1024) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new ApiError("INVALID_INPUT", "Expected a multipart upload.");
  if (Number(request.headers.get("content-length")) > maxBytes) throw new ApiError("PAYLOAD_TOO_LARGE", "Upload is too large.");
  if (!request.body) throw new ApiError("INVALID_INPUT", "An upload is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new ApiError("PAYLOAD_TOO_LARGE", "Upload is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return await new Response(Buffer.concat(chunks), { headers: { "content-type": contentType } }).formData(); }
  catch { throw new ApiError("INVALID_INPUT", "Malformed multipart upload."); }
}
