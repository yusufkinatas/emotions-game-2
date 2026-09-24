// Card grids grouped by Light in wheel order, then Blends, neutral, Insight and Buried (DESIGN 16.6 deck
// view and deck select), plus keyboard helpers for moving focus through any grid or option row.

import type { CardDef, ContentPack, Engine, Light } from '../../engine/index';
import { BLENDS, LIGHTS, blendOfLights } from '../../engine/index';
import type { CardFaceProps } from '../kit/cardFace';
import { fitCards } from '../kit/cardFace';
import { LIGHT_NAME } from '../kit/names';
import { markIcon, sigil } from '../kit/sigils';
import { h } from '../dom';
import { cardElement, isInsightDef, type CardView } from './cards';

export type GroupKey = Light | 'blend' | 'neutral' | 'insight' | 'buried';

export interface CardGroup {
  key: GroupKey;
  label: string;
  items: CardView[];
}

const ORDER: GroupKey[] = [...LIGHTS, 'blend', 'neutral', 'insight', 'buried'];

function groupOf(def: CardDef): GroupKey {
  if (def.buried || def.kind === 'buried') return 'buried';
  if (isInsightDef(def)) return 'insight';
  if (def.lights.length === 0) return 'neutral';
  if (def.lights.length === 2) return 'blend';
  return def.lights[0]!;
}

const GROUP_LABEL: Record<Exclude<GroupKey, Light>, string> = {
  blend: 'Blends',
  neutral: 'Neutral',
  insight: 'Insight',
  buried: 'Buried',
};

/** Blend rank in wheel order, so Delight comes before Playfulness. */
function blendRank(def: CardDef): number {
  const b = blendOfLights(def.lights);
  return b ? BLENDS.indexOf(b) : 99;
}

/**
 * Group cards for display. Within a group cards are sorted by name (never by pile position, so the draw
 * pile's order stays hidden), Blends by wheel order first.
 */
export function groupCards(pack: ContentPack, views: readonly CardView[]): CardGroup[] {
  const buckets = new Map<GroupKey, CardView[]>();
  for (const v of views) {
    const def = pack.cards[v.defId];
    if (!def) continue;
    const k = groupOf(def);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(v);
  }
  const out: CardGroup[] = [];
  for (const key of ORDER) {
    const items = buckets.get(key);
    if (!items?.length) continue;
    items.sort((a, b) => {
      const da = pack.cards[a.defId]!;
      const db = pack.cards[b.defId]!;
      return (
        (key === 'blend' ? blendRank(da) - blendRank(db) : 0) ||
        da.name.localeCompare(db.name) ||
        Number(a.upgraded) - Number(b.upgraded) ||
        (b.weight ?? 0) - (a.weight ?? 0)
      );
    });
    out.push({ key, label: key in GROUP_LABEL ? GROUP_LABEL[key as keyof typeof GROUP_LABEL] : LIGHT_NAME[key as Light], items });
  }
  return out;
}

const GROUP_ICON: Record<Exclude<GroupKey, Light>, string> = {
  blend: markIcon('harmony'),
  neutral: sigil('neutral'),
  insight: markIcon('sunburst'),
  buried: markIcon('seal'),
};

function groupHeader(g: CardGroup): HTMLElement {
  const icon = g.key in GROUP_ICON ? GROUP_ICON[g.key as keyof typeof GROUP_ICON] : sigil(g.key as Light, { tint: true });
  return h(
    'h3',
    { class: 'card-grid__head', dataset: { group: g.key } },
    h('span', { class: 'card-grid__icon', html: icon, attrs: { 'aria-hidden': 'true' } }),
    h('span', null, g.label),
    h('span', { class: 'card-grid__count num' }, String(g.items.length)),
  );
}

