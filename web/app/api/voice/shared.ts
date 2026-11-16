// Shared by the Spark AI voice endpoints: access code, rate limit, CORS, and where the voice service lives.
export const cors = {
  "Access-Control-Allow-Origin": "*", // the access code, not the origin, is what gates these endpoints
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-hcm-coach-code, x-coachmark-code",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};
export const reply = (status: number, body: unknown) => Response.json(body, { status, headers: cors });
export const preflight = () => new Response(null, { status: 204, headers: cors });

const WINDOW_MS = 10 * 60_000, MAX_PER_WINDOW = 200; // a long recording makes two calls per step
const hits = new Map<string, number[]>();

/** Returns a refusal, or null when the request may go ahead. */
export function gate(request: Request, needs: ("voice" | "claude")[]): Response | null {
  // The COACHMARK_* settings and x-coachmark-code header are the pre-rename names, still accepted (Spark sends x-coachmark-code).
  const code = process.env.HCM_COACH_ACCESS_CODE || process.env.HCM_COACH_ASK_CODE || process.env.COACHMARK_ACCESS_CODE || process.env.COACHMARK_ASK_CODE;
  const missing = (needs.includes("voice") && !process.env.ELEVENLABS_API_KEY) || (needs.includes("claude") && !(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN));
  if (!code || missing) return reply(503, { error: "AI voice is not set up on the server yet." });
  if ((request.headers.get("x-hcm-coach-code") ?? request.headers.get("x-coachmark-code")) !== code) return reply(401, { error: "That access code is not right." });
  const who = `${code}:${request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"}`;
  const now = Date.now(), recent = (hits.get(who) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now); hits.set(who, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW ? reply(429, { error: "Too many requests in a short time. Try again in a few minutes." }) : null;
}

export const voice = () => ({
  key: process.env.ELEVENLABS_API_KEY ?? "",
  base: (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").replace(/\/+$/, ""),
  voiceId: process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM",
  sttModel: process.env.ELEVENLABS_STT_MODEL || "scribe_v1",
  ttsModel: process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2",
});
