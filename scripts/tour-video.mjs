// Builds the first-launch tour video from demo/tour/shots (see tour-shots.mjs), Bella's narration (demo/tour/t0*.mp3,
// ElevenLabs) and the music bed (demo/audio/music.mp3). Output: extension/assets/tour.webm (shipped in the app) and
// demo/tour/hcm-coach-tour.mp4 (to share). Usage: node scripts/tour-video.mjs
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const T = join(root, "demo/tour"), work = join(T, "work"); rmSync(work, { recursive: true, force: true }); mkdirSync(work, { recursive: true });
const A = join(root, "extension/dist-guide-live/assets");
const b64 = (p, t) => `data:${t};base64,${readFileSync(p).toString("base64")}`;
const font = (f) => b64(join(A, f), "font/woff2");
const W = 720, H = 1280, FPS = 30, X = 0.45; // crossfade length
const dur = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", "-nostdin", ...args], { stdio: "inherit" });

// Scenes: [shot or title, kicker, headline, seconds, narration line that starts here]
const vo = [1, 2, 3, 4, 5, 6, 7].map((i) => join(T, `t0${i}.mp3`));
const d = vo.map(dur);
const S = [
  { title: "open", vo: 0, secs: d[0] + 0.9 },
  { shot: "01-library", k: "Pick a process", h: "The meter shows how much help you'll get.", vo: 1, secs: d[1] + 0.7 },
  { shot: "02-guide", k: "Guide", h: "See what to do, where, and why.", vo: 2, secs: d[2] + 0.7 },
  { shot: "03-how", k: "Check · How", h: "Show you know it worked…", vo: 3, secs: d[3] / 2 + 0.6 },
  { shot: "04-why", k: "Check · Why", h: "…and why it matters.", secs: d[3] / 2 + 0.6 },
  { shot: "05-prompt", k: "Prompt", h: "Get it right twice: you lead.", vo: 4, secs: d[4] * 0.55 + 0.5 },
  { shot: "06-oncall", k: "On call", h: "Less help, any time you want.", secs: d[4] * 0.45 + 0.7 },
  { shot: "07-chat", k: "Ask", h: "Answers only from HCM Coach.", vo: 5, secs: d[5] + 0.7 },
  { shot: "08-sayback", k: "Say it back", h: "What you did, and why.", vo: 6, secs: d[6] * 0.6 + 0.4 },
  { title: "close", secs: d[6] * 0.4 + 2.6 },
];

const css = `@font-face{font-family:Cas;src:url(${font("libre-caslon-display-latin-400-normal.woff2")})}
@font-face{font-family:CasI;src:url(${font("libre-caslon-text-latin-400-italic.woff2")})}
@font-face{font-family:Ant;src:url(${font("antonio-latin-700-normal.woff2")})}
@font-face{font-family:Int;src:url(${font("inter-latin-500-normal.woff2")})}
*{margin:0;box-sizing:border-box}html,body{width:${W}px;height:${H}px}
body{font-family:Int;color:#fff;overflow:hidden}
.k{font:700 26px Ant;letter-spacing:.14em;text-transform:uppercase;color:#CFAE70}
.h{font:400 50px/1.08 Cas;margin-top:12px}
.lock{height:44px}`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const lockup = b64(join(A, "vu-lockup-white.png"), "image/png");
for (const [i, s] of S.entries()) {
  if (s.shot) {
    await page.setContent(`<style>${css}
      body{background:radial-gradient(120% 60% at 50% 0%,rgba(207,174,112,.22),transparent 60%),#1C1C1C}
      .cap{position:absolute;left:56px;right:56px;top:70px}
      .frame{position:absolute;left:50%;top:300px;width:470px;transform:translateX(-50%);border-radius:22px;overflow:hidden;border:1.5px solid rgba(207,174,112,.7);box-shadow:0 30px 80px rgba(0,0,0,.6)}
      .frame img{display:block;width:100%}</style>
      <div class="cap"><p class="k">${s.k}</p><p class="h">${s.h}</p></div>
      <div class="frame"><img src="${b64(join(T, "shots", s.shot + ".png"), "image/png")}"></div>`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(work, `s${i}.png`) });
  } else {
    const open = s.title === "open";
    await page.setContent(`<style>${css}body{background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:26px}
      .t{font:400 104px/1 Cas}.t em{font-family:CasI;color:#CFAE70}.s{font:500 30px/1.35 Int;color:rgba(255,255,255,.86);max-width:540px}</style>
      <img class="lock" src="${lockup}"><p class="k">HCM Academy</p>
      <p class="t">HCM <em>Coach</em></p>
      <p class="s">${open ? "Learn the process by doing it, with a coach beside you." : "Learn it by doing it.<br>Then do it with the coach off."}</p>`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: join(work, `s${i}.png`), omitBackground: true });
  }
}
await browser.close();

