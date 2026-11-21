import { useEffect, useRef, useState } from "react";
import lockup from "../../assets/vu-lockup-white.png";
import { VERSION, MODE } from "../generated/content";

const GUIDE = MODE === "guide";
import { LESSONS, KNOWLEDGE, CONTENT_INFO, CONTENT_KEY, applyContent, checkPack, getLesson, stepsFor } from "../lib/data";
import { K, type Run, type Prefs, type HistoryEntry } from "../lib/storage";
import { send } from "../lib/messages";
import { useStored, Icon, fmtDate, fmtDuration } from "./ui";
import { Coach } from "./Coach";
import { Search, type HelpTurn } from "./Search";
import { LIVE, fetchContent } from "#content";
import { Recap } from "./Recap";
import { SayBack, Meter } from "./Guided";
import { LEVELS, type Level, type Levels } from "../lib/coach";
import { AI_ENABLED, reportProgress } from "#coach";
import type { Lesson } from "../../../shared/types";

export function App() {
  const [prefs, prefsReady] = useStored<Prefs>(K.prefs, {});
  const [run, runReady] = useStored<Run | null>(K.run, null);
  const [history] = useStored<HistoryEntry[]>(K.history, []);
  const [picked, setPicked] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [touring, setTouring] = useState(false);
  const [editingMe, setEditingMe] = useState(false);
  const [pack] = useStored<unknown>(CONTENT_KEY, null);
  const [, redraw] = useState(0);
  const [sync, setSync] = useState<{ busy: boolean; note: string }>({ busy: false, note: "" });
  const SEARCH_ENABLED = KNOWLEDGE.length > 0;
  const inRun = run?.status === "active";

  // Switch to newly downloaded content only between guides, so a guide never changes under someone mid-task.
  useEffect(() => { if (LIVE && pack && !inRun && applyContent(pack)) redraw((n) => n + 1); }, [pack, inRun]);

  const checkForUpdates = async (code: string | undefined) => {
    if (!LIVE || !code) return;
    setSync({ busy: true, note: "" });
    const res = await fetchContent(code);
    if (res.status !== "ok") { setSync({ busy: false, note: res.message ?? "" }); return; }
    const clean = checkPack(res.pack);
    if (!clean) { setSync({ busy: false, note: "The update did not pass its checks, so it was not used." }); return; }
    const changed = clean.version !== CONTENT_INFO.version;
    await chrome.storage.local.set({ [CONTENT_KEY]: clean });
    setSync({ busy: false, note: changed ? "Updated just now." : "You have the latest." });
  };
  useEffect(() => { if (prefsReady) void checkForUpdates(prefs.contentCode); }, [prefsReady, prefs.contentCode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opt-in progress: once a run is complete, send its parts' levels and right/miss, once per run. Off unless she turned it on.
  useEffect(() => {
    if (!run || run.status !== "complete" || !prefs.contentCode || !prefs.learnerId || !prefs.learnerName || !prefs.learnerEmail) return;
    if ((prefs.reported ?? []).includes(run.runId)) return;
    const steps = Object.entries(run.results).flatMap(([id, r]) => r.outcome && (r.next ?? r.level) ? [{ id, level: (r.next ?? r.level)!, outcome: r.outcome }] : []);
    const mark = () => chrome.storage.local.set({ [K.prefs]: { ...prefs, reported: [...(prefs.reported ?? []), run.runId].slice(-50) } });
    if (!steps.length) { void mark(); return; }
    void reportProgress(prefs.contentCode, { learner: { id: prefs.learnerId, name: prefs.learnerName, email: prefs.learnerEmail }, lessonId: run.lessonId, runId: run.runId, steps }).then((r) => { if (!r.error) void mark(); });
  }, [run?.status, run?.runId, prefs.learnerEmail]); // eslint-disable-line react-hooks/exhaustive-deps
  const [helpTurns, setHelpTurns] = useState<HelpTurn[]>([]); // in memory only, gone when the panel closes
  const main = useRef<HTMLElement>(null);

  const lesson = getLesson(run?.lessonId);
  const stepNow = run && lesson && run.status === "active" ? lesson.steps.find((s) => s.id === run.stepIds[run.index]) : undefined;
  // Live build: after the tour, set up the training record (name, work email, access code) before anything else.
  const needsSetup = LIVE && AI_ENABLED && (!prefs.learnerName || !prefs.learnerEmail || !prefs.contentCode);
  const view = !prefs.consent ? "welcome" : (touring || (GUIDE && !prefs.seenTour)) ? "tour" : (needsSetup || editingMe) && !touring ? "setup" : run && lesson ? (run.status === "complete" ? "recap" : run.status === "sayback" ? "sayback" : "coach") : picked ? "intro" : "library";
  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [view, run?.index]);
  if (!prefsReady || !runReady) return null;

  return (
    <div className="shell">
      <header className="top">
        <img src={lockup} alt="Vanderbilt University" className="lockup" />
        <span className="eyebrow top-tag">HCM Coach</span>
      </header>
      <main ref={main} className="main" data-view={view}>
        {view === "welcome" && <Welcome onAccept={() => chrome.storage.local.set({ [K.prefs]: { ...prefs, consent: true } })} />}
        {view === "setup" && <Setup prefs={prefs} editing={editingMe} onDone={() => setEditingMe(false)} />}
        {view === "tour" && <Tour onDone={() => { setTouring(false); void chrome.storage.local.set({ [K.prefs]: { ...prefs, seenTour: true } }); }} />}
        {view === "library" && GUIDE && <button className="link tour-link" onClick={() => setTouring(true)}><Icon name="play" size={14} /> Watch the 1-minute tour</button>}
        {view === "library" && <Library history={history} onPick={setPicked} />}
        {view === "library" && LIVE && <ContentStatus prefs={prefs} sync={sync} onCheck={() => checkForUpdates(prefs.contentCode)} onEditMe={() => setEditingMe(true)} />}
        {view === "intro" && <Intro lesson={getLesson(picked!)!} prefs={prefs} onBack={() => setPicked(null)} />}
        {view === "coach" && <Coach run={run!} lesson={lesson!} />}
        {view === "sayback" && <SayBack run={run!} lesson={lesson!} steps={run!.stepIds.map((id) => stepsFor(lesson!, run!.department).find((s) => s.id === id)!).filter(Boolean)} />}
        {view === "recap" && <Recap run={run!} lesson={lesson!} onDone={() => { setPicked(null); void send({ t: "exit" }); }} />}
      </main>
      {prefs.consent && view !== "tour" && SEARCH_ENABLED && (searching ? (
        <Search onClose={() => setSearching(false)} turns={helpTurns} setTurns={setHelpTurns} code={prefs.contentCode}
          here={lesson && run ? { lessonId: lesson.id, stepId: stepNow?.id, label: stepNow ? (stepNow.title ?? lesson.title) : lesson.title } : undefined}
          onOpen={inRun ? undefined : (lessonId) => { setPicked(lessonId); setSearching(false); }} />
      ) : (
        <button className="chat-fab" onClick={() => setSearching(true)} aria-label="Ask HCM Coach"><Icon name="chat" size={22} /><span>Ask</span></button>
      ))}
      <footer className="foot">
        <span className="foot-badge"><Icon name="off" size={14} /> {LIVE ? "Cannot see your pages. Sends guide updates, your training record and what you ask the coach." : GUIDE ? "Guide build. Cannot see your pages. No network access." : "Offline build. No network access."}</span>
        <span>v{VERSION}</span>
      </footer>
    </div>
  );
}

/** The first-launch tour: a short narrated video of how the coach works and how to get around. Replay it from the list. */
function Tour({ onDone }: { onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ended, setEnded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { video.current?.play().catch(() => setBlocked(true)); }, []);
  return (
    <section className="page tour enter">
      <p className="eyebrow">Quick tour · 1 minute</p>
      <h1 className="display small">How HCM Coach <em>works</em>.</h1>
      <div className="tour-video">
        <video ref={video} src="tour.webm" controls playsInline preload="auto" onPlay={() => setBlocked(false)} onEnded={() => setEnded(true)} aria-label="HCM Coach tour video, with narration" />
        {blocked && <button className="tour-play" onClick={() => void video.current?.play()} aria-label="Play the tour"><Icon name="play" size={34} /></button>}
      </div>
      <div className="actions">
        <button className={`btn ${ended ? "primary" : "ghost"} block`} onClick={onDone}>{ended ? "Show me the processes" : "Skip the tour"} <Icon name="arrow" /></button>
      </div>
    </section>
  );
}

/** First launch (live build): her name, work email and the access code. HCM roles are paid roles, so training progress
 *  is tracked for everyone; this screen says plainly what is sent, and what never is. */
function Setup({ prefs, editing, onDone }: { prefs: Prefs; editing: boolean; onDone: () => void }) {
  const [name, setName] = useState(prefs.learnerName ?? "");
  const [email, setEmail] = useState(prefs.learnerEmail ?? "");
  const [code, setCode] = useState(prefs.contentCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ready = name.trim().length > 1 && emailOk && code.trim().length > 0;
  const submit = async () => {
    setBusy(true); setError("");
    const res = await fetchContent(code.trim()); // checks the code with the server before saving anything
    setBusy(false);
    if (res.status !== "ok") { setError(res.message ?? "That access code did not work."); return; }
    await chrome.storage.local.set({ [K.prefs]: { ...prefs, learnerName: name.trim().slice(0, 80), learnerEmail: email.trim().toLowerCase().slice(0, 120), contentCode: code.trim(), learnerId: prefs.learnerId ?? crypto.randomUUID(), shareProgress: true } });
    onDone();
  };
  return (
    <section className="page enter setup">
      <p className="eyebrow">{editing ? "Your training record" : "Set up · 1 minute"}</p>
      <h1 className="display small">{editing ? <>Fix your <em>details</em>.</> : <>Who's <em>learning</em>?</>}</h1>
      <p className="lead">HCM Academy tracks your training in HCM Coach: which processes you've done, and how much help each step still needs.</p>
      <form className="setup-form" onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
        <label className="field"><span className="label">Your name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} placeholder="First and last name" /></label>
        <label className="field"><span className="label">Work email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={120} placeholder="name@vanderbilt.edu" /></label>
        {!editing || !prefs.contentCode ? <label className="field"><span className="label">Access code</span>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="From your HCM Academy contact" /></label> : null}
        <p className="hint-text setup-note"><Icon name="lock" size={14} /> Sent to HCM Academy: your name, work email, and each step's help level and whether you got it right. Never your screen, anything from Oracle, or what you type.</p>
        {error && <p className="hint-text setup-error" role="alert">{error}</p>}
        <button className="btn primary block" disabled={!ready || busy}>{busy ? "Checking…" : editing ? "Save" : "Start"} <Icon name="arrow" /></button>
        {editing && <button type="button" className="btn ghost block" onClick={onDone}>Cancel</button>}
      </form>
    </section>
  );
}

/** Live guide: where the content came from, and the access code that lets it download updates. */
function ContentStatus({ prefs, sync, onCheck, onEditMe }: { prefs: Prefs; sync: { busy: boolean; note: string }; onCheck: () => void; onEditMe: () => void }) {
  const [code, setCode] = useState("");
  const save = (contentCode: string | undefined) => chrome.storage.local.set({ [K.prefs]: { ...prefs, contentCode } });
  return (
    <section className="content-status">
      <h2 className="eyebrow rule">Guide content</h2>
      <p className="hint-text">{CONTENT_INFO.live ? `Updated ${fmtDate(new Date(CONTENT_INFO.updated).getTime())} · version ${CONTENT_INFO.version}` : "Using the guides that came with this install."}</p>
      {prefs.contentCode ? (
        <p className="hint-text"><button className="link" disabled={sync.busy} onClick={onCheck}>{sync.busy ? "Checking" : "Check for updates"}</button>
          <span role="status">{sync.note}</span><button className="link" onClick={() => save(undefined)}>Remove access code</button></p>
      ) : null}
      {prefs.learnerName && AI_ENABLED && (
        <div className="share-box on">
          <p className="hint-text"><Icon name="check" size={14} /> Your training record: <b>{prefs.learnerName}</b> ({prefs.learnerEmail}). Your progress goes to HCM Academy after each process.</p>
          <button className="link" onClick={onEditMe}>Fix my name or email</button>
        </div>)}
      {prefs.contentCode ? null : (
        <form className="code-form" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void save(code.trim()); }}>
          <label className="field"><span className="label">Access code, to get guide updates</span>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="From your HCM Academy contact" /></label>
          <button className="btn ghost" disabled={!code.trim()}>Save</button>
          {sync.note && <p className="hint-text" role="status">{sync.note}</p>}
        </form>
      )}
    </section>
  );
}

