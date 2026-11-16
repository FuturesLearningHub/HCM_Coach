// Ask endpoint for the HCM Coach guide: answers questions about HCM functions and processes only.
// The Anthropic API key lives here, in a server environment variable. It is never in the extension.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { SYSTEM_PROMPT, SOURCE_TITLES } from "./prompt";
import { redact } from "./redact";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MODEL = process.env.HCM_COACH_ASK_MODEL || process.env.COACHMARK_ASK_MODEL || "claude-sonnet-5-5";
const MAX_QUESTION = 500, MAX_HISTORY = 6, MAX_TURN = 1500, MAX_CONTEXT = 300;
const WINDOW_MS = 10 * 60_000, MAX_PER_WINDOW = 20;

const Answer = z.object({
  in_scope: z.boolean().describe("false when the question is not about HCM functions and processes"),
  answer: z.string(),
  sources: z.array(z.string()).describe("titles of the reference documents used, exactly as given"),
});

const cors = {
  "Access-Control-Allow-Origin": "*", // the access code, not the origin, is what gates this endpoint
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-hcm-coach-code, x-coachmark-code",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};
const reply = (status: number, body: unknown) => Response.json(body, { status, headers: cors });

// Best-effort limit per access code and address. It resets when the server instance is recycled.
const hits = new Map<string, number[]>();
function limited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export async function POST(request: Request) {
  // COACHMARK_* settings and the x-coachmark-code header are the pre-rename names, still accepted.
  const code = process.env.HCM_COACH_ASK_CODE || process.env.COACHMARK_ASK_CODE;
  if (!code || !(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN))
    return reply(503, { error: "Ask is not set up on the server yet." });
  if ((request.headers.get("x-hcm-coach-code") ?? request.headers.get("x-coachmark-code")) !== code) return reply(401, { error: "That access code is not right." });
  const who = `${code}:${request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"}`;
  if (limited(who)) return reply(429, { error: "Too many questions in a short time. Try again in a few minutes." });

  let body: { question?: unknown; history?: unknown; context?: unknown };
  try { body = await request.json(); } catch { return reply(400, { error: "Bad request." }); }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return reply(400, { error: "Type a question first." });
  if (question.length > MAX_QUESTION) return reply(400, { error: `Keep questions under ${MAX_QUESTION} characters.` });
  const history = (Array.isArray(body.history) ? body.history : []).slice(-MAX_HISTORY)
    .filter((m): m is { role: "user" | "assistant"; text: string } => !!m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
    .map((m) => ({ role: m.role, content: redact(m.text.slice(0, MAX_TURN)) }));
  const ctx = (body.context ?? {}) as { guide?: unknown; step?: unknown };
  const where = [typeof ctx.guide === "string" && `guide "${ctx.guide.slice(0, MAX_CONTEXT)}"`, typeof ctx.step === "string" && `step "${ctx.step.slice(0, MAX_CONTEXT)}"`].filter(Boolean).join(", ");

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: `${where ? `(The person currently has this open in the guide: ${where}.)\n\n` : ""}Question: ${redact(question)}` },
  ];
  // The system prompt is identical on every request, so it is cached. Low effort suits short factual answers.
  const base = {
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: "text" as const, text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } }],
    messages,
  };

  const client = new Anthropic();
  try {
    let message;
    try {
      // If a safety classifier declines, let the API retry on its default fallback model inside the same call.
      message = await client.beta.messages.parse({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
        output_config: { effort: "low", format: betaZodOutputFormat(Answer) } });
    } catch (error) {
      if (!(error instanceof Anthropic.BadRequestError)) throw error;
      // The fallback option is not available everywhere. Ask again without it.
      message = await client.messages.parse({ ...base, output_config: { effort: "low", format: zodOutputFormat(Answer) } });
    }
    if (message.stop_reason === "refusal" || !message.parsed_output)
      return reply(200, { inScope: false, answer: "I can't help with that. I can answer questions about HCM functions and processes, such as how to change an employee's manager.", sources: [] });
    const { in_scope, answer, sources } = message.parsed_output;
    return reply(200, { inScope: in_scope, answer, sources: in_scope ? sources.filter((s) => SOURCE_TITLES.includes(s)) : [] });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return reply(503, { error: "Ask is not set up correctly on the server." });
    if (error instanceof Anthropic.RateLimitError) return reply(429, { error: "Ask is busy right now. Try again in a minute." });
    if (error instanceof Anthropic.APIError) return reply(502, { error: "Ask could not get an answer. Try again." });
    return reply(500, { error: "Something went wrong." });
  }
}
