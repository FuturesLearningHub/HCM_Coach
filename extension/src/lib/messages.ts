// Messages between the side panel, the content script and the background service worker.
// All of it stays inside the extension. Nothing here leaves the device.
export type PanelMsg =
  | { t: "start"; lessonId: string; department: string }
  | { t: "confirm" } | { t: "skip" } | { t: "hint" } | { t: "back" }
  | { t: "callReady" } | { t: "callDone" } | { t: "callContinue" }
  | { t: "debrief"; outcome: string; notes: string; ratings: Record<string, number> }
  | { t: "exit" } | { t: "focusTab" }
  | { t: "pick"; n: number } | { t: "next" } | { t: "askHelp" } | { t: "lessHelp" } | { t: "saybackDone" };

export type ContentMsg =
  | { t: "hello" }
  | { t: "passed"; stepId: string }
  | { t: "click"; stepId: string; isTarget: boolean; mistake: number }
  | { t: "idle"; stepId: string }
  | { t: "conditions"; ids: string[] }
  | { t: "target"; stepId: string; found: boolean };

/** What the background tells the lesson tab's content script. Null means: no lesson here, do nothing. */
export type TabView = { runId: string; lessonId: string; stepId: string; index: number; spotlight: boolean } | null;

export type Msg = PanelMsg | ContentMsg;
export const send = <R = unknown>(msg: Msg): Promise<R> => chrome.runtime.sendMessage(msg).catch(() => undefined) as Promise<R>;
