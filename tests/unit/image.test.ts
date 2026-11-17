import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MAX_UPLOAD_BYTES, processImage } from "@/lib/storage/image";

describe("decoded image validation", () => {
  it.each(["jpeg", "png", "webp"] as const)("processes %s to bounded metadata-free WebP", async (format) => {
    const input = await sharp({ create: { width: 1600, height: 800, channels: 3, background: "red" } }).toFormat(format).withMetadata({ orientation: 6 }).toBuffer();
    const output = await processImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp"); expect(Math.max(meta.width!, meta.height!)).toBe(800);
    expect(meta.exif).toBeUndefined(); expect(meta.orientation).toBeUndefined();
  });
  it("rejects corrupt bytes, empty files and disguised SVG", async () => {
    for (const bytes of [Buffer.alloc(0), Buffer.from("not an image"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')]) {
      await expect(processImage(bytes)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
  });
  it("rejects oversized input before decoding", async () => {
    await expect(processImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });
  it("rejects compressed images exceeding the input pixel cap", async () => {
    const input = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
    await expect(processImage(input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
