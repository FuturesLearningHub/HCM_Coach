import { useEffect, useState, type ReactNode } from "react";

/** Live view of one chrome.storage.local key. The background is the writer; the panel just follows. */
export function useStored<T>(key: string, fallback: T): [T, boolean] {
  const [state, setState] = useState<{ value: T; ready: boolean }>({ value: fallback, ready: false });
  useEffect(() => {
    let alive = true;
    chrome.storage.local.get(key).then((got) => { if (alive) setState({ value: (got[key] as T | undefined) ?? fallback, ready: true }); });
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && key in changes) setState({ value: (changes[key].newValue as T | undefined) ?? fallback, ready: true });
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => { alive = false; chrome.storage.onChanged.removeListener(onChange); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [state.value, state.ready];
}

const paths: Record<string, ReactNode> = {
  screen: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  offline: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17.5" cy="9" r="2.3" /><path d="M16.5 14.2c2.6.3 4.5 2.6 4.5 5.3" /></>,
  checkpoint: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>,
  call: <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 006 6l1.5-2 4 1.5v3a2 2 0 01-2 2A16 16 0 014.5 5.5a2 2 0 012-2z" />,
  rule: <><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" /><path d="M9 9h6M9 13h6" /></>,
  tip: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" /></>,
  warning: <><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  box: <><path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" /><path d="M4 8l8 4 8-4M12 12v8" /></>,
  off: <><path d="M4 4l16 16" /><path d="M8.5 15.5a5 5 0 017 0M5.5 12.5a9 9 0 013-2M18.5 12.5a9 9 0 00-5-2.4" /><circle cx="12" cy="19" r=".8" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.5l3.5 2" /></>,
  download: <><path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5" /><path d="M5 20h14" /></>,
  bell: <><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16z" /><path d="M10 20.5h4" /></>,
  chat: <><path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 014 14.5v-9z" /><path d="M8.5 8.5h7M8.5 11.5h4.5" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5z" />,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>
  );
}

export const STEP_KIND: Record<string, { label: string; icon: string }> = {
  screen: { label: "On screen", icon: "screen" },
  offline: { label: "Away from the screen", icon: "offline" },
  checkpoint: { label: "Stop and check", icon: "checkpoint" },
  call: { label: "Conversation", icon: "call" },
};

export const fmtDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
};
export const fmtDate = (d: number | string, withTime = false) =>
  new Date(typeof d === "string" ? d + "T00:00:00" : d).toLocaleString(undefined, withTime
    ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** A step's title with its kind icon (screen, people, check, call), the same icon as in the step list. */
export function StepTitle({ type, children }: { type: keyof typeof STEP_KIND; children: ReactNode }) {
  return <h1 className="step-title with-icon"><span className="step-icon" title={STEP_KIND[type].label} aria-label={STEP_KIND[type].label}><Icon name={STEP_KIND[type].icon} size={18} /></span><span>{children}</span></h1>;
}
