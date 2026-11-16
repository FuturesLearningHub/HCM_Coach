// Records HCM Coach on the practice screens and cuts the narrated demo video (demo/hcm-coach-demo.mp4) with ffmpeg.
// Part 1 (guide): the app beside the practice screens, walking through Change an Employee's Manager.
// Part 2 (update): a new process published on the server arrives on its own, then Help answers a question.
// Title and closing slides: animated HCM Coach type over the motion backgrounds in demo/motion (made in Runway).
// Narration and music: demo/audio (intro, g01.., u01.., outro, music). Captions are the lines in CAPTIONS below.
// It builds the app against its own local server on :3000, then puts the real build (npm run build:app) back.
// Usage: node scripts/demo-video.mjs            record and cut
//        CUT_ONLY=1 WORK=<dir> node scripts/demo-video.mjs   re-cut the last recordings
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = process.env.WORK || mkdtempSync(join(tmpdir(), "hcm-coach-demo-"));
mkdirSync(work, { recursive: true });
const out = join(root, "demo/hcm-coach-demo.mp4");
const BASE = "http://localhost:3000", CODE = "demo-code";
const W = 1280, H = 800, PW = 400, FPS = 25;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const AUD = join(root, "demo/audio");
const probe = (f) => Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout);
const clip = (name) => { const f = join(AUD, name + ".mp3"); return existsSync(f) ? { f, d: probe(f) } : null; };
const ff = (args) => { const r = spawnSync("ffmpeg", ["-y", "-nostdin", "-loglevel", "error", ...args], { encoding: "utf8" }); if (r.status !== 0) { console.error(r.stderr); process.exit(1); } };

// On-screen captions, in order. Each one plays the matching narration clip (g01, g02 ... u01 ...).
const CAPTIONS = {
  guide: [
    "Always there, beside Oracle. It never sees or changes the page.",
    "Pick the process you are about to do.",
    "Each step: a plain instruction, where to look, what you should see.",
    "Common mistakes up front. Do the step, then press Done.",
    "Some steps are a pause, to check something first.",
    "Local rules where they apply, with their source. Hints on request.",
    "Outside <em>Oracle</em> too: who to tell, and how.",
    "Ready for the conversation, then a tip for next time.",
    "A recap at the end. Nothing leaves your computer.",
  ],
  update: [
    "When a process changes, nobody reinstalls anything.",
    "New and updated guides arrive on their own.",
    "Stuck? Ask <em>Help</em>. Answers come only from HCM Coach's own guides.",
  ],
};

const CURSOR = `(() => { if (window.top !== window) return; const make = () => { if (document.getElementById('demo-cursor') || !document.body) return;
  const c = document.createElement('div'); c.id = 'demo-cursor';
  c.style.cssText = 'position:fixed;z-index:2147483647;left:-40px;top:-40px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(207,174,112,.45);border:2px solid #946E24;pointer-events:none;transition:transform .12s';
  document.body.appendChild(c);
  addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { c.style.transform = 'scale(.6)'; }, true);
  addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true); };
  document.addEventListener('DOMContentLoaded', make); make(); })();`;

