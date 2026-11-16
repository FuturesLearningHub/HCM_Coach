// Checks for Ask: the server endpoint (with a stand-in for the Anthropic API) and the Ask view in the guide.
// No real model is called here, so this proves the plumbing and the limits, not the quality of answers.
// Usage: npm run test:ask   (starts its own stand-in API on :4010 and its own web server on :3011)
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
const WEB = "http://localhost:3011", CODE = "test-code-123";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Stand-in for api.anthropic.com: records what the server sends and returns a fixed structured answer.
const seen = [];
const upstream = createServer((req, res) => {
  let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
    const body = JSON.parse(raw || "{}"); seen.push({ url: req.url, headers: req.headers, body });
    const last = JSON.stringify(body.messages?.at(-1)?.content ?? "");
    const out = /capital of france|poem/i.test(last)
      ? { in_scope: false, answer: "I can only help with HCM functions and processes, for example how to change an employee's manager.", sources: [] }
      : { in_scope: true, answer: "For non-exempt employees the effective date must be the first day of the pay period, which is a Sunday.", sources: ["Change Employee Manager in Oracle Cloud", "A made-up source"] };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "msg_test", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text: JSON.stringify(out) }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }));
  });
}).listen(4010);

const web = spawn("npx", ["next", "dev", "-p", "3011"], { cwd: join(root, "web"), stdio: "ignore", detached: true,
  env: { ...process.env, ANTHROPIC_API_KEY: "sk-ant-test-not-real", ANTHROPIC_BASE_URL: "http://localhost:4010", HCM_COACH_ASK_CODE: CODE } });
const up = async () => { try { return (await fetch(WEB + "/api/ask", { method: "OPTIONS" })).status === 204; } catch { return false; } };
for (let i = 0; i < 90 && !(await up()); i++) await sleep(1000);
const post = (body, code = CODE) => fetch(WEB + "/api/ask", { method: "POST", headers: { "content-type": "application/json", ...(code ? { "x-hcm-coach-code": code } : {}) }, body: JSON.stringify(body) });