export interface CardGridOptions {
  engine: Engine;
  cards: readonly CardView[];
  /** Cards that can be picked (others are shown dimmed). Omit for a read-only grid. */
  eligible?: (v: CardView) => boolean;
  /** Called with the picked card. */
  onPick?: (v: CardView) => void;
  /** uid of the selected card (drawn lifted). */
  selectedUid?: number | null;
  /** Show every card as its upgraded version (deck view toggle). */
  showUpgraded?: boolean;
  /** Extra face props per card. */
  faceProps?: (v: CardView) => Partial<CardFaceProps>;
  emptyText?: string;
}

/** A grouped card grid. Pickable cards are buttons; read-only cards are focusable so their text is reachable. */
export function renderCardGrid(o: CardGridOptions): HTMLElement {
  const root = h('div', { class: 'card-grid' });
  const groups = groupCards(o.engine.pack, o.cards);
  if (groups.length === 0) {
    root.append(h('p', { class: 'card-grid__empty muted' }, o.emptyText ?? 'No cards here.'));
    return root;
  }
  for (const g of groups) {
    const row = h('div', { class: 'card-grid__row' });
    for (const v of g.items) {
      const def = o.engine.pack.cards[v.defId];
      const up = o.showUpgraded && def?.upgrade && !v.upgraded ? { ...v, upgraded: true } : v;
      const pickable = !!o.onPick && (o.eligible ? o.eligible(v) : true);
      const selected = o.selectedUid !== undefined && o.selectedUid !== null && v.uid === o.selectedUid;
      const el = cardElement(o.engine, up, {
        tag: pickable ? 'button' : 'div',
        state: selected ? 'selected' : pickable && o.eligible ? 'playable' : 'idle',
        ...(o.faceProps?.(v) ?? {}),
      });
      const cell = h('div', {
        class: ['card-grid__cell', o.eligible && !pickable && 'is-ineligible', pickable && 'is-eligible', selected && 'is-selected'],
      });
      if (pickable) {
        el.addEventListener('click', () => o.onPick!(v));
      } else {
        el.tabIndex = 0;
        if (o.eligible) el.setAttribute('aria-disabled', 'true');
      }
      if (v.uid !== undefined) el.dataset.uid = String(v.uid);
      cell.append(el);
      row.append(cell);
    }
    root.append(h('section', { class: 'card-grid__group', dataset: { group: g.key } }, groupHeader(g), row));
  }
  return root;
}

/** Fit every card in a grid once it is in the document (kit rule: once per mount). */
export function fitGrid(el: HTMLElement): void {
  requestAnimationFrame(() => fitCards(el));
}

// ------------------------------------------------------------------------------------------------
// Keyboard: arrow keys move focus to the nearest focusable in that direction (grids and option rows).
// ------------------------------------------------------------------------------------------------

const FOCUSABLE = 'button:not(:disabled), [tabindex="0"], a[href], input, select';

export function focusables(container: ParentNode, selector = FOCUSABLE): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(selector)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Move focus in `container` for an arrow key. Returns true if the key was an arrow and focus moved or
 * landed on the first item.
 */
export function arrowFocus(e: KeyboardEvent, container: HTMLElement, selector = FOCUSABLE): boolean {
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] as [number, number] | undefined;
  if (!dir) return false;
  const items = focusables(container, selector);
  if (items.length === 0) return false;
  const current = document.activeElement as HTMLElement | null;
  if (!current || !container.contains(current) || !items.includes(current)) {
    items[0]!.focus();
    return true;
  }
  const r0 = current.getBoundingClientRect();
  const cx = r0.left + r0.width / 2;
  const cy = r0.top + r0.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === current) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx;
    const dy = r.top + r.height / 2 - cy;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 1) continue;
    const across = Math.abs(dir[0] ? dy : dx);
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (!best) return true;
  best.focus();
  best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  return true;
}

/** True when a button (or link) inside `container` has focus: let Enter and Space activate it natively. */
export function focusedControl(container: HTMLElement): HTMLElement | null {
  const a = document.activeElement as HTMLElement | null;
  if (!a || !container.contains(a)) return null;
  return a.matches('button, a[href], input, select, [role="button"]') ? a : null;
}
