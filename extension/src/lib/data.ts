// Loads the bundled lessons, contacts and rubrics and validates them against the schemas before use.
import { RAW_LESSONS, RAW_CONTACTS, RAW_RUBRICS, KNOWLEDGE as BUNDLED_KNOWLEDGE, BUILT, MODE } from "../generated/content";
import { validateLesson, validateContacts, validateRubric } from "../generated/validators";
import type { Lesson, ContactsDirectory, Rubric, Contact, Step } from "../../../shared/types";

function keep<T>(raw: unknown[], validate: (d: unknown) => boolean, kind: string): T[] {
  return raw.filter((item) => {
    const ok = validate(item);
    if (!ok) console.warn(`[coachmark] dropped invalid ${kind}`, (item as { id?: string })?.id);
    return ok;
  }) as T[];
}

export type KnowledgeDoc = { title: string; sections: { heading: string; text: string }[] };
/** What the server sends to a live guide. Treated as untrusted until it passes checkPack. */
export type ContentPack = { version: string; updated: string; lessons: unknown[]; contacts: unknown[]; rubrics: unknown[]; knowledge: KnowledgeDoc[] };

// Content in use. It starts as the copy built into the extension. A live guide may replace it with a
// downloaded pack (applyContent). Importers see the current value.
export let LESSONS = keep<Lesson>(RAW_LESSONS, validateLesson, "lesson");
export let CONTACTS = keep<ContactsDirectory>(RAW_CONTACTS, validateContacts, "contacts file");
export let RUBRICS = keep<Rubric>(RAW_RUBRICS, validateRubric, "rubric");
export let KNOWLEDGE: KnowledgeDoc[] = BUNDLED_KNOWLEDGE;
export let CONTENT_INFO: { version: string; updated: string; live: boolean } = { version: "built-in", updated: BUILT, live: false };

export const CONTENT_KEY = "cm.content";
const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

/**
 * Checks a downloaded pack before it is stored or used. Every guide, contacts file and rubric must pass the same
 * schema the build uses; a guide may not name a site or carry on-page targets (the guide build cannot see pages).
 * Anything that fails is dropped. Returns null when nothing usable is left.
 */
export function checkPack(raw: unknown): ContentPack | null {
  const p = raw as Partial<ContentPack> | null;
  if (!p || !isText(p.version, 40) || !isText(p.updated, 40) || !Array.isArray(p.lessons) || !Array.isArray(p.contacts) || !Array.isArray(p.rubrics)) return null;
  const lessons = keep<Lesson>(p.lessons, validateLesson, "lesson").filter((l) =>
    MODE !== "guide" || (!l.allowedDomains && !l.startUrl && l.steps.every((s) => s.type !== "screen" || (!s.target && !s.success))));
  if (!lessons.length) return null;
  const knowledge = (Array.isArray(p.knowledge) ? p.knowledge : []).filter((d): d is KnowledgeDoc =>
    !!d && isText(d.title, 200) && Array.isArray(d.sections) && d.sections.every((x) => !!x && isText(x.heading, 200) && isText(x.text, 20000))).slice(0, 200);
  return { version: p.version, updated: p.updated, lessons, contacts: keep<ContactsDirectory>(p.contacts, validateContacts, "contacts file"), rubrics: keep<Rubric>(p.rubrics, validateRubric, "rubric"), knowledge };
}

/** Switches to a pack (already stored). Returns false and keeps the current content if the pack does not pass. */
export function applyContent(raw: unknown): boolean {
  const pack = checkPack(raw);
  if (!pack) return false;
  LESSONS = pack.lessons as Lesson[]; CONTACTS = pack.contacts as ContactsDirectory[]; RUBRICS = pack.rubrics as Rubric[]; KNOWLEDGE = pack.knowledge;
  CONTENT_INFO = { version: pack.version, updated: pack.updated, live: true };
  return true;
}

export async function loadStoredContent(): Promise<void> {
  const got = await chrome.storage.local.get(CONTENT_KEY);
  if (got[CONTENT_KEY]) applyContent(got[CONTENT_KEY]);
}

export const getLesson = (id: string | undefined) => LESSONS.find((l) => l.id === id);
export const getRubric = (id: string) => RUBRICS.find((r) => r.id === id);

export function stepsFor(lesson: Lesson, department: string): Step[] {
  return lesson.steps.filter((s) => !s.departments || s.departments.includes(department));
}

export type ResolvedContact = Contact & { updated: string; stale: boolean };

/** Match id + learner department, fall back to Default. */
export function resolveContact(lesson: Lesson, ref: string | undefined, department: string): ResolvedContact | null {
  if (!ref) return null;
  const dir = CONTACTS.find((c) => c.org === lesson.org);
  if (!dir) return null;
  const hit = dir.contacts.find((c) => c.id === ref && c.department === department)
    ?? dir.contacts.find((c) => c.id === ref && c.department === "Default");
  if (!hit) return null;
  const ageDays = (Date.now() - new Date(dir.updated + "T00:00:00").getTime()) / 86_400_000;
  return { ...hit, updated: dir.updated, stale: ageDays > 90 };
}

/** host is location.host (includes the port when there is one). */
export function hostAllowed(host: string, domains: string[]): boolean {
  const hostname = host.split(":")[0];
  return domains.some((d) => {
    if (d.startsWith("*.")) return hostname.endsWith(d.slice(1));
    return d.includes(":") ? d === host : d === hostname;
  });
}

/** ISO 8601 duration (weeks, days, hours, minutes, seconds) to milliseconds. */
export function durationMs(iso: string): number {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return 0;
  const [w, d, h, min, s] = m.slice(1).map((x) => Number(x || 0));
  return ((((w * 7 + d) * 24 + h) * 60 + min) * 60 + s) * 1000;
}
