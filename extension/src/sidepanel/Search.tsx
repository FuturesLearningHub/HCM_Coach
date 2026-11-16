import { useEffect, useMemo, useRef, useState } from "react";
import { KNOWLEDGE, LESSONS } from "../lib/data";
import { Icon } from "./ui";
import type { Lesson } from "../../../shared/types";

// "What do I do if" help. It runs entirely inside the extension: it finds the passages in the guides and job aids
// that best match the question and quotes them, with where they came from. There is no AI model and no network
// call, so it costs nothing, never invents an answer, and nothing typed here leaves this computer.
const STOP = new Set("a about am an and any are as at be been but by can could did do does doing for from had has have how i if in into is it its me my need of on or our should so than that the their them then there these they this to up was we were what when where which who why will with would you your".split(" "));
const words = (s: string) => s.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? [];
const stem = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w);
const hit = (w: string, t: string) => w === t || (t.length > 3 && w.startsWith(t));

type Passage = { source: string; heading: string; lines: string[]; lessonId?: string; stepId?: string };
export type HelpTurn = { role: "user"; text: string } | { role: "answer"; found: boolean; lines: string[]; source?: string; heading?: string; lessonId?: string; more: { source: string; heading: string; lessonId?: string }[]; terms: string[] };

type Loose = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);

/** Everything the guides know, cut into small passages: each step, each rule or tip, each reminder, each job aid section. */
function passages(): Passage[] {
  const out: Passage[] = [];
  for (const doc of KNOWLEDGE) for (const sec of doc.sections) out.push({ source: `Job aid: ${doc.title}`, heading: sec.heading, lines: sec.text.split("\n").map((l) => l.trim()).filter(Boolean) });
  for (const lesson of LESSONS as Lesson[]) {
    const source = `Guide: ${lesson.title}`;
    out.push({ source, heading: "What this process is for", lines: [lesson.goal], lessonId: lesson.id });
    for (const raw of lesson.steps as unknown as Loose[]) {
      const prep = (raw.prep ?? {}) as Loose;
      const lines = [
        text(raw.instruction), text(raw.where) && `Where: ${text(raw.where)}`, text(raw.expect) && `You should see: ${text(raw.expect)}`,
        text(raw.why) && `Why: ${text(raw.why)}`, text(raw.note), ...list(raw.hints).map(text),
        ...list(raw.commonMistakes).map((m) => text((m as Loose).say)),
        text(prep.goal) && `Goal of the conversation: ${text(prep.goal)}`,
        ...list(prep.pushbacks).map((p) => `If they say "${text((p as Loose).if)}": ${text((p as Loose).try)}`),
        ...list(prep.doThis).map(text),
      ].filter(Boolean) as string[];
      out.push({ source, heading: text(raw.title) || "Step", lines, lessonId: lesson.id, stepId: text(raw.id) });
    }
    for (const c of list((lesson as unknown as Loose).callouts) as Loose[])
      out.push({ source, heading: c.kind === "rule" ? "Rule" : "Good to know", lines: [text(c.say), text(c.source) && `Source: ${text(c.source)}`].filter(Boolean) as string[], lessonId: lesson.id });
    for (const r of list((lesson as unknown as Loose).reminders) as Loose[])
      out.push({ source, heading: "Afterwards", lines: [text(r.say)].filter(Boolean), lessonId: lesson.id });
  }
  return out.filter((p) => p.lines.length);
}

