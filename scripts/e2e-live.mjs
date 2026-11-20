// Checks for the live guide: content is published on the server and the installed guide picks it up
// with no rebuild and no reinstall. Starts its own web server on :3012.
// Usage: npm run test:live
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS || join(root, "test-results"); mkdirSync(shots, { recursive: true });
const WEB = "http://localhost:3012", CODE = "live-test-code";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pack = () => spawnSync("node", ["scripts/build-knowledge.mjs"], { cwd: root });
const get = (code) => fetch(WEB + "/api/content", { headers: code ? { "x-hcm-coach-code": code } : {} });

const guideFile = join(root, "web/guides/change-manager.json");
const original = readFileSync(guideFile, "utf8");
const newGuide = join(root, "web/guides/zz-live-test.json");
const badGuide = join(root, "web/guides/zz-live-bad.json");
let web;
try {
  const b = spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), encoding: "utf8", env: { ...process.env, HCM_COACH_MODE: "guide", HCM_COACH_CONTENT_URL: WEB } });
  if (b.status !== 0) { console.error(b.stderr); throw new Error("build failed"); }
  const ext = join(root, "extension/dist-guide-live");
  const manifest = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
  check("live build: one address allowed, still no site access", manifest.content_security_policy.extension_pages.endsWith(`connect-src ${WEB}`) && !manifest.host_permissions && !manifest.content_scripts && JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "sidePanel"]));

  web = spawn("npx", ["next", "dev", "-p", "3012"], { cwd: join(root, "web"), stdio: "ignore", detached: true, env: { ...process.env, HCM_COACH_ACCESS_CODE: CODE } });
  for (let i = 0; i < 90; i++) { try { if ((await get(CODE)).ok) break; } catch {} await sleep(1000); }
  check("content feed refuses a missing or wrong access code", (await get(null)).status === 401 && (await get("nope")).status === 401);
  const v1 = await (await get(CODE)).json();
  check("content feed returns guides, contacts, rubrics and job aids with a version", v1.version?.length === 12 && v1.lessons.length >= 1 && v1.contacts.length >= 1 && v1.rubrics.length >= 1 && v1.knowledge.length === 8);

  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "live-")), { channel: "chromium", headless: true, viewport: { width: 400, height: 1000 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const requests = []; ctx.on("request", (q) => requests.push(q.url()));
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  const panel = ctx.pages()[0] ?? await ctx.newPage();
  await panel.goto(`chrome-extension://${id}/sidepanel.html`);
  const see = (t, ms = 8000) => panel.getByText(t, { exact: false }).first().waitFor({ timeout: ms }).then(() => true, () => false);
  await panel.getByRole("button", { name: /Got it/ }).click();
  check("before a code is entered it uses the built-in guides and sends nothing", await see("Using the guides that came with this install") && !requests.some((u) => u.startsWith(WEB)));
  await panel.getByPlaceholder(/HCM Academy contact/).fill(CODE);
  await panel.getByRole("button", { name: "Save" }).click();
  check("with the code it downloads the current content", await see(`version ${v1.version}`));

  // Publish a change on the server: retitle a guide, add a new one, and add one that breaks the rules.
  writeFileSync(guideFile, original.replace('"title": "Change an Employee\'s Manager"', '"title": "Change an Employee\'s Manager (updated)"'));
  const fresh = JSON.parse(original); fresh.id = "live-test-guide"; fresh.title = "Brand New Guide From The Server"; fresh.series = "HCM Academy · New";
  writeFileSync(newGuide, JSON.stringify(fresh, null, 2));
  const bad = JSON.parse(original); bad.id = "live-bad-guide"; bad.title = "Guide That Names A Website"; bad.allowedDomains = ["evil.example.com"]; bad.startUrl = "/";
  writeFileSync(badGuide, JSON.stringify(bad, null, 2));
  pack(); await sleep(2500);
  let v2; for (let i = 0; i < 20; i++) { v2 = await (await get(CODE)).json(); if (v2.version !== v1.version) break; await sleep(1000); }
  check("publishing on the server changes the version", v2.version !== v1.version);
  await panel.getByRole("button", { name: "Check for updates" }).click();
  check("the installed guide shows the new and changed guides with no rebuild or reinstall", await see("Brand New Guide From The Server") && await see("Change an Employee's Manager (updated)") && await see(`version ${v2.version}`));
  check("a guide that breaks the rules is dropped, not shown", !(await see("Guide That Names A Website", 800)));
  await panel.screenshot({ path: join(shots, "live-library.png") });

  // A guide in progress is not changed under the person.
  await panel.locator(".lesson-card", { hasText: "Brand New Guide From The Server" }).click();
  await panel.getByRole("button", { name: /^Start/ }).click();
  check("a downloaded guide runs", await panel.locator(".step-title", { hasText: "Find the employee" }).waitFor({ timeout: 6000 }).then(() => true, () => false));
  await panel.getByRole("button", { name: /^Done$/ }).click();
  await panel.locator(".option", { hasText: "The employee shows in the results." }).click();
  await panel.getByRole("button", { name: /^Next/ }).click();
  check("and advances", await panel.locator(".step-title", { hasText: "Open Change Manager" }).waitFor({ timeout: 6000 }).then(() => true, () => false));

  // With the server gone, the last download is still there.
  try { process.kill(-web.pid); } catch {} web = null; await sleep(1500);
  await panel.reload();
  check("with no connection it keeps working from the last download", await panel.locator(".step-title", { hasText: "Open Change Manager" }).waitFor({ timeout: 6000 }).then(() => true, () => false));
  const outside = [...new Set(requests.filter((u) => !u.startsWith(`chrome-extension://${id}/`)))];
  check("the only outside address ever contacted is the content feed", outside.length === 1 && outside[0] === WEB + "/api/content", outside.join(" "));
  check("any other address is blocked by the security policy", (await panel.evaluate(async () => { try { await fetch("https://example.com/"); return "allowed"; } catch { return "blocked"; } })) === "blocked");
  await ctx.close();
} finally {
  if (web) try { process.kill(-web.pid); } catch {}
  writeFileSync(guideFile, original); rmSync(newGuide, { force: true }); rmSync(badGuide, { force: true }); pack();
  spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), env: { ...process.env, HCM_COACH_MODE: "guide", HCM_COACH_CONTENT_URL: "https://hcm-coach.vercel.app" } });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.${failed.length ? "\nFAILED:\n  " + failed.map((f) => f.name).join("\n  ") : ""}`);
process.exit(failed.length ? 1 : 0);
