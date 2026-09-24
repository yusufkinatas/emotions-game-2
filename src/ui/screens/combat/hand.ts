// The hand (DESIGN 16.2): cards fanned in wheel order across x 232-1048, keyed by uid and updated in place.
// Hover lifts a card and spreads its neighbours; the selected card lifts 40px at 1.15x.

import type { Uid } from '../../../engine/types';
import { h } from '../../dom';
import { fitCards, renderCardFace } from '../../kit/cardFace';
import type { CardModel } from './model';

export const HAND_W = 816;
const CARD_W = 130;
const MAX_PITCH = 138;

export interface HandHandlers {
  onCard(uid: Uid): void;
  onHover(uid: Uid | null): void;
  onCancel(): void;
}

interface CardSlot {
  uid: Uid;
  wrap: HTMLElement;
  card: HTMLButtonElement;
  sig: string;
}

export class Hand {
  readonly el: HTMLElement;
  private slots = new Map<Uid, CardSlot>();
  private order: Uid[] = [];
  private hover: Uid | null = null;
  private selected: Uid | null = null;
  private mounted = false;
  /** Focus and blur fire while cards are swapped; ignore them so an update never re-enters itself. */
  private updating = false;

  constructor(private readonly handlers: HandHandlers) {
    this.el = h('div', { class: 'cb-hand', attrs: { role: 'group', 'aria-label': 'Your hand' } });
  }

  card(uid: Uid): HTMLButtonElement | undefined {
    return this.slots.get(uid)?.card;
  }

  cardAt(i: number): HTMLButtonElement | undefined {
    const uid = this.order[i];
    return uid === undefined ? undefined : this.slots.get(uid)?.card;
  }

  uids(): readonly Uid[] {
    return this.order;
  }

  /** Take a card out of the hand (to fly it elsewhere); returns its wrapper, still in the DOM. */
  detach(uid: Uid): HTMLElement | null {
    const s = this.slots.get(uid);
    if (!s) return null;
    this.slots.delete(uid);
    this.order = this.order.filter((u) => u !== uid);
    if (this.hover === uid) this.hover = null;
    this.layout();
    return s.wrap;
  }

  setHover(uid: Uid | null): void {
    if (this.hover === uid) return;
    this.hover = uid;
    for (const s of this.slots.values()) s.card.classList.toggle('is-hover', s.uid === uid && s.uid !== this.selected);
    this.layout();
  }

  update(cards: readonly CardModel[], selected: Uid | null, dealing = true): void {
    this.updating = true;
    try {
      this.apply(cards, selected, dealing);
    } finally {
      this.updating = false;
    }
  }

  private apply(cards: readonly CardModel[], selected: Uid | null, dealing: boolean): void {
    this.selected = selected;
    const keep = new Set(cards.map((c) => c.uid));
    for (const [uid, s] of this.slots) {
      if (!keep.has(uid)) {
        s.wrap.remove();
        this.slots.delete(uid);
      }
    }
    const fresh: HTMLElement[] = [];
    let dealt = 0;
    for (const m of cards) {
      let s = this.slots.get(m.uid);
      const sig = JSON.stringify(m.props);
      if (!s) {
        const card = this.renderCard(m);
        const wrap = h('div', { class: 'cb-card', dataset: { uid: String(m.uid) } }, card);
        s = { uid: m.uid, wrap, card, sig };
        this.slots.set(m.uid, s);
        this.el.append(wrap);
        fresh.push(wrap);
        if (this.mounted && dealing) {
          card.classList.add('is-dealing');
          card.style.animationDelay = `${dealt++ * 60}ms`;
          card.addEventListener('animationend', () => card.classList.remove('is-dealing'), { once: true });
        }
      } else if (s.sig !== sig) {
        const had = document.activeElement === s.card;
        const card = this.renderCard(m);
        s.card.replaceWith(card);
        s.card = card;
        s.sig = sig;
        fresh.push(s.wrap);
        if (had) card.focus({ preventScroll: true });
      }
      s.wrap.classList.toggle('cb-card--resolve-with', m.resolveWith);
      s.wrap.classList.toggle('cb-card--selected', m.uid === selected);
      s.card.classList.toggle('is-hover', m.uid === this.hover && m.uid !== selected);
    }
    this.order = cards.map((c) => c.uid);
    if (this.hover !== null && !keep.has(this.hover)) this.hover = null;
    this.layout();
    if (fresh.length) fitCards(this.el);
    this.mounted = true;
  }

  private renderCard(m: CardModel): HTMLButtonElement {
    const card = renderCardFace(m.props) as HTMLButtonElement;
    const uid = m.uid;
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handlers.onCard(uid);
    });
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handlers.onCancel();
    });
    card.addEventListener('pointerenter', () => !this.updating && this.handlers.onHover(uid));
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-deg', '0deg');
      this.handlers.onHover(null);
    });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const t = ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 10;
      card.style.setProperty('--tilt-deg', `${Math.max(-5, Math.min(5, t)).toFixed(1)}deg`);
    });
    card.addEventListener('focus', () => {
      for (const s of this.slots.values()) s.card.tabIndex = s.uid === uid ? 0 : -1;
      if (!this.updating) this.handlers.onHover(uid);
    });
    card.addEventListener('blur', () => !this.updating && this.handlers.onHover(null));
    return card;
  }

  /** Roving focus (19): one card in the hand is a Tab stop; arrows move between cards. */
  private rove(): void {
    const active = this.order.find((u) => this.slots.get(u)?.card === document.activeElement);
    const current = active ?? this.selected ?? this.order[0];
    for (const [uid, s] of this.slots) s.card.tabIndex = uid === current ? 0 : -1;
  }

  /** Fan positions in reference px; neighbours of the hovered card spread by 24px. */
  layout(): void {
    this.rove();
    const n = this.order.length;
    const pitch = n > 1 ? Math.min(MAX_PITCH, (HAND_W - CARD_W) / (n - 1)) : 0;
    const total = CARD_W + (n - 1) * pitch;
    const x0 = (HAND_W - total) / 2;
    const mid = (n - 1) / 2;
    const hi = this.hover !== null ? this.order.indexOf(this.hover) : -1;
    const si = this.selected !== null ? this.order.indexOf(this.selected) : -1;
    const spread = 24;
    this.el.classList.toggle('card-chips--icons', pitch < 110);
    this.order.forEach((uid, i) => {
      const s = this.slots.get(uid)!;
      let x = x0 + i * pitch;
      const d = i - mid;
      let rot = Math.max(-9, Math.min(9, d * (n > 6 ? 1.6 : 2.4)));
      let y = d * d * (n > 6 ? 0.9 : 1.6);
      const focusI = hi >= 0 ? hi : -1;
      if (focusI >= 0 && i !== focusI) x += i < focusI ? -spread : spread;
      if (i === hi || i === si) {
        rot = 0;
        y = 0;
      }
      s.wrap.style.setProperty('--x', x.toFixed(1));
      s.wrap.style.setProperty('--y', y.toFixed(1));
      s.wrap.style.setProperty('--rot', rot.toFixed(2));
      s.wrap.style.zIndex = String(i === si ? 60 : i === hi ? 50 : i + 1);
    });
  }
}