function answer(question: string, all: Passage[], here?: { lessonId?: string; stepId?: string }): HelpTurn {
  const terms = [...new Set(words(question).filter((w) => !STOP.has(w) && w.length > 1).map(stem))];
  const none: HelpTurn = { role: "answer", found: false, lines: [], more: [], terms };
  if (!terms.length) return none;
  const scored = all.map((p) => {
    const body = words(p.lines.join(" ")).map(stem), title = words(`${p.source} ${p.heading}`).map(stem);
    let score = 0, matched = 0, inBodyTerms = 0;
    for (const t of terms) {
      const b = body.filter((w) => hit(w, t)).length, h = title.filter((w) => hit(w, t)).length;
      if (b || h) matched += 1;
      if (b) inBodyTerms += 1;
      score += Math.min(b, 3) * 2 + Math.min(h, 2) * 2;
    }
    score += matched * matched * 3;
    if (p.heading === "Rule") score *= 1.3; // a stated rule outranks a step that merely mentions the same words
    // The process the person is in right now is the most likely subject of the question.
    if (here?.lessonId && p.lessonId === here.lessonId) score *= here.stepId && p.stepId === here.stepId ? 1.5 : 1.2;
    return { p, score, matched, inBodyTerms };
  }).filter((x) => x.matched > 0 && x.inBodyTerms > 0).sort((a, b) => b.score - a.score);
  const best = scored[0];
  // Answer only when most of what was asked is actually covered. Otherwise say so plainly.
  if (!best || best.matched / terms.length < 0.5) return none;
  // Quote the lines that carry the answer, most relevant first, rather than the whole passage.
  const ranked = best.p.lines.map((line, i) => ({ line, i, n: terms.filter((t) => words(line).map(stem).some((w) => hit(w, t))).length }));
  const keep = best.p.lines.length <= 3 ? ranked : ranked.filter((l) => l.n > 0).sort((a, b) => b.n - a.n || a.i - b.i).slice(0, 3);
  const more = scored.slice(1).filter((x) => x.score >= best.score * 0.55 && !(x.p.source === best.p.source && x.p.heading === best.p.heading)).slice(0, 2)
    .map((x) => ({ source: x.p.source, heading: x.p.heading, lessonId: x.p.lessonId }));
  return { role: "answer", found: true, lines: (keep.length ? keep : ranked.slice(0, 2)).map((l) => l.line), source: best.p.source, heading: best.p.heading, lessonId: best.p.lessonId, more, terms };
}

/** Shows text with the asked-about words marked. Built from plain strings, so nothing in a guide can run as code. */
function Marked({ text: body, terms }: { text: string; terms: string[] }) {
  const parts = body.split(/([A-Za-z0-9][A-Za-z0-9-]*)/);
  return <>{parts.map((p, i) => (i % 2 && terms.some((t) => hit(stem(p.toLowerCase()), t)) ? <mark key={i}>{p}</mark> : p))}</>;
}

const EXAMPLES = ["What date do I use for a non-exempt employee?", "What if my upload needs approval?", "Which document type is a salary increase letter?", "What do I do if the position search finds nothing?"];

export function Search({ onClose, turns, setTurns, here, onOpen }: { onClose: () => void; turns: HelpTurn[]; setTurns: (t: HelpTurn[]) => void; here?: { lessonId?: string; stepId?: string; label?: string }; onOpen?: (lessonId: string) => void }) {
  const [draft, setDraft] = useState("");
  const all = useMemo(passages, [KNOWLEDGE, LESSONS]); // eslint-disable-line react-hooks/exhaustive-deps
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.length]);
  const ask = (q: string) => { const question = q.trim(); if (!question) return; setTurns([...turns, { role: "user", text: question }, answer(question, all, here)]); setDraft(""); };
  return (
    <section className="page ask enter">
      <button className="link back" onClick={onClose}><Icon name="back" size={16} /> Back to the guide</button>
      <p className="eyebrow">Help</p>
      <h1 className="display small">What do I do <em>if</em>…</h1>
      <p className="hint-text"><Icon name="lock" size={13} /> Answers are quoted from the {LESSONS.length} guides and {KNOWLEDGE.length} job aids in this extension. Nothing you type leaves this computer.</p>
      {turns.length === 0 && <div className="examples">{EXAMPLES.map((e) => <button key={e} className="btn ghost block example" onClick={() => ask(e)}>{e}</button>)}</div>}
      <div className="chat" aria-live="polite">
        {turns.map((t, i) => t.role === "user" ? <p key={i} className="bubble user">{t.text}</p> : t.found ? (
          <div key={i} className="bubble assistant">
            <p className="label">{t.heading}</p>
            {t.lines.map((l, j) => <p key={j} className="answer-line"><Marked text={l} terms={t.terms} /></p>)}
            <p className="answer-source">From {t.source}</p>
            {t.lessonId && onOpen && t.lessonId !== here?.lessonId && <button className="link" onClick={() => onOpen(t.lessonId!)}>Open this process <Icon name="arrow" size={14} /></button>}
            {t.more.length > 0 && <p className="answer-more">Also covered in: {t.more.map((m) => `${m.heading} (${m.source.replace(/^(Guide|Job aid): /, "")})`).join("; ")}</p>}
          </div>
        ) : (
          <div key={i} className="bubble scope">
            <p className="label">Not in the guides</p>
            <p>I could not find that in the guides or job aids, so I will not guess. Try the words used on the Oracle screen, or contact HCM support for your unit.</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <label className="field"><span className="label">Your question{here?.label ? ` (you are on: ${here.label})` : ""}</span>
          <input className="input" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} placeholder="What do I do if…" autoComplete="off" maxLength={300} /></label>
        <button className="btn primary block" disabled={!draft.trim()}>Ask <Icon name="arrow" /></button>
      </form>
    </section>
  );
}