function Welcome({ onAccept }: { onAccept: () => void }) {
  return (
    <section className="page enter">
      <p className="eyebrow">Welcome</p>
      <h1 className="display">Learn the whole <em>job</em>.</h1>
      <p className="lead">{GUIDE
        ? "I coach you while you do the real work. I help a lot at first, and less as you get each step right. The goal: you do it with me switched off."
        : "I coach you through a real process from start to finish: the screen steps, the people to tell, the local rules, and the conversations. You do the work. I never do it for you."}</p>
      <ul className="facts">
        <li><span className="fact-icon"><Icon name="eye" /></span><div><h2 className="label">What I read</h2><p>{GUIDE
          ? "Nothing. I have no access to Oracle or to any other page, so I cannot see, read or change what is on your screen."
          : "Buttons, labels and whether a field is filled in, on lesson sites only, and only while a lesson is running."}</p></div></li>
        <li><span className="fact-icon"><Icon name="box" /></span><div><h2 className="label">What I store</h2><p>{LIVE && AI_ENABLED ? "Your progress and call notes, in this browser. Your training record (name, work email, and how each process is going) also goes to HCM Academy."
          : "Your progress, your self-ratings and your call notes. All of it stays in this browser on this device."}</p></div></li>
        <li><span className="fact-icon"><Icon name="lock" /></span><div><h2 className="label">What I send</h2><p>{LIVE ? "Updated guides come down. Your training record goes up after each process. When you ask the coach, it gets the step and your question. Never your screen or anything from Oracle."
          : "Nothing. This build has no network access at all. You can export your results yourself if you choose to share them."}</p></div></li>
      </ul>
      <button className="btn primary block" onClick={onAccept}>Got it. Show me the lessons <Icon name="arrow" /></button>
    </section>
  );
}

