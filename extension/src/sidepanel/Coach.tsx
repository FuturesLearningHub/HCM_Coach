import { useEffect, useRef, useState } from "react";
import { getRubric, resolveContact, stepsFor, type ResolvedContact } from "../lib/data";
import type { Run, ShownCallout } from "../lib/storage";
import { send } from "../lib/messages";
import { MODE } from "../generated/content";

const GUIDE = MODE === "guide";
import { Icon, STEP_KIND, fmtDate } from "./ui";
import { Guided } from "./Guided";
import { LEVELS, type Level } from "../lib/coach";
import type { Lesson, Step, CallStep, Rubric } from "../../../shared/types";

const CALLOUT_LABEL = { rule: "Local rule", tip: "Tip from the team", warning: "Watch out" } as const;
export const OUTCOMES = ["Got a yes", "Partial yes", "No", "No answer", "Rescheduled"];

export function Coach({ run, lesson }: { run: Run; lesson: Lesson }) {
  const all = stepsFor(lesson, run.department);
  const steps = run.stepIds.map((id) => all.find((s) => s.id === id)!).filter(Boolean);
  const step = steps[run.index];
  const [justDone, setJustDone] = useState<string | null>(null);
  const prevIndex = useRef(run.index);

  useEffect(() => {
    if (run.index > prevIndex.current) {
      const prev = steps[prevIndex.current];
      const r = prev ? run.results[prev.id] : undefined;
      const moved = r?.level && r.next && r.next !== r.level ? (r.next > r.level ? ` · Less help next time: ${LEVELS[r.next as Level].name}` : ` · More help next time: ${LEVELS[r.next as Level].name}`) : "";
      setJustDone((prev?.title ?? "Step") + moved);
      const t = setTimeout(() => setJustDone(null), 3600);
      prevIndex.current = run.index;
      return () => clearTimeout(t);
    }
    prevIndex.current = run.index;
  }, [run.index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!step) return null;
  const kind = STEP_KIND[step.type];
  const contact = resolveContact(lesson, step.contactRef, run.department);

  return (
    <section className="page coach">
      <div className="progress">
        <p className="eyebrow">{lesson.title}</p>
        <div className="progress-row">
          <span className="count" aria-live="polite">Step {run.index + 1} of {steps.length}</span>
          {run.department !== "Default" && <span className="chip">{run.department}</span>}
        </div>
        <ol className="rail" aria-hidden="true">
          {steps.map((s, i) => <li key={s.id} className={`${i < run.index ? "done" : i === run.index ? "now" : ""} ${s.type !== "screen" ? "people" : ""}`} />)}
        </ol>
      </div>

      <div className="toast-slot" aria-live="polite">
        {justDone && <p className="toast"><span className="tick"><Icon name="check" size={14} /></span> Done: {justDone}</p>}
      </div>

      {GUIDE && step.type === "screen" ? (
      <article className="step-card kind-screen guided enter" key={step.id}>
        <Guided run={run} lesson={lesson} steps={steps} step={step} />
      </article>
      ) : (
      <article className={`step-card kind-${step.type} enter`} key={step.id}>
        <p className="kind"><Icon name={kind.icon} size={16} /> {kind.label}</p>
        {step.title && <h1 className="step-title">{step.title}</h1>}
        {!(step.type === "call" && run.callPhase !== "prep") && <p className="instruction">{step.instruction}</p>}
        {step.why && run.callPhase === undefined && <p className="why"><span className="label">Why it matters</span>{step.why}</p>}
        {step.note && <p className="why">{step.note}</p>}

        {run.callouts.map((c) => <CalloutCard key={c.id} c={c} />)}

        {step.type === "screen" && <ScreenBody run={run} step={step} />}
        {(step.type === "offline" || step.type === "checkpoint") && (
          <>
            {contact && <ContactCard contact={contact} />}
            <div className="actions">
              <button className="btn primary block" onClick={() => send({ t: "confirm" })}><Icon name="check" /> {step.confirm}</button>
              {step.type === "offline" && step.allowSkip && <button className="btn ghost block" onClick={() => send({ t: "skip" })}>{step.allowSkip.label}</button>}
            </div>
          </>
        )}
        {step.type === "call" && <CallBody run={run} step={step} contact={contact} />}
      </article>
      )}

      <details className="all-steps">
        <summary>All steps</summary>
        <ol>
          {steps.map((s, i) => (
            <li key={s.id} className={i < run.index ? "done" : i === run.index ? "now" : ""}>
              <span className="dot">{i < run.index ? <Icon name="check" size={12} /> : i + 1}</span>
              <span>{s.title ?? s.instruction}{run.results[s.id]?.status === "skipped" && <em className="muted"> (skipped)</em>}</span>
              <Icon name={STEP_KIND[s.type].icon} size={14} />
            </li>
          ))}
        </ol>
      </details>
      {GUIDE && run.index > 0 && run.callPhase !== "debrief" && run.callPhase !== "tips" && (
        <button className="link back center-self" onClick={() => send({ t: "back" })}><Icon name="back" size={16} /> Previous step</button>
      )}
      <ExitLesson />
    </section>
  );
}

function ScreenBody({ run, step }: { run: Run; step: Extract<Step, { type: "screen" }> }) {
  const hints = step.hints ?? [];
  const label = run.hintLevel === 0 ? "I'm stuck. Give me a hint" : run.hintLevel < hints.length ? "Another hint" : run.hintLevel === hints.length ? "Show me where" : "Show me again";
  let n = 0;
  return (
    <>
      {run.feed.length > 0 && (
        <ul className="feed" aria-live="polite">
          {run.feed.map((f) => (
            <li key={f.kind + f.at} className={`feed-item ${f.kind} enter`}>
              <span className="label">{f.kind === "mistake" ? "Not quite" : f.kind === "spotlight" ? "Look at the page" : `Hint ${++n}`}{f.auto && f.kind !== "mistake" ? " · you looked stuck" : ""}</span>
              {f.text}
            </li>
          ))}
        </ul>
      )}
      {run.targetFound === false ? (
        <p className="watch lost"><Icon name="warning" size={16} /><span>I cannot see this on the page you are on. You may need to go back a screen.{" "}
          <button className="link" onClick={() => send({ t: "focusTab" })}>Show the practice tab</button></span></p>
      ) : (
        <p className="watch"><span className="pulse" /> <span>I am watching the page. This step completes on its own when you do it.</span></p>
      )}
      <div className="actions">
        <button className="btn ghost block" onClick={() => send({ t: "hint" })}><Icon name="tip" /> {label}</button>
      </div>
    </>
  );
}

function CalloutCard({ c }: { c: ShownCallout }) {
  return (
    <aside className={`callout ${c.kind} enter`} aria-live="polite">
      <span className="callout-icon"><Icon name={c.kind} /></span>
      <div>
        <p className="label">{CALLOUT_LABEL[c.kind]}</p>
        <p>{c.say}</p>
        {c.source && <p className="source">Source: {c.source}</p>}
      </div>
    </aside>
  );
}

export function ContactCard({ contact }: { contact: ResolvedContact }) {
  return (
    <div className="contact">
      <span className="avatar" aria-hidden="true">{contact.name ? contact.name.split(" ").map((w) => w[0]).slice(0, 2).join("") : <Icon name="offline" />}</span>
      <div>
        <p className="contact-name">{contact.name ?? contact.role}</p>
        {contact.name && <p className="contact-role">{contact.role}</p>}
        <p className="contact-how">{contact.how}</p>
        <p className="source">Contact info updated {fmtDate(contact.updated)}{contact.stale && <strong> · Contact info may be out of date.</strong>}</p>
      </div>
    </div>
  );
}

function PrepCard({ step, compact }: { step: CallStep; compact?: boolean }) {
  const { prep } = step;
  return (
    <div className={`prep ${compact ? "compact" : ""}`}>
      <p className="label">Your goal</p>
      <p>{prep.goal}</p>
      <p className="label">Open with</p>
      <blockquote className="opener">{prep.opener}</blockquote>
      {!compact && !!prep.pushbacks?.length && (
        <>
          <p className="label">If they push back</p>
          <dl className="pushbacks">
            {prep.pushbacks.map((p) => <div key={p.if}><dt>&ldquo;{p.if}&rdquo;</dt><dd>{p.try}</dd></div>)}
          </dl>
        </>
      )}
      {!!prep.doThis?.length && (
        <>
          <p className="label">Do this</p>
          <ul className="do-this">{prep.doThis.map((d) => <li key={d}><Icon name="check" size={14} />{d}</li>)}</ul>
        </>
      )}
    </div>
  );
}

function CallBody({ run, step, contact }: { run: Run; step: CallStep; contact: ResolvedContact | null }) {
  const rubric = getRubric(step.debrief.rubricRef);
  if (run.callPhase === "prep") return (
    <>
      {contact && <ContactCard contact={contact} />}
      <PrepCard step={step} />
      <div className="actions"><button className="btn primary block" onClick={() => send({ t: "callReady" })}>I'm ready <Icon name="arrow" /></button></div>
    </>
  );
  if (run.callPhase === "calling") return (
    <>
      <p className="instruction">Go make the call. Take your time. I will be here when you are back.</p>
      {contact && <ContactCard contact={contact} />}
      <PrepCard step={step} compact />
      <div className="actions"><button className="btn primary block" onClick={() => send({ t: "callDone" })}><Icon name="check" /> Call done</button></div>
    </>
  );
  if (run.callPhase === "debrief" && rubric) return <Debrief rubric={rubric} />;
  if (run.callPhase === "tips" && rubric) {
    const ratings = run.results[step.id]?.call?.ratings ?? {};
    const low = rubric.items.filter((i) => (ratings[i.id] ?? 5) <= 3);
    const keep = rubric.items.find((i) => i.keepDoing);
    return (
      <>
        <p className="instruction">{low.length ? "Here is what to try next time." : "That went well."}</p>
        <ul className="tips">
          {low.length
            ? low.map((i) => <li key={i.id} className="tip-item" data-item={i.id}><span className="label">{i.prompt} · you rated {ratings[i.id]}</span>{i.tip}</li>)
            : <li className="tip-item keep"><span className="label">Keep doing</span>{keep?.keepDoing ?? "Strong call across the board. Keep doing what you did."}</li>}
        </ul>
        <p className="hint-text">Saved to your call log on this device. You can export it from the recap.</p>
        <div className="actions"><button className="btn primary block" onClick={() => send({ t: "callContinue" })}>Continue <Icon name="arrow" /></button></div>
      </>
    );
  }
  return null;
}

function Debrief({ rubric }: { rubric: Rubric }) {
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const complete = outcome !== "" && rubric.items.every((i) => ratings[i.id]);
  return (
    <form className="debrief" onSubmit={(e) => { e.preventDefault(); if (complete) void send({ t: "debrief", outcome, notes: notes.trim(), ratings }); }}>
      <p className="instruction">How did it go?</p>
      <label className="field"><span className="label">Outcome</span>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)} required>
          <option value="" disabled>Choose one</option>
          {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
        </select>
      </label>
      <label className="field"><span className="label">What happened</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Two or three sentences. No names or sensitive details." />
        <span className="hint-text"><Icon name="lock" size={13} /> Your notes stay on this device.</span>
      </label>
      {rubric.items.map((item) => (
        <fieldset key={item.id} className="rating">
          <legend>{item.prompt}</legend>
          <div className="scale" role="radiogroup">
            {[1, 2, 3, 4, 5].map((v) => (
              <label key={v} className={ratings[item.id] === v ? "on" : ""}>
                <input type="radio" name={`rate-${item.id}`} value={v} checked={ratings[item.id] === v} onChange={() => setRatings({ ...ratings, [item.id]: v })} />{v}
              </label>
            ))}
          </div>
          <p className="scale-ends"><span>Not at all</span><span>Fully</span></p>
        </fieldset>
      ))}
      <div className="actions"><button className="btn primary block" disabled={!complete}>See my tips <Icon name="arrow" /></button></div>
    </form>
  );
}

function ExitLesson() {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button className="link exit" onClick={() => setAsking(true)}>Exit lesson</button>;
  return (
    <div className="exit-confirm" role="alertdialog" aria-label="Exit lesson">
      <p>Exit now? Your progress in this run will not be saved.</p>
      <div className="row"><button className="btn ghost" onClick={() => setAsking(false)}>Keep going</button><button className="btn ghost" onClick={() => send({ t: "exit" })}>Exit lesson</button></div>
    </div>
  );
}