try {
  console.log("\nServer endpoint");
  check("no access code is refused", (await post({ question: "How do I change a manager?" }, null)).status === 401);
  check("wrong access code is refused", (await post({ question: "How do I change a manager?" }, "nope")).status === 401);
  check("empty and over-long questions are refused", (await post({ question: " " })).status === 400 && (await post({ question: "x".repeat(501) })).status === 400);
  check("nothing reached the model for refused requests", seen.length === 0);

  const r = await post({ question: "What date for a non-exempt change? Ask jo.smith@vanderbilt.edu or 615-555-0142, ID 000123456.", context: { guide: "Change an Employee's Manager", step: "Set the effective date" },
    history: [{ role: "user", text: "hi" }, { role: "assistant", text: "Hello." }] });
  const data = await r.json();
  const sent = seen.at(-1);
  const system = JSON.stringify(sent?.body.system ?? "");
  const userTurn = JSON.stringify(sent?.body.messages?.at(-1) ?? "");
  check("in-scope question returns an answer", r.status === 200 && data.inScope === true && /Sunday/.test(data.answer), JSON.stringify(data).slice(0, 160));
  check("only sources that exist in the knowledge base are returned", JSON.stringify(data.sources) === JSON.stringify(["Change Employee Manager in Oracle Cloud"]));
  check("system prompt carries the scope rule and the job aids", /only job is to answer questions about HCM functions and processes/.test(system) && /Inactivate Position in Oracle Cloud/.test(system) && /Costing for Persons/.test(system));
  check("system prompt is marked for caching", /"cache_control":\{"type":"ephemeral"\}/.test(system));
  check("email, phone and long numbers are stripped before the model sees them", !/jo\.smith|615-555-0142|000123456/.test(userTurn) && /email removed/.test(userTurn) && /phone removed/.test(userTurn) && /number removed/.test(userTurn), userTurn.slice(0, 200));
  check("guide and step context is passed along", /Set the effective date/.test(userTurn));
  check("model and API key come from the server, not the request", sent?.body.model === "claude-sonnet-5-5" && JSON.stringify(sent?.headers).includes("sk-ant-test-not-real") && sent?.body.output_config?.effort === "low", JSON.stringify(Object.keys(sent?.headers ?? {})));
  check("CORS allows the extension to call it", r.headers.get("access-control-allow-origin") === "*" && r.headers.get("cache-control") === "no-store");
  const off = await (await post({ question: "What is the capital of France?" })).json();
  check("out-of-scope answer is flagged and carries no sources", off.inScope === false && off.sources.length === 0);

  console.log("\nAsk view in the guide");
  const b = spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), encoding: "utf8", env: { ...process.env, HCM_COACH_MODE: "guide", HCM_COACH_ASK_URL: WEB } });
  if (b.status !== 0) { console.error(b.stderr); throw new Error("build failed"); }
  const ext = join(root, "extension/dist-guide-ask");
  const manifest = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
  check("Ask build: one address in the security policy, still no site access", manifest.content_security_policy.extension_pages.endsWith(`connect-src ${WEB}`) && !manifest.host_permissions && !manifest.content_scripts && JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "sidePanel"]));
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "ask-")), { channel: "chromium", headless: true, viewport: { width: 400, height: 900 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  const requests = []; ctx.on("request", (q) => requests.push(q.url()));
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  const panel = ctx.pages()[0] ?? await ctx.newPage();
  await panel.goto(`chrome-extension://${id}/sidepanel.html`);
  const see = (t) => panel.getByText(t, { exact: false }).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  await panel.getByRole("button", { name: /Got it/ }).click();
  await panel.locator(".lesson-card").first().click(); await panel.getByRole("button", { name: /^Start/ }).click(); await panel.locator(".step-card").waitFor();
  await panel.getByRole("button", { name: /Ask a question/ }).click();
  check("first use explains what is sent and asks for the access code", await see("Only the question you type") && await see("Access code"));
  check("nothing is sent before the person asks", !requests.some((u) => u.startsWith(WEB)));
  await panel.getByPlaceholder(/HCM Academy contact/).fill(CODE);
  await panel.getByRole("button", { name: /Turn on Ask/ }).click();
  seen.length = 0;
  await panel.getByPlaceholder(/No names/).fill("What date can I use?");
  await panel.getByRole("button", { name: /^Ask/ }).click();
  check("answer and its source are shown", await see("which is a Sunday") && await see("Source: Change Employee Manager in Oracle Cloud"));
  check("the open guide step went with the question", /Find the employee/.test(JSON.stringify(seen.at(-1)?.body.messages?.at(-1) ?? "")));
  await panel.getByPlaceholder(/No names/).fill("Write me a poem");
  await panel.getByRole("button", { name: /^Ask/ }).click();
  check("out-of-scope reply is labelled as such", await see("Outside what I can answer"));
  await panel.screenshot({ path: join(shots, "ask-chat.png") });
  const asked = requests.filter((u) => !u.startsWith(`chrome-extension://${id}/`));
  check("the only outside requests are the questions themselves", asked.length === 2 && asked.every((u) => u === WEB + "/api/ask"), asked.join(" "));
  check("any other address is blocked by the security policy", (await panel.evaluate(async () => { try { await fetch("https://example.com/"); return "allowed"; } catch { return "blocked"; } })) === "blocked");
  await panel.getByRole("button", { name: /Back to the guide/ }).click();
  check("the guide is still where it was", await panel.locator(".step-title", { hasText: "Find the employee" }).isVisible());
  await ctx.close();

  console.log("\nLimits");
  let limited = false;
  for (let i = 0; i < 24 && !limited; i++) limited = (await post({ question: "How do I inactivate a position?" })).status === 429;
  check("rate limit kicks in", limited);

  console.log("\nOther builds stay offline");
  const plain = spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), encoding: "utf8", env: { ...process.env, HCM_COACH_MODE: "guide", HCM_COACH_ASK_URL: "" } });
  const pm = JSON.parse(readFileSync(join(root, "extension/dist-guide/manifest.json"), "utf8"));
  const pj = readFileSync(join(root, "extension/dist-guide/sidepanel.js"), "utf8");
  check("plain guide build has no network code and connect-src 'none'", plain.status === 0 && pm.content_security_policy.extension_pages.endsWith("connect-src 'none'") && !/\bfetch\s*\(/.test(pj) && !pj.includes("/api/ask"));
} finally {
  upstream.close(); try { process.kill(-web.pid); } catch {}
  // Leave the Ask build pointing at the real service, not the test server.
  spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), env: { ...process.env, HCM_COACH_MODE: "guide", HCM_COACH_ASK_URL: "https://hcm-coach.vercel.app" } });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.${failed.length ? "\nFAILED:\n  " + failed.map((f) => f.name).join("\n  ") : ""}`);
process.exit(failed.length ? 1 : 0);
