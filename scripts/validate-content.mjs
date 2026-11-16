// Validates every lesson, contacts and rubric file against the shared schemas,
// then cross-checks references (contactRef, rubricRef, step ids).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { isStale } from "./build-knowledge.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const dir = (d) => readdirSync(join(root, d)).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: `${d}/${f}`, data: read(join(root, d, f)) }));

/** watched = lessons the extension checks on the page (web/lessons). Guides (web/guides) are read-along only. */
export function loadContent(lessonDir = "web/lessons", watched = true) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const v = {
    lesson: ajv.compile(read(join(root, "shared/lesson.schema.json"))),
    contacts: ajv.compile(read(join(root, "shared/contacts.schema.json"))),
    rubric: ajv.compile(read(join(root, "shared/rubric.schema.json"))),
  };
  const errors = [];
  const check = (kind, items) => items.forEach(({ file, data }) => {
    if (!v[kind](data)) for (const e of v[kind].errors) errors.push(`${file}: ${e.instancePath || "/"} ${e.message}`);
  });
  const lessons = dir(lessonDir), contacts = dir("web/contacts"), rubrics = dir("web/rubrics");
  check("lesson", lessons); check("contacts", contacts); check("rubric", rubrics);

  if (!errors.length) {
    const rubricIds = new Set(rubrics.map((r) => r.data.id));
    for (const { file, data: l } of lessons) {
      const dirFile = contacts.find((c) => c.data.org === l.org)?.data;
      const stepIds = new Set();
      const needContact = (ref, where) => {
        if (!ref) return;
        if (!dirFile) return errors.push(`${file}: ${where} uses contactRef but no contacts file has org "${l.org}"`);
        if (!dirFile.contacts.some((c) => c.id === ref && c.department === "Default"))
          errors.push(`${file}: ${where} contactRef "${ref}" has no Default entry in ${dirFile.org}`);
      };
      if (watched && !(l.allowedDomains?.length && l.startUrl)) errors.push(`${file}: watched lessons need allowedDomains and startUrl`);
      if (!watched && (l.allowedDomains || l.startUrl)) errors.push(`${file}: guide lessons must not name a site (no allowedDomains or startUrl)`);
      for (const s of l.steps) {
        if (watched && s.type === "screen" && !(s.target && s.success)) errors.push(`${file}: step ${s.id} needs target and success`);
        if (!watched && s.type === "screen" && (s.target || s.success)) errors.push(`${file}: guide step ${s.id} must not have target or success`);
        if (stepIds.has(s.id)) errors.push(`${file}: duplicate step id "${s.id}"`);
        stepIds.add(s.id);
        needContact(s.contactRef, `step ${s.id}`);
        if (s.type === "call" && !rubricIds.has(s.debrief.rubricRef)) errors.push(`${file}: step ${s.id} rubricRef "${s.debrief.rubricRef}" not found`);
        for (const d of s.departments ?? []) if (!l.departments.includes(d)) errors.push(`${file}: step ${s.id} department "${d}" not in lesson departments`);
      }
      for (const c of l.callouts ?? []) {
        for (const k of ["step", "afterStep"]) if (c.when[k] && !stepIds.has(c.when[k])) errors.push(`${file}: callout ${c.id} refers to unknown step "${c.when[k]}"`);
        if (c.when.department && !l.departments.includes(c.when.department)) errors.push(`${file}: callout ${c.id} department "${c.when.department}" not in lesson departments`);
      }
      for (const r of l.reminders ?? []) {
        if (!stepIds.has(r.afterStep)) errors.push(`${file}: reminder ${r.id} refers to unknown step "${r.afterStep}"`);
        needContact(r.contactRef, `reminder ${r.id}`);
      }
    }
  }
  return { errors, lessons: lessons.map((x) => x.data), contacts: contacts.map((x) => x.data), rubrics: rubrics.map((x) => x.data) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const watched = loadContent("web/lessons", true), guides = loadContent("web/guides", false);
  const errors = [...watched.errors, ...guides.errors];
  if (isStale()) errors.push("the generated content files for the server are out of date. Run: npm run knowledge");
  if (errors.length) { console.error("Content validation FAILED:\n  " + errors.join("\n  ")); process.exit(1); }
  console.log(`Content valid: ${watched.lessons.length} watched lessons, ${guides.lessons.length} guides, ${watched.contacts.length} contacts files, ${watched.rubrics.length} rubrics.`);
}
