// Builds without Ask use this file, so no network code is bundled.
export type AskReply = { inScope?: boolean; answer?: string; sources?: string[]; error?: string };
export const ASK_ENABLED = false;
export async function ask(_code: string, _question: string, _history: { role: "user" | "assistant"; text: string }[], _context: { guide?: string; step?: string }): Promise<AskReply> {
  return { error: "Ask is not part of this build." };
}
