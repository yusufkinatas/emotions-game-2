// Coach marks (DESIGN 17.3): each shows the first time its moment happens on a profile (any run; C1 to C3
// are tutorial-only by trigger), never blocking input, one at a time with a queue, anchored with an arrow,
// dismissed by a click or by the relevant action (any step, or a screen calling dismiss). Settings >
// Reset tips clears the seen list so every tip can show again.

import type { App, TipsApi } from './app';
import { coachMarkMarkup } from './kit/callouts';
import { toElement } from './kit/svg';
import * as storage from './storage';
import { contains, placeTip, type Avoid, type Rect } from './tipPlace';
import './styles/tips.css';

/** Pre-1.1 profiles kept a separate "tips reset" flag here; tips no longer depend on the run count. */
const LEGACY_TIPS_KEY = 'heartward.tips';
/** A tip must be up this long before a click or a step dismisses it, so it is never lost unread. */
const MIN_VISIBLE_MS = 700;
const GAP = 12;

/**
 * UI a coach mark should not cover (weight = how bad covering it is). Anything that is, contains or sits
 * inside the tip's own anchor is ignored, since the arrow points at it anyway.
 */
const AVOID: readonly [string, number][] = [
  ['.cb-endturn', 3],
  ['.top-bar', 2],
  ['.lethal-banner', 2],
  ['.intent-pill', 2],
  ['.nameplate__row--name, .nameplate__row--name2, .nameplate__row--bar', 2],
  ['.cb-player__heart', 1.5],
  ['.map-detail__head', 2],
  ['.shade-slot__art', 0.7],
  ['.card-face__name, .card-face__gem', 0.5],
];

interface Pending {
  id: string;
  anchor: Element | null;
  /** Finds the anchor again if the screen re-rendered it (a card re-drawn on select, a slot rebuilt). */
  locate: () => Element | null;
  text: string;
}

interface Visible extends Pending {
  el: HTMLElement;
  shownAt: number;
  timer: number;
}

const rectOf = (r: DOMRect): Rect => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });

