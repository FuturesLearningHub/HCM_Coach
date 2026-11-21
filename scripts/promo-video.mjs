// Builds the HCM Coach promo (demo/promo/hcm-coach-promo.mp4): 16:9, the panel docked beside the practice Oracle
// screens, bold lower-third headlines, the support meter animating Guide to Off, Runway motion backgrounds for the
// open and close, Bella's narration (demo/promo/p0*.mp3) over an upbeat track (demo/promo/music.mp3).
// Inputs: demo/tour/shots (node scripts/tour-shots.mjs) and demo/promo/oracle-*.png. Usage: node scripts/promo-video.mjs
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = join(root, "demo/promo"), SH = join(root, "demo/tour/shots"), work = join(P, "work");
rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
const A = join(root, "extension/dist-guide-live/assets");
const b64 = (p, t) => `data:${t};base64,${readFileSync(p).toString("base64")}`;
const font = (f) => b64(join(A, f), "font/woff2");
const W = 1920, H = 1080, FPS = 30, X = 0.4;
const dur = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", "-nostdin", ...args], { stdio: "inherit" });
const vo = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => join(P, `v0${i}.mp3`)); const d = vo.map(dur);

// A plain-speak story: the problem, what it is, how it works, the dial that turns help down as you improve, why it works.
const S = [
  { kind: "title", bg: "close", lines: ["Read the job aid.", "Hope you remember."], sub: "It doesn't stick.", vo: 0, secs: d[0] + 0.5 },
  { oracle: "workforce", shot: "01-library", k: "Meet HCM Coach", h: "A coach beside Oracle, while you do the <em>real</em> work.", vo: 1, secs: d[1] + 0.4 },
  { oracle: "change", shot: "02-guide", k: "1 · It shows you", h: "What to do, where to look, and <em>why</em>.", vo: 2, secs: d[2] + 0.4 },
  { oracle: "change", shot: "03-how", k: "2 · It checks you get it", h: "How do you know it worked?", vo: 3, secs: d[3] * 0.5 + 0.3 },
  { oracle: "change", shot: "04-why", k: "2 · It checks you get it", h: "And why does it <em>matter</em>?", secs: d[3] * 0.5 + 0.5 },
  { kind: "meter", lit: 1, k: "Here's the smart part", h: "The better you get, the <em>less</em> it helps.", line: "Guide: it shows you every step.", vo: 4, secs: d[4] + 0.5 },
  { kind: "meter", lit: 2, k: "Right twice?", h: "It turns the help <em>down</em>.", line: "Prompt: it just asks what comes next.", vo: 5, secs: d[5] * 0.36 + 0.25, cut: true },
  { kind: "meter", lit: 3, k: "Keep it up", h: "It turns the help <em>down</em>.", line: "On call: quiet, unless you ask.", secs: d[5] * 0.32 + 0.25, cut: true },
  { kind: "meter", lit: 4, k: "Then", h: "You do it <em>on your own</em>.", line: "Off: no coach needed.", secs: d[5] * 0.32 + 0.6, cut: true },
  { kind: "meter", lit: 2, back: true, k: "Miss one?", h: "It steps back <em>in</em>, just for that step.", line: "More help on that step until you've got it.", vo: 6, secs: d[6] * 0.42 + 0.2 },
  { oracle: "change", shot: "07-chat", k: "Stuck? Just ask", h: "Answers only from your team's <em>own</em> guides.", secs: d[6] * 0.58 + 0.5 },
  { kind: "why", vo: 7, secs: d[7] * 0.62 + 0.3 },
  { kind: "end", bg: "title", secs: d[7] * 0.38 + 2.6 },
];

