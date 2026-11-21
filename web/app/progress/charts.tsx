"use client";
// Charts for the progress dashboard: plain SVG, hover tooltips, legends, and the tables below as the table view.
// Colors: six categorical series (validated for dark surfaces and colorblind separation) and a four-step gold
// ordinal ramp for support levels (Guide darkest, Off brightest).
import { useState, type ReactNode } from "react";

export const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c"];
export const LEVEL_COLORS = ["#7a6540", "#9c8150", "#bd9d63", "#e3c690"]; // Guide, Prompt, On call, Off
const INK = "rgba(255,255,255,.92)", MUTED = "rgba(255,255,255,.62)", GRID = "rgba(255,255,255,.10)", SURFACE = "#262626";

type Tip = { x: number; y: number; body: ReactNode } | null;
function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return <div style={{ position: "absolute", left: tip.x + 14, top: tip.y - 10, pointerEvents: "none", background: "#111", border: "1px solid rgba(255,255,255,.2)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: INK, whiteSpace: "nowrap", zIndex: 5, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>{tip.body}</div>;
}
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "0 0 10px" }}>{items.map((i) => (
    <span key={i.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: MUTED }}><span style={{ width: 12, height: 12, borderRadius: 3, background: i.color }} />{i.label}</span>))}</div>;
}

/** Progress over runs: % of a process's parts at Off after each run, one line per learner and process. */
export function LearningCurves({ series }: { series: { label: string; color: string; points: { run: number; pct: number; date: string; miss: number }[] }[] }) {
  const [tip, setTip] = useState<Tip>(null);
  const W = 720, H = 280, L = 44, R = 16, T = 12, B = 34;
  const maxRun = Math.max(2, ...series.flatMap((s) => s.points.map((p) => p.run)));
  const x = (r: number) => L + ((r - 1) / (maxRun - 1)) * (W - L - R), y = (p: number) => T + (1 - p / 100) * (H - T - B);
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setTip(null)}>
      <Legend items={series} />
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Independence after each run, per learner and process">
        {[0, 25, 50, 75, 100].map((g) => <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke={GRID} /><text x={L - 8} y={y(g) + 4} fill={MUTED} fontSize="12" textAnchor="end">{g}%</text></g>)}
        {Array.from({ length: maxRun }, (_, i) => i + 1).map((r) => <text key={r} x={x(r)} y={H - 12} fill={MUTED} fontSize="12" textAnchor="middle">{r}</text>)}
        <text x={(L + W - R) / 2} y={H} fill={MUTED} fontSize="11" textAnchor="middle">Run</text>
        {series.map((s) => (
          <g key={s.label}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" points={s.points.map((p) => `${x(p.run)},${y(p.pct)}`).join(" ")} />
            {s.points.map((p) => <circle key={p.run} cx={x(p.run)} cy={y(p.pct)} r="4.5" fill={s.color} stroke={SURFACE} strokeWidth="2" />)}
            {s.points.map((p) => <circle key={"h" + p.run} cx={x(p.run)} cy={y(p.pct)} r="12" fill="transparent"
              onMouseMove={(e) => { const b = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, body: <><b>{s.label}</b><br />Run {p.run} · {p.date}<br />{p.pct}% independent{p.miss ? ` · ${p.miss} missed this run` : ""}</> }); }} />)}
          </g>))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/** Where every learner's steps sit now, per process: a stacked bar of Guide / Prompt / On call / Off. */
export function LevelBars({ rows }: { rows: { label: string; counts: number[] }[] }) {
  const [tip, setTip] = useState<Tip>(null);
  const NAMES = ["Guide", "Prompt", "On call", "Off"];
  return (
    <div style={{ position: "relative", display: "grid", gap: 14 }} onMouseLeave={() => setTip(null)}>
      <Legend items={NAMES.map((n, i) => ({ label: n, color: LEVEL_COLORS[i] }))} />
      {rows.map((r) => {
        const total = r.counts.reduce((a, b) => a + b, 0) || 1;
        return (
          <div key={r.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: INK, marginBottom: 6 }}><span>{r.label}</span><span style={{ color: MUTED }}>{Math.round((r.counts[3] / total) * 100)}% at Off</span></div>
            <div style={{ display: "flex", gap: 2, height: 22 }}>
              {r.counts.map((c, i) => c > 0 && (
                <div key={i} style={{ flex: c, background: LEVEL_COLORS[i], borderRadius: 4, minWidth: 4 }}
                  onMouseMove={(e) => { const b = (e.currentTarget.parentElement!.parentElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, body: <><b>{r.label}</b><br />{NAMES[i]}: {c} step{c === 1 ? "" : "s"} ({Math.round((c / total) * 100)}%)</> }); }} />))}
            </div>
          </div>);
      })}
      <Tooltip tip={tip} />
    </div>
  );
}

/** The steps people miss most: horizontal bars, labelled with the count. */
export function MissBars({ rows }: { rows: { label: string; sub: string; miss: number; right: number }[] }) {
  const [tip, setTip] = useState<Tip>(null);
  const max = Math.max(1, ...rows.map((r) => r.miss));
  return (
    <div style={{ position: "relative", display: "grid", gap: 10 }} onMouseLeave={() => setTip(null)}>
      {rows.map((r) => (
        <div key={r.sub + r.label} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 260px) 1fr", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 14, color: INK, lineHeight: 1.25 }}>{r.label}<div style={{ fontSize: 12, color: MUTED }}>{r.sub}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}
            onMouseMove={(e) => { const b = (e.currentTarget.parentElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, body: <><b>{r.label}</b> · {r.sub}<br />Missed {r.miss} · Right {r.right}</> }); }}>
            <div style={{ width: `${(r.miss / max) * 100}%`, minWidth: 6, height: 18, background: "#CFAE70", borderRadius: "0 4px 4px 0" }} />
            <span style={{ fontSize: 13, color: INK }}>{r.miss}</span>
          </div>
        </div>))}
      <Tooltip tip={tip} />
    </div>
  );
}
