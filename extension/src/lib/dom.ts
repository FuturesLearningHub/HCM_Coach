// Finds elements the way a person describes them: by role and visible name, or by field label.
import type { Target } from "../../../shared/types";

export const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
export const same = (a: string | null | undefined, b: string | null | undefined) => norm(a).toLowerCase() === norm(b).toLowerCase();

export function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none";
}

const isField = (el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

/** A practical accessible-name calculation: aria-label, aria-labelledby, <label>, value, alt, then text. */
export function accName(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return norm(aria);
  const by = el.getAttribute("aria-labelledby");
  if (by) {
    const text = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    if (norm(text)) return norm(text);
  }
  if (isField(el)) {
    if (el instanceof HTMLInputElement && ["button", "submit", "reset"].includes(el.type)) return norm(el.value);
    const label = el.labels?.[0];
    if (label) return labelText(label);
    return norm(el.getAttribute("placeholder") ?? el.getAttribute("title"));
  }
  if (el instanceof HTMLImageElement) return norm(el.alt);
  return norm(el.textContent) || norm(el.getAttribute("title"));
}

/** Label text without the text of any control nested inside the label. */
function labelText(label: HTMLLabelElement): string {
  const clone = label.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("input,select,textarea,button").forEach((n) => n.remove());
  return norm(clone.textContent);
}

const ROLE_SELECTORS: Record<string, string> = {
  button: 'button,[role="button"],input[type="button"],input[type="submit"],summary',
  link: 'a[href],[role="link"]',
  menuitem: '[role="menuitem"]',
  textbox: 'input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="tel"],input[type="url"],input[type="date"],input[type="number"],textarea,[role="textbox"]',
  combobox: 'select,[role="combobox"]',
  checkbox: 'input[type="checkbox"],[role="checkbox"]',
  radio: 'input[type="radio"],[role="radio"]',
  tab: '[role="tab"]',
  option: 'option,[role="option"]',
  heading: 'h1,h2,h3,h4,h5,h6,[role="heading"]',
};
const INTERACTIVE = 'button,a[href],input,select,textarea,summary,[role="button"],[role="link"],[role="menuitem"],[role="tab"],[role="option"],[role="checkbox"],[role="radio"]';

export function findByRole(role: string, text: string): Element | null {
  const selector = ROLE_SELECTORS[role] ?? `[role="${CSS.escape(role)}"]`;
  const all = [...document.querySelectorAll(selector)].filter(isVisible);
  return all.find((el) => same(accName(el), text)) ?? null;
}

export function findByLabel(label: string): Element | null {
  for (const l of document.querySelectorAll("label")) {
    if (!same(labelText(l), label)) continue;
    const control = l.control ?? l.querySelector("input,select,textarea");
    if (control && isVisible(control)) return control;
  }
  const aria = [...document.querySelectorAll("input,select,textarea,[role='textbox'],[role='combobox']")]
    .find((el) => isVisible(el) && same(el.getAttribute("aria-label"), label));
  return aria ?? null;
}

function safeQuery(selector: string): Element | null {
  try { return document.querySelector(selector); } catch { return null; }
}

/** Order from the spec: role + text, then label, then testId / selector as a fallback. */
export function findTarget(t: Target): Element | null {
  if (t.role && t.text) { const el = findByRole(t.role, t.text); if (el) return el; }
  if (t.label) { const el = findByLabel(t.label); if (el) return el; }
  if (t.testId) { const el = safeQuery(`[data-testid="${CSS.escape(t.testId)}"]`); if (el && isVisible(el)) return el; }
  if (t.selector) { const el = safeQuery(t.selector); if (el && isVisible(el)) return el; }
  return null;
}

export function findField(cond: { label?: string; selector?: string }): Element | null {
  if (cond.label) { const el = findByLabel(cond.label); if (el) return el; }
  if (cond.selector) return safeQuery(cond.selector);
  return null;
}

/** Values are read here and compared locally. They never leave the page. */
export function fieldMatches(el: Element, cond: { equals?: string; notEmpty?: true }): boolean {
  let values: string[];
  if (el instanceof HTMLSelectElement) {
    const opt = el.selectedOptions[0];
    values = opt && el.value !== "" ? [el.value, norm(opt.textContent)] : [""];
  } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    values = [el.checked ? "true" : ""];
  } else if (isField(el)) {
    values = [el.value];
  } else {
    values = [norm(el.textContent)];
  }
  if (cond.notEmpty) return values.some((v) => norm(v) !== "");
  return values.some((v) => norm(v) === norm(cond.equals));
}

export function closestInteractive(node: EventTarget | null): Element | null {
  return node instanceof Element ? node.closest(INTERACTIVE) : null;
}
