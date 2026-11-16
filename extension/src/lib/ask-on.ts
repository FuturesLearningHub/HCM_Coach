// The only network code in the extension, and only in the Ask build. It sends the typed question, the last few
// turns of this chat, and the name of the guide and step that are open. Nothing from any web page. The address
// is fixed at build time and is the only one the content security policy allows.
import { ASK_URL } from "../generated/content";

export type AskReply = { inScope?: boolean; answer?: string; sources?: string[]; error?: string };
export const ASK_ENABLED = true;

export async function ask(code: string, question: string, history: { role: "user" | "assistant"; text: string }[], context: { guide?: string; step?: string }): Promise<AskReply> {
  try {
    const res = await fetch(`${ASK_URL}/api/ask`, {
      method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json", "x-coachmark-code": code },
      body: JSON.stringify({ question, history, context }),
    });
    const data = (await res.json().catch(() => ({}))) as AskReply;
    if (!res.ok) return { error: data.error ?? "Ask could not get an answer. Try again." };
    return data;
  } catch {
    return { error: "Could not reach the Ask service. Check your connection and try again." };
  }
}
