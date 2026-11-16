// Service worker: owns lesson state, launches lessons, schedules follow-up reminders.
// It is the only writer of the run state. The side panel and content script read it from storage.
import { getLesson, stepsFor, hostAllowed, durationMs, resolveContact, loadStoredContent } from "./lib/data";
import { CONTENT_URL } from "./generated/content";
import type { TabView } from "./lib/messages";
import { MODE } from "./generated/content";

const GUIDE = MODE === "guide"; // read-along build: no page access, every step is confirmed by the learner
import { contextMatches, hasPageCondition } from "./lib/callouts";
import { K, get, set, type Run, type CoachEvent, type EventType, type HistoryEntry, type CallLogEntry, type Prefs } from "./lib/storage";
import type { Msg } from "./lib/messages";
import type { Lesson, Step } from "../../shared/types";

chrome.runtime.onInstalled.addListener(() => { void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); });

// Storage is closed to content scripts. Only the extension's own pages and this worker can read it,
// so nothing running in a web page's process can reach progress, results or call notes.
void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

/** The little the page side needs to know: which step to watch. No results, no notes. */
const viewOf = (run: Run | null): TabView => run && run.status === "active"
  ? { runId: run.runId, lessonId: run.lessonId, stepId: run.stepIds[run.index], index: run.index, spotlight: run.spotlight } : null;
const tellTab = (tabId: number | null, view: TabView) => { if (tabId !== null) chrome.tabs.sendMessage(tabId, { t: "view", view }).catch(() => undefined); };
async function saveRun(run: Run) { await set(K.run, run); tellTab(run.tabId, viewOf(run)); }

const ownOrigin = chrome.runtime.getURL("");
const PANEL = new Set(["start", "confirm", "skip", "hint", "callReady", "callDone", "callContinue", "debrief", "exit", "focusTab", "back"]);

// Serialise every state change so two messages can never interleave a read-modify-write.
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => { const p = queue.then(fn, fn); queue = p.catch(() => undefined); return p; };

const stored = CONTENT_URL ? loadStoredContent() : Promise.resolve(); // after a worker restart, resume on the same content

type Ctx = { run: Run; lesson: Lesson; steps: Step[]; step: Step | undefined };
async function load(): Promise<Ctx | null> {
  await stored;
  const run = await get<Run | null>(K.run, null);
  if (!run) return null;
  const lesson = getLesson(run.lessonId);
  if (!lesson) return null;
  const all = stepsFor(lesson, run.department);
  const steps = run.stepIds.map((id) => all.find((s) => s.id === id)).filter((s): s is Step => !!s);
  return { run, lesson, steps, step: steps[run.index] };
}

const log = (run: Run, type: EventType, stepId?: string, extra: Partial<CoachEvent> = {}) =>
  run.events.push({ type, stepId, at: Date.now(), department: run.department, ...extra });

function showCallouts(c: Ctx, pageIds: string[] | null) {
  const { run, lesson, step } = c;
  if (!step || run.status !== "active") return;
  const done = Object.keys(run.results);
  for (const callout of lesson.callouts ?? []) {
    const page = hasPageCondition(callout);
    if (page ? !(pageIds && pageIds.includes(callout.id)) : pageIds !== null) continue;
    if (!contextMatches(callout, { stepId: step.id, department: run.department, done })) continue;
    if (run.callouts.some((x) => x.id === callout.id)) continue;
    if (!GUIDE && !callout.repeat && run.shownCallouts.some((x) => x.id === callout.id)) continue;
    const shown = { id: callout.id, kind: callout.kind, say: callout.say, source: callout.source, stepId: step.id };
    run.callouts.push(shown);
    if (run.shownCallouts.some((x) => x.id === callout.id)) continue;
    run.shownCallouts.push(shown);
    log(run, "callout_shown", step.id, { data: { callout: callout.id } });
  }
}

function enterStep(c: Ctx) {
  const { run } = c;
  c.step = c.steps[run.index];
  Object.assign(run, { stepStartedAt: Date.now(), hintLevel: 0, spotlight: false, offTarget: 0, mistakes: 0, feed: [], callouts: [], targetFound: null });
  run.callPhase = c.step?.type === "call" ? "prep" : undefined;
  showCallouts(c, null);
}

async function advance(c: Ctx, status: "done" | "skipped") {
  const { run, step } = c;
  if (!step) return;
  const seconds = Math.round((Date.now() - run.stepStartedAt) / 1000);
  run.results[step.id] = { ...run.results[step.id], status, seconds, hints: run.hintLevel, mistakes: run.mistakes };
  if (step.type === "screen" || step.type === "call") log(run, "step_complete", step.id, { seconds });
  run.index += 1;
  if (run.index < c.steps.length) { enterStep(c); return; }
  await finish(c);
}