const mix = (lesson: Lesson) => {
  const screen = lesson.steps.filter((s) => s.type === "screen").length;
  const people = lesson.steps.length - screen;
  return `${screen} on screen · ${people} with people`;
};

/** The topic is the part of the series after the dot: "HCM Academy · Positions" is the topic "Positions". */
const topicOf = (l: Lesson) => (l.series ?? "Other").split("·").pop()!.trim();
const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ");
/** Everything a learner might type to find a process: its name, goal, topic, and the words in its steps. */
const haystack = (l: Lesson) => fold([l.title, l.goal, l.series, l.audience, ...l.steps.flatMap((s) => [s.title, s.instruction])].filter(Boolean).join(" "));
const stemWord = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w);

/** Where she stands on a process overall: the typical support level across its on-screen parts. */
function supportFor(levels: Levels, l: Lesson): { level: Level; label: string } | null {
  const parts = l.steps.filter((s) => s.type === "screen");
  if (!parts.length) return null;
  const known = parts.map((s) => levels[l.id]?.[s.id]);
  if (known.every((k) => !k)) return { level: 1, label: "New: full support" };
  const lv = known.map((k) => k?.level ?? 1).sort((a, b) => a - b);
  const mid = lv[Math.floor(lv.length / 2)] as Level;
  return { level: mid, label: mid === 4 ? "Mostly on your own" : mid === 1 ? "Learning: full support" : `Learning: mostly ${LEVELS[mid].name}` };
}

