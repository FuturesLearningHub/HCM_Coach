// Phase 1 "done when" checks, run against the practice app with the built extension loaded in Chromium.
// Usage: npm run build:ext && npm run test:e2e   (starts the practice app on :3000 if it is not already running)
import { createRequire } from "node:module";
// Playwright is resolved the CommonJS way so a globally installed copy (NODE_PATH) works too.
const { chromium } = createRequire(import.meta.url)("playwright");
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(root, "extension/dist");
const shots = process.env.SHOTS || join(root, "test-results");
mkdirSync(shots, { recursive: true });
const BASE = "http://localhost:3000";

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const up = async () => { try { return (await fetch(BASE + "/practice/time-off")).ok; } catch { return false; } };

let server;
if (!(await up())) {
  console.log("Starting practice app on :3000 …");
  server = spawn("npm", ["run", "dev", "-w", "web"], { cwd: root, stdio: "ignore", detached: true });
  for (let i = 0; i < 90 && !(await up()); i++) await new Promise((r) => setTimeout(r, 1000));
}

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "hcm-coach-")), {
  channel: "chromium", headless: true, viewport: { width: 1180, height: 860 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const requests = [];
ctx.on("request", (r) => requests.push(r.url()));
const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker");
const id = new URL(sw.url()).host;
// The lessons open the hosted practice app by default. Having a local tab open makes the coach use it instead.
const local = ctx.pages()[0] ?? await ctx.newPage();
await local.goto(BASE + "/");
const panel = await ctx.newPage();
await panel.setViewportSize({ width: 400, height: 900 });
await panel.goto(`chrome-extension://${id}/sidepanel.html`);
const P = (text) => panel.getByText(text, { exact: false }).first();
const seen = async (text, ms = 6000) => P(text).waitFor({ state: "visible", timeout: ms }).then(() => true, () => false);
const stepIs = (title) => panel.locator(".step-title", { hasText: title }).waitFor({ timeout: 8000 }).then(() => true, () => false);
const shot = (page, name) => page.screenshot({ path: join(shots, name + ".png") });

async function startLesson(title, dept) {
  await panel.locator(".lesson-card", { hasText: title }).click();
  if (dept) await panel.locator(".pill", { hasText: dept }).click();
  const before = ctx.pages().length;
  await panel.getByRole("button", { name: /Start lesson/ }).click();
  await panel.locator(".step-card").waitFor();
  await new Promise((r) => setTimeout(r, 800));
  const app = ctx.pages().find((p) => p.url().startsWith(BASE)) ?? ctx.pages()[before];
  await app.waitForLoadState("domcontentloaded");
  return app;
}

async function debrief(ratings) {
  await panel.getByRole("button", { name: /I'm ready/ }).click();
  await panel.getByRole("button", { name: /Call done/ }).click();
  await panel.locator(".debrief select").selectOption("Got a yes");
  await panel.locator(".debrief textarea").fill("E2E-SECRET-NOTE coverage is set for Friday.");
  for (const [item, v] of Object.entries(ratings)) await panel.locator(`input[name="rate-${item}"][value="${v}"]`).check({ force: true });
  await panel.getByRole("button", { name: /See my tips/ }).click();
}

// ── Run 1: time off, Facilities ───────────────────────────────────────────────
console.log("\nTime off request · Facilities");
await panel.getByRole("button", { name: /Got it/ }).click();
await shot(panel, "01-library");
let app = await startLesson("Submit a Time Off Request", "Facilities");
check("lesson starts and opens the practice app", app.url().includes("/practice/time-off") && await stepIs("Start a request"));
await app.bringToFront(); await new Promise((r) => setTimeout(r, 700));
await shot(app, "02-highlight-new-request");
await app.getByRole("button", { name: "History" }).click();
await app.waitForURL("**/history");
await app.goBack();
await app.getByRole("button", { name: "History" }).click();
check("clicking History twice shows the commonMistake message", await seen("History only shows past requests"));
await shot(panel, "03-mistake");
await app.goto(BASE + "/practice/time-off");
await app.getByRole("button", { name: "New Request" }).click();
check("screen step advances on a real action (New Request → form)", await stepIs("Choose the absence type"));
check("Facilities learner sees the Facilities rule", await seen("time off during the first week of the month needs director sign-off"));
await new Promise((r) => setTimeout(r, 600));
await shot(app, "04-highlight-absence-type"); await shot(panel, "05-facilities-rule");
await app.getByLabel("Absence Type").selectOption({ label: "Vacation" });
check("field step advances when the value is right", await stepIs("Choose the reason code"));
await app.getByLabel("Reason Code").selectOption({ label: "Personal" });
check("tip callout fires on a field value (Personal → pick Other)", await seen("Pick Other here, not Personal"));
await app.getByLabel("Reason Code").selectOption({ label: "Other" });
await stepIs("Enter the dates");
await app.getByLabel("Start Date").fill("2026-11-20");
await app.getByLabel("End Date").fill("2026-11-20");
check("checkpoint step appears and waits for confirm", await stepIs("Check your balance"));
await panel.getByRole("button", { name: /I have enough hours/ }).click();
await stepIs("Submit the request");
await app.getByRole("button", { name: "Save Draft" }).click();
check("Save Draft decoy shows its commonMistake", await seen("Payroll never sees a draft"));
await app.getByRole("button", { name: "Submit", exact: true }).click();
check("Submit advances to the offline step", await stepIs("Hand it to Payroll"));
check("Facilities learner sees Dana as the Payroll contact", await seen("Dana Ortiz") && !(await seen("Chuck Ramos", 400)));
await shot(panel, "06-offline-dana");
await panel.getByRole("button", { name: /I let Payroll know/ }).click();
await stepIs("Confirm coverage");
await shot(panel, "07-call-prep");
await debrief({ purpose: 2, listen: 4, "next-step": 5 });
check("rating purpose a 2 shows the purpose tip", await seen("Lead with why you are calling"));
await panel.getByRole("button", { name: /Continue/ }).click();
check("lesson runs start to finish (recap shown)", await seen("You did the whole"));
await shot(panel, "08-recap");
await panel.getByRole("button", { name: /Back to lessons/ }).click();

// ── Run 2: time off, Default ──────────────────────────────────────────────────
console.log("\nTime off request · Default");
app = await startLesson("Submit a Time Off Request", "Another department");
await app.getByRole("button", { name: "New Request" }).click();
await stepIs("Choose the absence type");
check("Default learner does not see the Facilities rule", !(await seen("director sign-off", 1200)));
await app.getByLabel("Absence Type").selectOption({ label: "Vacation" });
await app.getByLabel("Reason Code").selectOption({ label: "Other" });
await app.getByLabel("Start Date").fill("2026-11-20");
await app.getByLabel("End Date").fill("2026-11-20");
await stepIs("Check your balance");
await panel.getByRole("button", { name: /I have enough hours/ }).click();
await stepIs("Submit the request");
await app.getByRole("button", { name: "Submit", exact: true }).click();
await stepIs("Hand it to Payroll");
check("Default learner sees Chuck as the Payroll contact", await seen("Chuck Ramos") && !(await seen("Dana Ortiz", 400)));
await panel.getByRole("button", { name: /Payroll already knows/ }).click();
await stepIs("Confirm coverage");
await debrief({ purpose: 5, listen: 4, "next-step": 5 });
check("all 4s and 5s shows keep-doing", await seen("Keep doing") && await seen("You opened with purpose"));
await panel.getByRole("button", { name: /Continue/ }).click();
check("recap shows the skipped offline step", await seen("Skipped with a reason"));
await panel.getByRole("button", { name: /Back to lessons/ }).click();

// ── Run 3: HCM Academy, change manager ────────────────────────────────────────
console.log("\nHCM Academy · Change an Employee's Manager");
app = await startLesson("Change an Employee's Manager");
await stepIs("Find the employee");
await app.getByLabel("Search for a person").fill("Jordan");
await stepIs("Open the actions menu");
await new Promise((r) => setTimeout(r, 600)); await shot(app, "10-hcm-highlight-actions");
await app.getByRole("button", { name: "Actions for Jordan Avery" }).click();
await stepIs("Choose the right action");
await app.getByRole("menuitem", { name: "Change Manager" }).click();
await stepIs("Info to include");
await app.getByRole("button", { name: "Continue" }).click();
await stepIs("Check the pay type");
await panel.getByRole("button", { name: /I checked the pay type/ }).click();
await stepIs("Set the effective date");
check("HCM rule callout shows on the effective date step, with its source", await seen("must be the first day of the pay period") && await seen("job aid updated 3/2/26"));
await app.getByLabel("When does the manager change start?").fill("2026-11-25");
check("a mid-pay-period date does not complete the step", !(await panel.locator(".step-title", { hasText: "How the manager is changing" }).waitFor({ timeout: 1500 }).then(() => true, () => false)));
await shot(panel, "11-hcm-date-rule");
await app.getByLabel("When does the manager change start?").fill("2026-11-22");
check("a Sunday completes the step", await stepIs("How the manager is changing"));
await app.getByLabel("What's the way to change the manager?").selectOption({ label: "Manager Change" });
await stepIs("Why the manager is changing");
await app.getByLabel("Why are you changing the manager?").selectOption({ label: "Correction" });
check("warning callout fires on the wrong reason", await seen("Correction is for fixing a past entry"));
await app.getByLabel("Why are you changing the manager?").selectOption({ label: "Change Line Manager" });
await stepIs("Move to Managers");
await app.getByRole("button", { name: "Continue" }).click();
await stepIs("Edit the active manager");
await app.getByRole("button", { name: "Edit manager" }).click();
await stepIs("Assign the new manager");
await app.getByRole("textbox", { name: "Managers" }).fill("Pri");
await app.getByRole("option", { name: /Priya Raman/ }).click();
await stepIs("Save");
await app.getByRole("button", { name: "Save", exact: true }).click();
await stepIs("Submit");
await app.getByRole("button", { name: "Submit", exact: true }).click();
check("HCM lesson: all 13 screen steps advance on real actions", await stepIs("Tell the new manager"));
check("afterStep callout (auto-approved) shows after submit", await seen("approved automatically"));
await panel.getByRole("button", { name: /I let the new manager know/ }).click();
await stepIs("Hand off with the outgoing manager");
await debrief({ purpose: 4, listen: 3, "next-step": 4 });
await panel.getByRole("button", { name: /Continue/ }).click();
check("HCM lesson runs start to finish", await seen("You did the whole"));
await shot(panel, "12-hcm-recap");

// ── Hint ladder ───────────────────────────────────────────────────────────────
await panel.getByRole("button", { name: /Back to lessons/ }).click();
app = await startLesson("Submit a Time Off Request", "Finance");
await panel.getByRole("button", { name: /Give me a hint/ }).click();
await panel.getByRole("button", { name: /Another hint/ }).click();
await panel.getByRole("button", { name: /Show me where/ }).click();
check("hint ladder ends with 'Here is where you should be'", await seen("Here is where you should be"));
await app.bringToFront(); await new Promise((r) => setTimeout(r, 900)); await shot(app, "13-spotlight");
await panel.getByRole("button", { name: "Exit lesson" }).click();
await panel.getByRole("button", { name: "Exit lesson" }).click();

// ── Data and network ──────────────────────────────────────────────────────────
console.log("\nData and network");
const stored = await sw.evaluate(() => chrome.storage.local.get(null));
check("call notes are in local storage", JSON.stringify(stored["cm.callLog"] ?? "").includes("E2E-SECRET-NOTE"));
check("call notes are not in the event log", !JSON.stringify(stored["cm.history"] ?? "").includes("E2E-SECRET-NOTE"));
const foreign = [...new Set(requests.filter((u) => !u.startsWith(`chrome-extension://${id}/`) && !u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")))];
check("zero network requests beyond the extension's own files and the practice app", foreign.length === 0, foreign.slice(0, 3).join(" "));
const panelReqs = requests.filter((u) => u.startsWith("chrome-extension://"));
check("side panel loads only its own bundled files", panelReqs.length > 0 && panelReqs.every((u) => u.startsWith(`chrome-extension://${id}/`)));
check("notes absent from every request URL", !requests.some((u) => u.includes("E2E-SECRET-NOTE")));
const tryNet = (target) => target.evaluate(async () => { try { await fetch("http://localhost:3000/"); return "allowed"; } catch (e) { return "blocked"; } });
check("CSP blocks network calls from the side panel", (await tryNet(panel)) === "blocked");
check("CSP blocks network calls from the service worker", (await tryNet(sw)) === "blocked");
const manifest = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
check("manifest asks only for storage and sidePanel, and two exact hosts", JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "sidePanel"]) && JSON.stringify(manifest.host_permissions) === JSON.stringify(["http://localhost:3000/*", "https://hcm-coach.vercel.app/*"]) && !manifest.externally_connectable);
// Hardening: the page side cannot read storage or issue coach commands.
const probe = await ctx.newPage();
await probe.goto(BASE + "/practice/time-off");
const cdp = await ctx.newCDPSession(probe);
await cdp.send("Runtime.enable");
const contexts = [];
cdp.on("Runtime.executionContextCreated", (e) => contexts.push(e.context));
await probe.reload(); await new Promise((r) => setTimeout(r, 1500));
const isolated = contexts.find((c) => c.origin.startsWith("chrome-extension://"));
const inContentScript = async (expression) => (await cdp.send("Runtime.evaluate", { expression, contextId: isolated.id, awaitPromise: true, returnByValue: true })).result.value;
check("content script cannot read extension storage (call notes included)", !!isolated && (await inContentScript(`chrome.storage.local.get(null).then((v) => "readable:" + Object.keys(v).length, (e) => "blocked")`)) === "blocked");
check("coach commands sent from a web page's content script are refused", !!isolated && (await inContentScript(`chrome.runtime.sendMessage({ t: "start", lessonId: "time-off-request", department: "Default" }).then((r) => r && r.error ? "refused" : "accepted")`)) === "refused");
await ctx.close();

// Wildcard hosts are refused at build time.
const lessonFile = join(root, "web/lessons/time-off-request.json");
const lessonText = readFileSync(lessonFile, "utf8");
let wildBuild;
try {
  writeFileSync(lessonFile, lessonText.replace('"localhost:3000"]', '"localhost:3000", "*.vercel.app"]'));
  wildBuild = spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), encoding: "utf8" });
} finally { writeFileSync(lessonFile, lessonText); }
check("a wildcard host in a lesson fails the build", wildBuild.status !== 0 && /wildcard allowedDomains/.test(wildBuild.stderr));

// ── Build guard ───────────────────────────────────────────────────────────────
const file = join(root, "extension/src/lib/data.ts");
const original = readFileSync(file, "utf8");
let guard;
try {
  writeFileSync(file, original + `\nexport const leak = () => ${"fe" + "tch"}("https://example.com");\n`);
  guard = spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), encoding: "utf8" });
} finally { writeFileSync(file, original); }
check("adding a network call to the code fails the build", guard.status !== 0 && /network code found/.test(guard.stderr));
const rebuild = spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), encoding: "utf8" });
check("clean source builds again", rebuild.status === 0);

if (server) try { process.kill(-server.pid); } catch {}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.${failed.length ? "\nFAILED:\n  " + failed.map((f) => f.name).join("\n  ") : ""}`);
process.exit(failed.length ? 1 : 0);
