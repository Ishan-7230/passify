import "server-only";
import sharp from "sharp";
import { ApiError } from "@/lib/http/errors";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const supported = new Set(["jpeg", "png", "webp"]);

export async function processImage(input: Uint8Array) {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE", "Images must be 4 MiB or smaller.");
  if (!input.byteLength) throw new ApiError("INVALID_INPUT", "Choose a JPEG, PNG or WebP image.");
  try {
    const image = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: "warning", animated: true });
    const metadata = await image.metadata();
    if (!metadata.format || !supported.has(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
    // Rotation consumes EXIF orientation. Default output strips metadata.
    return await image.rotate().resize(800, 800, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw new ApiError("INVALID_INPUT", "Choose a valid, non-animated JPEG, PNG or WebP image under 20 megapixels.");
  }
}
