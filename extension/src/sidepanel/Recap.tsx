import { getRubric, stepsFor } from "../lib/data";
import { K, type Run, type CallLogEntry } from "../lib/storage";
import { VERSION, MODE } from "../generated/content";
import { Icon, STEP_KIND, fmtDate, fmtDuration, download, useStored } from "./ui";
import type { Lesson, Step } from "../../../shared/types";

const CALLOUT_LABEL = { rule: "Rule", tip: "Tip", warning: "Watch out" } as const;

function buildResults(run: Run, lesson: Lesson, steps: Step[]) {
  return {
    coachmark: VERSION,
    lesson: { id: lesson.id, title: lesson.title },
    department: run.department,
    startedAt: new Date(run.startedAt).toISOString(),
    finishedAt: new Date(run.finishedAt ?? Date.now()).toISOString(),
    durationSeconds: Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000),
    steps: steps.map((s) => ({ id: s.id, type: s.type, title: s.title ?? s.instruction, ...run.results[s.id] })),
    calloutsShown: run.shownCallouts.map((c) => c.id),
    events: run.events.map((e) => ({ ...e, at: new Date(e.at).toISOString() })),
    note: "Call notes are not included in this export. They stay on the learner's device.",
  };
}

function resultsText(run: Run, lesson: Lesson, steps: Step[]) {
  const r = buildResults(run, lesson, steps);
  const lines = [
    `COACHMARK RESULTS`, `Lesson: ${lesson.title}`, `Department: ${run.department}`, `Finished: ${fmtDate(run.finishedAt ?? Date.now(), true)}`,
    `Time: ${fmtDuration(r.durationSeconds)}`, ``, `STEPS`,
    ...steps.map((s, i) => {
      const res = run.results[s.id];
      const bits = [res?.status === "skipped" ? "skipped" : "done", s.type === "screen" ? `${res?.seconds ?? 0}s` : "", res?.hints ? `${res.hints} hint(s)` : "", res?.mistakes ? `${res.mistakes} mistake(s)` : ""].filter(Boolean);
      const call = res?.call ? ` | outcome: ${res.call.outcome} | ratings: ${Object.entries(res.call.ratings).map(([k, v]) => `${k} ${v}/5`).join(", ")}` : "";
      return `${String(i + 1).padStart(2)}. [${STEP_KIND[s.type].label}] ${s.title ?? s.instruction} (${bits.join(", ")})${call}`;
    }),
    ``, `Call notes are not included. They stay on your device.`,
  ];
  return lines.join("\n");
}

function callLogText(entries: CallLogEntry[]) {
  return entries.map((e) => [
    `CALL LOG · ${e.lessonTitle}`, `When: ${fmtDate(e.at, true)}`, e.contact ? `With: ${e.contact}` : "", `Outcome: ${e.outcome}`,
    `Self-ratings: ${Object.entries(e.ratings).map(([k, v]) => `${k} ${v}/5`).join(", ")}`, `Notes: ${e.notes || "(none)"}`,
  ].filter(Boolean).join("\n")).join("\n\n");
}

