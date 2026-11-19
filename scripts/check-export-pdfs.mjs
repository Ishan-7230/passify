import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import jsQR from "jsqr";

const directory = path.resolve(process.argv[2] ?? "test-results");
async function decode(file) {
  const { data, info } = await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  return jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data;
}
const files = (await readdir(directory)).filter((name) => name.endsWith("-pdf-render.png"));
if (files.filter((name) => !name.includes("-print-")).length !== 14) throw new Error("Expected 14 rendered badge PDFs");
for (const name of files) {
  const source = name.replace("-print","").replace("-pdf-render.png",".png");
  const original = await decode(path.join(directory,source));
  const rendered = await decode(path.join(directory,name));
  if (!original || original !== rendered) throw new Error(`QR mismatch: ${name}`);
  console.log(`PDF QR verified: ${name.replace("-pdf-render.png","")}`);
}