// ── Recording ──────────────────────────────────────────────────────────────────
async function record({ key, run: scenario }) {
  const vids = join(work, "video-" + key); rmSync(vids, { recursive: true, force: true }); mkdirSync(vids, { recursive: true });
  const ext = join(root, "extension/dist-guide-live");
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "hcm-coach-profile-")), {
    channel: "chromium", headless: true, viewport: { width: W, height: H }, recordVideo: { dir: vids, size: { width: W, height: H } },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  await ctx.addInitScript(CURSOR);
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  const app = ctx.pages()[0] ?? await ctx.newPage();
  const tApp = Date.now();
  await app.goto(BASE + "/practice/workforce");
  const panelPromise = ctx.waitForEvent("page");
  await sw.evaluate((url) => chrome.windows.create({ url, type: "popup", width: 416, height: 880 }), `chrome-extension://${id}/sidepanel.html`);
  const panel = await panelPromise;
  const tPanel = Date.now();
  await panel.setViewportSize({ width: PW, height: H });
  await panel.waitForLoadState();

  const marks = [];
  const t0 = Date.now();
  const hold = async () => { // let the narration for the current caption finish before moving on
    const m = marks.at(-1); if (!m) return;
    const left = (m.d ?? 0) + 0.3 - ((Date.now() - t0) / 1000 - m.t);
    if (left > 0) await sleep(left * 1000);
  };
  const say = async () => { await hold(); const i = marks.length; const c = clip(`${key[0]}${String(i + 1).padStart(2, "0")}`); marks.push({ t: (Date.now() - t0) / 1000, text: CAPTIONS[key][i], f: c?.f, d: c?.d }); };
  async function go(page, locator, { click = true, pause = 350 } = {}) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 30), { steps: 16 });
    await sleep(180);
    if (click) await locator.click();
    await sleep(pause);
  }
  const pBtn = (name) => panel.getByRole("button", { name });
  const step = (title) => panel.locator(".step-title", { hasText: title }).waitFor({ timeout: 10000 });
  await scenario({ app, panel, say, go, pBtn, step });
  await hold();
  const meta = { key, marks, total: (Date.now() - t0) / 1000, lead: (t0 - tPanel) / 1000, appLead: (t0 - tApp) / 1000 };
  meta.appVideo = await app.video().path(); meta.panelVideo = await panel.video().path();
  await ctx.close();
  writeFileSync(join(work, `meta-${key}.json`), JSON.stringify(meta));
  console.log(`recorded ${key}: ${meta.total.toFixed(0)}s`);
  return meta;
}