export function Recap({ run, lesson, onDone }: { run: Run; lesson: Lesson; onDone: () => void }) {
  const all = stepsFor(lesson, run.department);
  const steps = run.stepIds.map((id) => all.find((s) => s.id === id)!).filter(Boolean);
  const [callLog] = useStored<CallLogEntry[]>(K.callLog, []);
  const myCalls = callLog.filter((c) => c.runId === run.runId);
  const seconds = Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000);
  const screen = steps.filter((s) => s.type === "screen");
  const people = steps.filter((s) => s.type !== "screen");
  const hints = Object.values(run.results).reduce((n, r) => n + r.hints, 0);
  const independent = screen.filter((s) => run.results[s.id]?.hints === 0).length;
  const stamp = new Date(run.finishedAt ?? Date.now()).toISOString().slice(0, 10);

  return (
    <section className="page enter recap">
      <p className="eyebrow">Lesson complete</p>
      <h1 className="display">You did the whole <em>job</em>.</h1>
      <p className="lead">{lesson.recap.summary}</p>

      <dl className="stats">
        <div><dt>Time</dt><dd>{fmtDuration(seconds)}</dd></div>
        <div><dt>Steps</dt><dd>{Object.keys(run.results).length}<small> of {steps.length}</small></dd></div>
        <div><dt>{MODE === "guide" ? "Without hints" : "On your own"}</dt><dd>{independent}<small> of {screen.length}</small></dd></div>
        <div><dt>Hints used</dt><dd>{hints}</dd></div>
      </dl>

      <h2 className="eyebrow rule">On screen</h2>
      <ul className="result-list">
        {screen.map((s) => { const r = run.results[s.id]; return (
          <li key={s.id}><span className="tick"><Icon name="check" size={12} /></span><span>{s.title ?? s.instruction}</span>
            <span className="muted">{MODE === "guide" ? "Done" : `${r?.seconds ?? 0}s`}{r?.hints ? ` · ${r.hints} hint${r.hints > 1 ? "s" : ""}` : ""}{r?.mistakes ? ` · ${r.mistakes} slip${r.mistakes > 1 ? "s" : ""}` : ""}</span></li>
        ); })}
      </ul>

      {people.length > 0 && <>
        <h2 className="eyebrow rule">With people</h2>
        <ul className="result-list">
          {people.map((s) => { const r = run.results[s.id]; const rubric = s.type === "call" ? getRubric(s.debrief.rubricRef) : undefined; return (
            <li key={s.id} className={s.type === "call" ? "call-result" : ""}>
              <span className="tick"><Icon name={r?.status === "skipped" ? "arrow" : "check"} size={12} /></span>
              <span>{s.title ?? s.instruction}</span>
              <span className="muted">{s.type === "offline" ? (r?.status === "skipped" ? "Skipped with a reason" : "Confirmed") : s.type === "checkpoint" ? "Checked" : r?.call?.outcome}</span>
              {r?.call && rubric && (
                <ul className="ratings">
                  {rubric.items.map((i) => { const v = r.call!.ratings[i.id] ?? 0; return (
                    <li key={i.id}><span>{i.prompt}</span><span className="bar" role="img" aria-label={`${v} out of 5`}><i style={{ width: `${v * 20}%` }} /></span><b>{v}</b>
                      {v <= 3 && <p className="tip-line">{i.tip}</p>}</li>
                  ); })}
                </ul>
              )}
            </li>
          ); })}
        </ul>
      </>}

      {run.shownCallouts.length > 0 && <>
        <h2 className="eyebrow rule">Rules and tips you met</h2>
        <ul className="met">{run.shownCallouts.map((c) => <li key={c.id}><span className="label">{CALLOUT_LABEL[c.kind]}</span>{c.say}</li>)}</ul>
      </>}

      {(!!lesson.recap.nextSteps?.length || run.reminders.length > 0) && <>
        <h2 className="eyebrow rule">Next steps</h2>
        <ul className="met">
          {lesson.recap.nextSteps?.map((n) => <li key={n}>{n}</li>)}
          {run.reminders.map((r) => <li key={r.id} className="reminder"><Icon name="bell" size={15} /><span><span className="label">Follow up by {fmtDate(r.dueAt)}</span>{r.say}</span></li>)}
        </ul>
      </>}

      <h2 className="eyebrow rule">Share your results</h2>
      <p className="hint-text">Nothing is sent automatically. Export a file if you want to share it. Result exports never include your call notes.</p>
      <div className="actions">
        <button className="btn ghost block" onClick={() => download(`coachmark-${lesson.id}-${stamp}.json`, JSON.stringify(buildResults(run, lesson, steps), null, 2), "application/json")}><Icon name="download" /> Export results (JSON)</button>
        <button className="btn ghost block" onClick={() => download(`coachmark-${lesson.id}-${stamp}.txt`, resultsText(run, lesson, steps), "text/plain")}><Icon name="download" /> Export results (text)</button>
        {myCalls.length > 0 && <button className="btn ghost block" onClick={() => download(`coachmark-call-log-${stamp}.txt`, callLogText(myCalls), "text/plain")}><Icon name="download" /> Export my call log, with notes (text)</button>}
        <button className="btn primary block" onClick={onDone}>Back to lessons <Icon name="arrow" /></button>
      </div>
    </section>
  );
}
