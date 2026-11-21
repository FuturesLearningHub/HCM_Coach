// The coach's AI: explains a step, comments on her reasoning, answers a question, checks a say-back.
// One call, to the HCM Coach server only, with the access code. The server holds the verified process and the
// AI key; this sends only the process and step ids and the words she types. The AI never sets a level.
import { CONTENT_URL } from "../generated/content";

export const AI_ENABLED = true;
export type CoachAsk =
  | { action: "explain"; lessonId: string; stepId: string }
  | { action: "why"; lessonId: string; stepId: string; text: string }
  | { action: "ask"; lessonId: string; stepId?: string; text: string }
  | { action: "sayback"; lessonId: string; stepIds: string[]; text: string }
  | { action: "chat"; lessonId?: string; stepId?: string; text: string; history: { role: "user" | "assistant"; text: string }[] };
export type CoachReply = { text: string; covered?: string[]; missed?: string[]; found?: boolean; sources?: string[]; error?: string };

/** One POST to the HCM Coach server (the only place this file sends anything). */
async function post<T>(path: string, code: string, body: unknown): Promise<T & { error?: string }> {
  try {
    const res = await fetch(`${CONTENT_URL}${path}`, {
      method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json", "x-hcm-coach-code": code }, body: JSON.stringify(body),
    });
    const out = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ...out, error: out.error ?? "The coach is not available right now." };
    return out;
  } catch {
    return { error: "Could not reach the coach. Check your connection and try again." } as T & { error?: string };
  }
}

export async function askCoach(code: string, ask: CoachAsk): Promise<CoachReply> {
  const r = await post<CoachReply>("/api/coach", code, ask);
  return r.error ? { text: "", error: r.error } : r;
}

/** Opt-in progress: one finished run (process, each part's level and right/miss). Nothing else is sent. */
export type ProgressReport = { learner: { id: string; name: string }; lessonId: string; runId: string; steps: { id: string; level: number; outcome: "right" | "miss" }[] };
export const reportProgress = (code: string, r: ProgressReport) => post<{ ok?: boolean }>("/api/progress", code, r);
/** Turning sharing off deletes her record on the server. */
export const forgetProgress = (code: string, learnerId: string) => post<{ ok?: boolean }>("/api/progress", code, { action: "forget", learner: { id: learnerId } });
