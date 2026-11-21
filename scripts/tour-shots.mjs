// Captures the panel states for the first-launch tour video (demo/tour/shots). Runs a local server with a stand-in
// AI model so the chat shows an answer; the answer text is taken from the Change Manager guide itself.
// Usage: node scripts/tour-shots.mjs   then   node scripts/tour-video.mjs
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "demo/tour/shots"); mkdirSync(out, { recursive: true });
const WEB = "http://localhost:3015", CODE = "tour-code";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const guide = JSON.parse(readFileSync(join(root, "web/guides/change-manager.json"), "utf8"));

const model = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const body = JSON.parse(b || "{}");
  const o = { found: true, text: "Use the first day of the pay period, which is a Sunday. Pick the Sunday that starts the pay period the change begins in.", sources: ["Guide: Change an Employee's Manager"] };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ id: "m", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text: JSON.stringify(o) }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }));
}); }).listen(3016);
const web = spawn("npx", ["next", "dev", "-p", "3015"], { cwd: join(root, "web"), stdio: "ignore", detached: true, env: { ...process.env, HCM_COACH_ACCESS_CODE: CODE, AI_API_KEY: "k", ANTHROPIC_BASE_URL: "http://127.0.0.1:3016" } });
for (let i = 0; i < 90; i++) { try { if ((await fetch(WEB + "/api/content", { headers: { "x-hcm-coach-code": CODE } })).ok) break; } catch {} await sleep(1000); }
try {
  spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), env: { ...process.env, HCM_COACH_MODE: "guide", HCM_COACH_CONTENT_URL: WEB } });
  const ext = join(root, "extension/dist-guide-live");
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "tour-")), { channel: "chromium", headless: true, viewport: { width: 380, height: 760 }, deviceScaleFactor: 2, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  const p = ctx.pages()[0] ?? await ctx.newPage();
  await p.goto(`chrome-extension://${id}/sidepanel.html`);
  const shot = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: join(out, n + ".png") }); };
  const pick = (t) => p.locator(".option", { hasText: t }).first().click();
  const seed = (levels) => sw.evaluate((l) => chrome.storage.local.set({ "cm.levels": l }), levels);
  const openCM = async () => {
    await p.waitForTimeout(400);
    if (!(await p.getByRole("button", { name: /^Start/ }).isVisible())) await p.locator(".lesson-card", { hasText: "Change an Employee's Manager" }).click();
    await p.getByRole("button", { name: /^Start/ }).click();
  };
  const lv = (gid, level, streak = 0) => Object.fromEntries(JSON.parse(readFileSync(join(root, `web/guides/${gid}.json`), "utf8")).steps.filter((s) => s.type === "screen").map((s) => [s.id, { level, streak }]));

  await shot("00-welcome");
  await p.getByRole("button", { name: /Got it/ }).click(); await p.getByRole("button", { name: /Skip the tour/ }).click();
  await p.getByLabel("Your name").fill("Alex Morgan"); await p.getByLabel("Work email").fill("alex.morgan@example.edu");
  await p.getByLabel("Access code").fill(CODE);
  await p.getByRole("button", { name: /^Start/ }).click();
  await p.getByText("version ").first().waitFor();
  await seed({ "change-manager": lv("change-manager", 1, 1), "create-costing": lv("create-costing", 2), "upload-document-record": lv("upload-document-record", 4) });
  await p.evaluate(() => document.querySelector("main")?.scrollTo(0, 0));
  await shot("01-library");

  await seed({});
  await openCM();
  await p.locator(".step-title", { hasText: "Find the employee" }).waitFor();
  await shot("02-guide");
  await p.getByRole("button", { name: /^I did it$/ }).click();
  await pick(guide.steps[0].expect);
  await shot("03-how");
  await p.getByRole("button", { name: /^Next question/ }).click();
  await pick(guide.steps[0].why);
  await shot("04-why");
  await p.getByRole("button", { name: /^Next step/ }).click();
  await p.locator(".step-title", { hasText: "Open Change Manager" }).waitFor();
  await p.getByRole("button", { name: /Exit lesson/ }).click(); await p.getByRole("button", { name: /Exit lesson/ }).last().click();

  // Two right in a row: the same process now starts at Prompt.
  await seed({ "change-manager": lv("change-manager", 2) });
  await openCM();
  await p.getByRole("heading", { name: "What comes next?" }).waitFor();
  await shot("05-prompt");
  await pick("Find the employee");
  await pick(guide.steps[0].why);
  await p.getByRole("button", { name: "Less help" }).click();
  await shot("06-oncall");

  await p.getByRole("button", { name: "Ask HCM Coach" }).click();
  await p.getByLabel("Your question").fill("What date do I use for a non-exempt employee?");
  await p.getByRole("button", { name: "Ask", exact: true }).click();
  await p.getByText("first day of the pay period").first().waitFor();
  await shot("07-chat");
  await p.getByRole("button", { name: "Close chat" }).click();
  await p.getByRole("button", { name: /Exit lesson/ }).click(); await p.getByRole("button", { name: /Exit lesson/ }).last().click();

  // A practised process, all parts Off: straight through to the say-back.
  await seed({ "change-manager": lv("change-manager", 4) });
  await openCM();
  for (const st of guide.steps) {
    if (st.type === "screen") await p.getByRole("button", { name: /^I did it$/ }).click();
    else if (st.type === "call") { await p.getByRole("button", { name: /I'm ready/ }).click(); await p.getByRole("button", { name: /Call done/ }).click();
      await p.locator(".debrief select").selectOption("Got a yes");
      for (const [item, v] of [["purpose", 4], ["listen", 5], ["next-step", 5]]) await p.locator(`input[name="rate-${item}"][value="${v}"]`).check({ force: true });
      await p.getByRole("button", { name: /See my tips/ }).click(); await p.getByRole("button", { name: /Continue/ }).click(); }
    else await p.getByRole("button", { name: st.confirm }).click();
    await p.waitForTimeout(250);
  }
  await p.locator("textarea").fill("I found Jordan by person number, opened Change Manager, left Info to Include alone, set the Sunday start date, picked Manager Change and Change Line Manager, swapped in the new manager, and submitted. Then I told both managers.");
  await shot("08-sayback");
  await ctx.close();
} finally {
  try { process.kill(-web.pid); } catch {}
  model.close();
  spawnSync("npm", ["run", "build:app"], { cwd: root, stdio: "ignore" });
}
console.log("shots in", out);