async function guideScenario({ app, panel, say, go, pBtn, step }) {
  const done = async (next) => { await go(panel, pBtn(/Done\. Next step/), { pause: 200 }); await step(next); };
  await sleep(400);
  await say();
  await sleep(2600);
  await go(panel, pBtn(/Got it/), { pause: 700 });
  await say();
  await sleep(800);
  await go(panel, panel.locator(".lesson-card", { hasText: "Change an Employee's Manager" }), { pause: 1300 });
  await go(panel, pBtn(/^Start/), { pause: 400 });
  await step("Find the employee");
  await say();
  await sleep(1800);
  const search = app.getByLabel("Search for a person");
  await go(app, search, { pause: 200 });
  await search.pressSequentially("Jordan", { delay: 90 }); await sleep(900);
  await say();
  await done("Choose Change Manager"); await sleep(2200);
  await go(app, app.getByRole("button", { name: "Actions for Jordan Avery" }), { pause: 600 });
  await go(app, app.getByRole("menuitem", { name: "Change Manager" }), { pause: 1000 });
  await done("Info to Include"); await sleep(800);
  await go(app, app.getByRole("button", { name: "Continue" }), { pause: 600 });
  await say();
  await done("Check the pay type"); await sleep(2000);
  await go(panel, pBtn(/I checked the pay type/), { pause: 200 });
  await step("Set the effective date");
  await say();
  await sleep(2200);
  await go(panel, pBtn(/Give me a hint/), { pause: 1800 });
  const date = app.getByLabel("When does the manager change start?");
  await go(app, date, { pause: 200 }); await date.fill("2026-11-22"); await sleep(700);
  await done("How the manager is changing");
  const way = app.getByLabel("What's the way to change the manager?");
  await go(app, way, { click: false, pause: 150 }); await way.selectOption({ label: "Manager Change" }); await sleep(450);
  await done("Why the manager is changing");
  const why = app.getByLabel("Why are you changing the manager?");
  await go(app, why, { click: false, pause: 150 }); await why.selectOption({ label: "Change Line Manager" }); await sleep(450);
  await done("Move to Managers");
  await go(app, app.getByRole("button", { name: "Continue" }), { pause: 450 });
  await done("Edit the active manager");
  await go(app, app.getByRole("button", { name: "Edit manager" }), { pause: 450 });
  await done("Assign the new manager");
  const mgr = app.getByRole("textbox", { name: "Managers" });
  await go(app, mgr, { pause: 150 }); await mgr.fill(""); await mgr.pressSequentially("Pri", { delay: 100 }); await sleep(500);
  await go(app, app.getByRole("option", { name: /Priya Raman/ }), { pause: 400 });
  await done("Save");
  await go(app, app.getByRole("button", { name: "Save", exact: true }), { pause: 450 });
  await done("Submit");
  await go(app, app.getByRole("button", { name: "Submit", exact: true }), { pause: 600 });
  await say();
  await done("Tell the new manager"); await sleep(2800);
  await go(panel, pBtn(/I let the new manager know/), { pause: 200 });
  await step("Hand off with the outgoing manager");
  await say();
  await sleep(1200); await panel.mouse.wheel(0, 380); await sleep(1400);
  await go(panel, pBtn(/I'm ready/), { pause: 900 });
  await go(panel, pBtn(/Call done/), { pause: 600 });
  await panel.locator(".debrief select").selectOption("Partial yes"); await sleep(250);
  for (const [item, v] of [["purpose", 5], ["listen", 2], ["next-step", 4]]) await go(panel, panel.locator(`.rating:has(input[name="rate-${item}"]) label`).nth(v - 1), { pause: 200 });
  await go(panel, pBtn(/See my tips/), { pause: 2200 });
  await go(panel, pBtn(/Continue/), { pause: 300 });
  await say();
  await sleep(1400);
  for (let i = 0; i < 2; i++) { await panel.mouse.wheel(0, 330); await sleep(1000); }
}

// The "process changed" scene publishes a new guide on the local server while recording, then removes it.
const demoGuide = join(root, "web/guides/zz-demo-new.json");
const packContent = () => spawnSync("node", ["scripts/build-knowledge.mjs"], { cwd: root });
function publishDemoGuide() {
  const g = JSON.parse(readFileSync(join(root, "web/guides/create-costing.json"), "utf8"));
  Object.assign(g, { id: "update-costing", title: "Update Costing for a Person", goal: "Change the costing on an employee's assignment in Oracle from the right effective date." });
  writeFileSync(demoGuide, JSON.stringify(g, null, 2)); packContent();
}
const unpublishDemoGuide = () => { rmSync(demoGuide, { force: true }); packContent(); };

async function updateScenario({ panel, say, go, pBtn }) {
  await sleep(400);
  await go(panel, pBtn(/Got it/), { pause: 600 });
  await say();
  const code = panel.getByPlaceholder(/HCM Academy contact/);
  await code.scrollIntoViewIfNeeded(); await go(panel, code, { pause: 150 }); await code.pressSequentially(CODE, { delay: 55 });
  await go(panel, pBtn("Save"), { pause: 1600 });
  publishDemoGuide(); await sleep(3500);
  await say();
  await go(panel, pBtn("Check for updates"), { pause: 1200 });
  const fresh = panel.locator(".lesson-card", { hasText: "Update Costing for a Person" });
  await fresh.waitFor({ timeout: 15000 }); await fresh.scrollIntoViewIfNeeded(); await panel.mouse.wheel(0, -160); await sleep(2600);
  await say();
  await go(panel, panel.locator("header.top .ask-btn"), { pause: 700 });
  const q = panel.getByPlaceholder(/What do I do if/);
  await q.pressSequentially("What percentage do I enter for costing?", { delay: 45 }); await sleep(300);
  await go(panel, pBtn(/^Ask/), { pause: 2600 });
  await panel.mouse.wheel(0, 200); await sleep(2000);
}

const PARTS = [
  { key: "guide", run: guideScenario, note: "<b>Left:</b> practice screens standing in for Oracle &nbsp;·&nbsp; <b>Right:</b> HCM Coach, in the browser beside it. It only shows guidance and has no access to the page" },
  { key: "update", run: updateScenario, note: "<b>Left:</b> practice screens standing in for Oracle &nbsp;·&nbsp; <b>Right:</b> HCM Coach updating itself, then answering from its own guides" },
];

const metas = [];
if (process.env.CUT_ONLY) { for (const p of PARTS) metas.push(JSON.parse(readFileSync(join(work, `meta-${p.key}.json`), "utf8"))); }
else {
  const b = spawnSync("node", ["build.mjs"], { cwd: join(root, "extension"), encoding: "utf8", env: { ...process.env, HCM_COACH_MODE: "guide", HCM_COACH_CONTENT_URL: BASE } });
  if (b.status !== 0) { console.error(b.stderr); process.exit(1); }
  const web = spawn("npx", ["next", "dev", "-p", "3000"], { cwd: join(root, "web"), stdio: "ignore", detached: true, env: { ...process.env, HCM_COACH_ACCESS_CODE: CODE } });
  for (let i = 0; i < 90; i++) { try { if ((await fetch(BASE + "/practice/workforce")).ok) break; } catch {} await sleep(1000); }
  try { for (const p of PARTS) metas.push(await record(p)); }
  finally { unpublishDemoGuide(); try { process.kill(-web.pid); } catch {} spawnSync("npm", ["run", "build:app"], { cwd: root, stdio: "ignore" }); }
}

// ── Stills and animated slides (rendered with the bundled brand fonts) ────────
const font = (f) => `data:font/woff2;base64,${readFileSync(join(root, "extension/assets", f)).toString("base64")}`;
const img = (f) => `data:image/png;base64,${readFileSync(join(root, "extension/assets", f)).toString("base64")}`;
const css = `@font-face{font-family:Caslon;src:url(${font("libre-caslon-display-latin-400-normal.woff2")})}
@font-face{font-family:CaslonI;src:url(${font("libre-caslon-text-latin-400-italic.woff2")})}
@font-face{font-family:Inter;src:url(${font("inter-latin-500-normal.woff2")})}
@font-face{font-family:Antonio;src:url(${font("antonio-latin-700-normal.woff2")})}
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;font-family:Inter;color:#fff;overflow:hidden;background:transparent}
em{font-family:CaslonI;font-style:italic;color:#CFAE70}
.eyebrow{font:700 22px Antonio;letter-spacing:.1em;text-transform:uppercase;color:#CFAE70}
.plate{background:#1C1C1C;height:100%;position:relative}.plate img{position:absolute;right:90px;top:44px;height:44px}
.plate .eyebrow{position:absolute;left:90px;top:52px}.frame{position:absolute;left:86px;top:186px;width:1690px;height:808px;border:2px solid rgba(207,174,112,.45);border-radius:6px}
.note{position:absolute;left:90px;bottom:30px;font-size:19px;color:rgba(255,255,255,.6)}.note b{color:#CFAE70;font-weight:500}
.cap{position:absolute;left:90px;top:92px;width:1600px;font:400 46px/1.15 Caslon}
/* Animated slides. Everything is driven by Web Animations so each frame can be rendered exactly. */
.slide{position:absolute;inset:0}
.word{display:inline-block;will-change:transform,filter,opacity}
.chip{display:inline-block;border:1.5px solid rgba(207,174,112,.6);border-radius:999px;padding:10px 22px;font-size:24px;color:rgba(255,255,255,.88);background:rgba(28,28,28,.55);margin:0 8px}`;
const page = (body) => `<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`;
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const still = async (name, body, transparent = false) => { await pg.setContent(page(body)); await pg.evaluate(() => document.fonts.ready); await pg.screenshot({ path: join(work, name), omitBackground: transparent }); };
for (const p of PARTS) await still(`plate-${p.key}.png`, `<div class="plate"><span class="eyebrow">HCM Coach · Demo</span><img src="${img("vu-lockup-white.png")}"><div class="frame"></div><div class="note">${p.note}</div></div>`);
for (const m of metas) for (const [i, mk] of m.marks.entries()) await still(`cap-${m.key}-${i}.png`, `<div class="cap">${mk.text}</div>`, true);

/** Renders an animated text layer to a transparent PNG sequence. `anims` are [selector, keyframes, {delay, duration}] in ms. */
async function animate(name, body, anims, seconds) {
  const dir = join(work, "frames-" + name); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
  await pg.setContent(page(body)); await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate((list) => { for (const [sel, kf, o] of list) document.querySelectorAll(sel).forEach((el, i) => el.animate(kf, { fill: "both", easing: "cubic-bezier(.2,.7,.2,1)", ...o, delay: o.delay + (o.stagger ?? 0) * i }).pause()); }, anims);
  const frames = Math.round(seconds * FPS);
  for (let f = 0; f < frames; f++) {
    await pg.evaluate((ms) => document.getAnimations().forEach((a) => { a.currentTime = ms; }), (f * 1000) / FPS);
    await pg.screenshot({ path: join(dir, `${String(f).padStart(4, "0")}.png`), omitBackground: true });
  }
  return dir;
}
const words = (s) => s.split(" ").map((w) => `<span class="word">${w}</span>`).join(" ");
const blurIn = [{ opacity: 0, filter: "blur(18px)", transform: "translateY(28px) scale(1.04)" }, { opacity: 1, filter: "blur(0)", transform: "none" }];
const fadeUp = [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }];
const TITLE_S = 7.2, CLOSE_S = 7.4;
const titleDir = await animate("title", `
  <div class="slide" style="background:linear-gradient(90deg,#0d0c0b 0,#0d0c0b 640px,rgba(13,12,11,.85) 900px,rgba(13,12,11,0) 1280px)"></div>
  <img class="logo" src="${img("vu-lockup-white.png")}" style="position:absolute;left:150px;top:90px;height:60px">
  <div style="position:absolute;left:150px;top:330px;width:1000px">
    <div class="eyebrow e1" style="font-size:26px">HCM Academy · In your browser</div>
    <div style="font:400 168px/1 Caslon;margin:22px 0 30px"><span class="word t">HCM</span> <em class="word t">Coach</em></div>
    <div class="rule" style="height:3px;width:170px;background:#CFAE70;transform-origin:left"></div>
    <p class="sub" style="font-size:36px;line-height:1.4;color:rgba(255,255,255,.86);margin:30px 0 0;max-width:900px">${words("Your guide for every part of an HCM process, in Oracle and outside it.")}</p>
    <div class="pill" style="margin-top:34px;margin-left:-8px"><span class="chip">Browser extension</span><span class="chip">Always there</span></div>
  </div>`, [
  [".logo", fadeUp, { delay: 200, duration: 700 }],
  [".e1", fadeUp, { delay: 450, duration: 700 }],
  [".t", blurIn, { delay: 700, duration: 900, stagger: 220 }],
  [".rule", [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { delay: 1500, duration: 700 }],
  [".sub .word", blurIn, { delay: 1800, duration: 600, stagger: 70 }],
  [".chip", fadeUp, { delay: 3000, duration: 600, stagger: 180 }],
], TITLE_S);
const closeDir = await animate("close", `
  <div class="slide" style="background:linear-gradient(0deg,#0d0c0b 0,#0d0c0b 230px,rgba(13,12,11,.75) 420px,rgba(13,12,11,0) 640px)"></div>
  <div style="position:absolute;left:0;right:0;top:520px;text-align:center">
    <div style="font:400 150px/1 Caslon"><span class="word t">HCM</span> <em class="word t">Coach</em></div>
    <p class="tag" style="font:400 46px/1.3 Caslon;margin:26px 0 34px;color:rgba(255,255,255,.92)">${words("Always there, for the whole")} <em class="word">job.</em></p>
    <div><span class="chip">Lives in your browser</span><span class="chip">In and outside Oracle</span><span class="chip">Updates on its own</span></div>
    <img class="logo" src="${img("vu-lockup-white.png")}" style="height:48px;margin-top:44px">
  </div>`, [
  [".t", blurIn, { delay: 300, duration: 900, stagger: 220 }],
  [".tag .word", blurIn, { delay: 1100, duration: 600, stagger: 90 }],
  [".chip", fadeUp, { delay: 2000, duration: 600, stagger: 180 }],
  [".logo", fadeUp, { delay: 2700, duration: 700 }],
], CLOSE_S);
await browser.close();

// ── Cut ───────────────────────────────────────────────────────────────────────
const enc = ["-r", String(FPS), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-an"];
// Title: the gold ribbon shifted right so the left side is clear for the type. Closing: the starburst lifted above the type.
ff(["-i", join(root, "demo/motion/title-bg.mp4"), "-framerate", String(FPS), "-i", join(titleDir, "%04d.png"), "-filter_complex",
  `[0:v]fps=${FPS},scale=1920:1080,pad=2560:1080:640:0:color=0x0d0c0b,crop=1920:1080:0:0,tpad=stop_mode=clone:stop_duration=2[bg];[bg][1:v]overlay=0:0:shortest=1,fade=in:0:10`,
  "-t", String(TITLE_S), ...enc, join(work, "title.mp4")]);
ff(["-i", join(root, "demo/motion/close-bg.mp4"), "-framerate", String(FPS), "-i", join(closeDir, "%04d.png"), "-filter_complex",
  `[0:v]fps=${FPS},scale=1920:1080,pad=1920:1300:0:0:color=0x0d0c0b,crop=1920:1080:0:220,tpad=stop_mode=clone:stop_duration=2[bg];[bg][1:v]overlay=0:0:shortest=1,fade=out:st=${(CLOSE_S - 0.6).toFixed(2)}:d=0.6`,
  "-t", String(CLOSE_S), ...enc, join(work, "close.mp4")]);
// Demo parts: the plate, both recordings, and the captions, each fading in and out.
for (const m of metas) {
  const inputs = ["-loop", "1", "-t", String(m.total), "-i", join(work, `plate-${m.key}.png`), "-ss", m.appLead.toFixed(2), "-i", m.appVideo, "-ss", m.lead.toFixed(2), "-i", m.panelVideo];
  m.marks.forEach((_, i) => inputs.push("-loop", "1", "-t", String(m.total), "-i", join(work, `cap-${m.key}-${i}.png`)));
  let chain = `[1:v]crop=${W}:${H}:0:0,setpts=PTS-STARTPTS[a];[2:v]crop=${PW}:${H}:0:0,setpts=PTS-STARTPTS[p];[0:v][a]overlay=90:190:eof_action=repeat[v0];[v0][p]overlay=1372:190:eof_action=repeat[c0]`;
  m.marks.forEach((mk, i) => {
    const end = m.marks[i + 1]?.t ?? m.total;
    chain += `;[${i + 3}:v]format=rgba,fade=in:st=${mk.t.toFixed(2)}:d=0.35:alpha=1,fade=out:st=${Math.max(mk.t, end - 0.3).toFixed(2)}:d=0.3:alpha=1[k${i}];[c${i}][k${i}]overlay=0:0[c${i + 1}]`;
  });
  ff([...inputs, "-filter_complex", chain, "-map", `[c${m.marks.length}]`, "-t", m.total.toFixed(2), ...enc, join(work, `part-${m.key}.mp4`)]);
}
// Join with transitions: blur into the demo, slide between parts, blur into the close.
const segs = [{ f: join(work, "title.mp4"), d: TITLE_S }, ...metas.map((m) => ({ f: join(work, `part-${m.key}.mp4`), d: m.total })), { f: join(work, "close.mp4"), d: CLOSE_S }];
const TRANS = ["hblur", "smoothleft", "hblur"], XD = 0.8;
let vf = "", last = "[0:v]", acc = segs[0].d;
const starts = [0];
for (let i = 1; i < segs.length; i++) {
  const offset = acc - XD; starts.push(offset);
  vf += `${last}[${i}:v]xfade=transition=${TRANS[i - 1]}:duration=${XD}:offset=${offset.toFixed(3)}[x${i}];`;
  last = `[x${i}]`; acc = offset + segs[i].d;
}
const length = acc;
ff([...segs.flatMap((s) => ["-i", s.f]), "-filter_complex", vf.slice(0, -1), "-map", last, ...enc, join(work, "silent.mp4")]);

// Sound: narration placed on the timeline, the upbeat music bed under it.
const clips = [];
const intro = clip("intro"), outro = clip("outro");
if (intro) clips.push({ ...intro, at: 0.9 });
metas.forEach((m, k) => { for (const mk of m.marks) if (mk.f) clips.push({ f: mk.f, at: starts[k + 1] + mk.t + 0.15 }); });
if (outro) clips.push({ ...outro, at: starts.at(-1) + 1.1 });
const music = join(AUD, "music.mp3");
const ain = ["-i", join(work, "silent.mp4")]; clips.forEach((c) => ain.push("-i", c.f));
let af = clips.map((c, i) => `[${i + 1}:a]aresample=48000,adelay=${Math.round(c.at * 1000)}:all=1[n${i}]`).join(";");
let mixIn = clips.map((_, i) => `[n${i}]`).join("");
ain.push("-i", music);
af += `;[${clips.length + 1}:a]aresample=48000,loudnorm=I=-18:TP=-2,volume=0.24,afade=t=in:d=0.5,afade=t=out:st=${(length - 2.5).toFixed(2)}:d=2.5[m]`; mixIn += "[m]";
ff([...ain, "-filter_complex", `${af};${mixIn}amix=inputs=${clips.length + 1}:normalize=0:duration=longest,alimiter=limit=0.9:level=disabled[a]`,
  "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-t", length.toFixed(2), "-movflags", "+faststart", out]);
console.log(`Demo video: ${out}  (${length.toFixed(1)}s, ${clips.length} narration clips)\nwork dir: ${work}`);
