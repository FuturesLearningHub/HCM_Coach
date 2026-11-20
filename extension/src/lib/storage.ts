// Everything the coach remembers lives in chrome.storage.local on this device.
export type EventType =
  | "step_complete" | "hint_used" | "mistake" | "callout_shown" | "offline_confirmed" | "offline_skipped"
  | "checkpoint_confirmed" | "call_prepped" | "call_rated" | "reminder_fired" | "reminder_opened" | "lesson_complete";

export type CoachEvent = { type: EventType; stepId?: string; at: number; seconds?: number; department: string; data?: Record<string, string | number> };

export type FeedItem = { kind: "mistake" | "hint" | "spotlight" | "nudge"; text: string; at: number; auto?: boolean };
export type ShownCallout = { id: string; kind: "rule" | "tip" | "warning"; say: string; source?: string; stepId: string };
export type CallResult = { outcome: string; ratings: Record<string, number> };
export type StepResult = { status: "done" | "skipped"; seconds: number; hints: number; mistakes: number; call?: CallResult;
  /** Guide build: the support level this part was done at, how it went, and the level it moves to next time. */
  level?: number; outcome?: "right" | "miss"; next?: number };

export type Run = {
  runId: string;
  lessonId: string;
  department: string;
  tabId: number | null;
  origin: string;
  stepIds: string[];
  index: number;
  /** Guide build: after the last part she says back what she did ("sayback"), then the recap. */
  status: "active" | "sayback" | "complete";
  startedAt: number;
  stepStartedAt: number;
  finishedAt?: number;
  // current-step state
  hintLevel: number;
  spotlight: boolean;
  offTarget: number;
  mistakes: number;
  feed: FeedItem[];
  callouts: ShownCallout[];
  callPhase?: "prep" | "calling" | "debrief" | "tips";
  targetFound: boolean | null;
  // guide build: the support level for this part and where she is in it
  level?: number;
  phase?: "prompt" | "do" | "check" | "result";
  picked?: number;
  missed?: boolean;
  asked?: boolean;
  // whole-run state
  shownCallouts: ShownCallout[];
  results: Record<string, StepResult>;
  events: CoachEvent[];
  reminders: { id: string; say: string; dueAt: number }[];
};

export type Prefs = { consent?: boolean; department?: string; contentCode?: string };
export type HistoryEntry = { runId: string; lessonId: string; department: string; finishedAt: number; seconds: number; hints: number; independent: number; steps: number };
export type CallLogEntry = { runId: string; lessonId: string; lessonTitle: string; stepId: string; at: number; contact: string; outcome: string; ratings: Record<string, number>; notes: string };

export const K = { run: "cm.run", prefs: "cm.prefs", history: "cm.history", callLog: "cm.callLog", levels: "cm.levels" } as const;

export async function get<T>(key: string, fallback: T): Promise<T> {
  const got = await chrome.storage.local.get(key);
  return (got[key] as T | undefined) ?? fallback;
}
export const set = (key: string, value: unknown) => chrome.storage.local.set({ [key]: value });