export function createTips(app: App): TipsApi {
  const layer = document.createElement('div');
  layer.className = 'tips-layer';
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  layer.append(live);
  app.root.append(layer);
  storage.remove(LEGACY_TIPS_KEY);

  const queue: Pending[] = [];
  let visible: Visible | null = null;

  const seen = (id: string): boolean => app.profile.seenTips.includes(id);

  function markSeen(id: string): void {
    if (seen(id)) return;
    app.profile.seenTips.push(id);
    app.saveProfile();
  }

  /**
   * A locator for `anchor` that survives re-renders: the same element if still mounted, else the element
   * in the same place under the nearest `[data-uid]` host (hand card, Shade slot), else, for a card, another
   * copy of the same card in the same container (the first Kind Word was played, the second is in hand).
   */
  function locator(anchor: Element | null): () => Element | null {
    if (!anchor) return () => null;
    const host = anchor.closest<HTMLElement>('[data-uid]');
    const hostCls = host?.classList[0];
    const hostSel = host && hostCls ? `.${CSS.escape(hostCls)}[data-uid="${CSS.escape(host.dataset.uid ?? '')}"]` : null;
    const innerCls = host && host !== anchor ? anchor.classList[0] : undefined;
    const face = anchor.closest('.card-face');
    const cardName = face?.querySelector('.card-face__name')?.textContent ?? null;
    const scopeCls = host?.parentElement?.classList[0];
    return () => {
      if (anchor.isConnected) return anchor;
      if (hostSel) {
        const h = app.root.querySelector(hostSel);
        const t = h && (innerCls ? h.querySelector(`.${CSS.escape(innerCls)}`) : h);
        if (t) return t;
      }
      if (cardName && scopeCls && hostCls) {
        for (const c of app.root.querySelectorAll(`.${CSS.escape(scopeCls)} .${CSS.escape(hostCls)} .card-face`)) {
          if (c.querySelector('.card-face__name')?.textContent === cardName) return c;
        }
      }
      return null;
    };
  }

  function avoidRects(anchor: Rect): Avoid[] {
    const out: Avoid[] = [];
    for (const [sel, weight] of AVOID) {
      for (const el of app.root.querySelectorAll(sel)) {
        if (layer.contains(el)) continue;
        const r = rectOf(el.getBoundingClientRect());
        if (r.right - r.left <= 0 || r.bottom - r.top <= 0) continue;
        if (contains(r, anchor) || contains(anchor, r)) continue;
        out.push({ ...r, weight });
      }
    }
    return out;
  }

  function place(v: Visible): void {
    // Follow the anchor if it was re-rendered; if it is gone for good the player moved on.
    const found = v.locate();
    if (v.anchor && !found) {
      hide(v.id, true);
      return;
    }
    v.anchor = found;
    layer.hidden = app.overlay !== null;
    const el = v.el;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const u = Math.min(vw / 1280, vh / 720);
    const ar = found ? rectOf(found.getBoundingClientRect()) : null;
    const pl = placeTip({
      anchor: ar,
      bubble: { w: el.offsetWidth, h: el.offsetHeight },
      view: { w: vw, h: vh },
      avoid: ar ? avoidRects(ar) : [],
      u,
      gap: GAP,
    });
    el.dataset.arrow = pl.arrow;
    if (pl.arrowAt !== undefined) {
      const prop = pl.arrow === 'up' || pl.arrow === 'down' ? '--arrow-x' : '--arrow-y';
      el.style.setProperty(prop, `${Math.round(pl.arrowAt)}px`);
    }
    el.style.left = `${Math.round(pl.left)}px`;
    el.style.top = `${Math.round(pl.top)}px`;
  }

  function display(p: Pending): void {
    const el = toElement<HTMLElement>(coachMarkMarkup({ text: p.text, arrow: 'down', id: p.id }));
    el.querySelector('.coach-mark__close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hide(p.id, true);
    });
    layer.append(el);
    const v: Visible = { ...p, el, shownAt: performance.now(), timer: 0 };
    visible = v;
    markSeen(p.id);
    live.textContent = p.text;
    place(v);
    // Anchors move (hands fan out, screens scroll); follow them cheaply.
    v.timer = window.setInterval(() => place(v), 250);
  }

  function pump(): void {
    if (visible) return;
    while (queue.length) {
      const next = queue.shift()!;
      if (seen(next.id)) continue;
      if (next.anchor) {
        // Re-rendered anchors are found again; one whose screen is gone is dropped (not marked seen).
        const found = next.locate();
        if (!found) continue;
        next.anchor = found;
      }
      display(next);
      return;
    }
  }

  function hide(id?: string, force = false): void {
    const v = visible;
    if (!v || (id && v.id !== id)) return;
    if (!force && performance.now() - v.shownAt < MIN_VISIBLE_MS) return;
    clearInterval(v.timer);
    visible = null;
    v.el.classList.add('is-leaving');
    window.setTimeout(() => v.el.remove(), 180);
    window.setTimeout(pump, 220);
  }

  // Any click dismisses the visible tip (it never blocks the click itself).
  app.root.addEventListener('pointerdown', () => hide(), true);
  // Any action taken is "the relevant action" for the tip that is up.
  app.onStep(() => hide());
  window.addEventListener('resize', () => visible && place(visible));

  return {
    show(id, anchor, text) {
      if (seen(id)) return;
      if (visible?.id === id || queue.some((q) => q.id === id)) return;
      queue.push({ id, anchor, locate: locator(anchor), text });
      pump();
    },
    dismiss(id) {
      if (id) {
        const i = queue.findIndex((q) => q.id === id);
        if (i >= 0) {
          queue.splice(i, 1);
          markSeen(id);
        }
      }
      hide(id, true);
    },
    reset() {
      app.profile.seenTips = [];
      app.saveProfile();
      queue.length = 0;
      hide(undefined, true);
    },
  };
}