const css = `@font-face{font-family:Cas;src:url(${font("libre-caslon-display-latin-400-normal.woff2")})}
@font-face{font-family:CasI;src:url(${font("libre-caslon-text-latin-400-italic.woff2")})}
@font-face{font-family:Ant;src:url(${font("antonio-latin-700-normal.woff2")})}
@font-face{font-family:Int;src:url(${font("inter-latin-500-normal.woff2")})}
*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px;overflow:hidden}body{font-family:Int;color:#fff}
em{font-family:CasI;font-style:normal;color:#CFAE70}
.k{font:700 30px Ant;letter-spacing:.16em;text-transform:uppercase;color:#CFAE70}
.h{font:400 76px/1.04 Cas;margin-top:10px}`;
const LEVELS = ["Guide", "Prompt", "On call", "Off"], SAYS = ["Shows you the step, then checks it.", "You say what comes next.", "Quiet, unless you ask.", "You do it on your own."];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const lockup = b64(join(A, "vu-lockup-white.png"), "image/png");
const img = (p) => b64(p, "image/png");
const docked = (oracle, shot, overlay = "") => `
  <div style="position:absolute;left:0;top:0;width:1440px;height:1080px;background:url(${img(join(P, `oracle-${oracle}.png`))}) 0 0/1440px 1080px;filter:brightness(.92)"></div>
  <div style="position:absolute;left:1440px;top:0;width:480px;height:1080px;background:#141414;border-left:1px solid rgba(207,174,112,.5)">
    <div style="height:60px;display:flex;align-items:center;gap:10px;padding:0 18px;font:600 17px Int;color:rgba(255,255,255,.75)"><span style="width:12px;height:12px;border-radius:50%;background:#CFAE70"></span>HCM Coach</div>
    <img src="${img(join(SH, shot + ".png"))}" style="display:block;width:480px;height:960px;object-fit:cover;object-position:top">
  </div>${overlay}`;
for (const [i, s] of S.entries()) {
  let html, transparent = false;
  if (s.oracle) html = docked(s.oracle, s.shot, `
    <div style="position:absolute;left:0;bottom:0;width:1440px;height:430px;background:linear-gradient(to top,rgba(20,20,20,.96) 35%,rgba(20,20,20,0))"></div>
    <div style="position:absolute;left:90px;bottom:84px;width:1200px"><p class="k">${s.k}</p><p class="h">${s.h}</p></div>
    <div style="position:absolute;left:1436px;top:0;width:488px;height:1080px;box-shadow:0 0 60px 6px rgba(207,174,112,.35);pointer-events:none"></div>`);
  else if (s.kind === "meter") {
    const help = [100, 66, 33, 6][s.lit - 1];
    html = docked("change", s.back ? "02-guide" : ["02-guide", "05-prompt", "06-oncall", "08-sayback"][s.lit - 1], `
    <div style="position:absolute;left:0;top:0;width:1440px;height:1080px;background:rgba(20,20,20,.9)"></div>
    <div style="position:absolute;left:110px;top:150px;width:1220px">
      <p class="k">${s.k}</p>
      <p class="h" style="margin-bottom:64px">${s.h}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${LEVELS.map((l, j) => `
        <div style="padding:30px 20px;border-radius:14px;text-align:center;${j + 1 === s.lit ? "background:#CFAE70;color:#1C1C1C;box-shadow:0 0 50px rgba(207,174,112,.55);transform:scale(1.06)" : j + 1 < s.lit ? "background:rgba(207,174,112,.18);color:#CFAE70" : "background:rgba(255,255,255,.07);color:rgba(255,255,255,.55)"}">
          <p style="font:700 38px Ant;letter-spacing:.1em;text-transform:uppercase">${l}</p></div>`).join("")}</div>
      <div style="display:flex;align-items:center;gap:24px;margin-top:46px">
        <span style="font:700 28px Ant;letter-spacing:.14em;color:rgba(255,255,255,.7)">HELP</span>
        <div style="flex:1;height:22px;border-radius:11px;background:rgba(255,255,255,.08);overflow:hidden"><div style="width:${help}%;height:100%;border-radius:11px;background:linear-gradient(90deg,#CFAE70,#ECB748)"></div></div>
        <span style="font:700 28px Ant;color:#CFAE70;width:90px">${s.back ? "▲ MORE" : s.lit > 1 ? "▼ LESS" : "FULL"}</span>
      </div>
      <p style="margin-top:36px;font:500 34px Int;color:rgba(255,255,255,.88)">${s.line}</p>
    </div>`);
  }
  else if (s.kind === "why") html = `<div style="position:absolute;inset:0;background:radial-gradient(90% 70% at 50% 0%,rgba(207,174,112,.2),transparent 60%),#1C1C1C"></div>
    <div style="position:absolute;left:120px;right:120px;top:150px">
      <p class="k">That's why it works</p><p class="h" style="margin-bottom:70px">You learn it by <em>doing</em> it.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:30px">${[["1", "Do the real work", "In Oracle, with a coach beside you. Not a quiz on the side."], ["2", "Help fades as you improve", "Right answers turn the help down. A miss turns it back up."], ["3", "Then do it on your own", "The goal: the same process, with the coach switched off."]].map(([n, t, b]) => `
        <div style="padding:40px 36px;border-radius:18px;border:1.5px solid rgba(207,174,112,.55);background:rgba(255,255,255,.04)">
          <p style="font:700 64px Ant;color:#CFAE70">${n}</p><p style="font:400 46px/1.1 Cas;margin:16px 0 18px">${t}</p><p style="font:500 28px/1.4 Int;color:rgba(255,255,255,.8)">${b}</p></div>`).join("")}</div></div>`;
  else {
    transparent = true;
    html = s.kind === "title" ? `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center">
        <p style="font:400 112px/1.05 Cas">${s.lines[0]}</p><p style="font:400 112px/1.05 Cas;color:#CFAE70">${s.lines[1]}</p><p style="margin-top:30px;font:500 44px Int;color:rgba(255,255,255,.85)">${s.sub ?? ""}</p></div>`
      : `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center">
        <img src="${lockup}" style="height:60px"><p class="k">HCM Academy</p><p style="font:400 168px/1 Cas">HCM <em>Coach</em></p>
        <p style="font:500 40px Int;color:rgba(255,255,255,.88)">Learn it by doing it.</p></div>`;
  }
  await page.setContent(`<style>${css}${transparent ? "body{background:transparent}" : "body{background:#1C1C1C}"}</style>${html}`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(work, `s${i}.png`), omitBackground: transparent });
}
await browser.close();