// Each scene as a clip: shots get a slow push-in; titles sit over the Runway motion background, cropped to portrait.
const clips = S.map((s, i) => {
  const out = join(work, `c${i}.mp4`), frames = Math.round(s.secs * FPS);
  if (s.shot) ff(["-loop", "1", "-i", join(work, `s${i}.png`), "-vf", `scale=${W * 2}:${H * 2},zoompan=z='1+0.035*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/3-(ih/zoom/3)':d=${frames}:s=${W}x${H}:fps=${FPS},format=yuv420p`, "-frames:v", String(frames), "-c:v", "libx264", "-crf", "16", out]);
  else ff(["-stream_loop", "-1", "-i", join(root, `demo/motion/${s.title === "open" ? "title" : "close"}-bg.mp4`), "-loop", "1", "-i", join(work, `s${i}.png`), "-filter_complex",
    `[0:v]crop=608:1080,scale=${W}:${H},fps=${FPS},eq=brightness=-0.12[bg];[bg][1:v]overlay=0:0,format=yuv420p,fade=t=in:st=0:d=0.5`, "-t", s.secs.toFixed(3), "-c:v", "libx264", "-crf", "16", out]);
  return out;
});

// Join with crossfades, and place each narration line at the start of its scene.
let chain = "", last = "[0:v]", t = S[0].secs; const starts = [0];
for (let i = 1; i < clips.length; i++) {
  const o = `[v${i}]`; chain += `${last}[${i}:v]xfade=transition=${i % 3 === 0 ? "slideleft" : "fade"}:duration=${X}:offset=${(t - X).toFixed(3)}${o};`;
  starts.push(t - X); t += S[i].secs - X; last = o;
}
const total = t;
const voIn = S.map((s, i) => (s.vo !== undefined ? { file: vo[s.vo], at: starts[i] + (i === 0 ? 0.6 : 0.25) } : null)).filter(Boolean);
const n = clips.length;
const aParts = voIn.map((v, j) => `[${n + 1 + j}:a]adelay=${Math.round(v.at * 1000)}|${Math.round(v.at * 1000)},volume=1.6[a${j}]`).join(";");
const filter = `${chain}${last}fade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8[vout];` +
  `[${n}:a]atrim=0:${total.toFixed(2)},volume=0.22,afade=t=in:d=1,afade=t=out:st=${(total - 2.2).toFixed(2)}:d=2.2[m];${aParts};` +
  `[m]${voIn.map((_, j) => `[a${j}]`).join("")}amix=inputs=${voIn.length + 1}:normalize=0,alimiter=limit=0.95[aout]`;
const inputs = [...clips.flatMap((c) => ["-i", c]), "-i", join(root, "demo/audio/music.mp3"), ...voIn.flatMap((v) => ["-i", v.file])];
const mp4 = join(T, "hcm-coach-tour.mp4");
ff([...inputs, "-filter_complex", filter, "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-t", total.toFixed(2), mp4]);
ff(["-i", mp4, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-c:a", "libopus", "-b:a", "96k", join(root, "extension/assets/tour.webm")]);
console.log(`tour: ${total.toFixed(1)}s →`, mp4);
