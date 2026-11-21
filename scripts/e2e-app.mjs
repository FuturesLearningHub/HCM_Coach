// Checks for the HCM Coach app: the guide with live updates and the built-in Help chat, against a local server.
// Help must answer only from what is loaded into the app and never contact anything.
// Usage: npm run test:app   (starts its own web server on :3015)
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS || join(root, "test-results"); mkdirSync(shots, { recursive: true });
const WEB = "http://localhost:3015", CODE = "test-code-app", ADMIN = "test-admin-code";
const PROGRESS_DIR = mkdtempSync(join(tmpdir(), "progress-"));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A stand-in for the AI model, so the coach can be checked without a real key. It records what it was sent.
const seenByModel = [];
const model = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const body = JSON.parse(b || "{}"); seenByModel.push({ key: req.headers["x-api-key"] ?? req.headers.authorization, headers: Object.keys(req.headers).join(","), body: b });
  const say = /say-back|Say-back|sayback/i.test(JSON.stringify(body.messages));
  const chat = JSON.stringify(body.system).includes("HCM Coach chat");
  const q = JSON.stringify(body.messages.at(-1));
  const out = chat ? (/zebra/.test(q) ? { found: false, text: "That isn't in HCM Coach. Ask HCM support.", sources: [] }
      : { found: true, text: "Enter 100 in Percentage, unless you were told otherwise.", sources: ["Guide: Create Costing for a Person", "Job aid: Something Made Up"] })
    : say ? { covered: ["percentage", "not-a-real-part"], missed: ["coa-string"], text: "Good on the percentage. You left out the COA string." } : { text: "This is where you find the person. Match the person number." };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ id: "msg_test", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text: JSON.stringify(out) }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }));
}); }).listen(3016);
const web = spawn("npx", ["next", "dev", "-p", "3015"], { cwd: join(root, "web"), stdio: "ignore", detached: true, env: { ...process.env, HCM_COACH_ACCESS_CODE: CODE, AI_API_KEY: "test-key", ANTHROPIC_BASE_URL: "http://127.0.0.1:3016", AI_PROVIDER: "", PROGRESS_LOCAL_DIR: PROGRESS_DIR, PROGRESS_ADMIN_CODE: ADMIN } });
const up = async () => { try { return (await fetch(WEB + "/api/content", { headers: { "x-hcm-coach-code": CODE } })).ok; } catch { return false; } };
for (let i = 0; i < 90 && !(await up()); i++) await sleep(1000);

