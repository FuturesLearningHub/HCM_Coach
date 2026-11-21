// Opt-in progress reports. A learner who turns on "Share my progress" sends one small record after each run:
// the process, each part's support level and whether she got it right. Nothing from Oracle, nothing she typed,
// no chat. Records are private files in Vercel Blob (store hcm-coach-progress), one per learner, readable only by
// this server. Writing needs the shared access code; reading needs the separate PROGRESS_ADMIN_CODE.
import { createHash } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";
import { CONTENT_PACK } from "../content/content.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*", // the codes, not the origin, gate this endpoint
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-hcm-coach-code, x-coachmark-code, x-progress-admin",
  "Cache-Control": "no-store",
};
const reply = (status: number, body: unknown) => Response.json(body, { status, headers: cors });
export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

const KEEP_DAYS = 365;
type Loose = Record<string, unknown>;
type StepRec = { title: string; level: number; right: number; miss: number };
type ProcRec = { title: string; runs: number; firstRun: string; lastRun: string; steps: Record<string, StepRec> };
export type LearnerRec = { v: 1; key: string; name: string; updated: string; runIds: string[]; processes: Record<string, ProcRec> };

const lessons = CONTENT_PACK.lessons as unknown as Loose[];
const accessCode = () => (process.env.HCM_COACH_ACCESS_CODE || process.env.HCM_COACH_ASK_CODE || process.env.COACHMARK_ACCESS_CODE || process.env.COACHMARK_ASK_CODE || "").trim();
const adminCode = () => (process.env.PROGRESS_ADMIN_CODE || "").trim();
const storeReady = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || (!process.env.VERCEL && process.env.PROGRESS_LOCAL_DIR));
const keyFor = (learnerId: string) => createHash("sha256").update("hcm-coach:" + learnerId).digest("hex").slice(0, 32);
const pathFor = (key: string) => `progress/${key}.json`;
const cleanName = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 80) : "");

