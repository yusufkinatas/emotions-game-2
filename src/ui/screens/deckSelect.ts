// Deck select (DESIGN 16.6): remove, upgrade, transform, duplicate or Tend. The whole deck in the grouped
// grid with eligible cards highlighted; pick one to see it in the side panel (before and after for an
// upgrade, Weight for a Tend), then confirm. Skip (or Back to the Haven) when the engine allows it.

import type { CardInstance, DeckSelectPurpose, GameState, Phase } from '../../engine/index';
import { BURIED_LINES } from '../../content/index';
import type { App, ScreenController } from '../app';
import { h, replaceChildren } from '../dom';
import { fitCards } from '../kit/cardFace';
import { createTopBar } from '../components/topBar';
import { cardElement, printedCost, viewOf } from '../components/cards';
import type { CardFaceProps } from '../kit/cardFace';
import { arrowFocus, focusedControl, renderCardGrid } from '../components/cardGrid';
import { fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

type DeckSelectPhase = Extract<Phase, { kind: 'deckSelect' }>;

const TITLES: Record<DeckSelectPurpose, [string, string]> = {
  remove: ['Set down a card', 'It leaves your deck for good.'],
  upgrade: ['Kindle: upgrade a card', 'Pick a card to see it before and after.'],
  transform: ['Transform a card', 'It becomes a random upgraded card of a Light next to its own.'],
  duplicate: ['Duplicate a card', 'A copy joins your deck.'],
  tend: ['Tend a Buried card', 'Its Weight drops by 1. At Weight 0 it becomes Insight.'],
};

const CONFIRM: Record<DeckSelectPurpose, string> = {
  remove: 'Set it down',
  upgrade: 'Upgrade',
  transform: 'Transform',
  duplicate: 'Duplicate',
  tend: 'Tend',
};

function originLine(ph: DeckSelectPhase): string | null {
  const o = ph.origin;
  if (!o) return null;
  if (o.kind === 'shop') return `Costs ${o.price} Glimmers when you choose. ${ph.skippable ? 'Skipping is free.' : ''}`.trim();
  if (o.kind === 'haven') return 'Back returns you to the Haven fire.';
  return null;
}

/** Mark the numbers an upgrade raises (text diff of the engine's two card texts) and a lowered cost. */
function upgradeMarks(app: App, card: CardInstance): Partial<CardFaceProps> {
  const nums = (t: string): number[] => (t.match(/\d+/g) ?? []).map(Number);
  const before = nums(app.engine.describeCard(card.defId, false, card.weight));
  const after = nums(app.engine.describeCard(card.defId, true, card.weight));
  const def = app.engine.pack.cards[card.defId];
  const out: Partial<CardFaceProps> = {};
  if (before.length === after.length) {
    out.numberTrends = after.map((n, i) => (n > before[i]! ? 'up' : n < before[i]! ? 'down' : null));
  }
  if (def && printedCost(def, true) !== null && (printedCost(def, true) ?? 0) < (printedCost(def, false) ?? 0)) out.costState = 'lowered';
  return out;
}

function previewPanel(app: App, s: GameState, ph: DeckSelectPhase, card: CardInstance | null, hint: string | null = null): HTMLElement {
  if (!card) {
    return h('div', { class: 'select-preview__empty muted' }, ph.options.length ? 'Choose a highlighted card.' : 'No card can be chosen here.');
  }
  const def = app.engine.pack.cards[card.defId];
  const v = viewOf(card);
  if (ph.purpose === 'upgrade') {
    return h(
      'div',
      { class: 'select-preview__pair' },
      h('div', { class: 'select-preview__card' }, h('span', { class: 'eyebrow' }, 'Now'), cardElement(app.engine, v)),
      h('span', { class: 'select-preview__arrow', attrs: { 'aria-hidden': 'true' } }, '->'),
      h('div', { class: 'select-preview__card' }, h('span', { class: 'eyebrow' }, 'Upgraded'), cardElement(app.engine, { ...v, upgraded: true }, upgradeMarks(app, card))),
      hint ? h('p', { class: 'select-preview__hint muted' }, hint) : null,
    );
  }
  let note = '';
  if (ph.purpose === 'tend' && def?.buried) {
    const w = card.weight ?? 1;
    if (w > 1) note = `Weight ${w} -> ${w - 1}.`;
    else {
      const insightId = def.buried.insight;
      const made = s.run.insightsMade.includes(insightId);
      note = made ? `Weight 1 -> 0. ${BURIED_LINES.peace}` : `Weight 1 -> 0: it becomes ${app.engine.pack.cards[insightId]?.name ?? 'Insight'}.`;
    }
  } else if (ph.purpose === 'remove') note = 'It leaves your deck.';
  else if (ph.purpose === 'duplicate') note = 'A second copy joins your deck.';
  else if (ph.purpose === 'transform') note = 'It becomes a random upgraded card of a neighbouring Light.';
  return h(
    'div',
    { class: 'select-preview__single' },
    h('div', { class: 'select-preview__card' }, cardElement(app.engine, v, hint ? {} : { state: 'selected' })),
    h('p', { class: 'select-preview__note' }, note),
    hint ? h('p', { class: 'select-preview__hint muted' }, hint) : null,
  );
}

export function deckSelectScreen(app: App): ScreenController {
  const top = createTopBar(app);
  const title = h('h1', { class: 'screen__title select-title' });
  const sub = h('p', { class: 'screen__subtitle select-sub' });
  const gridHost = h('div', { class: 'select-grid scroll' });
  const preview = h('div', { class: 'select-preview' });
  const confirmBtn = h('button', { class: 'btn btn--primary', attrs: { type: 'button' } }, h('span', { class: 'select-confirm__label' }, 'Confirm'), h('span', { class: 'kbd' }, 'Enter'));
  const skipBtn = h('button', { class: 'btn btn--ghost', attrs: { type: 'button' } }, h('span', { class: 'select-skip__label' }, 'Skip'), h('span', { class: 'kbd' }, 'S'));
  const side = h('aside', { class: 'select-side panel' }, preview, h('div', { class: 'select-side__actions' }, confirmBtn, skipBtn));
  const body = h('div', { class: 'select-layout' }, h('div', { class: 'select-main' }, h('div', { class: 'select-head' }, title, sub), gridHost), side);
  const el = h('div', { class: 'screen select-screen' }, top.el, body);
  let selected: number | null = null;
  let signature = '';
  /** The eligible card previewed while nothing is picked yet (keyboard focus or pointer hover). */
  let peek: number | null = null;

  /** With nothing picked, the side panel previews the focused or hovered eligible card. */
  function showPeek(uid: number | null): void {
    const s = app.state;
    const ph = phase();
    if (!s || !ph || selected !== null) return;
    const id = uid !== null && ph.options.includes(uid) ? uid : null;
    if (id === peek) return;
    peek = id;
    const card = id === null ? null : (s.run.deck.find((c) => c.uid === id) ?? null);
    replaceChildren(preview, previewPanel(app, s, ph, card, card ? 'Click it or press Enter to choose it.' : null));
    requestAnimationFrame(() => fitCards(preview));
  }
  const uidIn = (t: EventTarget | null): number | null => {
    const c = t instanceof Element ? t.closest<HTMLElement>('[data-uid]') : null;
    const n = Number(c?.dataset.uid);
    return c && Number.isInteger(n) ? n : null;
  };
  gridHost.addEventListener('focusin', (e) => showPeek(uidIn(e.target)));
  gridHost.addEventListener('pointerover', (e) => {
    const uid = uidIn(e.target);
    if (uid !== null) showPeek(uid);
  });

  const phase = (): DeckSelectPhase | null => (app.state?.phase.kind === 'deckSelect' ? app.state.phase : null);

  function confirm(): void {
    if (selected === null || !app.isLegal({ t: 'choose', uid: selected })) {
      uiSound(app, 'notEnough');
      return;
    }
    uiSound(app, 'confirm');
    void app.dispatch({ t: 'choose', uid: selected });
  }

  function skip(): void {
    if (!app.isLegal({ t: 'skip' })) return;
    uiSound(app, 'cancel');
    void app.dispatch({ t: 'skip' });
  }

  confirmBtn.addEventListener('click', confirm);
  skipBtn.addEventListener('click', skip);

  function render(focusUid?: number): void {
    const s = app.state;
    const ph = phase();
    if (!s || !ph) return;
    const [t, st] = TITLES[ph.purpose];
    title.textContent = t;
    sub.textContent = [st, originLine(ph)].filter(Boolean).join(' ');
    const scrollTop = gridHost.scrollTop;
    const grid = renderCardGrid({
      engine: app.engine,
      cards: s.run.deck.map(viewOf),
      eligible: (v) => v.uid !== undefined && ph.options.includes(v.uid),
      onPick: (v) => {
        selected = v.uid ?? null;
        uiSound(app, 'hover');
        render(selected ?? undefined);
      },
      selectedUid: selected,
    });
    gridHost.replaceChildren(grid);
    gridHost.scrollTop = scrollTop;
    const card = selected === null ? null : (s.run.deck.find((c) => c.uid === selected) ?? null);
    peek = null;
    replaceChildren(preview, previewPanel(app, s, ph, card));
    const label = confirmBtn.querySelector('.select-confirm__label')!;
    label.textContent = card ? `${CONFIRM[ph.purpose]}${ph.origin?.kind === 'shop' ? ` (${ph.origin.price} Glimmers)` : ''}` : 'Choose a card';
    confirmBtn.disabled = !card;
    skipBtn.hidden = !app.isLegal({ t: 'skip' });
    skipBtn.querySelector('.select-skip__label')!.textContent = ph.origin?.kind === 'haven' ? 'Back' : ph.options.length === 0 ? 'Continue' : 'Skip';
    requestAnimationFrame(() => {
      fitCards(gridHost);
      fitCards(preview);
      const opening = focusUid === undefined && !el.contains(document.activeElement);
      const firstEligible = gridHost.querySelector<HTMLElement>('.card-grid__cell.is-eligible .card-face');
      const target =
        (focusUid !== undefined ? gridHost.querySelector<HTMLElement>(`[data-uid="${focusUid}"]`) : null) ??
        (opening ? (firstEligible ?? gridHost.querySelector<HTMLElement>('button.card-face')) : null);
      target?.focus({ preventScroll: true });
      if (!target) return;
      // Bring the chosen or first eligible card into view (Buried cards sit at the end of the grid). On
      // opening, show its group from the header down, so the grid doesn't open cut mid-group.
      const group = opening ? target.closest<HTMLElement>('.card-grid__group') : null;
      if (group) {
        const host = gridHost.getBoundingClientRect();
        const delta = group.getBoundingClientRect().top - host.top - 4;
        const fits = target.getBoundingClientRect().bottom - delta <= host.bottom;
        if (fits) gridHost.scrollTop += delta;
        else target.scrollIntoView?.({ block: 'nearest' });
      } else target.scrollIntoView?.({ block: 'nearest' });
      if (opening && selected === null) showPeek(Number(target.dataset.uid ?? target.closest<HTMLElement>('[data-uid]')?.dataset.uid));
    });
  }

  fadeIn(el, app);
  return {
    el,
    update(a) {
      top.update(a);
      const s = a.state;
      const ph = phase();
      if (!s || !ph) return;
      const sig = `${ph.purpose}:${ph.options.join(',')}:${s.run.deck.length}`;
      if (sig === signature) return;
      signature = sig;
      selected = null;
      render();
    },
    onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const k = e.key.toLowerCase();
      if (k === 's') {
        skip();
        return true;
      }
      if (e.key === 'Escape' && selected !== null) {
        selected = null;
        render();
        return true;
      }
      if (arrowFocus(e, gridHost)) return true;
      if (e.key === 'Enter') {
        const f = focusedControl(el);
        const uid = Number(f?.dataset.uid);
        if (f && Number.isInteger(uid)) {
          // Enter on a card: pick it, or confirm when it is already the picked one.
          if (selected === uid) confirm();
          else f.click();
          return true;
        }
        if (f) return false;
        confirm();
        return true;
      }
      return false;
    },
  };
}
