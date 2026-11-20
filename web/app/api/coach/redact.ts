/** People are told not to type personal details. This strips the obvious ones anyway before anything leaves. */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email removed]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[number removed]")
    .replace(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, "[phone removed]")
    .replace(/\b\d{6,}\b/g, "[number removed]");
}