// Tests only: PROGRESS_LOCAL_DIR keeps records in a local folder instead of Vercel Blob. Ignored on Vercel.
const LOCAL = !process.env.VERCEL && process.env.PROGRESS_LOCAL_DIR ? process.env.PROGRESS_LOCAL_DIR : "";
const fs = () => import("node:fs/promises");
const localPath = (path: string) => `${LOCAL}/${path.replace(/\//g, "_")}`;
const store = {
  put: async (path: string, body: string) => LOCAL ? (await fs()).writeFile(localPath(path), body) : void (await put(path, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json", cacheControlMaxAge: 60 })),
  del: async (path: string) => LOCAL ? (await fs()).rm(localPath(path), { force: true }) : del(path),
  list: async (): Promise<string[]> => {
    if (LOCAL) return (await (await fs()).readdir(LOCAL)).filter((f) => f.startsWith("progress_")).map((f) => f.replace(/^progress_/, "progress/"));
    const out: string[] = []; let cursor: string | undefined;
    do { const page = await list({ prefix: "progress/", cursor, limit: 1000 }); out.push(...page.blobs.map((b) => b.pathname)); cursor = page.hasMore ? page.cursor : undefined; } while (cursor);
    return out;
  },
};

async function readRec(path: string): Promise<LearnerRec | null> {
  if (LOCAL) { try { return JSON.parse(await (await fs()).readFile(localPath(path), "utf8")) as LearnerRec; } catch { return null; } }
  const r = await get(path, { access: "private", useCache: false }).catch(() => null);
  if (!r || r.statusCode !== 200 || !r.stream) return null;
  try { return JSON.parse(await new Response(r.stream).text()) as LearnerRec; } catch { return null; }
}

/** A learner's run: merge it into her record. */
export async function POST(request: Request) {
  const code = accessCode();
  if (!code || !storeReady()) return reply(503, { error: "Progress sharing is not set up on the server yet." });
  if ((request.headers.get("x-hcm-coach-code") ?? request.headers.get("x-coachmark-code") ?? "").trim() !== code) return reply(401, { error: "That access code is not right." });
  let body: Loose;
  try { body = await request.json(); } catch { return reply(400, { error: "Bad request." }); }
  const learner = (body.learner ?? {}) as Loose;
  const learnerId = typeof learner.id === "string" && /^[A-Za-z0-9-]{16,64}$/.test(learner.id) ? learner.id : "";
  if (!learnerId) return reply(400, { error: "Bad request." });
  const key = keyFor(learnerId), path = pathFor(key);

  // Opting out deletes her record.
  if (body.action === "forget") { await store.del(path).catch(() => {}); console.log("[progress] forget"); return reply(200, { ok: true }); }

  const name = cleanName(learner.name);
  const lesson = lessons.find((l) => l.id === body.lessonId);
  const runId = typeof body.runId === "string" ? body.runId.slice(0, 64) : "";
  if (!name || !lesson || !runId || !Array.isArray(body.steps)) return reply(400, { error: "Bad request." });
  const lessonSteps = lesson.steps as Loose[];
  const steps = (body.steps as Loose[]).filter((s) => lessonSteps.some((x) => x.id === s.id) && [1, 2, 3, 4].includes(Number(s.level)) && ["right", "miss"].includes(String(s.outcome)));

  const now = new Date().toISOString();
  const rec: LearnerRec = (await readRec(path)) ?? { v: 1, key, name, updated: now, runIds: [], processes: {} };
  rec.name = name; rec.updated = now;
  if (!rec.runIds.includes(runId)) {
    rec.runIds = [...rec.runIds, runId].slice(-50);
    const id = String(lesson.id);
    const proc = rec.processes[id] ?? { title: String(lesson.title), runs: 0, firstRun: now, lastRun: now, steps: {} };
    proc.title = String(lesson.title); proc.runs += 1; proc.lastRun = now;
    for (const s of steps) {
      const meta = lessonSteps.find((x) => x.id === s.id)!;
      const st = proc.steps[String(s.id)] ?? { title: String(meta.title ?? meta.instruction), level: 1, right: 0, miss: 0 };
      st.title = String(meta.title ?? meta.instruction); st.level = Number(s.level);
      if (s.outcome === "right") st.right += 1; else st.miss += 1;
      proc.steps[String(s.id)] = st;
    }
    rec.processes[id] = proc;
  }
  await store.put(path, JSON.stringify(rec));
  console.log(`[progress] saved ${String(lesson.id)} (${steps.length} parts)`);
  return reply(200, { ok: true });
}

async function allRecords(): Promise<LearnerRec[]> {
  const out: LearnerRec[] = [];
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  for (const path of await store.list()) {
    const rec = await readRec(path);
    if (!rec) continue;
    if (Date.parse(rec.updated) < cutoff) { await store.del(path).catch(() => {}); continue; } // retention
    out.push(rec);
  }
  return out;
}

const admin = (request: Request) => { const c = adminCode(); return !!c && (request.headers.get("x-progress-admin") ?? "").trim() === c; };

/** The dashboard's data (admin only). ?format=csv for a spreadsheet. */
export async function GET(request: Request) {
  if (!adminCode() || !storeReady()) return reply(503, { error: "The progress dashboard is not set up on the server yet." });
  if (!admin(request)) return reply(401, { error: "That admin code is not right." });
  const recs = (await allRecords()).map(({ runIds, ...r }) => r); // eslint-disable-line @typescript-eslint/no-unused-vars
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const q = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const LEVEL = ["", "Guide", "Prompt", "On call", "Off"];
    const rows = [["Learner", "Process", "Runs", "Last run", "Part", "Support level", "Right", "Missed"].map(q).join(",")];
    for (const r of recs) for (const p of Object.values(r.processes)) for (const s of Object.values(p.steps))
      rows.push([r.name, p.title, p.runs, p.lastRun.slice(0, 10), s.title, LEVEL[s.level] ?? s.level, s.right, s.miss].map(q).join(","));
    return new Response(rows.join("\n"), { headers: { ...cors, "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=hcm-coach-progress.csv" } });
  }
  return reply(200, { generated: new Date().toISOString(), keepDays: KEEP_DAYS, learners: recs });
}

/** Remove one learner's record (admin only), e.g. on request. */
export async function DELETE(request: Request) {
  if (!adminCode() || !storeReady()) return reply(503, { error: "Not set up." });
  if (!admin(request)) return reply(401, { error: "That admin code is not right." });
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!/^[a-f0-9]{32}$/.test(key)) return reply(400, { error: "Bad request." });
  await store.del(pathFor(key)).catch(() => {});
  return reply(200, { ok: true });
}
