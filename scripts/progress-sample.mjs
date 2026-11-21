// Makes a sample progress report with fictional learners, using the real /api/progress code on a local server
// (records saved to a local folder instead of Vercel Blob). Output: demo/progress-sample/ (dashboard screenshot,
// CSV, and one stored record exactly as it is saved). Usage: node scripts/progress-sample.mjs
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "demo/progress-sample");
const WEB = "http://localhost:3021", CODE = "sample-code", ADMIN = "sample-admin";
const dir = mkdtempSync(join(tmpdir(), "progress-sample-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
spawnSync("npx", ["next", "build"], { cwd: join(root, "web"), stdio: "ignore" }); // a production server: no dev reloads
const web = spawn("npx", ["next", "start", "-p", "3021"], { cwd: join(root, "web"), stdio: "ignore", detached: true, env: { ...process.env, HCM_COACH_ACCESS_CODE: CODE, PROGRESS_ADMIN_CODE: ADMIN, PROGRESS_LOCAL_DIR: dir } });
for (let i = 0; i < 90; i++) { try { if ((await fetch(WEB + "/api/content", { headers: { "x-hcm-coach-code": CODE } })).ok) break; } catch {} await sleep(1000); }

// The app's throttle: two right in a row means less help, a miss means more.
const throttle = (s, ok) => ok ? (s.streak + 1 >= 2 && s.level < 4 ? { level: s.level + 1, streak: 0 } : { level: s.level, streak: s.streak + 1 }) : { level: Math.max(1, s.level - 1), streak: 0 };
const guide = (id) => JSON.parse(readFileSync(join(root, `web/guides/${id}.json`), "utf8"));
// Fictional learners: [name, process, runs, { stepId: run numbers she missed it on }]
const PEOPLE = [
  ["Jordan Lee", "change-manager", 6, { "effective-date": [1, 3], "way-reason": [1] }],
  ["Jordan Lee", "create-costing", 2, { "coa-string": [1] }],
  ["Priya Shah", "create-costing", 5, { "coa-string": [1, 2], "percentage": [1] }],
  ["Sam Ortiz", "inactivate-position", 3, { "action-reason": [1, 2], "status": [2] }],
  ["Taylor Brooks", "upload-document-record", 7, { "document-type": [1] }],
  ["Taylor Brooks", "change-manager", 1, {}],
];
const ids = {};
try {
  for (const [name, gid, runs, misses] of PEOPLE) {
    const id = (ids[name] ??= "sample-" + name.toLowerCase().replace(/\W/g, "") + "-0000000000");
    const screens = guide(gid).steps.filter((s) => s.type === "screen");
    const state = Object.fromEntries(screens.map((s) => [s.id, { level: 1, streak: 0 }]));
    for (let run = 1; run <= runs; run++) {
      const steps = screens.map((s) => { const ok = !(misses[s.id] ?? []).includes(run); state[s.id] = throttle(state[s.id], ok); return { id: s.id, level: state[s.id].level, outcome: ok ? "right" : "miss" }; });
      const r = await fetch(WEB + "/api/progress", { method: "POST", headers: { "content-type": "application/json", "x-hcm-coach-code": CODE }, body: JSON.stringify({ learner: { id, name }, lessonId: gid, runId: `${gid}-${run}`, steps }) });
      if (!r.ok) throw new Error(await r.text());
    }
  }
  // Sample only: spread the runs over four weeks so the over-time chart reads like a real pilot.
  const start = Date.parse("2026-10-26T15:00:00Z");
  for (const f of readdirSync(dir)) {
    const rec = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const seen = {};
    rec.history = (rec.history ?? []).map((h) => { const n = (seen[h.lessonId] = (seen[h.lessonId] ?? 0) + 1); const off = Object.keys(rec.processes).indexOf(h.lessonId) * 3; return { ...h, at: new Date(start + ((n - 1) * 4 + off) * 86_400_000).toISOString() }; });
    for (const [id, p] of Object.entries(rec.processes)) { const hs = rec.history.filter((h) => h.lessonId === id); if (hs.length) { p.firstRun = hs[0].at; p.lastRun = hs.at(-1).at; } }
    rec.updated = rec.history.map((h) => h.at).sort().at(-1) ?? rec.updated;
    writeFileSync(join(dir, f), JSON.stringify(rec));
  }
  writeFileSync(join(out, "hcm-coach-progress-sample.csv"), await (await fetch(WEB + "/api/progress?format=csv", { headers: { "x-progress-admin": ADMIN } })).text());
  const files = readdirSync(dir).sort();
  copyFileSync(join(dir, files[0]), join(out, "sample-stored-record.json"));
  writeFileSync(join(out, "sample-stored-record.json"), JSON.stringify(JSON.parse(readFileSync(join(out, "sample-stored-record.json"), "utf8")), null, 2));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  await fetch(WEB + "/progress"); await p.goto(WEB + "/progress", { waitUntil: "load", timeout: 120000 }); await p.waitForFunction(() => Object.keys(document.querySelector("input") ?? {}).some((k) => k.startsWith("__react")), null, { timeout: 120000 }); await p.getByLabel("Admin code").fill(ADMIN); await p.getByRole("button", { name: "Open dashboard" }).click();
  await p.getByText("How independent each learner is").waitFor(); await p.waitForTimeout(800);
  // A hover, to show the tooltip in the screenshot.
  const dot = p.locator("svg circle[fill=transparent]").nth(9); await dot.hover({ force: true }); await p.waitForTimeout(300);
  await p.screenshot({ path: join(out, "dashboard-sample.png"), fullPage: true }); await b.close();
  console.log("stored files:", files.join(", "));
} finally { try { process.kill(-web.pid); } catch {} }
