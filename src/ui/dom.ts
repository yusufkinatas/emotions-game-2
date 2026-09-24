// Tiny DOM helpers. No framework: screens build elements with h() and update them in place.

type Child = Node | string | number | null | undefined | false | Child[];

export type Props = {
  class?: string | (string | false | null | undefined)[];
  style?: Partial<CSSStyleDeclaration> | Record<string, string>;
  dataset?: Record<string, string>;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  on?: { [K in keyof HTMLElementEventMap]?: (e: HTMLElementEventMap[K]) => void };
  text?: string;
  html?: string;
} & Record<string, unknown>;

const RESERVED = new Set(['class', 'style', 'dataset', 'attrs', 'on', 'text', 'html']);

export function classList(c: Props['class']): string {
  if (!c) return '';
  return Array.isArray(c) ? c.filter(Boolean).join(' ') : c;
}

function append(el: Element, child: Child): void {
  if (child === null || child === undefined || child === false) return;
  if (Array.isArray(child)) {
    for (const c of child) append(el, c);
    return;
  }
  el.append(child instanceof Node ? child : document.createTextNode(String(child)));
}

/** Create an HTML element: h('button', { class: 'btn', on: { click } }, 'Label'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  append(el, children);
  return el;
}

export function applyProps(el: HTMLElement, props: Props): void {
  const cls = classList(props.class);
  if (cls) el.className = cls;
  if (props.style) Object.assign(el.style, props.style);
  if (props.dataset) Object.assign(el.dataset, props.dataset);
  if (props.attrs) {
    for (const [k, v] of Object.entries(props.attrs)) {
      if (v === null || v === undefined || v === false) el.removeAttribute(k);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (props.on) {
    for (const [k, fn] of Object.entries(props.on)) if (fn) el.addEventListener(k, fn as EventListener);
  }
  if (props.text !== undefined) el.textContent = props.text;
  if (props.html !== undefined) el.innerHTML = props.html;
  for (const [k, v] of Object.entries(props)) {
    if (RESERVED.has(k) || v === undefined) continue;
    (el as unknown as Record<string, unknown>)[k] = v;
  }
}

/** Parse trusted SVG markup (from the kit) into an element. */
export function svgEl(markup: string): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGSVGElement;
}

/** Replace all children of `el`. */
export function replaceChildren(el: Element, ...children: Child[]): void {
  el.replaceChildren();
  append(el, children);
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
