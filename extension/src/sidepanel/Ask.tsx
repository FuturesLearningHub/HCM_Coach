import { useEffect, useRef, useState } from "react";
import { ask } from "#ask";
import { K, type Prefs } from "../lib/storage";
import { Icon } from "./ui";

export type Turn = { role: "user" | "assistant"; text: string; sources?: string[]; outOfScope?: boolean; error?: boolean };
const EXAMPLES = ["What date can I use for a non-exempt manager change?", "How do I inactivate a position?", "Which document type is a salary increase letter?"];

/** Ask: questions about HCM functions and processes. Only what is typed here is sent. Nothing is kept after the panel closes. */
export function Ask({ prefs, context, turns, setTurns, onClose }: {
  prefs: Prefs; context: { guide?: string; step?: string }; turns: Turn[]; setTurns: (t: Turn[]) => void; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [code, setCode] = useState(prefs.askCode ?? "");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const ready = !!prefs.askConsent && !!prefs.askCode;
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.length, busy]);

  const savePrefs = (patch: Partial<Prefs>) => chrome.storage.local.set({ [K.prefs]: { ...prefs, ...patch } });
  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = turns.filter((t) => !t.error).slice(-6).map(({ role, text }) => ({ role, text }));
    const next: Turn[] = [...turns, { role: "user", text: q }];
    setTurns(next); setText(""); setBusy(true);
    const res = await ask(prefs.askCode ?? "", q, history, context);
    setBusy(false);
    setTurns([...next, res.error || !res.answer
      ? { role: "assistant", text: res.error ?? "No answer came back. Try again.", error: true }
      : { role: "assistant", text: res.answer, sources: res.sources, outOfScope: res.inScope === false }]);
  };

  return (
    <section className="page ask enter">
      <button className="link back" onClick={onClose}><Icon name="back" size={16} /> Back to the guide</button>
      <p className="eyebrow">Ask</p>
      <h1 className="display small">Ask about an HCM <em>process</em>.</h1>

      {!ready ? (
        <form className="ask-setup" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void savePrefs({ askCode: code.trim(), askConsent: true }); }}>
          <ul className="facts">
            <li><span className="fact-icon"><Icon name="tip" /></span><div><h2 className="label">What it answers</h2><p>Questions about HCM functions and processes, from the HCM job aids. Nothing else.</p></div></li>
            <li><span className="fact-icon"><Icon name="arrow" /></span><div><h2 className="label">What it sends</h2><p>Only the question you type, the last few turns of this chat, and the name of the guide step you have open. It goes to the HCM Coach service and on to Anthropic's Claude to be answered. Nothing from Oracle or any web page is sent.</p></div></li>
            <li><span className="fact-icon"><Icon name="lock" /></span><div><h2 className="label">Keep people out of it</h2><p>Do not type names, IDs, pay or anything else about a specific person.</p></div></li>
          </ul>
          <label className="field"><span className="label">Access code</span>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" placeholder="From your HCM Academy contact" />
          </label>
          <button className="btn primary block" disabled={!code.trim()}>I understand. Turn on Ask</button>
        </form>
      ) : (
        <>
          <div className="chat" aria-live="polite">
            {turns.length === 0 && (
              <div className="examples">
                <p className="hint-text">Try one of these, or type your own.</p>
                {EXAMPLES.map((e) => <button key={e} className="btn ghost block example" onClick={() => send(e)}>{e}</button>)}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} className={`bubble ${t.role} ${t.error ? "error" : ""} ${t.outOfScope ? "scope" : ""}`}>
                {t.role === "assistant" && <span className="label">{t.error ? "Problem" : t.outOfScope ? "Outside what I can answer" : "Answer"}</span>}
                <p>{t.text}</p>
                {!!t.sources?.length && <p className="source">Source: {t.sources.join("; ")}</p>}
              </div>
            ))}
            {busy && <div className="bubble assistant"><span className="label">Answer</span><p className="thinking"><span className="pulse" /> Looking that up</p></div>}
            <div ref={end} />
          </div>
          <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <label className="field"><span className="label">Your question</span>
              <textarea rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="No names or personal details."
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
            </label>
            <button className="btn primary block" disabled={busy || !text.trim()}>Ask <Icon name="arrow" /></button>
            <p className="hint-text">Answers come from the HCM job aids and can be wrong. Check anything that changes a record.
              <button type="button" className="link" onClick={() => savePrefs({ askCode: undefined, askConsent: false })}>Turn off Ask</button></p>
          </form>
        </>
      )}
    </section>
  );
}
