// The coach's AI: explains a step, comments on her reasoning, answers a question, checks a say-back.
// One call, to the HCM Coach server only, with the access code. The server holds the verified process and the
// AI key; this sends only the process and step ids and the words she types. The AI never sets a level.
import { CONTENT_URL } from "../generated/content";

export const AI_ENABLED = true;
export type CoachAsk =
  | { action: "explain"; lessonId: string; stepId: string }
  | { action: "why"; lessonId: string; stepId: string; text: string }
  | { action: "ask"; lessonId: string; stepId?: string; text: string }
  | { action: "sayback"; lessonId: string; stepIds: string[]; text: string };
export type CoachReply = { text: string; covered?: string[]; missed?: string[]; error?: string };

export async function askCoach(code: string, ask: CoachAsk): Promise<CoachReply> {
  try {
    const res = await fetch(`${CONTENT_URL}/api/coach`, {
      method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json", "x-hcm-coach-code": code }, body: JSON.stringify(ask),
    });
    const body = (await res.json().catch(() => ({}))) as CoachReply & { error?: string };
    if (!res.ok) return { text: "", error: body.error ?? "The coach is not available right now." };
    return body;
  } catch {
    return { text: "", error: "Could not reach the coach. Check your connection and try again." };
  }
}
