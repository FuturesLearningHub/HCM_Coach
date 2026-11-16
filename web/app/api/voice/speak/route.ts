// Spark AI voice, step 3: speak one cleaned line in the polished voice.
import { gate, preflight, reply, voice } from "../shared";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(request: Request) {
  const refused = gate(request, ["voice"]);
  if (refused) return refused;
  let body: { text?: unknown };
  try { body = await request.json(); } catch { return reply(400, { error: "Bad request." }); }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return reply(400, { error: "There is no script for this step." });
  if (text.length > 800) return reply(400, { error: "That script is too long for one step. Keep it under 800 characters." });

  const v = voice();
  try {
    const res = await fetch(`${v.base}/v1/text-to-speech/${encodeURIComponent(v.voiceId)}?output_format=mp3_44100_128`, {
      method: "POST", headers: { "xi-api-key": v.key, "content-type": "application/json" }, body: JSON.stringify({ text, model_id: v.ttsModel }),
    });
    if (res.status === 401 || res.status === 403) return reply(503, { error: "AI voice is not set up correctly on the server." });
    if (!res.ok) return reply(502, { error: "The voice service could not speak that line. Try again." });
    const type = res.headers.get("content-type")?.split(";")[0] || "audio/mpeg";
    return reply(200, { audio: `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}` });
  } catch { return reply(502, { error: "The voice service could not be reached." }); }
}
