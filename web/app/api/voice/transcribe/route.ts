// Spark AI voice, step 1: turn one recorded clip into text.
import { gate, preflight, reply, voice } from "../shared";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(request: Request) {
  const refused = gate(request, ["voice"]);
  if (refused) return refused;
  let body: { audio?: unknown };
  try { body = await request.json(); } catch { return reply(400, { error: "Bad request." }); }
  const match = typeof body.audio === "string" ? /^data:(audio\/[\w.+-]+)(?:;[^,]*)?;base64,(.+)$/.exec(body.audio) : null;
  if (!match) return reply(400, { error: "No audio clip was sent." });
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 3_000_000) return reply(400, { error: "That clip is too long. Keep each step under about two minutes." });

  const v = voice();
  const form = new FormData();
  form.append("model_id", v.sttModel);
  form.append("file", new Blob([bytes], { type: match[1] }), "clip.webm");
  try {
    const res = await fetch(`${v.base}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": v.key }, body: form });
    if (res.status === 401 || res.status === 403) return reply(503, { error: "AI voice is not set up correctly on the server." });
    if (!res.ok) return reply(502, { error: "The speech service could not read that clip. Try again." });
    const data = (await res.json()) as { text?: string };
    return reply(200, { text: (data.text ?? "").trim() });
  } catch { return reply(502, { error: "The speech service could not be reached." }); }
}
