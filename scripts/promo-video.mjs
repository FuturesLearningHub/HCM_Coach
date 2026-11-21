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
const vo = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => join(P, `p0${i}.mp3`)); const d = vo.map(dur);

const S = [
  { kind: "title", bg: "close", lines: ["New process in <em>Oracle</em>?", "No more guessing."], vo: 0, secs: d[0] + 0.7 },
  { oracle: "workforce", shot: "01-library", k: "Meet HCM Coach", h: "Right beside Oracle. Always there.", vo: 1, secs: d[1] + 0.5 },
  { oracle: "change", shot: "02-guide", k: "Guide", h: "Every step: what, where, and <em>why</em>.", vo: 2, secs: d[2] + 0.45 },
  { oracle: "change", shot: "04-why", k: "Check", h: "Prove the how, and the why.", vo: 3, secs: d[3] + 0.55 },
  ...[1, 2, 3, 4].map((lit, j) => ({ kind: "meter", lit, vo: j === 0 ? 4 : undefined, secs: (d[4] + 0.6) / 4 + (j ? X : 0), cut: j > 0 })),
  { oracle: "change", shot: "07-chat", k: "Ask", h: "Answers only from your verified guides.", vo: 5, secs: d[5] + 0.5 },
  { oracle: "change", shot: "06-oncall", k: "Then, on your own", h: "Learn it with help. Do it <em>solo</em>.", vo: 6, secs: d[6] + 0.7 },
  { kind: "end", bg: "title", vo: 7, secs: d[7] + 2.8 },
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
  else if (s.kind === "meter") html = docked("change", s.lit === 1 ? "02-guide" : s.lit === 2 ? "05-prompt" : s.lit === 3 ? "06-oncall" : "08-sayback", `
    <div style="position:absolute;left:0;top:0;width:1440px;height:1080px;background:rgba(20,20,20,.88)"></div>
    <div style="position:absolute;left:110px;top:190px;width:1220px">
      <p class="k">The coach steps back as you learn</p>
      <p class="h" style="margin-bottom:70px">Two right in a row: <em>less help</em>.</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${LEVELS.map((l, j) => `
        <div style="padding:34px 22px;border-radius:14px;text-align:center;${j + 1 === s.lit ? "background:#CFAE70;color:#1C1C1C;box-shadow:0 0 50px rgba(207,174,112,.55);transform:scale(1.06)" : j + 1 < s.lit ? "background:rgba(207,174,112,.18);color:#CFAE70" : "background:rgba(255,255,255,.07);color:rgba(255,255,255,.55)"}">
          <p style="font:700 40px Ant;letter-spacing:.1em;text-transform:uppercase">${l}</p></div>`).join("")}</div>
      <p style="margin-top:40px;font:500 34px Int;color:rgba(255,255,255,.85)">${LEVELS[s.lit - 1]}: ${SAYS[s.lit - 1]}</p>
    </div>`);
  else {
    transparent = true;
    html = s.kind === "title" ? `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center">
        <p style="font:400 112px/1.05 Cas">${s.lines[0]}</p><p style="font:400 112px/1.05 Cas;color:#CFAE70">${s.lines[1]}</p></div>`
      : `<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center">
        <img src="${lockup}" style="height:60px"><p class="k">HCM Academy</p><p style="font:400 168px/1 Cas">HCM <em>Coach</em></p>
        <p style="font:500 40px Int;color:rgba(255,255,255,.88)">Learn it by doing it. Then do it with the coach off.</p></div>`;
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
  else if (s.kind === "meter") ff(["-loop", "1", "-i", join(work, `s${i}.png`), "-vf", `fps=${FPS},format=yuv420p`, "-t", s.secs.toFixed(3), "-c:v", "libx264", "-crf", "16", out]);
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
ff([...clips.flatMap((c) => ["-i", c]), "-i", join(P, "music.mp3"), ...voIn.flatMap((v) => ["-i", v.file]), "-filter_complex", filter,
  "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total.toFixed(2), join(P, "hcm-coach-promo.mp4")]);
console.log(`promo: ${total.toFixed(1)}s`);
