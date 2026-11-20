// Builds without the HCM Coach server use this file, so no AI or network code is bundled.
export const AI_ENABLED = false;
export type CoachAsk =
  | { action: "explain"; lessonId: string; stepId: string }
  | { action: "why"; lessonId: string; stepId: string; text: string }
  | { action: "ask"; lessonId: string; stepId?: string; text: string }
  | { action: "sayback"; lessonId: string; stepIds: string[]; text: string }
  | { action: "chat"; lessonId?: string; stepId?: string; text: string; history: { role: "user" | "assistant"; text: string }[] };
export type CoachReply = { text: string; covered?: string[]; missed?: string[]; found?: boolean; sources?: string[]; error?: string };
export async function askCoach(_code: string, _ask: CoachAsk): Promise<CoachReply> { return { text: "", error: "The AI coach is not part of this build." }; }
