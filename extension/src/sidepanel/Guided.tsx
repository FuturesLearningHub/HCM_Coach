// One part of a process, at the support level the throttle has set for her. Short copy, one thing at a time.
// The app marks every check from the verified guide. The AI (when this build has it) only talks.
import { useState } from "react";
import { send } from "../lib/messages";
import { K, type Prefs, type Run } from "../lib/storage";
import { LEVELS, checkFor, nextFor, watchFor, type Level } from "../lib/coach";
import { AI_ENABLED, askCoach, type CoachAsk } from "#coach";
import { Icon, useStored } from "./ui";
import type { Lesson, ScreenStep, Step } from "../../../shared/types";

function useCoach() {
  const [prefs] = useStored<Prefs>(K.prefs, {});
  const [reply, setReply] = useState<{ busy?: boolean; text?: string; error?: string; covered?: string[]; missed?: string[] }>({});
  const ready = AI_ENABLED && !!prefs.contentCode;
  const ask = async (q: CoachAsk) => {
    setReply({ busy: true });
    const r = await askCoach(prefs.contentCode ?? "", q);
    setReply(r.error ? { error: r.error } : { text: r.text, covered: r.covered, missed: r.missed });
  };
  return { ready, reply, ask };
}

/** The throttle, visible: four levels of support, the current one lit. Moves right as she shows she can do it. */
export function Meter({ level, compact }: { level: Level; compact?: boolean }) {
  return (
    <div className={`meter ${compact ? "compact" : ""}`} role="img" aria-label={`Support: ${LEVELS[level].name}. ${LEVELS[level].says}`} title={LEVELS[level].says}>
      {([1, 2, 3, 4] as Level[]).map((l) => (
        <span key={l} className={`notch ${l === level ? "on" : l < level ? "past" : ""}`}>{!compact && LEVELS[l].name}</span>
      ))}
    </div>
  );
}

function CoachSays({ reply }: { reply: { busy?: boolean; text?: string; error?: string } }) {
  if (reply.busy) return <p className="coach-says busy" aria-live="polite">Thinking…</p>;
  if (reply.error) return <p className="coach-says error" aria-live="polite">{reply.error}</p>;
  if (reply.text) return <p className="coach-says" aria-live="polite"><span className="label">Coach</span>{reply.text}</p>;
  return null;
}

/** The short facts of a step: why, the rule that applies, what to watch for. Only what exists is shown. */
function Facts({ run, step }: { run: Run; step: ScreenStep }) {
  const rules = run.callouts;
  const watch = watchFor(step);
  return (
    <dl className="facts-list">
      {step.why && <div><dt className="label">Why</dt><dd>{step.why}</dd></div>}
      {rules.map((c) => <div key={c.id}><dt className="label">{c.kind === "rule" ? "Rule" : c.kind === "warning" ? "Watch out" : "Tip"}</dt><dd>{c.say}{c.source && <span className="source">{c.source}</span>}</dd></div>)}
      {watch && <div><dt className="label">Watch for</dt><dd>{watch}</dd></div>}
    </dl>
  );
}

function Options({ options, picked, answer, reveal, onPick }: { options: string[]; picked?: number; answer: number; reveal: boolean; onPick: (n: number) => void }) {
  return (
    <div className="options" role="group">
      {options.map((o, i) => {
        const state = reveal ? (i === answer ? "right" : i === picked ? "wrong" : "") : i === picked ? "wrong" : "";
        return <button key={i} className={`option ${state}`} disabled={reveal} onClick={() => onPick(i)}>{state === "right" && <Icon name="check" size={16} />}{o}</button>;
      })}
    </div>
  );
}

