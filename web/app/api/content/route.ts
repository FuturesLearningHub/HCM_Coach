// Content feed for the live guide: guides, contacts, rubrics and the job aids for Search, as one pack.
// The guide downloads this, checks it against its built-in schemas, and uses it in place of the copy it shipped
// with. Publishing new content is a deploy of this site. No reinstall of the extension is needed.
import { CONTENT_PACK } from "./content.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*", // the access code, not the origin, is what gates this endpoint
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "x-coachmark-code",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};
const UPDATED = new Date().toISOString(); // when this deployment was built

export function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

export function GET(request: Request) {
  // These are internal procedures, so the feed is not public. One shared code, set on the server.
  const code = process.env.COACHMARK_ACCESS_CODE || process.env.COACHMARK_ASK_CODE;
  if (!code) return Response.json({ error: "The content feed is not set up on the server yet." }, { status: 503, headers: cors });
  if (request.headers.get("x-coachmark-code") !== code) return Response.json({ error: "That access code is not right." }, { status: 401, headers: cors });
  return Response.json({ ...CONTENT_PACK, updated: UPDATED }, { headers: cors });
}