async function finish(c: Ctx) {
  const { run, lesson, steps } = c;
  run.status = "complete";
  run.finishedAt = Date.now();
  run.callouts = []; run.feed = []; run.callPhase = undefined; run.spotlight = false;
  const seconds = Math.round((run.finishedAt - run.startedAt) / 1000);
  log(run, "lesson_complete", undefined, { seconds });

  // Follow-ups are listed on the recap. Timed reminders (alarms + notifications) arrive in Phase 2.
  for (const r of lesson.reminders ?? []) {
    if (run.results[r.afterStep]?.status !== "done") continue;
    run.reminders.push({ id: r.id, say: r.say, dueAt: Date.now() + durationMs(r.delay) });
  }

  const screen = steps.filter((s) => s.type === "screen");
  const entry: HistoryEntry = { runId: run.runId, lessonId: lesson.id, department: run.department, finishedAt: run.finishedAt, seconds,
    hints: Object.values(run.results).reduce((n, r) => n + r.hints, 0),
    independent: screen.filter((s) => run.results[s.id]?.hints === 0).length, steps: steps.length };
  await set(K.history, [...(await get<HistoryEntry[]>(K.history, [])), entry].slice(-100));
}

/** Next rung of the hint ladder: lesson hints in order, then "here is where you should be". */
function revealHint(c: Ctx, auto: boolean) {
  const { run, step } = c;
  if (!step || step.type !== "screen") return;
  const hints = step.hints ?? [];
  if (GUIDE && run.hintLevel >= hints.length) return; // nothing on the page to point at
  if (run.hintLevel > hints.length) { run.spotlight = true; return; }
  const text = run.hintLevel < hints.length ? hints[run.hintLevel] : "Here is where you should be. I have highlighted it on the page.";
  const kind = run.hintLevel < hints.length ? "hint" : "spotlight";
  if (kind === "spotlight") run.spotlight = true;
  run.hintLevel += 1;
  run.feed.push({ kind, text, at: Date.now(), auto });
  log(run, "hint_used", step.id, { data: { level: run.hintLevel, auto: auto ? 1 : 0 } });
}

async function tabExists(id: number | null): Promise<boolean> {
  if (id === null) return false;
  try { await chrome.tabs.get(id); return true; } catch { return false; }
}

/** Reuse a tab that is already on an allowed site, otherwise open the first concrete allowed domain. */
async function openLessonTab(lesson: Lesson): Promise<{ tabId: number | null; origin: string } | { error: string }> {
  const domains = lesson.allowedDomains ?? [];
  const allowed = (url?: string) => { try { return !!url && hostAllowed(new URL(url).host, domains); } catch { return false; } };
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const existing = (allowed(active?.url) ? active : undefined) ?? (await chrome.tabs.query({})).find((t) => allowed(t.url));
  if (existing?.id !== undefined && existing.url) {
    const origin = new URL(existing.url).origin;
    await chrome.tabs.update(existing.id, { url: origin + lesson.startUrl, active: true });
    return { tabId: existing.id, origin };
  }
  const concrete = domains.find((d) => !d.startsWith("*."));
  if (!concrete) return { error: "Open the practice site in a tab first, then start the lesson." };
  const host = concrete.split(":")[0];
  const origin = `${host === "localhost" || host.startsWith("127.") ? "http" : "https"}://${concrete}`;
  const tab = await chrome.tabs.create({ url: origin + lesson.startUrl, active: true });
  return { tabId: tab.id ?? null, origin };
}

