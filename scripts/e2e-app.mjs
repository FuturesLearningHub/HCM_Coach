// Checks for the HCM Coach app: the guide with live updates and the built-in Help chat, against a local server.
// Help must answer only from what is loaded into the app and never contact anything.
// Usage: npm run test:app   (starts its own web server on :3015)
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS || join(root, "test-results"); mkdirSync(shots, { recursive: true });
const WEB = "http://localhost:3015", CODE = "test-code-app";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const web = spawn("npx", ["next", "dev", "-p", "3015"], { cwd: join(root, "web"), stdio: "ignore", detached: true, env: { ...process.env, HCM_COACH_ACCESS_CODE: CODE } });
const up = async () => { try { return (await fetch(WEB + "/api/content", { headers: { "x-hcm-coach-code": CODE } })).ok; } catch { return false; } };
for (let i = 0; i < 90 && !(await up()); i++) await sleep(1000);

try {
  check("the server has no AI endpoint", (await fetch(WEB + "/api/ask", { method: "POST", body: "{}" })).status === 404);
  const b = spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), encoding: "utf8", env: { ...process.env, HCM_COACH_MODE: "guide", HCM_COACH_CONTENT_URL: WEB } });
  if (b.status !== 0) { console.error(b.stderr); throw new Error("build failed"); }
  const ext = join(root, "extension/dist-guide-live");
  const manifest = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
  check("one app named HCM Coach, one address allowed, still no site access", manifest.name === "HCM Coach" && manifest.content_security_policy.extension_pages.endsWith(`connect-src ${WEB}`) && !manifest.host_permissions && !manifest.content_scripts && JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "sidePanel"]));
  check("it ships the app's security note", readFileSync(join(ext, "SECURITY.md"), "utf8").startsWith("# HCM Coach: security one-pager"));

  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "app-")), { channel: "chromium", headless: true, viewport: { width: 360, height: 900 }, deviceScaleFactor: 2, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const requests = []; ctx.on("request", (q) => requests.push(q.url()));
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  const panel = ctx.pages()[0] ?? await ctx.newPage();
  await panel.goto(`chrome-extension://${id}/sidepanel.html`);
  const see = (t, ms = 8000) => panel.getByText(t, { exact: false }).first().waitFor({ timeout: ms }).then(() => true, () => false);
  check("welcome says what is sent", await see("I download updated guides"));
  await panel.getByRole("button", { name: /Got it/ }).click();
  const help = panel.locator("header.top .ask-btn");
  const box = await help.boundingBox();
  check("one small Help button in the header, on a single line", (await help.count()) === 1 && (await help.innerText()).trim() === "Help" && box.height < 30, JSON.stringify(box));
  check("the update area is on the process list", await see("Using the guides that came with this install"));
  await panel.getByPlaceholder(/HCM Academy contact/).fill(CODE);
  await panel.getByRole("button", { name: "Save" }).click();
  check("with the code it downloads the current content", await see("version "));
  check("every process is there, including Create Costing", (await panel.locator(".lesson-card").count()) === 4 && await see("Create Costing for a Person"));
  check("the footer says it only downloads guide updates", await see("Downloads guide updates only"));
  await panel.evaluate(() => document.querySelector("main")?.scrollTo(0, 0));
  await panel.screenshot({ path: join(shots, "app-library.png") });

  const before = requests.length;
  await help.click();
  await panel.getByPlaceholder(/./).last().fill("What percentage do I enter for costing?");
  await panel.getByRole("button", { name: /^Ask/ }).click();
  check("Help answers from the loaded job aid and guide", await see("Use 100 unless you were told otherwise") && await see("From Guide: Create Costing for a Person"));
  check("asking Help sends nothing anywhere", requests.slice(before).every((u) => u.startsWith(`chrome-extension://${id}/`)), requests.slice(before).join(" "));
  await panel.screenshot({ path: join(shots, "app-help.png") });

  const outside = [...new Set(requests.filter((u) => !u.startsWith(`chrome-extension://${id}/`)))];
  check("the only outside request is the content feed", outside.length === 1 && outside[0] === WEB + "/api/content", outside.join(" "));
  check("any other address is blocked by the security policy", (await panel.evaluate(async () => { try { await fetch("https://example.com/"); return "allowed"; } catch { return "blocked"; } })) === "blocked");
  await ctx.close();
} finally {
  try { process.kill(-web.pid); } catch {}
  // Leave the app build pointing at the real service, not the test server.
  spawnSync("npm", ["run", "build:app"], { cwd: root, stdio: "ignore" });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.${failed.length ? "\nFAILED:\n  " + failed.map((f) => f.name).join("\n  ") : ""}`);
process.exit(failed.length ? 1 : 0);
