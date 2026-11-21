// Checks the coach server against a stand-in Vanderbilt Amplify API (/available_models, /chat), so the Amplify path is
// tested without a real key. Usage: node scripts/check-amplify.mjs   (starts the web app on :3019, stand-in on :3018)
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = []; const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "  PASS" : "  FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const seen = [];
const amp = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  seen.push({ path: req.url, auth: req.headers.authorization, body: b });
  res.writeHead(200, { "content-type": "application/json" });
  if (req.url === "/available_models") return res.end(JSON.stringify({ success: true, data: { models: [{ id: "gpt-4o" }, { id: "us.anthropic.claude-sonnet-4-v1:0" }], default: { id: "gpt-4o" } } }));
  const body = JSON.parse(b); const sys = body.data.messages[0].content;
  const out = /HCM Coach chat/.test(sys) ? { found: true, text: "Use 100 unless you were told otherwise.", sources: ["Guide: Create Costing for a Person"] }
    : /say-back/i.test(JSON.stringify(body.data.messages)) ? { covered: ["percentage"], missed: ["coa-string"], text: "Good start." }
    : "Plain words, not JSON: find the person first.";
  res.end(JSON.stringify({ success: true, message: "Chat endpoint response retrieved", data: typeof out === "string" ? out : "```json\n" + JSON.stringify(out) + "\n```" }));
}); }).listen(3018);
const web = spawn("npx", ["next", "dev", "-p", "3019"], { cwd: join(root, "web"), stdio: "ignore", detached: true,
  env: { ...process.env, HCM_COACH_ACCESS_CODE: "c", AI_API_KEY: "amp-v1-test", AMPLIFY_API_URL: "http://127.0.0.1:3018", AMPLIFY_MODEL: "", HCM_COACH_MODEL: "" } });
for (let i = 0; i < 90; i++) { try { if ((await fetch("http://localhost:3019/api/content", { headers: { "x-hcm-coach-code": "c" } })).ok) break; } catch {} await sleep(1000); }
const coach = async (b) => (await fetch("http://localhost:3019/api/coach", { method: "POST", headers: { "content-type": "application/json", "x-hcm-coach-code": "c" }, body: JSON.stringify(b) })).json();
try {
  const chat = await coach({ action: "chat", text: "What percentage do I enter for costing?", history: [] });
  check("chat: Amplify answer comes back with its source", chat.found === true && /100/.test(chat.text) && chat.sources[0] === "Guide: Create Costing for a Person", JSON.stringify(chat));
  const call = seen.find((s) => s.path === "/chat");
  check("sends the key as Bearer amp-v1-...", call?.auth === "Bearer amp-v1-test");
  check("picks a Claude Sonnet model from /available_models", JSON.parse(call.body).data.options.model.id === "us.anthropic.claude-sonnet-4-v1:0");
  check("gives Amplify the app's guides and job aids", JSON.parse(call.body).data.messages[0].content.includes("=== Guide: Change an Employee's Manager ==="));
  const sb = await coach({ action: "sayback", lessonId: "create-costing", stepIds: ["percentage", "coa-string"], text: "I entered 100 and submitted." });
  check("say-back: JSON in a code fence is read, parts are marked", JSON.stringify(sb.covered) === '["percentage"]' && JSON.stringify(sb.missed) === '["coa-string"]', JSON.stringify(sb));
  const ex = await coach({ action: "explain", lessonId: "change-manager", stepId: "find-employee" });
  check("explain: plain-word answers still come through", /find the person first/.test(ex.text ?? ""), JSON.stringify(ex));
} finally { try { process.kill(-web.pid); } catch {} amp.close(); }
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`); process.exit(failed ? 1 : 0);
