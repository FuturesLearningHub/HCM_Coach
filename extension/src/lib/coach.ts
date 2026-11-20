// The coaching rules: four support levels, the throttle that moves a part between them, and the questions the
// app asks. Everything here is built from the verified guide and decided by the app. The AI never sets a level.
import type { Lesson, ScreenStep, Step } from "../../../shared/types";

export type Level = 1 | 2 | 3 | 4;
export const LEVELS: Record<Level, { name: string; says: string }> = {
  1: { name: "Guide", says: "I show you the step, then check it with you." },
  2: { name: "Prompt", says: "You tell me what comes next." },
  3: { name: "On call", says: "I stay quiet unless you ask." },
  4: { name: "Off", says: "You do it on your own." },
};

/** Where one part of one process stands. Kept per process, per part, on this device. */
export type PartState = { level: Level; streak: number };
export type Levels = Record<string, Record<string, PartState>>;
export const START: PartState = { level: 1, streak: 0 };

/** The throttle: two right in a row means less help, a miss means more, and she can always ask for less. */
export function throttle(s: PartState, outcome: "right" | "miss" | "less"): PartState {
  if (outcome === "less") return { level: Math.min(4, s.level + 1) as Level, streak: 0 };
  if (outcome === "miss") return { level: Math.max(1, s.level - 1) as Level, streak: 0 };
  const streak = s.streak + 1;
  return streak >= 2 && s.level < 4 ? { level: (s.level + 1) as Level, streak: 0 } : { level: s.level, streak };
}

export type Question = { question: string; options: string[]; answer: number; why: string };

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Put the right option among the others in a fixed, step-specific place, so it is not always first. */
function arrange(right: string, others: string[], seed: string): { options: string[]; answer: number } {
  const picked = [...new Set(others.filter((o) => o && o !== right))].slice(0, 2);
  const at = hash(seed) % (picked.length + 1);
  const options = [...picked]; options.splice(at, 0, right);
  return { options, answer: at };
}
const screens = (steps: Step[]) => steps.filter((s): s is ScreenStep => s.type === "screen");
const label = (s: Step) => s.title ?? s.instruction;
/** Other parts of this process, starting after this one, so the wrong options are real steps too. */
const othersOf = (steps: Step[], step: Step) => { const i = steps.indexOf(step); return [...steps.slice(i + 1), ...steps.slice(0, i)].filter((s) => s !== step); };

/** Guide level: the quick check after the step. An authored check wins; otherwise "what should you see now?". */
export function checkFor(steps: Step[], step: ScreenStep): Question | null {
  if (step.check) return { ...step.check, why: step.check.why ?? step.why ?? step.expect ?? "" };
  if (!step.expect) return null;
  const others = (othersOf(screens(steps), step) as ScreenStep[]).map((s) => s.expect ?? "");
  const { options, answer } = arrange(step.expect, others, step.id);
  return { question: "What should you see on the screen now?", options, answer, why: `${step.expect} That is how you know it worked.` };
}

/** The why, checked: this step's reason among the reasons for other steps in the same process. */
export function whyFor(steps: Step[], step: Step): Question | null {
  if (!step.why) return null;
  const others = othersOf(steps, step).map((s) => s.why ?? "").filter(Boolean);
  if (!others.length) return null;
  const { options, answer } = arrange(step.why, others, step.id + ":why");
  return { question: "Why does this step matter?", options, answer, why: step.why };
}

/** Guide level, after she does the step: first the how, then the why. Each is marked by the app. */
export const checksFor = (steps: Step[], step: ScreenStep): Question[] =>
  [checkFor(steps, step), whyFor(steps, step)].filter((q): q is Question => !!q);

/** Prompt level, before she does the step: what comes next, then why it matters. */
export const promptsFor = (steps: Step[], step: Step): Question[] =>
  [nextFor(steps, step), whyFor(steps, step)].filter((q): q is Question => !!q);

/** Prompt level: before the step, "what comes next?", with real steps from this process as the other options. */
export function nextFor(steps: Step[], step: Step): Question {
  const others = othersOf(steps, step).map(label);
  const { options, answer } = arrange(label(step), others, step.id + ":next");
  return { question: "What comes next?", options, answer, why: step.why ?? step.instruction };
}

/** The first thing to watch for on a step: a known mistake, else the first hint. */
export const watchFor = (step: ScreenStep) => step.commonMistakes?.[0]?.say ?? step.hints?.[0];

export const partState = (levels: Levels, lesson: Lesson, stepId: string): PartState => levels[lesson.id]?.[stepId] ?? START;