try {
  check("the old open-ended ask endpoint is gone", (await fetch(WEB + "/api/ask", { method: "POST", body: "{}" })).status === 404);
  const coach = (body, code = CODE) => fetch(WEB + "/api/coach", { method: "POST", headers: { "content-type": "application/json", ...(code ? { "x-hcm-coach-code": code } : {}) }, body: JSON.stringify(body) });
  check("the coach needs the access code", (await coach({ action: "explain", lessonId: "create-costing", stepId: "percentage" }, "")).status === 401);
  check("the coach only takes a real process and part", (await coach({ action: "explain", lessonId: "nope", stepId: "x" })).status === 400);
  const sb = await (await coach({ action: "sayback", lessonId: "create-costing", stepIds: ["percentage", "coa-string", "submit"], text: "I entered 100 as the percentage and submitted it." })).json();
  check("say-back: the coach marks parts covered and missed, and only real parts count", JSON.stringify(sb.covered) === '["percentage"]' && JSON.stringify(sb.missed) === '["coa-string"]' && /COA/.test(sb.text), JSON.stringify(sb));
  const sent = seenByModel.at(-1);
  check("the model gets the verified process and the key from Vercel, nothing else about her", /^(Bearer )?test-key$/.test(sent.key) && sent.body.includes("Enter 100, unless you were told otherwise") && !sent.body.includes(CODE), `key=${sent.key} h=${sent.headers} has=${sent.body.includes("Enter 100")} code=${sent.body.includes(CODE)} ${sent.body.slice(0, 300)}`);
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
  check("welcome says what is sent, including the training record", await see("Updated guides come down") && await see("Your training record goes up"));
  await panel.getByRole("button", { name: /Got it/ }).click(); await panel.getByRole("button", { name: /Skip the tour/ }).click();
  const help = panel.getByRole("button", { name: "Ask HCM Coach" });
  check("one Ask button floats over every screen", await help.waitFor({ timeout: 5000 }).then(() => true, () => false) && (await help.count()) === 1);
  // Before the access code: the chat quotes the guides inside the app, and sends nothing.
  await help.click();
  await panel.getByLabel("Your question").fill("What percentage do I enter for costing?");
  await panel.getByRole("button", { name: "Ask", exact: true }).click();
  check("without the code, the chat says how to get chat answers", await see("For chat answers, add the access code"));
  check("without the code, the chat quotes the loaded job aid", await see("unless directed otherwise") && await see("Create Costing for Persons in Oracle Cloud"));
  check("and sends nothing anywhere", requests.every((u) => u.startsWith(`chrome-extension://${id}/`)));
  await panel.getByRole("button", { name: "Close chat" }).click();
  // Setup: everyone is enrolled. Name, work email and access code, with a plain note of what is sent.
  check("first launch asks who is learning: name, work email, access code", await see("Who's") && await panel.getByLabel("Your name").isVisible() && await panel.getByLabel("Work email").isVisible() && await panel.getByLabel("Access code").isVisible());
  check("setup says what is sent, and what never is", await see("Never your screen, anything from Oracle, or what you type"));
  await panel.getByLabel("Your name").fill("Test Learner");
  await panel.getByLabel("Work email").fill("Test.Learner@Example.edu");
  await panel.getByLabel("Access code").fill("wrong-code");
  await panel.getByRole("button", { name: /^Start/ }).click();
  check("a wrong access code is caught at setup", await see("That access code is not right"));
  check("the library stays closed until setup is done", (await panel.locator(".lesson-card").count()) === 0);
  await panel.getByLabel("Access code").fill(CODE);
  await panel.getByRole("button", { name: /^Start/ }).click();
  check("with the code it downloads the current content", await see("version "));
  check("every process is there, including Create Costing", (await panel.locator(".lesson-card").count()) === 4 && await see("Create Costing for a Person"));
  check("the footer says what it sends", await see("Sends guide updates, your training record and what you ask the coach"));
  check("the list shows whose training record this is", await see("Your training record:") && await see("test.learner@example.edu"));
  await panel.evaluate(() => document.querySelector("main")?.scrollTo(0, 0));
  await panel.screenshot({ path: join(shots, "app-library.png") });

  const before = requests.length;
  // With the code: the pop-up chat asks the AI, which answers only from the guides and job aids in the app.
  await help.click();
  const ask = async (q) => { await panel.getByLabel("Your question").fill(q); await panel.getByRole("button", { name: "Ask", exact: true }).click(); };
  await ask("What percentage do I enter for costing?");
  check("the AI chat answers in real time", await see("Enter 100 in Percentage"));
  check("and names its source, only real guides and job aids", await see("From Guide: Create Costing for a Person") && !(await see("Something Made Up", 500)));
  const chatSent = seenByModel.at(-1).body;
  check("the AI is given the app's guides and job aids, and told to use only them", chatSent.includes("Answer ONLY from the guides and job aids") && chatSent.includes("=== Job aid: Create Costing for Persons in Oracle Cloud ===") && chatSent.includes("=== Guide: Inactivate a Position ==="));
  await ask("How do I order a zebra spaceship?");
  check("a question the app doesn't cover gets 'Not in HCM Coach', not a guess", await see("Not in HCM Coach") && await see("Ask HCM support"));
  check("the conversation is sent along so follow-ups make sense", JSON.parse(seenByModel.at(-1).body).messages.length === 3);
  await panel.screenshot({ path: join(shots, "app-chat.png") });
  await panel.getByRole("button", { name: "Close chat" }).click();

  // The coach in a process: at Guide level, "Explain more" asks the AI about this part only.
  await panel.locator(".lesson-card", { hasText: "Create Costing for a Person" }).click();
  await panel.getByRole("button", { name: /^Start/ }).click();
  await panel.getByRole("button", { name: "I have all five" }).click();
  await panel.getByRole("button", { name: /Explain more/ }).click();
  check("Explain more: the coach answers about this part", await panel.locator(".coach-says", { hasText: "This is where you find the person" }).waitFor({ timeout: 8000 }).then(() => true, () => false));
  check("the model is asked about this part only", JSON.parse(seenByModel.at(-1).body).messages[0].content.includes("Find the employee"), JSON.parse(seenByModel.at(-1).body).messages[0].content.slice(0, 200));
  await panel.screenshot({ path: join(shots, "app-coach.png") });

  // Training record: sent automatically after each finished run, filed under her work email; the admin dashboard shows it.
  const progress = (headers = {}, q = "") => fetch(WEB + "/api/progress" + q, { headers });
  check("nothing is sent before a process is finished", !requests.some((u) => u.includes("/api/progress")));
  await panel.getByRole("button", { name: /Exit lesson/ }).click(); await panel.getByRole("button", { name: /Exit lesson/ }).last().click();
  await panel.waitForTimeout(400);
  const costing = JSON.parse(readFileSync(join(root, "web/guides/create-costing.json"), "utf8"));
  await sw.evaluate((ids) => chrome.storage.local.set({ "cm.levels": { "create-costing": Object.fromEntries(ids.map((i) => [i, { level: 4, streak: 0 }])) } }), costing.steps.filter((x) => x.type === "screen").map((x) => x.id));
  if (!(await panel.getByRole("button", { name: /^Start/ }).isVisible())) await panel.locator(".lesson-card", { hasText: "Create Costing for a Person" }).click();
  await panel.getByRole("button", { name: /^Start/ }).click();
  for (const st of costing.steps) { await panel.getByRole("button", { name: st.type === "screen" ? /^I did it$/ : st.confirm }).click(); await panel.waitForTimeout(150); }
  await panel.getByRole("button", { name: /^Finish/ }).click();
  await see("You did the whole");
  let rec; for (let i = 0; i < 20 && !rec; i++) { await sleep(500); const r = await progress({ "x-progress-admin": ADMIN }); rec = r.ok ? (await r.json()).learners[0] : undefined; }
  check("a finished run is saved automatically, under her work email", rec?.name === "Test Learner" && rec.email === "test.learner@example.edu" && rec.processes["create-costing"]?.runs === 1, JSON.stringify(rec)?.slice(0, 200));
  const parts = Object.values(rec?.processes["create-costing"]?.steps ?? {});
  check("the record holds only parts, levels and right/miss counts", parts.length === costing.steps.filter((x) => x.type === "screen").length && parts.every((p) => Object.keys(p).sort().join() === "level,miss,right,title"), JSON.stringify(parts[0]));
  check("a reinstall with the same email continues the same record", (await (await fetch(WEB + "/api/progress", { method: "POST", headers: { "content-type": "application/json", "x-hcm-coach-code": CODE }, body: JSON.stringify({ learner: { id: "another-device-0000000000", name: "Test Learner", email: "test.learner@example.edu" }, lessonId: "create-costing", runId: "second-device-run", steps: [] }) })).ok) && (await (await progress({ "x-progress-admin": ADMIN })).json()).learners.length === 1);
  check("the shared access code cannot read anyone's progress", (await progress({ "x-hcm-coach-code": CODE })).status === 401 && (await progress({ "x-progress-admin": "wrong" })).status === 401);
  check("the admin can download it as CSV, with the email", /Test Learner.*test\.learner@example\.edu/.test(await (await progress({ "x-progress-admin": ADMIN }, "?format=csv")).text()));
  const dash = await ctx.newPage(); await dash.goto(WEB + "/progress");
  await dash.waitForFunction(() => Object.keys(document.querySelector("input") ?? {}).some((k) => k.startsWith("__react")), null, { timeout: 60000 });
  await dash.getByLabel("Admin code").fill(ADMIN); await dash.getByRole("button", { name: "Open dashboard" }).click();
  check("the dashboard shows who is where, with charts", await dash.getByText("Test Learner").first().waitFor({ timeout: 15000 }).then(() => true, () => false) && await dash.getByText("How independent each learner is").isVisible() && await dash.getByText("Help levels by process").isVisible());
  await dash.screenshot({ path: join(shots, "app-progress-dashboard.png"), fullPage: true }); await dash.close();
  await panel.getByRole("button", { name: /Done|All processes|Back to/ }).first().click().catch(() => {});
  await panel.getByRole("button", { name: /Fix my name or email/ }).click();
  check("she can fix her name or email", await see("Fix your") && (await panel.getByLabel("Work email").inputValue()) === "test.learner@example.edu");
  await panel.getByRole("button", { name: "Cancel" }).click();
  const key = rec?.key;
  check("the admin can delete a person's record", (await fetch(WEB + "/api/progress?key=" + key, { method: "DELETE", headers: { "x-progress-admin": ADMIN } })).ok && (await (await progress({ "x-progress-admin": ADMIN })).json()).learners.length === 0);
  const outside = [...new Set(requests.filter((u) => !u.startsWith(`chrome-extension://${id}/`)))];
  check("the only outside requests are the content feed, the coach and opt-in progress", outside.filter((u) => !["/progress", "/_next", "/img"].some((p) => u.startsWith(WEB + p))).sort().join(" ") === [WEB + "/api/coach", WEB + "/api/content", WEB + "/api/progress"].join(" "), outside.join(" "));
  check("any other address is blocked by the security policy", (await panel.evaluate(async () => { try { await fetch("https://example.com/"); return "allowed"; } catch { return "blocked"; } })) === "blocked");
  await ctx.close();
} finally {
  try { process.kill(-web.pid); } catch {}
  model.close();
  // Leave the app build pointing at the real service, not the test server.
  spawnSync("npm", ["run", "build:app"], { cwd: root, stdio: "ignore" });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.${failed.length ? "\nFAILED:\n  " + failed.map((f) => f.name).join("\n  ") : ""}`);
process.exit(failed.length ? 1 : 0);
