// Checks for the full HCM Coach app: the guide with live updates and Ask together, against a local server and a
// stand-in for the Anthropic API. Proves the two features work side by side and that nothing else is contacted.
// Usage: npm run test:app   (starts its own stand-in API on :4015 and its own web server on :3015)
import { createRequire } from "node:module";
import { createServer } from "node:http";
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

const upstream = createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    const out = { in_scope: true, answer: "Use 100 percent unless you were told otherwise.", sources: ["Create Costing for Persons in Oracle Cloud"] };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "msg_test", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text: JSON.stringify(out) }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }));
  });
}).listen(4015);

const web = spawn("npx", ["next", "dev", "-p", "3015"], { cwd: join(root, "web"), stdio: "ignore", detached: true,
  env: { ...process.env, ANTHROPIC_API_KEY: "sk-ant-test-not-real", ANTHROPIC_BASE_URL: "http://localhost:4015", HCM_COACH_ASK_CODE: CODE } });
const up = async () => { try { return (await fetch(WEB + "/api/content", { headers: { "x-hcm-coach-code": CODE } })).ok; } catch { return false; } };
for (let i = 0; i < 90 && !(await up()); i++) await sleep(1000);

try {
  const b = spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), encoding: "utf8", env: { ...process.env, HCM_COACH_MODE: "guide", HCM_COACH_CONTENT_URL: WEB, HCM_COACH_ASK_URL: WEB } });
  if (b.status !== 0) { console.error(b.stderr); throw new Error("build failed"); }
  const ext = join(root, "extension/dist-guide-live-ask");
  const manifest = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
  check("one app named HCM Coach, one address allowed, still no site access", manifest.name === "HCM Coach" && manifest.content_security_policy.extension_pages.endsWith(`connect-src ${WEB}`) && !manifest.host_permissions && !manifest.content_scripts && JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "sidePanel"]));
  check("it ships the security note that covers both features", readFileSync(join(ext, "SECURITY.md"), "utf8").startsWith("# HCM Coach: security one-pager"));

  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "app-")), { channel: "chromium", headless: true, viewport: { width: 400, height: 1000 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const requests = []; ctx.on("request", (q) => requests.push(q.url()));
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  const panel = ctx.pages()[0] ?? await ctx.newPage();
  await panel.goto(`chrome-extension://${id}/sidepanel.html`);
  const see = (t, ms = 8000) => panel.getByText(t, { exact: false }).first().waitFor({ timeout: ms }).then(() => true, () => false);
  check("welcome says what is sent for both features", await see("Ask sends only the question you type") && await see("I download updated guides"));
  await panel.getByRole("button", { name: /Got it/ }).click();
  check("the update area is on the process list", await see("Using the guides that came with this install"));
  await panel.getByPlaceholder(/HCM Academy contact/).fill(CODE);
  await panel.getByRole("button", { name: "Save" }).click();
  check("with the code it downloads the current content", await see("version "));
  check("every process is there, including Create Costing", (await panel.locator(".lesson-card").count()) === 4 && await see("Create Costing for a Person"));
  check("the footer names both features", await see("Downloads guide updates; Ask sends only what you type"));
  await panel.screenshot({ path: join(shots, "app-library.png") });

  await panel.locator(".lesson-card", { hasText: "Create Costing" }).click();
  await panel.getByRole("button", { name: /^Start/ }).click(); await panel.locator(".step-card").waitFor();
  await panel.getByRole("button", { name: /Ask a question/ }).click();
  const codeBox = panel.getByPlaceholder(/HCM Academy contact/);
  if (await codeBox.isVisible().catch(() => false)) { await codeBox.fill(CODE); await panel.getByRole("button", { name: /Turn on Ask/ }).click(); }
  await panel.getByPlaceholder(/No names/).fill("What percentage do I use?");
  await panel.getByRole("button", { name: /^Ask/ }).click();
  check("Ask answers with its source", await see("Use 100 percent") && await see("Source: Create Costing for Persons in Oracle Cloud"));
  await panel.screenshot({ path: join(shots, "app-ask.png") });

  const outside = [...new Set(requests.filter((u) => !u.startsWith(`chrome-extension://${id}/`)))];
  check("the only outside requests are the content feed and Ask", outside.length === 2 && outside.includes(WEB + "/api/content") && outside.includes(WEB + "/api/ask"), outside.join(" "));
  check("any other address is blocked by the security policy", (await panel.evaluate(async () => { try { await fetch("https://example.com/"); return "allowed"; } catch { return "blocked"; } })) === "blocked");
  await ctx.close();
} finally {
  upstream.close(); try { process.kill(-web.pid); } catch {}
  // Leave the app build pointing at the real service, not the test server.
  spawnSync("npm", ["run", "build:app"], { cwd: root, stdio: "ignore" });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.${failed.length ? "\nFAILED:\n  " + failed.map((f) => f.name).join("\n  ") : ""}`);
process.exit(failed.length ? 1 : 0);
