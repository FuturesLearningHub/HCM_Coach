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
const done = () => panel.getByRole("button", { name: /Done\. Next step/ }).click();
const shot = (name) => panel.screenshot({ path: join(shots, name + ".png") });

check("welcome says it reads nothing", await seen("I have no access to Oracle"));
await panel.getByRole("button", { name: /Got it/ }).click();
// Finding a process: search box and topic chips above the list.
const cards = () => panel.locator(".lesson-card").allInnerTexts().then((t) => t.map((x) => x.split("\n")[0]));
const find = panel.getByLabel("Find a process");
const all = await cards();
await find.fill("upload");
check("typing a word narrows the list to matching processes", all.length >= 3 && JSON.stringify(await cards()) === JSON.stringify(["Upload a Document to Document Records"]) && await panel.getByText(`1 of ${all.length} processes`).isVisible(), (await cards()).join(" | "));
await find.fill("pencil icon");
check("search also looks inside the steps, not just the title", JSON.stringify(await cards()) === JSON.stringify(["Change an Employee's Manager"]));
await find.fill("zebra");
check("no match is explained, with a way back to the full list", await panel.getByText("No process matches that.").isVisible() && (await cards()).length === 0);
await panel.getByRole("button", { name: "Show all processes" }).click();
await panel.getByRole("button", { name: "Positions", exact: true }).click();
check("a topic chip filters the list", JSON.stringify(await cards()) === JSON.stringify(["Inactivate a Position"]) && await panel.getByRole("button", { name: "Positions", exact: true }).getAttribute("aria-pressed") === "true");
await panel.waitForTimeout(400); await panel.screenshot({ path: join(shots, "guide-finder.png") });
await panel.getByRole("button", { name: "All", exact: true }).click();
check("All shows every process again", (await cards()).length === all.length);
await panel.locator(".lesson-card", { hasText: "Change an Employee's Manager" }).click();
const pagesBefore = ctx.pages().length;
await panel.getByRole("button", { name: /^Start/ }).click();
check("starts at step 1 without opening or touching any tab", await stepIs("Find the employee") && ctx.pages().length === pagesBefore);
check("screen step shows where to look and what to expect", await seen("The search box on the Home page") && await seen("When it worked"));
await shot("guide-01-step");
await done();
check("Done moves to the next step", await stepIs("Choose Change Manager"));
check("common slips are shown up front", await seen("Change Location moves where someone works"));
await panel.getByRole("button", { name: /Previous step/ }).click();
check("Previous step goes back", await stepIs("Find the employee"));
await done(); await stepIs("Choose Change Manager");
await done(); await stepIs("Info to Include");
await done(); await stepIs("Check the pay type");
await panel.getByRole("button", { name: /I checked the pay type/ }).click();
await stepIs("Set the effective date");
check("rule appears at the step it applies to, with its source", await seen("must be the first day of the pay period") && await seen("job aid updated 3/2/26"));
await panel.getByRole("button", { name: /Give me a hint/ }).click();
check("hint is shown on request", await seen("pick the Sunday that starts the pay period"));
await shot("guide-02-rule");
for (const next of ["How the manager is changing", "Why the manager is changing", "Move to Managers", "Edit the active manager", "Assign the new manager", "Save", "Submit", "Tell the new manager"]) { await done(); await stepIs(next); }
check("all twelve screen steps complete by Done", await stepIs("Tell the new manager"));
check("after-submit tip and contact card show", await seen("approved automatically") && await seen("The employee's new manager"));
await panel.getByRole("button", { name: /I let the new manager know/ }).click();
await stepIs("Hand off with the outgoing manager");
await panel.getByRole("button", { name: /I'm ready/ }).click();
await panel.getByRole("button", { name: /Call done/ }).click();
await panel.locator(".debrief select").selectOption("Got a yes");
for (const [item, v] of [["purpose", 2], ["listen", 5], ["next-step", 5]]) await panel.locator(`input[name="rate-${item}"][value="${v}"]`).check({ force: true });
await panel.getByRole("button", { name: /See my tips/ }).click();
check("call debrief gives the tip for a low rating", await seen("Lead with why you are calling"));
await panel.getByRole("button", { name: /Continue/ }).click();
check("guide runs start to finish (recap shown)", await seen("You did the whole"));
await shot("guide-03-recap");

// Help: "what do I do if" questions, answered by quoting the guides and job aids. Offline, no AI model.
await panel.getByRole("button", { name: /Ask for help/ }).click();
const askHelp = async (q) => { await panel.getByPlaceholder("What do I do if…").fill(q); await panel.getByRole("button", { name: /^Ask/ }).click(); await panel.waitForTimeout(250); };
const lastAnswer = () => panel.locator(".chat > .bubble:not(.user)").last().innerText();
check("help says where its answers come from and that nothing is sent", await seen("Answers are quoted from the") && await seen("Nothing you type leaves this computer"));
await askHelp("What date do I use for a non-exempt employee?");
let ans = await lastAnswer();
check("a rule question is answered with the rule, and its source", /pay period/.test(ans) && /Sunday/.test(ans) && /From (Guide|Job aid): Change/.test(ans), ans.replace(/\n/g, " | ").slice(0, 220));
await askHelp("What do I do if my upload needs approval from PCB?");
ans = await lastAnswer();
check("a what-if question is answered from the right process", /approval from PCB/.test(ans) && /Document/.test(ans), ans.replace(/\n/g, " | ").slice(0, 220));
await askHelp("Which document type is a salary increase letter?");
ans = await lastAnswer();
check("the answer quotes only the lines that matter, not the whole section", /Compensation Letters/.test(ans) && !/visa and sponsorship/i.test(ans), ans.replace(/\n/g, " | ").slice(0, 220));
await askHelp("How do I order a zebra spaceship?");
ans = await lastAnswer();
check("it refuses to guess when the guides do not cover it", /Not in the guides/i.test(ans) && /will not guess/.test(ans));
check("the conversation stays on screen as a chat", (await panel.locator(".chat > .bubble.user").count()) === 4);
await shot("guide-04-search");
await panel.getByRole("button", { name: /Back to the guide/ }).click();

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
