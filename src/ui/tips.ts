// Coach marks (DESIGN 17.3): shown on a profile's first run only (or again after Settings > Reset tips),
// never blocking input, one at a time with a queue, anchored with an arrow, dismissed by a click or by the
// relevant action (any step, or a screen calling dismiss), each at most once per profile.

import type { App, TipsApi } from './app';
import { coachMarkMarkup } from './kit/callouts';
import type { Tail } from './kit/callouts';
import { toElement } from './kit/svg';
import * as storage from './storage';
import './styles/tips.css';

const TIPS_KEY = 'heartward.tips';
/** A tip must be up this long before a click or a step dismisses it, so it is never lost unread. */
const MIN_VISIBLE_MS = 700;
const GAP = 12;

interface Pending {
  id: string;
  anchor: Element | null;
  text: string;
}

interface Visible extends Pending {
  el: HTMLElement;
  shownAt: number;
  timer: number;
}

export function createTips(app: App): TipsApi {
  const layer = document.createElement('div');
  layer.className = 'tips-layer';
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  layer.append(live);
  app.root.append(layer);

  const queue: Pending[] = [];
  let visible: Visible | null = null;
  let resetOn = storage.load<{ on: boolean }>(TIPS_KEY)?.on === true;

  const enabled = (): boolean => app.profile.stats.runs <= 1 || resetOn;
  const seen = (id: string): boolean => app.profile.seenTips.includes(id);

  function markSeen(id: string): void {
    if (seen(id)) return;
    app.profile.seenTips.push(id);
    app.saveProfile();
  }

  function place(v: Visible): void {
    // The anchor's screen is gone (the player moved on without a step, e.g. Continue from a save).
    if (v.anchor && !v.anchor.isConnected) {
      hide(v.id, true);
      return;
    }
    layer.hidden = app.overlay !== null;
    const el = v.el;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const u = Math.min(vw / 1280, vh / 720);
    const bw = el.offsetWidth;
    const bh = el.offsetHeight;
    const a = v.anchor && v.anchor.isConnected ? v.anchor.getBoundingClientRect() : null;
    let arrow: Tail | 'none' = 'none';
    let left = (vw - bw) / 2;
    let top = 60 * u;
    if (a && a.width + a.height > 0) {
      const cx = a.left + a.width / 2;
      const gap = GAP * u;
      if (a.top - bh - gap > 8) {
        arrow = 'down';
        top = a.top - bh - gap;
      } else if (a.bottom + bh + gap < vh - 8) {
        arrow = 'up';
        top = a.bottom + gap;
      } else if (a.left - bw - gap > 8) {
        arrow = 'right';
        left = a.left - bw - gap;
        top = Math.min(vh - bh - 8, Math.max(8, a.top + a.height / 2 - 21 * u));
      } else {
        arrow = 'left';
        left = a.right + gap;
        top = Math.min(vh - bh - 8, Math.max(8, a.top + a.height / 2 - 21 * u));
      }
      if (arrow === 'down' || arrow === 'up') {
        left = Math.min(vw - bw - 8, Math.max(8, cx - 31 * u));
        // Keep the arrow over the anchor even when the bubble is pushed in from an edge.
        el.style.setProperty('--arrow-x', `${Math.min(bw - 24 * u, Math.max(10 * u, cx - left - 7 * u))}px`);
      }
    }
    el.dataset.arrow = arrow;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
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
    if (visible || !enabled()) return;
    while (queue.length) {
      const next = queue.shift()!;
      if (seen(next.id)) continue;
      // An anchor that left the page belongs to a screen that is gone; keep the tip for another time.
      if (next.anchor && !next.anchor.isConnected) continue;
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
      if (!enabled() || seen(id)) return;
      if (visible?.id === id || queue.some((q) => q.id === id)) return;
      queue.push({ id, anchor, text });
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
      resetOn = true;
      storage.save(TIPS_KEY, { on: true });
      queue.length = 0;
      hide(undefined, true);
    },
  };
}
