"use client";
// HCM Coach progress dashboard (admin only). Reads the opt-in progress records through /api/progress with the
// PROGRESS_ADMIN_CODE. Nothing here is public: without the admin code the API returns nothing.
import { useEffect, useMemo, useState } from "react";
import { LearningCurves, LevelBars, MissBars, SERIES } from "./charts";

type StepRec = { title: string; level: number; right: number; miss: number };
type ProcRec = { title: string; runs: number; firstRun: string; lastRun: string; steps: Record<string, StepRec> };
type Learner = { key: string; name: string; updated: string; processes: Record<string, ProcRec>; history?: { at: string; lessonId: string; off: number; total: number; miss: number; indep?: number }[] };
const LEVEL = ["", "Guide", "Prompt", "On call", "Off"];
const C = { bg: "#1C1C1C", card: "rgba(255,255,255,.05)", line: "rgba(255,255,255,.14)", gold: "#CFAE70", muted: "rgba(255,255,255,.68)", text: "rgba(255,255,255,.92)" };
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function Progress() {
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState("");
  const [data, setData] = useState<Learner[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { const c = sessionStorage.getItem("hcm-progress-admin"); if (c) setSaved(c); } catch {} }, []);
  useEffect(() => { if (saved) void load(saved); }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(c: string) {
    setBusy(true); setError("");
    const res = await fetch("/api/progress", { headers: { "x-progress-admin": c }, cache: "no-store" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) { setError(body.error ?? "Could not load progress."); setData(null); try { sessionStorage.removeItem("hcm-progress-admin"); } catch {} return; }
    try { sessionStorage.setItem("hcm-progress-admin", c); } catch {}
    setData(body.learners);
  }
  async function csv() {
    const res = await fetch("/api/progress?format=csv", { headers: { "x-progress-admin": saved } });
    const url = URL.createObjectURL(await res.blob()); const a = document.createElement("a");
    a.href = url; a.download = "hcm-coach-progress.csv"; a.click(); URL.revokeObjectURL(url);
  }
  async function remove(l: Learner) {
    if (!confirm(`Delete all progress for ${l.name}? This cannot be undone.`)) return;
    await fetch(`/api/progress?key=${l.key}`, { method: "DELETE", headers: { "x-progress-admin": saved } });
    void load(saved);
  }

  const missed = useMemo(() => {
    const m = new Map<string, { process: string; step: string; miss: number; right: number; people: number }>();
    for (const l of data ?? []) for (const p of Object.values(l.processes)) for (const s of Object.values(p.steps)) {
      const k = p.title + "|" + s.title; const e = m.get(k) ?? { process: p.title, step: s.title, miss: 0, right: 0, people: 0 };
      e.miss += s.miss; e.right += s.right; e.people += 1; m.set(k, e);
    }
    return [...m.values()].filter((e) => e.miss > 0).sort((a, b) => b.miss - a.miss).slice(0, 10);
  }, [data]);

  // Chart data: progress over runs (one series per learner and process), levels per process, and misses.
  const curves = useMemo(() => {
    const out: { label: string; color: string; points: { run: number; pct: number; date: string; miss: number }[] }[] = [];
    for (const l of data ?? []) for (const [id, p] of Object.entries(l.processes)) {
      const runs = (l.history ?? []).filter((h) => h.lessonId === id);
      if (runs.length) out.push({ label: `${l.name} · ${p.title}`, color: "", points: runs.map((h, i) => ({ run: i + 1, pct: h.indep ?? Math.round((h.off / Math.max(1, h.total)) * 100), date: day(h.at), miss: h.miss })) });
    }
    return out.slice(0, SERIES.length).map((s, i) => ({ ...s, color: SERIES[i] }));
  }, [data]);
  const levelRows = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const l of data ?? []) for (const p of Object.values(l.processes)) {
      const c = m.get(p.title) ?? [0, 0, 0, 0];
      for (const s of Object.values(p.steps)) c[s.level - 1] += 1;
      m.set(p.title, c);
    }
    return [...m.entries()].map(([label, counts]) => ({ label, counts }));
  }, [data]);

  const page: React.CSSProperties = { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px 60px" };
  const box: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18 };
  const th: React.CSSProperties = { textAlign: "left", fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", color: C.gold, padding: "8px 10px", borderBottom: `1px solid ${C.line}` };
  const td: React.CSSProperties = { padding: "10px", borderBottom: `1px solid ${C.line}`, fontSize: 14, verticalAlign: "top" };
  const btn: React.CSSProperties = { background: C.gold, color: "#1C1C1C", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer" };

  return (
    <main style={page}>
      <style>{`html,body{background:${C.bg}!important;margin:0}`}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 20 }}>
        <header>
          <p style={{ color: C.gold, letterSpacing: ".14em", textTransform: "uppercase", fontSize: 13, margin: 0 }}>HCM Coach</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 40, margin: "6px 0" }}>Learner progress</h1>
          <p style={{ color: C.muted, margin: 0 }}>Only learners who turned on “Share my progress”. Levels: Guide → Prompt → On call → Off. Records are deleted after 12 months.</p>
        </header>

        {!data && (
          <form style={{ ...box, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) setSaved(code.trim()); }}>
            <label style={{ flex: 1, minWidth: 240, display: "grid", gap: 6 }}><span style={{ fontSize: 13, color: C.muted }}>Admin code</span>
              <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" style={{ padding: 10, borderRadius: 8, border: `1px solid ${C.line}`, background: "#111", color: C.text }} /></label>
            <button style={btn} disabled={busy}>{busy ? "Loading…" : "Open dashboard"}</button>
            {error && <p role="alert" style={{ width: "100%", color: "#ECB748", margin: 0 }}>{error}</p>}
          </form>
        )}

        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              {[["Learners sharing", data.length],
                ["Processes reached Off", data.reduce((n, l) => n + Object.values(l.processes).filter((p) => Object.values(p.steps).length && Object.values(p.steps).every((s) => s.level === 4)).length, 0)],
                ["Runs recorded", data.reduce((n, l) => n + Object.values(l.processes).reduce((m, p) => m + p.runs, 0), 0)]].map(([k, v]) => (
                <div key={String(k)} style={box}><p style={{ margin: 0, color: C.muted, fontSize: 13 }}>{k}</p><p style={{ margin: "4px 0 0", fontSize: 34, color: C.gold }}>{v}</p></div>))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={btn} onClick={() => void csv()}>Download CSV</button>
              <button style={{ ...btn, background: "transparent", color: C.text, border: `1px solid ${C.line}` }} onClick={() => void load(saved)}>Refresh</button>
              <button style={{ ...btn, background: "transparent", color: C.muted, border: `1px solid ${C.line}` }} onClick={() => { setData(null); setSaved(""); setCode(""); try { sessionStorage.removeItem("hcm-progress-admin"); } catch {} }}>Lock</button>
            </div>

            {curves.length > 0 && <section style={box}>
              <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>How independent each learner is, run by run</h2>
              <p style={{ margin: "0 0 12px", color: C.muted, fontSize: 14 }}>0% = full support on every step (Guide), 100% = coach off on every step. Rising lines mean the coach is stepping back; a dip is a miss that turned the help back up.</p>
              <LearningCurves series={curves} />
            </section>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))", gap: 20 }}>
              <section style={box}>
                <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Help levels by process</h2>
                <p style={{ margin: "0 0 12px", color: C.muted, fontSize: 14 }}>Every learner&apos;s steps, by how much help they get now.</p>
                <LevelBars rows={levelRows} />
              </section>
              <section style={box}>
                <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Most-missed steps</h2>
                <p style={{ margin: "0 0 12px", color: C.muted, fontSize: 14 }}>Where the guide or training may need work.</p>
                {missed.length ? <MissBars rows={missed.slice(0, 7).map((m) => ({ label: m.step, sub: m.process, miss: m.miss, right: m.right }))} /> : <p style={{ color: C.muted }}>No misses recorded yet.</p>}
              </section>
            </div>

            <section style={box}>
              <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Where people are</h2>
              {data.length === 0 ? <p style={{ color: C.muted }}>No one has shared progress yet.</p> : (
                <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Learner", "Process", "Runs", "Parts at each level", "Last run", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>{data.flatMap((l) => Object.values(l.processes).map((p, i) => {
                    const lv = [1, 2, 3, 4].map((n) => Object.values(p.steps).filter((s) => s.level === n).length);
                    return (
                      <tr key={l.key + p.title}>
                        <td style={td}>{i === 0 ? l.name : ""}</td><td style={td}>{p.title}</td><td style={td}>{p.runs}</td>
                        <td style={td}>{lv.map((n, j) => <span key={j} style={{ display: "inline-block", marginRight: 10, whiteSpace: "nowrap", color: j === 3 && n ? C.gold : C.text }}>{LEVEL[j + 1]} {n}</span>)}</td>
                        <td style={td}>{day(p.lastRun)}</td>
                        <td style={td}>{i === 0 && <button onClick={() => void remove(l)} style={{ background: "none", border: 0, color: C.muted, textDecoration: "underline", cursor: "pointer" }}>Delete</button>}</td>
                      </tr>);
                  }))}</tbody></table></div>)}
            </section>

            <section style={box}>
              <h2 style={{ margin: "0 0 10px", fontSize: 18 }}>Most-missed parts (table)</h2>
              {missed.length === 0 ? <p style={{ color: C.muted }}>No misses recorded yet.</p> : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Process", "Part", "Missed", "Right", "Learners"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>{missed.map((m) => <tr key={m.process + m.step}><td style={td}>{m.process}</td><td style={td}>{m.step}</td><td style={{ ...td, color: "#ECB748" }}>{m.miss}</td><td style={td}>{m.right}</td><td style={td}>{m.people}</td></tr>)}</tbody>
                </table>)}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