const clips = S.map((s, i) => {
  const out = join(work, `c${i}.mp4`), frames = Math.round(s.secs * FPS);
  if (s.bg) ff(["-stream_loop", "-1", "-i", join(root, `demo/motion/${s.bg}-bg.mp4`), "-loop", "1", "-i", join(work, `s${i}.png`), "-filter_complex",
    `[0:v]scale=${W}:${H},fps=${FPS},eq=brightness=-0.18[bg];[1:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.04*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},format=rgba[fg];[bg][fg]overlay=0:0,format=yuv420p`, "-t", s.secs.toFixed(3), "-c:v", "libx264", "-crf", "16", out]);
  else if (s.kind === "meter" || s.kind === "why") ff(["-loop", "1", "-i", join(work, `s${i}.png`), "-vf", `fps=${FPS},format=yuv420p`, "-t", s.secs.toFixed(3), "-c:v", "libx264", "-crf", "16", out]);
  else ff(["-loop", "1", "-i", join(work, `s${i}.png`), "-vf", `scale=${W * 2}:${H * 2},zoompan=z='1+0.03*on/${frames}':x='iw*0.62-(iw/zoom*0.62)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},format=yuv420p`, "-frames:v", String(frames), "-c:v", "libx264", "-crf", "16", out]);
  return out;
});
const T = ["fadeblack", "smoothleft", "fade", "slideup", "fade", "fade", "fade", "circleopen", "smoothleft", "fadewhite", "fadeblack"];
let chain = "", last = "[0:v]", t = S[0].secs; const starts = [0];
for (let i = 1; i < clips.length; i++) {
  const x = S[i].cut ? 0.25 : X;
  chain += `${last}[${i}:v]xfade=transition=${S[i].cut ? "fade" : T[i % T.length]}:duration=${x}:offset=${(t - x).toFixed(3)}[v${i}];`;
  starts.push(t - x); t += S[i].secs - x; last = `[v${i}]`;
}
const total = t, n = clips.length;
const voIn = S.map((s, i) => (s.vo !== undefined ? { file: vo[s.vo], at: starts[i] + (i === 0 ? 0.35 : 0.2) } : null)).filter(Boolean);
const aParts = voIn.map((v, j) => `[${n + 1 + j}:a]adelay=${Math.round(v.at * 1000)}|${Math.round(v.at * 1000)},volume=1.7[a${j}]`).join(";");
const filter = `${chain}${last}fade=t=out:st=${(total - 0.7).toFixed(2)}:d=0.7[vout];` +
  `[${n}:a]atrim=0:${total.toFixed(2)},volume=0.32,afade=t=out:st=${(total - 2).toFixed(2)}:d=2[m];${aParts};` +
  `[m]${voIn.map((_, j) => `[a${j}]`).join("")}amix=inputs=${voIn.length + 1}:normalize=0,alimiter=limit=0.95[aout]`;
ff([...clips.flatMap((c) => ["-i", c]), "-i", join(P, "music-long.mp3"), ...voIn.flatMap((v) => ["-i", v.file]), "-filter_complex", filter,
  "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total.toFixed(2), join(P, "hcm-coach-promo.mp4")]);
console.log(`promo: ${total.toFixed(1)}s`);
