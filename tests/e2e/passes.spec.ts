import { test, expect, type Page, type APIResponse } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import jsQR from "jsqr";
import { readFile } from "node:fs/promises";
import { passTemplates } from "../../components/pass/templates";
import { orgTemplates } from "../../components/pass/orgTemplates";

process.loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const appUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
if (new URL(apiUrl).hostname !== "127.0.0.1" || !["localhost","127.0.0.1"].includes(new URL(appUrl).hostname)) throw new Error("Use the isolated local stack only.");
const admin = createClient(apiUrl,process.env.SUPABASE_SECRET_KEY!,{ auth:{ persistSession:false,autoRefreshToken:false } });
const password = "Local-Passify-Fixture-825!";
async function data(response: APIResponse) {
  const body = await response.json(); expect(response.ok(),JSON.stringify(body)).toBe(true); return body.data;
}
async function login(page: Page, mode: "personal" | "organization") {
  const email = `passes-${crypto.randomUUID()}@example.test`;
  const result = await admin.auth.admin.createUser({ email,password,email_confirm:true,user_metadata:{ display_name:"Alex Morgan" } });
  expect(result.error).toBeNull();
  await page.goto(`/login/${mode}`);
  await page.getByLabel("Email Address").fill(email); await page.getByLabel("Password",{ exact:true }).fill(password);
  await page.getByRole("button",{ name:/START SESSION/ }).click();
  await expect(page).toHaveURL(new RegExp(`/onboarding/${mode}$`),{ timeout:30_000 });
  const workspaces = await data(await page.request.get("/api/workspaces"));
  return workspaces[0].id as string;
}
async function decode(bytes: Buffer) {
  const { data: pixels,info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  return jsQR(new Uint8ClampedArray(pixels),info.width,info.height)?.data;
}
test("both builders, all 14 exports, lifecycle, groups, import and tenant isolation",async ({ page,browser },info) => {
  test.setTimeout(360_000);
  const workspace = await login(page,"personal");
  await data(await page.request.patch("/api/onboarding",{ headers:{ Origin:appUrl },data:{ workspaceId:workspace,defaultPassName:"Alex" } }));
  const png = await sharp({ create:{ width:240,height:240,channels:3,background:"#38bdf8" } }).png().toBuffer();
  await page.goto("/dashboard/personal/builder?template=design-1");
  await page.getByLabel("Name",{ exact:true }).fill("Alex Morgan"); await page.getByLabel("Title",{ exact:true }).fill("Engineer");
  await page.getByLabel("Photo",{ exact:true }).setInputFiles({ name:"photo.png",mimeType:"image/png",buffer:png });
  await page.getByRole("button",{ name:"GENERATE PASS" }).click();
  await expect(page).toHaveURL(/\/dashboard\/personal\/passes\/[a-f0-9-]+$/,{ timeout:30_000 });
  const firstId = page.url().split("/").at(-1)!;
  const first = await data(await page.request.get(`/api/passes/${firstId}`));
  const org = await data(await page.request.post("/api/workspaces",{ headers:{ Origin:appUrl },data:{ workspaceType:"organization" } }));
  await data(await page.request.patch("/api/onboarding",{ headers:{ Origin:appUrl },data:{ workspaceId:org.id,name:"Arcade Labs",industry:"tech" } }));
  const group = await data(await page.request.post("/api/groups",{ headers:{ Origin:appUrl },data:{ workspaceId:org.id,name:"Launch",groupType:"event" } }));
  await data(await page.request.patch(`/api/groups/${group.id}`,{ headers:{ Origin:appUrl },data:{ name:"Launch Team" } }));
  await page.goto("/dashboard/organization/builder?template=corporate-navy");
  await page.getByLabel("Name",{ exact:true }).fill("Alex Morgan"); await page.getByLabel("Role / Title",{ exact:true }).fill("Engineer");
  await page.getByLabel("Group",{ exact:true }).selectOption(group.id);
  await page.getByRole("button",{ name:"GENERATE PASS" }).click();
  await expect(page).toHaveURL(/\/dashboard\/organization\/passes\/[a-f0-9-]+$/);
  const orgId = page.url().split("/").at(-1)!;
  const issued: { id:string; mode:string; template:string; verificationUrl:string }[] = [];
  for (const template of [...passTemplates,...orgTemplates]) {
    const personal = template.id.startsWith("design-"); const mode = personal ? "personal" : "organization";
    let id = template.id === "design-1" ? firstId : template.id === "corporate-navy" ? orgId : "";
    if (!id) {
      const body = { workspaceId:personal ? workspace : org.id,templateId:template.id,holderName:"Alex Morgan",holderTitle:"Engineer",...(personal ? { photoPath:first.photo_path } : {}),expiresAt:null };
      const key = crypto.randomUUID();
      const created = await data(await page.request.post("/api/passes",{ headers:{ Origin:appUrl,"Idempotency-Key":key },data:body })); id = created.id;
      expect((await data(await page.request.post("/api/passes",{ headers:{ Origin:appUrl,"Idempotency-Key":key },data:body })))).toMatchObject({ id });
      expect((await page.request.post("/api/passes",{ headers:{ Origin:appUrl,"Idempotency-Key":key },data:{ ...body,holderName:"Changed" } })).status()).toBe(409);
    }
    const detail = await data(await page.request.get(`/api/passes/${id}`));
    issued.push({ id,mode,template:template.id,verificationUrl:detail.verificationUrl });
    await page.goto(`/dashboard/${mode}/passes/${id}`);
    await expect(page.getByRole("heading",{ name:"YOUR ISSUED PASS" })).toBeVisible();
    const qr = await page.request.get(`/api/passes/${id}/qr`); expect(await decode(await qr.body())).toBe(detail.verificationUrl);
    const downloadWait = page.waitForEvent("download"); await page.getByRole("button",{ name:"DOWNLOAD PNG" }).click();
    const download = await downloadWait; const file = info.outputPath(`${template.id}.png`); await download.saveAs(file);
    expect(await decode(await readFile(file)),`${template.id} exported QR`).toBe(detail.verificationUrl);
    const pdfWait = page.waitForEvent("download"); await page.getByRole("button",{ name:"DOWNLOAD PDF" }).click();
    const pdf = await pdfWait; const pdfFile = info.outputPath(`${template.id}.pdf`); await pdf.saveAs(pdfFile);
    expect((await readFile(pdfFile)).subarray(0,5).toString()).toBe("%PDF-");
    if (template.id === "design-1" || template.id === "corporate-navy") await page.screenshot({ path:info.outputPath(`${mode}-detail.png`),fullPage:true });
  }
  const outsiderContext = await browser.newContext({ baseURL:appUrl }); const outsider = await outsiderContext.newPage();
  try {
    await login(outsider,"organization");
    for (const url of [`/api/passes/${firstId}`,`/api/passes/${firstId}/qr`,`/api/passes?workspaceId=${workspace}`,`/api/organizations?workspaceId=${org.id}`,`/api/uploads?workspaceId=${workspace}&path=${encodeURIComponent(first.photo_path)}`]) expect((await outsider.request.get(url)).status()).toBe(404);
    expect((await outsider.request.patch(`/api/passes/${firstId}`,{ headers:{ Origin:appUrl },data:{ holderName:"Hijacked" } })).status()).toBe(404);
    expect((await outsider.request.post(`/api/passes/${firstId}/revoke`,{ headers:{ Origin:appUrl },data:{ reason:"Hijacked" } })).status()).toBe(404);
    expect((await outsider.request.patch(`/api/groups/${group.id}`,{ headers:{ Origin:appUrl },data:{ name:"Hijacked" } })).status()).toBe(404);
  } finally { await outsiderContext.close(); }
  expect((await page.request.post("/api/passes",{ headers:{ Origin:"https://evil.example" },data:{} })).status()).toBe(403);
  const publicToken = first.verificationUrl.split("/").at(-1);
  let verified = await page.request.get(`/api/verify/${publicToken}`); expect(verified.headers()["cache-control"]).toContain("no-store");
  expect(await data(verified)).toMatchObject({ valid:true,status:"active" });
  await page.goto(`/dashboard/personal/passes/${firstId}`); await page.getByLabel("Name",{ exact:true }).fill("Alex Updated"); await page.getByRole("button",{ name:"Save changes" }).click();
  await expect.poll(async () => (await data(await page.request.get(`/api/passes/${firstId}`))).holder_name).toBe("Alex Updated");
  await page.getByLabel("Reason",{ exact:true }).fill("Replaced"); await page.getByRole("checkbox").check(); await page.getByRole("button",{ name:"Revoke permanently" }).click();
  await expect(page.getByText("REVOKED",{ exact:true })).toBeVisible();
  verified = await page.request.get(`/api/verify/${publicToken}`); expect(await data(verified)).toMatchObject({ valid:false,status:"revoked" });
  expect((await page.request.patch(`/api/passes/${firstId}`,{ headers:{ Origin:appUrl },data:{ holderName:"Reactivate" } })).status()).toBe(409);
  const missing = await page.request.get(`/api/verify/${"z".repeat(43)}`); expect(missing.status()).toBe(404);
  const key = crypto.randomUUID(); const csv = Buffer.from("name,role,external_id,valid_until\nChris,Staff,0001,2099-01-01\nPat,Staff,0002,2099-01-01");
  const bulk = (dryRun:string) => page.request.post("/api/passes/bulk",{ headers:{ Origin:appUrl },multipart:{ workspaceId:org.id,templateId:"corporate-navy",groupId:group.id,idempotencyKey:key,dryRun,file:{ name:"passes.csv",mimeType:"text/csv",buffer:csv } } });
  expect(await data(await bulk("true"))).toMatchObject({ totalRows:2,created:0,rowErrors:[] });
  const imported = await data(await bulk("false")); expect(imported).toMatchObject({ created:2,failed:0 }); expect(await data(await bulk("false"))).toEqual(imported);
  expect(await data(await bulk("true"))).toMatchObject({ failed:2 });
  const list = await data(await page.request.get(`/api/passes?workspaceId=${org.id}&search=0001&limit=1`)); expect(list.total).toBe(1); expect(list.items[0].external_id).toBe("0001"); expect(list.items[0]).not.toHaveProperty("verification_token");
  expect(await data(await page.request.get(`/api/dashboard/stats?workspaceId=${org.id}`))).toMatchObject({ total:10,active:10 });
  await page.goto("/dashboard/organization"); await page.screenshot({ path:info.outputPath("organization-dashboard.png"),fullPage:true });
  await page.goto(first.verificationUrl); await expect(page.getByText(/REVOKED/i).first()).toBeVisible();
  await page.screenshot({ path:info.outputPath("revoked-verification.png"),fullPage:true });
  await page.context().clearCookies(); expect((await page.request.get(`/api/passes/${firstId}`)).status()).toBe(401);
});
