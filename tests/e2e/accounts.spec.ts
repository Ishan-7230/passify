import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

process.loadEnvFile(".env.local");
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const appUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
if (new URL(apiUrl).hostname !== "127.0.0.1" || !["localhost", "127.0.0.1"].includes(new URL(appUrl).hostname)) {
  throw new Error("These tests create local fixtures. Use the isolated local Supabase stack only.");
}
const password = "Local-Test-Passify-824!";

async function emailLink(request: APIRequestContext, email: string) {
  let messageId = "";
  await expect.poll(async () => {
    const data = await (await request.get("http://127.0.0.1:54324/api/v1/messages")).json();
    const message = data.messages.find((item: { ID: string; To: { Address: string }[] }) => item.To.some((recipient) => recipient.Address === email));
    messageId = message?.ID ?? "";
    return Boolean(messageId);
  }, { timeout: 20_000 }).toBe(true);
  const message = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${messageId}`)).json();
  const links = [...String(message.HTML).matchAll(/href="([^"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&"));
  const link = links.find((value) => value.startsWith(`${apiUrl}/auth/v1/verify`));
  if (!link) throw new Error("Local confirmation link not found.");
  return link;
}

async function signup(page: Page, email: string) {
  await page.goto("/register/personal");
  await page.getByLabel("Display Name").fill("Alex Morgan");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /CREATE ACCOUNT/ }).click();
  await expect(page.getByRole("status")).toContainText("Check your inbox", { timeout: 30_000 });
  await page.goto(await emailLink(page.request, email));
  await expect(page).toHaveURL(/\/onboarding\/personal$/, { timeout: 30_000 });
}

test("confirmed account, both workspaces, private images, recovery and logout", async ({ page }, info) => {
  test.setTimeout(150_000);
  const email = `passify-${Date.now()}-${info.project.name}@example.test`;
  const anonymous = await page.request.get("/api/workspaces");
  expect(anonymous.status()).toBe(401);
  await signup(page, email);
  const png = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#ff2d78" } }).png().toBuffer();
  await page.getByLabel("Default Pass Name").fill("Alex's Pass");
  await page.getByLabel("Avatar / Photo (Optional)").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: /ENTER DASHBOARD/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/personal$/, { timeout: 30_000 });
  const personal = (await (await page.request.get("/api/workspaces")).json()).data.find((workspace: { workspace_type: string }) => workspace.workspace_type === "personal");
  expect(personal.onboarding_completed).toBe(true);
  expect(personal.default_pass_name).toBe("Alex's Pass");
  await page.goto("/onboarding/personal");
  await expect(page.getByLabel("Default Pass Name")).toHaveValue("Alex's Pass");
  await expect(page.getByAltText("Avatar preview")).toBeVisible();
  const signed = await page.request.get(`/api/uploads?workspaceId=${personal.id}&path=${encodeURIComponent(personal.avatar_path)}`);
  expect(signed.status()).toBe(200);
  expect((await page.request.get((await signed.json()).data.url)).status()).toBe(200);
  const publicImage = await page.request.get(`${apiUrl}/storage/v1/object/public/passify-assets/${personal.avatar_path}`);
  expect(publicImage.ok()).toBe(false);
  const wrongOrigin = await page.request.patch("/api/onboarding", { headers: { Origin: "https://evil.example" }, data: { workspaceId: personal.id, defaultPassName: "bad" } });
  expect(wrongOrigin.status()).toBe(403);
  const corrupt = await page.request.post("/api/uploads", { headers: { Origin: appUrl }, multipart: { workspaceId: personal.id, purpose: "avatar", file: { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not a picture") } } });
  expect(corrupt.status()).toBe(400);
  await page.goto("/login/organization");
  await page.getByRole("button", { name: /START SESSION/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/organization$/, { timeout: 20_000 });
  await page.getByLabel("Organization Name").fill("Arcade Labs");
  await page.getByLabel("Industry / Category").selectOption("tech");
  await page.getByLabel("Organization Logo (Optional)").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: /ENTER DASHBOARD/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/organization$/, { timeout: 20_000 });
  await page.reload();
  expect((await (await page.request.get("/api/workspaces")).json()).data).toHaveLength(2);
  const direct = createClient(apiUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  expect((await direct.auth.signInWithPassword({ email, password })).error).toBeNull();
  expect((await direct.from("workspaces").select()).error).not.toBeNull();
  await direct.auth.signOut();
  await page.getByRole("button", { name: "LOG OUT" }).click();
  await expect(page).toHaveURL(/\/login\/organization$/);
  expect((await page.request.get("/api/workspaces")).status()).toBe(401);
  await page.goto("/dashboard/personal");
  await expect(page).toHaveURL(/\/login\/personal$/);
  await page.goto("/auth/forgot-password?workspace=personal");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "SEND RECOVERY LINK" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  await page.goto(await emailLink(page.request, email));
  await expect(page).toHaveURL(/\/auth\/update-password\?workspace=personal/);
  await page.getByLabel("New password", { exact: true }).fill(`${password}New`);
  await page.getByLabel("Confirm password").fill(`${password}New`);
  await page.getByRole("button", { name: "SAVE PASSWORD" }).click();
  await expect(page).toHaveURL(/\/login\/personal\?password=updated/, { timeout: 20_000 });
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(`${password}New`);
  await page.getByRole("button", { name: /START SESSION/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/personal$/);
  await page.screenshot({ path: info.outputPath("personal-dashboard.png"), fullPage: true });
});
