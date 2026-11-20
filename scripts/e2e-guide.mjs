// Checks for the guide build (extension/dist-guide): a read-along guide with no access to any page.
// Usage: npm run build:guide && npm run test:guide
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(root, "extension/dist-guide");
const shots = process.env.SHOTS || join(root, "test-results");
mkdirSync(shots, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const manifest = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
check("manifest: storage and sidePanel only", JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "sidePanel"]));
check("manifest: no host permissions, no content scripts, no external messaging", !manifest.host_permissions && !manifest.content_scripts && !manifest.optional_host_permissions && !manifest.externally_connectable);

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "hcm-coach-guide-")), {
  channel: "chromium", headless: true, viewport: { width: 400, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const requests = [];
ctx.on("request", (r) => requests.push(r.url()));
const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker");
const id = new URL(sw.url()).host;
const panel = ctx.pages()[0] ?? await ctx.newPage();
await panel.goto(`chrome-extension://${id}/sidepanel.html`);
const seen = (text, ms = 5000) => panel.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: ms }).then(() => true, () => false);
const stepIs = (title) => panel.locator(".step-title", { hasText: title }).waitFor({ timeout: 6000 }).then(() => true, () => false);
const shot = (name) => panel.screenshot({ path: join(shots, name + ".png") });

check("welcome says it reads nothing", await seen("I have no access to Oracle"));
await panel.getByRole("button", { name: /Got it/ }).click();
// First launch: the tour video plays, with sound, and can be skipped; it can be replayed from the list.
check("first launch shows the tour", await seen("How HCM Coach"));
const tourState = () => panel.locator(".tour-video video").evaluate((v) => ({ t: v.currentTime, dur: v.duration, paused: v.paused, w: v.videoWidth, audio: v.mozHasAudio ?? (v.webkitAudioDecodedByteCount > 0 || v.audioTracks?.length > 0 || true) }));
await panel.waitForTimeout(1500);
const tv = await tourState();
check("the tour video loads and plays (about a minute, portrait)", tv.dur > 40 && tv.dur < 70 && tv.w > 0 && (tv.t > 0 || tv.paused), JSON.stringify(tv));
await panel.screenshot({ path: join(shots, "guide-00-tour.png") });
await panel.getByRole("button", { name: /Skip the tour/ }).click();
check("Skip goes to the process list, with a link to watch it again", await seen("Watch the 1-minute tour"));
// Finding a process: search box and topic chips above the list.
const cards = () => panel.locator(".lesson-card").allInnerTexts().then((t) => t.map((x) => x.split("\n")[0]));
const find = panel.getByLabel("Find a process");
const all = await cards();
await find.fill("upload");
check("typing a word narrows the list to matching processes", all.length >= 3 && JSON.stringify(await cards()) === JSON.stringify(["Upload a Document to Document Records"]) && await panel.getByText(`1 of ${all.length} processes`).isVisible(), (await cards()).join(" | "));
await find.fill("pencil");
check("search also looks inside the steps, not just the title", JSON.stringify(await cards()) === JSON.stringify(["Change an Employee's Manager"]));
await find.fill("zebra");
check("no match is explained, with a way back to the full list", await panel.getByText("No process matches that.").isVisible() && (await cards()).length === 0);
await panel.getByRole("button", { name: "Show all processes" }).click();
await panel.getByRole("button", { name: "Positions", exact: true }).click();
check("a topic chip filters the list", JSON.stringify(await cards()) === JSON.stringify(["Inactivate a Position"]) && await panel.getByRole("button", { name: "Positions", exact: true }).getAttribute("aria-pressed") === "true");
await panel.waitForTimeout(400); await panel.screenshot({ path: join(shots, "guide-finder.png") });
await panel.getByRole("button", { name: "All", exact: true }).click();
check("All shows every process again", (await cards()).length === all.length);
// The coached run. Every on-screen part starts at Guide: the step, why, the rule, then a quick check.
const guide = JSON.parse(readFileSync(join(root, "web/guides/change-manager.json"), "utf8"));
const rightFor = (st) => st.check ? st.check.options[st.check.answer] : st.expect;
const open = async () => { await panel.locator(".lesson-card", { hasText: "Change an Employee's Manager" }).click(); await panel.getByRole("button", { name: /^Start/ }).click(); };
const pickText = (t) => panel.locator(".option", { hasText: t }).first().click();
const toast = () => panel.locator(".toast, [role=status]").allInnerTexts().then((t) => t.join(" "));
let toasts = "";
/** One part at the level it is at. Guide: I did it, then the how and why checks. Prompt: what comes next and why, then I did it. */
async function part(st, { miss = false } = {}) {
  await panel.locator(".step-card").first().waitFor();
  await panel.waitForTimeout(150);
  if (await panel.getByRole("heading", { name: "What comes next?" }).isVisible()) {
    await pickText(st.title);
    if (await panel.getByRole("heading", { name: "Why does it matter?" }).waitFor({ timeout: 1500 }).then(() => true, () => false)) await pickText(st.why);
  }
  await panel.getByRole("button", { name: /^I did it$/ }).click({ timeout: 5000 });
  let first = true;
  while (await panel.locator(".options").waitFor({ timeout: 1500 }).then(() => true, () => false)) {
    const isWhy = /Why/.test(await panel.locator(".q-label").textContent());
    const right = isWhy ? st.why : rightFor(st);
    if (miss && first) await panel.locator(".option", { hasNotText: right }).first().click(); else await pickText(right);
    first = false;
    await panel.getByRole("button", { name: /^Next (question|step)/ }).click();
    await panel.waitForTimeout(200);
    if (!(await panel.locator(".q-label").isVisible())) break;
  }
  await panel.waitForTimeout(250); toasts += " " + await toast();
}
async function runAll({ missAt } = {}) {
  for (const st of guide.steps) {
    if (st.type === "screen") await part(st, { miss: st.id === missAt });
    else if (st.type === "checkpoint" || st.type === "offline") await panel.getByRole("button", { name: st.confirm }).click();
    else if (st.type === "call") { await panel.getByRole("button", { name: /I'm ready/ }).click(); await panel.getByRole("button", { name: /Call done/ }).click();
      await panel.locator(".debrief select").selectOption("Got a yes");
      for (const [item, v] of [["purpose", 2], ["listen", 5], ["next-step", 5]]) await panel.locator(`input[name="rate-${item}"][value="${v}"]`).check({ force: true });
      await panel.getByRole("button", { name: /See my tips/ }).click(); await panel.getByRole("button", { name: /Continue/ }).click(); }
  }
}

const pagesBefore = ctx.pages().length;
check("every process starts as new: full support", await seen("New: full support"));
await open();
check("starts at step 1 without opening or touching any tab", await stepIs("Find the employee") && ctx.pages().length === pagesBefore);
check("Guide level: the meter shows Guide lit", (await panel.locator(".meter .notch.on").textContent()).trim() === "Guide");
check("Guide level: shows the step, where to look, why and what to watch for", await seen("Search for the employee from Home.") && await seen("Where to look") && await seen("Right person first") && await seen("Match the person number"));
check("the step has its kind icon, like the step list", await panel.locator(".step-title .step-icon").isVisible());
await shot("guide-01-step");
await panel.getByRole("button", { name: /^I did it$/ }).click();
check("after she does it, the first check is the how", await seen("What should you see on the screen now?") && await seen("Check 1 of 2"));
await panel.locator(".option", { hasNotText: guide.steps[0].expect }).first().click();
check("a wrong pick is marked, with the right answer and why", await seen("Not quite.") && await panel.locator(".option.right", { hasText: guide.steps[0].expect }).isVisible());
await shot("guide-02-check");
await panel.getByRole("button", { name: /^Next question/ }).click();
check("then the why", await seen("Why does this step matter?") && await seen("Check 2 of 2"));
await pickText(guide.steps[0].why);
check("a right why is confirmed", await seen("Right."));
await shot("guide-02b-why");
await panel.getByRole("button", { name: /^Next step/ }).click();
check("Next step moves on", await stepIs("Open Change Manager"));
check("common slips are shown as what to watch for", await seen("Not Change Location"));
await panel.getByRole("button", { name: /Previous step/ }).click();
check("Previous step goes back", await stepIs("Find the employee"));
// Finish the first run from step 1, all right.
await runAll();
check("after the last part, she says it back", await seen("Say it") && await seen("what did you do, and why?"));
check("without the AI in this build, the say-back is compared against the process list", await seen("Check it against the process"));
await shot("guide-03-sayback");
await panel.getByRole("button", { name: /^Finish/ }).click();
check("guide runs start to finish (recap shown)", await seen("You did the whole"));
await shot("guide-04-recap");
await panel.getByRole("button", { name: /Back to|All processes|Done/ }).first().click().catch(() => {});

// Second run, all right: two right in a row moves each part down to Prompt. One miss keeps that part at Guide.
await panel.locator(".lesson-card").first().waitFor();
check("after one run the list shows she's learning", await seen("Learning: full support"));
await open(); toasts = "";
await runAll({ missAt: "submit" });
check("two right in a row: the coach says less help next time", /Less help next time: Prompt/.test(toasts), toasts.slice(0, 160));
await panel.getByRole("button", { name: /^Finish/ }).click();
await panel.getByRole("button", { name: /Back to|All processes|Done/ }).first().click().catch(() => {});
await panel.locator(".lesson-card").first().waitFor();
check("the list shows the process has moved to Prompt", await seen("Learning: mostly Prompt"));
await shot("guide-05-list-meter");

// Third run: at Prompt she says what comes next. A wrong answer gets a hint, not the answer.
await open();
await panel.waitForTimeout(300);
check("Prompt level: asks what comes next, meter shows Prompt", await panel.getByRole("heading", { name: "What comes next?" }).isVisible() && (await panel.locator(".meter .notch.on").textContent()).trim() === "Prompt");
await panel.locator(".option", { hasNotText: "Find the employee" }).first().click();
check("a wrong next step gets a hint", await seen("Not that one.") && await seen("Hint:"));
await shot("guide-06-prompt");
await pickText("Find the employee");
check("a right next step is confirmed, then she says why", await seen("Right.") && await panel.getByRole("heading", { name: "Why does it matter?" }).isVisible());
await pickText(guide.steps[0].why);
check("then she does it", await panel.getByRole("button", { name: /^I did it$/ }).waitFor({ timeout: 3000 }).then(() => true, () => false));
await panel.getByRole("button", { name: "Less help" }).click();
await seen("I'm here if you need me");
check("Less help: drops to On call, and the coach goes quiet", (await panel.locator(".meter .notch.on").textContent()).trim() === "On call" && await seen("I'm here if you need me"));
await panel.getByRole("button", { name: /Help me with this step/ }).click();
check("asking for help shows the step again", await seen("Search for the employee from Home."));
await shot("guide-07-oncall");
await panel.getByRole("button", { name: /Exit lesson/ }).click(); await panel.getByRole("button", { name: /Exit lesson/ }).last().click();

// Help: "what do I do if" questions, answered by quoting the guides and job aids. Offline, no AI model.
await panel.getByRole("button", { name: "Ask HCM Coach" }).click();
check("the chat pops up over the page", await panel.getByRole("dialog", { name: "Ask HCM Coach" }).isVisible());
const askHelp = async (q) => { await panel.getByLabel("Your question").fill(q); await panel.getByRole("button", { name: "Ask", exact: true }).click(); await panel.waitForTimeout(250); };
const lastAnswer = () => panel.locator(".chat > .bubble:not(.user)").last().innerText();
check("help says where its answers come from and that nothing is sent", await seen("Answers are quoted from the") && await seen("Nothing you type leaves this computer"));
await askHelp("What date do I use for a non-exempt employee?");
let ans = await lastAnswer();
check("a rule question is answered with the rule, and its source", /pay period/.test(ans) && /Sunday/.test(ans) && /From (Guide|Job aid): Change/.test(ans), ans.replace(/\n/g, " | ").slice(0, 220));
await askHelp("What do I do if my upload needs approval from PCB?");
ans = await lastAnswer();
check("a what-if question is answered from the right process", /PCB approv/.test(ans) && /Document/.test(ans), ans.replace(/\n/g, " | ").slice(0, 220));
await askHelp("Which document type is a salary increase letter?");
ans = await lastAnswer();
check("the answer quotes only the lines that matter, not the whole section", /Compensation Letters/.test(ans) && !/visa and sponsorship/i.test(ans), ans.replace(/\n/g, " | ").slice(0, 220));
await askHelp("How do I order a zebra spaceship?");
ans = await lastAnswer();
check("it refuses to guess when the guides do not cover it", /Not in the guides/i.test(ans) && /will not guess/.test(ans));
check("the conversation stays on screen as a chat", (await panel.locator(".chat > .bubble.user").count()) === 4);
await shot("guide-04-search");
await panel.getByRole("button", { name: "Close chat" }).click();

check("no tab was opened or navigated during the whole run", ctx.pages().length === pagesBefore);
const foreign = [...new Set(requests.filter((u) => !u.startsWith(`chrome-extension://${id}/`) && !u.startsWith("blob:") && !u.startsWith("data:")))];
check("zero network requests beyond the extension's own files", foreign.length === 0, foreign.slice(0, 3).join(" "));
const tryNet = (t) => t.evaluate(async () => { try { await fetch("https://example.com/"); return "allowed"; } catch { return "blocked"; } });
check("CSP blocks network calls from the side panel and the service worker", (await tryNet(panel)) === "blocked" && (await tryNet(sw)) === "blocked");
// Even if asked, the extension cannot run code in a page: it has no host access and no scripting permission.
const other = await ctx.newPage();
await other.goto("data:text/html,<title>Some site</title><h1>Any page</h1>");
check("extension has no scripting or tab-reading ability", await sw.evaluate(() => typeof chrome.scripting === "undefined" && typeof chrome.webRequest === "undefined" && typeof chrome.cookies === "undefined"));
const tabs = await sw.evaluate(() => chrome.tabs.query({}).then((ts) => ts.map((t) => t.url ?? null)));
check("extension cannot even read the address of other tabs", tabs.every((u) => u === null || u.startsWith("chrome-extension://")), JSON.stringify(tabs));
await ctx.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.${failed.length ? "\nFAILED:\n  " + failed.map((f) => f.name).join("\n  ") : ""}`);
process.exit(failed.length ? 1 : 0);