function Library({ history, onPick }: { history: HistoryEntry[]; onPick: (id: string) => void }) {
  const [levels] = useStored<Levels>(K.levels, {});
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const topics = [...new Set(LESSONS.map(topicOf))].sort((a, b) => a.localeCompare(b));
  const activeTopic = topic && topics.includes(topic) ? topic : null; // a live update can remove a topic
  const terms = fold(query).split(" ").filter((w) => w.length > 1).map(stemWord);
  const shown = LESSONS.filter((l) => (!activeTopic || topicOf(l) === activeTopic) && terms.every((t) => haystack(l).includes(t)));
  const filtering = terms.length > 0 || !!activeTopic;
  const canFilter = LESSONS.length > 1;

  const groups = new Map<string, Lesson[]>();
  for (const l of shown) groups.set(l.series ?? "Lessons", [...(groups.get(l.series ?? "Lessons") ?? []), l]);
  const ordered = [...groups].sort(([a], [b]) => Number(b.startsWith("HCM")) - Number(a.startsWith("HCM")) || a.localeCompare(b));
  return (
    <section className="page enter">
      <p className="eyebrow">{GUIDE ? "On-demand guide" : "Coached practice"}</p>
      <h1 className="display">Pick a <em>process</em>.</h1>
      <p className="lead">{GUIDE ? "Choose what you are about to do. I will walk you through it, one step at a time." : "Each lesson walks one real process end to end in the practice environment."}</p>
      {canFilter && (
        <div className="finder">
          <label className="field"><span className="label">Find a process</span>
            <span className="finder-input"><Icon name="eye" size={16} />
              <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. manager, upload, position" autoComplete="off" /></span></label>
          {topics.length > 1 && (
            <div className="topics" role="group" aria-label="Filter by topic">
              <button className={`topic ${!activeTopic ? "on" : ""}`} aria-pressed={!activeTopic} onClick={() => setTopic(null)}>All</button>
              {topics.map((t) => <button key={t} className={`topic ${activeTopic === t ? "on" : ""}`} aria-pressed={activeTopic === t} onClick={() => setTopic(activeTopic === t ? null : t)}>{t}</button>)}
            </div>
          )}
          <p className="hint-text" role="status">{filtering ? `${shown.length} of ${LESSONS.length} processes` : `${LESSONS.length} processes`}</p>
        </div>
      )}
      {filtering && shown.length === 0 && (
        <div className="no-match">
          <p>No process matches that.</p>
          <p className="hint-text">Try a different word, or a part of the task such as a button or page name.</p>
          <button className="btn ghost" onClick={() => { setQuery(""); setTopic(null); }}>Show all processes</button>
        </div>
      )}
      {ordered.map(([series, lessons]) => (
        <div key={series} className="group">
          <h2 className="eyebrow rule">{series}</h2>
          {lessons.map((l) => {
            const runs = history.filter((h) => h.lessonId === l.id);
            const last = runs[runs.length - 1];
            return (
              <button key={l.id} className="lesson-card" onClick={() => onPick(l.id)}>
                <span className="lesson-title">{l.title}</span>
                <span className="lesson-goal">{l.goal}</span>
                <span className="meta">
                  <span><Icon name="clock" size={14} /> {l.estimatedMinutes ?? Math.ceil(l.steps.length * 0.6)} min</span>
                  <span>{mix(l)}</span>
                </span>
                {last && <span className="done-tag"><Icon name="check" size={14} /> Completed {fmtDate(last.finishedAt)} in {fmtDuration(last.seconds)}</span>}
                {GUIDE && (() => { const sp = supportFor(levels, l); return sp && <span className="support"><Meter level={sp.level} compact /> {sp.label}</span>; })()}
                <span className="card-arrow"><Icon name="arrow" /></span>
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}

function Intro({ lesson, prefs, onBack }: { lesson: Lesson; prefs: Prefs; onBack: () => void }) {
  const needsDept = lesson.departments.length > 1;
  const remembered = prefs.department && lesson.departments.includes(prefs.department) ? prefs.department : null;
  const [dept, setDept] = useState<string | null>(needsDept ? remembered : "Default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const steps = stepsFor(lesson, dept ?? "Default");
  const count = (t: string) => steps.filter((s) => s.type === t).length;
  const parts = ([
    [count("screen"), "on-screen step", "on-screen steps", "screen"], [count("checkpoint"), "check before you act", "checks before you act", "checkpoint"],
    [count("offline"), "hand-off to a person", "hand-offs to people", "offline"], [count("call"), "coached conversation", "coached conversations", "call"],
  ] as [number, string, string, string][]).filter(([n]) => n > 0);

  const start = async () => {
    if (!dept) return;
    setBusy(true); setError(null);
    const res = await send<{ error?: string }>({ t: "start", lessonId: lesson.id, department: dept });
    if (res?.error) { setError(res.error); setBusy(false); }
  };

  return (
    <section className="page enter">
      <button className="link back" onClick={onBack}><Icon name="back" size={16} /> All lessons</button>
      <p className="eyebrow">{lesson.series ?? "Lesson"}</p>
      <h1 className="display small">{lesson.title}</h1>
      <p className="lead">{lesson.goal}</p>
      <ul className="parts">
        {parts.map(([n, one, many, icon]) => <li key={icon}><Icon name={icon} /><b>{n}</b> {n === 1 ? one : many}</li>)}
      </ul>
      {needsDept && (
        <fieldset className="dept">
          <legend className="label">Which department are you in?</legend>
          <p className="hint-text">This sets the contacts and local rules you see. I will remember it.</p>
          <div className="pills" role="radiogroup">
            {lesson.departments.map((d) => (
              <label key={d} className={`pill ${dept === d ? "on" : ""}`}>
                <input type="radio" name="dept" value={d} checked={dept === d} onChange={() => setDept(d)} />
                {d === "Default" ? "Another department" : d}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {error && <p className="notice" role="alert">{error}</p>}
      <button className="btn primary block" disabled={!dept || busy} onClick={start}>{GUIDE ? "Start" : busy ? "Opening the practice app" : "Start lesson"} <Icon name="arrow" /></button>
      <p className="hint-text center">{GUIDE ? "Open Oracle in this window and keep this panel beside it." : "The practice app opens in a tab. Keep this panel open beside it."}</p>
    </section>
  );
}
