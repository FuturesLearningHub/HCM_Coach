// Content script: reads the page during a lesson, runs success checks, draws the highlight.
// It is inert unless a lesson is running in this tab and this site is in that lesson's allowedDomains.
// It reports step ids and booleans to the coach. Field values and page text never leave this file.
import { getLesson, hostAllowed } from "./lib/data";
import { send, type TabView } from "./lib/messages";
import { runCheck } from "./lib/checks";
import { pageMatches } from "./lib/callouts";
import { findTarget, closestInteractive, accName, same } from "./lib/dom";
import { Overlay } from "./lib/overlay";

const overlay = new Overlay();
let run: TabView = null; // sent by the background, only to the lesson tab
let stepKey = "";          // runId:stepId of the step currently being watched
let passedKey = "";        // last step reported as passed
let lastConditions = "";
let lastFound: boolean | null = null;
let mutTimer: number | undefined;
let idleTimer: number | undefined;
let missingTimer: number | undefined;
let evalTimer: number | undefined;
let observer: MutationObserver | null = null;

function current() {
  if (!run) return null;
  const lesson = getLesson(run.lessonId);
  if (!lesson || !hostAllowed(location.host, lesson.allowedDomains ?? [])) return null;
  const step = lesson.steps.find((s) => s.id === run!.stepId);
  return step ? { lesson, step } : null;
}

function evaluate() {
  const cur = current();
  if (!cur) { stop(); return; }
  listen();
  const { lesson, step } = cur;
  const key = `${run!.runId}:${step.id}`;
  if (key !== stepKey) {
    stepKey = key; lastFound = null;
    clearInterval(idleTimer); clearTimeout(missingTimer); missingTimer = undefined;
    // Stuck trigger: 45 seconds on a screen step with no progress.
    if (step.type === "screen") idleTimer = window.setInterval(() => void send({ t: "idle", stepId: step.id }), 45_000);
  }

  if (step.type === "screen" && step.target && step.success) {
    const target = findTarget(step.target);
    overlay.show(target, `Step ${run!.index + 1}`, step.title ?? step.instruction, run!.spotlight);
    reportFound(step.id, !!target);
    if (passedKey !== key && runCheck(step.success)) { passedKey = key; void send({ t: "passed", stepId: step.id }); }
  } else {
    overlay.hide();
  }

  const ids = pageMatches(lesson);
  const sig = `${key}|${ids.join(",")}`;
  if (sig !== lastConditions) { lastConditions = sig; if (ids.length) void send({ t: "conditions", ids }); }
}

/** "Found" is reported at once. "Not on this page" waits, so page transitions do not flicker. */
function reportFound(stepId: string, found: boolean) {
  if (found) {
    clearTimeout(missingTimer); missingTimer = undefined;
    if (lastFound !== true) { lastFound = true; void send({ t: "target", stepId, found: true }); }
  } else if (lastFound !== false && missingTimer === undefined) {
    missingTimer = window.setTimeout(() => { missingTimer = undefined; lastFound = false; void send({ t: "target", stepId, found: false }); }, 1500);
  }
}

const schedule = (ms: number) => { clearTimeout(evalTimer); evalTimer = window.setTimeout(evaluate, ms); };

function onClick(e: MouseEvent) {
  const cur = current();
  if (!cur || cur.step.type !== "screen" || !cur.step.target) return;
  const el = closestInteractive(e.target);
  if (el) {
    const target = findTarget(cur.step.target);
    const isTarget = !!target && (target === el || target.contains(el) || el.contains(target));
    const name = accName(el);
    const mistake = (cur.step.commonMistakes ?? []).findIndex((m) => same(m.when.clickedText, name));
    void send({ t: "click", stepId: cur.step.id, isTarget, mistake });
  }
  schedule(60);
}
const onInput = () => schedule(120);
const onNav = () => schedule(60);

let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  addEventListener("click", onClick, true);
  addEventListener("input", onInput, true);
  addEventListener("change", onInput, true);
  addEventListener("popstate", onNav);
  addEventListener("hashchange", onNav);
  // Debounced DOM mutation (300 ms), also catches client-side navigation.
  observer = new MutationObserver(() => { mutTimer ??= window.setTimeout(() => { mutTimer = undefined; evaluate(); }, 300); });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
}

function stop() {
  overlay.hide();
  stepKey = ""; lastConditions = ""; lastFound = null;
  clearInterval(idleTimer); clearTimeout(missingTimer); clearTimeout(evalTimer); clearTimeout(mutTimer); missingTimer = undefined; mutTimer = undefined;
  if (!listening) return;
  listening = false;
  removeEventListener("click", onClick, true);
  removeEventListener("input", onInput, true);
  removeEventListener("change", onInput, true);
  removeEventListener("popstate", onNav);
  removeEventListener("hashchange", onNav);
  observer?.disconnect(); observer = null;
}

async function init() {
  chrome.runtime.onMessage.addListener((msg: { t?: string; view?: TabView }, sender) => {
    if (sender.id !== chrome.runtime.id || sender.tab || msg?.t !== "view") return;
    run = msg.view ?? null;
    evaluate();
  });
  const hello = await send<{ view: TabView }>({ t: "hello" });
  run = hello?.view ?? run;
  evaluate();
}
void init();
