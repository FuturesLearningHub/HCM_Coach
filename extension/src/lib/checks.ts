// Success check engine. Deterministic: step completion is decided by code, from the lesson file.
import type { Check } from "../../../shared/types";
import { findByRole, findField, fieldMatches, isVisible, norm } from "./dom";

export function urlMatches(pattern: string): boolean {
  const here = location.pathname + location.search + location.hash;
  try { const re = new RegExp(pattern); return re.test(here) || re.test(location.href); }
  catch { return here.includes(pattern); }
}

export function runCheck(check: Check): boolean {
  switch (check.type) {
    case "urlMatches": return urlMatches(check.pattern);
    case "textPresent": return norm(document.body?.innerText).toLowerCase().includes(norm(check.text).toLowerCase());
    case "elementVisible": {
      if (check.role && check.text) return findByRole(check.role, check.text) !== null;
      if (check.selector) { try { const el = document.querySelector(check.selector); return !!el && isVisible(el); } catch { return false; } }
      return false;
    }
    case "fieldValue": { const el = findField(check); return !!el && fieldMatches(el, check); }
    case "all": return check.checks.every(runCheck);
    case "any": return check.checks.some(runCheck);
  }
}