async function handle(msg: Msg, sender: chrome.runtime.MessageSender): Promise<unknown> {
  // Check who is talking. Coach commands are accepted only from this extension's own pages;
  // page reports only from a content script in a tab. Anything else is dropped.
  const fromOwnPage = sender.id === chrome.runtime.id && !!sender.url?.startsWith(ownOrigin);
  if (PANEL.has(msg.t) ? !fromOwnPage : (fromOwnPage || sender.id !== chrome.runtime.id || sender.tab?.id === undefined)) return { error: "Not allowed." };
  if (msg.t === "start") {
    // A live guide picks up the newest downloaded content when a guide starts, never in the middle of one.
    if (CONTENT_URL) await loadStoredContent();
    const lesson = getLesson(msg.lessonId);
    if (!lesson) return { error: "That lesson is not in this build." };
    const opened = GUIDE ? { tabId: null, origin: "" } : await openLessonTab(lesson);
    if ("error" in opened) return opened;
    const steps = stepsFor(lesson, msg.department);
    const now = Date.now();
    const run: Run = { runId: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, lessonId: lesson.id, department: msg.department,
      tabId: opened.tabId, origin: opened.origin, stepIds: steps.map((s) => s.id), index: 0, status: "active", startedAt: now, stepStartedAt: now,
      hintLevel: 0, spotlight: false, offTarget: 0, mistakes: 0, feed: [], callouts: [], targetFound: null,
      shownCallouts: [], results: {}, events: [], reminders: [] };
    enterStep({ run, lesson, steps, step: steps[0] });
    await saveRun(run);
    await set(K.prefs, { ...(await get<Prefs>(K.prefs, {})), department: msg.department });
    return { ok: true };
  }
  if (msg.t === "exit") {
    const old = await get<Run | null>(K.run, null);
    await chrome.storage.local.remove(K.run);
    tellTab(old?.tabId ?? null, null);
    return { ok: true };
  }

  const c = await load();
  if (!c) return msg.t === "hello" ? { view: null } : { error: "No lesson is running." };
  const { run, step } = c;

  if (msg.t === "hello") {
    // If the lesson tab was closed, the next allowed tab that reports in takes over.
    const id = sender.tab?.id ?? null;
    if (run.status === "active" && id !== null && run.tabId !== id && !(await tabExists(run.tabId))) { run.tabId = id; await set(K.run, run); }
    return { view: id !== null && id === run.tabId ? viewOf(run) : null };
  }
  if (msg.t === "focusTab") {
    if (await tabExists(run.tabId)) { const tab = await chrome.tabs.update(run.tabId!, { active: true }); if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true }); }
    else { const tab = await chrome.tabs.create({ url: run.origin + c.lesson.startUrl }); run.tabId = tab.id ?? null; await saveRun(run); }
    return { ok: true };
  }
  if (run.status !== "active" || !step) return { ok: false };

  const fromContent = msg.t === "passed" || msg.t === "click" || msg.t === "idle" || msg.t === "conditions" || msg.t === "target";
  if (fromContent && sender.tab?.id !== run.tabId) return { ok: false };
  if ("stepId" in msg && msg.stepId !== step.id) return { ok: false };

  switch (msg.t) {
    case "passed": if (step.type === "screen") await advance(c, "done"); break;
    case "click":
      if (step.type !== "screen") break;
      if (msg.mistake >= 0 && step.commonMistakes?.[msg.mistake]) {
        const text = step.commonMistakes[msg.mistake].say;
        run.feed = run.feed.filter((f) => !(f.kind === "mistake" && f.text === text));
        run.feed.push({ kind: "mistake", text, at: Date.now() });
        run.mistakes += 1;
        log(run, "mistake", step.id, { data: { mistake: msg.mistake } });
      } else if (!msg.isTarget) {
        run.offTarget += 1;
        if (run.offTarget >= 2) { run.offTarget = 0; revealHint(c, true); }
      }
      break;
    case "idle": revealHint(c, true); break;
    case "hint": revealHint(c, false); break;
    case "conditions": showCallouts(c, msg.ids); break;
    case "target": if (run.targetFound === msg.found) return { ok: true }; run.targetFound = msg.found; break;
    case "back": {
      if (!GUIDE || run.index === 0) break;
      run.index -= 1;
      delete run.results[run.stepIds[run.index]];
      enterStep(c);
      break;
    }
    case "confirm":
      if (step.type === "screen" && GUIDE) { await advance(c, "done"); break; }
      if (step.type === "offline") { log(run, "offline_confirmed", step.id); await advance(c, "done"); }
      else if (step.type === "checkpoint") { log(run, "checkpoint_confirmed", step.id); await advance(c, "done"); }
      break;
    case "skip":
      if (step.type === "offline" && step.allowSkip) { log(run, "offline_skipped", step.id, { data: { logAs: step.allowSkip.logAs ?? "skipped" } }); await advance(c, "skipped"); }
      break;
    case "callReady": if (step.type === "call" && run.callPhase === "prep") { run.callPhase = "calling"; log(run, "call_prepped", step.id); } break;
    case "callDone": if (step.type === "call" && run.callPhase === "calling") run.callPhase = "debrief"; break;
    case "debrief": {
      if (step.type !== "call" || run.callPhase !== "debrief") break;
      run.results[step.id] = { status: "done", seconds: 0, hints: 0, mistakes: 0, call: { outcome: msg.outcome, ratings: msg.ratings } };
      run.callPhase = "tips";
      // Ratings and outcome go in the event log. The free-text notes go only to the local call log.
      log(run, "call_rated", step.id, { data: { outcome: msg.outcome, ...msg.ratings } });
      const contact = resolveContact(c.lesson, step.contactRef, run.department);
      const entry: CallLogEntry = { runId: run.runId, lessonId: c.lesson.id, lessonTitle: c.lesson.title, stepId: step.id, at: Date.now(),
        contact: contact ? (contact.name ?? contact.role) : "", outcome: msg.outcome, ratings: msg.ratings, notes: msg.notes };
      await set(K.callLog, [...(await get<CallLogEntry[]>(K.callLog, [])), entry].slice(-200));
      break;
    }
    case "callContinue": if (step.type === "call" && run.callPhase === "tips") await advance(c, "done"); break;
  }
  await saveRun(run);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  serial(() => handle(msg, sender)).then(reply, (e) => reply({ error: String(e) }));
  return true;
});
