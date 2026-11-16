// Callout trigger engine. Page conditions (field values, URL) are evaluated in the page and only
// the matching callout ids are reported. Step and department conditions are evaluated by the coach.
import type { Callout, Lesson } from "../../../shared/types";
import { findField, fieldMatches } from "./dom";
import { urlMatches } from "./checks";

export const hasPageCondition = (c: Callout) => !!(c.when.fieldValue || c.when.urlMatches);

/** Runs in the content script. Returns ids of callouts whose page conditions hold right now. */
export function pageMatches(lesson: Lesson): string[] {
  return (lesson.callouts ?? []).filter(hasPageCondition).filter((c) => {
    if (c.when.urlMatches && !urlMatches(c.when.urlMatches)) return false;
    if (c.when.fieldValue) { const el = findField(c.when.fieldValue); if (!el || !fieldMatches(el, c.when.fieldValue)) return false; }
    return true;
  }).map((c) => c.id);
}

/** Runs in the background. Step, afterStep and department must all hold when present. */
export function contextMatches(c: Callout, ctx: { stepId: string; department: string; done: string[] }): boolean {
  if (c.when.step && c.when.step !== ctx.stepId) return false;
  if (c.when.afterStep && !ctx.done.includes(c.when.afterStep)) return false;
  if (c.when.department && c.when.department !== ctx.department) return false;
  return true;
}
