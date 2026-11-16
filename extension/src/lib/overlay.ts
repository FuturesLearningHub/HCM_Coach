// Highlight ring + tooltip, isolated in a closed Shadow DOM so page styles and page scripts cannot touch it.
const CSS_TEXT = `
:host { all: initial; }
.ring { position: fixed; z-index: 2147483646; pointer-events: none; border-radius: 10px; opacity: 0;
  border: 2px solid #946E24; box-shadow: 0 0 0 3px rgba(207,174,112,.55), 0 6px 22px rgba(28,28,28,.18);
  transition: top .18s ease, left .18s ease, width .18s ease, height .18s ease, opacity .18s ease, box-shadow .18s ease; }
.ring.on { opacity: 1; }
.ring.spot { box-shadow: 0 0 0 4px #CFAE70, 0 0 0 9999px rgba(28,28,28,.45); animation: pulse 1.4s ease-in-out 3; }
.tip { position: fixed; z-index: 2147483647; pointer-events: none; opacity: 0; max-width: 260px;
  background: #1C1C1C; color: #fff; border: 1px solid rgba(207,174,112,.6); border-radius: 8px; padding: 7px 11px 8px;
  font: 500 13px/1.35 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.28);
  transition: top .18s ease, left .18s ease, opacity .18s ease; }
.tip.on { opacity: 1; }
.tip b { display: block; color: #CFAE70; font: 700 10px/1.2 system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 2px; }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.035); } }
@media (prefers-reduced-motion: reduce) { .ring, .tip { transition: none; } .ring.spot { animation: none; } }
`;

export class Overlay {
  private host: HTMLElement | null = null;
  private ring!: HTMLDivElement;
  private tip!: HTMLDivElement;
  private target: Element | null = null;
  private timer: number | undefined;
  private onMove = () => this.place();

  private mount() {
    if (this.host?.isConnected) return;
    this.host = document.createElement("hcm-coach-overlay");
    const root = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS_TEXT;
    this.ring = document.createElement("div"); this.ring.className = "ring";
    this.tip = document.createElement("div"); this.tip.className = "tip"; this.tip.setAttribute("aria-hidden", "true");
    root.append(style, this.ring, this.tip);
    document.documentElement.append(this.host);
    addEventListener("scroll", this.onMove, { capture: true, passive: true });
    addEventListener("resize", this.onMove, { passive: true });
  }

  show(target: Element | null, label: string, text: string, spotlight: boolean) {
    if (!target) { this.hide(); return; }
    this.mount();
    const changed = target !== this.target;
    this.target = target;
    this.tip.replaceChildren(Object.assign(document.createElement("b"), { textContent: label }), document.createTextNode(text));
    const wasSpot = this.ring.classList.contains("spot");
    this.ring.classList.toggle("spot", spotlight);
    if (spotlight && (!wasSpot || changed)) target.scrollIntoView({ block: "center", behavior: "smooth" });
    this.place();
    this.ring.classList.add("on"); this.tip.classList.add("on");
    if (this.timer === undefined) this.timer = window.setInterval(this.onMove, 250);
  }

  hide() {
    this.target = null;
    if (!this.host) return;
    this.ring.classList.remove("on", "spot"); this.tip.classList.remove("on");
    if (this.timer !== undefined) { clearInterval(this.timer); this.timer = undefined; }
  }

  private place() {
    const t = this.target;
    if (!t || !t.isConnected) { if (this.host) { this.ring.classList.remove("on"); this.tip.classList.remove("on"); } return; }
    const r = t.getBoundingClientRect();
    const pad = 5;
    Object.assign(this.ring.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const tipH = this.tip.offsetHeight || 44, tipW = this.tip.offsetWidth || 200;
    const below = r.bottom + pad + 10 + tipH < innerHeight;
    const top = below ? r.bottom + pad + 10 : Math.max(8, r.top - pad - 10 - tipH);
    const left = Math.min(Math.max(8, r.left - pad), Math.max(8, innerWidth - tipW - 8));
    Object.assign(this.tip.style, { top: `${top}px`, left: `${left}px` });
  }
}
