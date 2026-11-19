import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

try { process.loadEnvFile(".env.local"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret || secret.length < 20) throw new Error("Configure the build's server secret before checking bundles.");
let checked = 0;
async function visit(directory) {
  for (const item of await readdir(directory,{ withFileTypes:true })) {
    const file = path.join(directory,item.name);
    if (item.isDirectory()) await visit(file);
    else if (/\.(js|map|json|html)$/.test(item.name)) {
      if ((await readFile(file,"utf8")).includes(secret)) throw new Error("Server secret found in client output.");
      checked++;
    }
  }
}
await visit(".next/static");
if (!checked) throw new Error("No client files found. Build the application first.");
console.log(`Checked ${checked} client artifacts: configured server secret absent.`);
