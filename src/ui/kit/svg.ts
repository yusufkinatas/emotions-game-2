// Markup helpers shared by the kit. Every renderer builds a string first (testable without a DOM), and the
// element variants parse it once with a <template>.

export const SVG_NS = 'http://www.w3.org/2000/svg';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for use inside markup or an attribute value. */
export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]!);
}

type AttrValue = string | number | boolean | null | undefined;

/** Serialise attributes, skipping null, undefined and false. `true` writes a bare attribute. */
export function attrs(o: Record<string, AttrValue>): string {
  let out = '';
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === false) continue;
    out += v === true ? ` ${k}` : ` ${k}="${esc(v)}"`;
  }
  return out;
}

/** Compact number for path data (2 decimals, no trailing zeros). */
export function n(x: number): string {
  const r = Math.round(x * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

/** A CSS length: numbers are px, strings pass through (e.g. 'calc(var(--u) * 24)'). */
export function cssLen(v: number | string): string {
  return typeof v === 'number' ? `${n(v)}px` : v;
}

let idCounter = 0;

/**
 * Unique id for SVG defs (gradients, clips, masks) so many instances can share a document.
 * Format: prefix + decimal counter + '_' (e.g. 'sa12_'); renderers append a one-letter suffix.
 */
export function uniqueId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000_000;
  return `${prefix}${idCounter}_`;
}

/** Parse trusted kit markup into its root element. Requires a DOM. */
export function toElement<T extends Element = HTMLElement>(markup: string): T {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const el = t.content.firstElementChild;
  if (!el) throw new Error('toElement: empty markup');
  return el as T;
}

/** Parse trusted SVG markup (a kit icon, sigil or Shade) into an SVGSVGElement. */
export function svgElement(markup: string): SVGSVGElement {
  return toElement<SVGSVGElement>(markup);
}

/** Point on a circle (degrees, 0 = up, clockwise), as used by the Compass and radial glyphs. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