export function Guided({ run, lesson, steps, step }: { run: Run; lesson: Lesson; steps: Step[]; step: ScreenStep }) {
  const level = (run.level ?? 1) as Level;
  const phase = run.phase ?? "do";
  const coach = useCoach();
  const [why, setWhy] = useState("");
  const [question, setQuestion] = useState("");
  const pick = (n: number) => send({ t: "pick", n });
  const done = <button className="btn primary block" onClick={() => send({ t: "confirm" })}><Icon name="check" /> Done</button>;

  const header = (
    <div className="level-row">
      <Meter level={level} />
      {level < 4 && phase !== "result" && <button className="link small" onClick={() => send({ t: "lessHelp" })}>Less help</button>}
    </div>
  );

  // Guide: the step, why, rule and what to watch for. Then a quick check, marked by the app.
  if (level === 1) {
    if (phase === "check" || phase === "result") {
      const q = checkFor(steps, step)!;
      const right = run.picked === q.answer;
      return (
        <>
          {header}
          <h1 className="step-title">{step.title ?? "Quick check"}</h1>
          <p className="instruction">{q.question}</p>
          <Options options={q.options} picked={run.picked} answer={q.answer} reveal={phase === "result"} onPick={pick} />
          {phase === "result" && (
            <div className={`verdict ${right ? "right" : "wrong"}`} aria-live="polite">
              <p className="verdict-head">{right ? "Right." : "Not quite."}</p>
              {q.why && <p>{q.why}</p>}
            </div>
          )}
          {phase === "result" && <div className="actions"><button className="btn primary block" onClick={() => send({ t: "next" })}>Next <Icon name="arrow" /></button></div>}
        </>
      );
    }
    return (
      <>
        {header}
        <h1 className="step-title">{step.title}</h1>
        <p className="instruction">{step.instruction}</p>
        <Facts run={run} step={step} />
        <CoachSays reply={coach.reply} />
        <div className="actions">
          {done}
          {coach.ready && !coach.reply.text && <button className="btn ghost block" disabled={coach.reply.busy} onClick={() => coach.ask({ action: "explain", lessonId: lesson.id, stepId: step.id })}><Icon name="tip" /> Explain more</button>}
        </div>
      </>
    );
  }

  // Prompt: she says what comes next and why. A right answer is confirmed; a wrong one gets a hint.
  if (level === 2) {
    const q = nextFor(steps, step);
    if (phase === "prompt") {
      const wrong = run.picked !== undefined && run.picked !== q.answer;
      return (
        <>
          {header}
          <h1 className="step-title">What comes next?</h1>
          <Options options={q.options} picked={run.picked} answer={q.answer} reveal={false} onPick={pick} />
          {wrong && <p className="verdict wrong" aria-live="polite"><span className="verdict-head">Not that one.</span> Hint: {step.hints?.[0] ?? step.why ?? step.where ?? "Think about what the screen needs from you now."}</p>}
          {coach.ready && <label className="why-box"><span className="label">Why? (optional)</span>
            <textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why does this come now?" /></label>}
        </>
      );
    }
    return (
      <>
        {header}
        <p className="verdict right"><span className="verdict-head">Right.</span> {step.title}</p>
        <p className="instruction">{step.instruction}</p>
        <CoachSays reply={coach.reply} />
        <div className="actions">
          {done}
          {coach.ready && why.trim() && !coach.reply.text && <button className="btn ghost block" disabled={coach.reply.busy} onClick={() => coach.ask({ action: "why", lessonId: lesson.id, stepId: step.id, text: why.trim() })}>How was my why?</button>}
        </div>
      </>
    );
  }

  // On call and Off: she does it. The coach only speaks when asked, and asking counts as needing help.
  const open = run.asked;
  return (
    <>
      {header}
      <h1 className="step-title">{level === 4 ? `Your turn: ${step.title}` : step.title}</h1>
      {!open && <p className="quiet">{level === 3 ? "Do this one yourself. I'm here if you need me." : "Do this one on your own."}</p>}
      {open && <><p className="instruction">{step.instruction}</p><Facts run={run} step={step} /></>}
      {open && coach.ready && (
        <form className="ask-row" onSubmit={(e) => { e.preventDefault(); if (question.trim()) void coach.ask({ action: "ask", lessonId: lesson.id, stepId: step.id, text: question.trim() }); }}>
          <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask the coach about this step" maxLength={400} />
          <button className="btn ghost" disabled={!question.trim() || coach.reply.busy}>Ask</button>
        </form>
      )}
      <CoachSays reply={coach.reply} />
      <div className="actions">
        {done}
        {!open && <button className="btn ghost block" onClick={() => send({ t: "askHelp" })}><Icon name="tip" /> {level === 3 ? "Help me with this step" : "I need help"}</button>}
      </div>
    </>
  );
}

/** After the last part: she says back what she did and why. The AI checks it against the verified process. */
export function SayBack({ run, lesson, steps }: { run: Run; lesson: Lesson; steps: Step[] }) {
  const coach = useCoach();
  const [text, setText] = useState("");
  const title = (id: string) => steps.find((s) => s.id === id)?.title ?? id;
  const checked = coach.reply.covered || coach.reply.missed;
  return (
    <section className="page coach enter">
      <p className="eyebrow">{lesson.title}</p>
      <h1 className="display small">Say it <em>back</em>.</h1>
      <p className="lead">In a few lines: what did you do, and why?</p>
      <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="First I… because…" maxLength={2000} />
      {coach.ready ? (
        <button className="btn ghost block" disabled={text.trim().length < 20 || coach.reply.busy}
          onClick={() => coach.ask({ action: "sayback", lessonId: lesson.id, stepIds: run.stepIds, text: text.trim() })}>{coach.reply.busy ? "Checking…" : "Check my say-back"}</button>
      ) : (
        <div className="compare"><p className="label">Check it against the process</p><ol>{steps.map((s) => <li key={s.id}>{s.title ?? s.instruction}</li>)}</ol></div>
      )}
      <CoachSays reply={{ error: coach.reply.error, text: coach.reply.text }} />
      {checked && (
        <div className="sayback-result">
          {!!coach.reply.covered?.length && <><p className="label">You covered</p><ul className="ticks">{coach.reply.covered.map((id) => <li key={id}><Icon name="check" size={14} />{title(id)}</li>)}</ul></>}
          {!!coach.reply.missed?.length && <><p className="label">Missing or off</p><ul className="gaps">{coach.reply.missed.map((id) => <li key={id}>{title(id)}</li>)}</ul></>}
        </div>
      )}
      <div className="actions"><button className="btn primary block" onClick={() => send({ t: "saybackDone" })}>Finish <Icon name="arrow" /></button></div>
    </section>
  );
}
