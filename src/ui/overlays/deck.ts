// Deck, draw pile and discard pile overlay (DESIGN 16.6). app.overlay picks the pile: 'deck' is the run
// deck (with an upgrade preview toggle), 'draw' and 'discard' are the combat piles. The draw pile is
// grouped by Light like everything else, so its order stays hidden.
// Also exports overlayFrame, the dialog chrome every overlay uses.

import type { CardInstance, GameState } from '../../engine/index';
import type { App, ScreenController } from '../app';
import { h } from '../dom';
import { markIcon } from '../kit/sigils';
import { fitCards } from '../kit/cardFace';
import { viewOf } from '../components/cards';
import { arrowFocus, renderCardGrid } from '../components/cardGrid';
import '../styles/overlays.css';

export interface OverlayFrame {
  el: HTMLElement;
  panel: HTMLElement;
  body: HTMLElement;
  title: HTMLElement;
  /** Keep Tab inside the dialog (19). Returns true if handled. */
  trapTab(e: KeyboardEvent): boolean;
}

let frameCount = 0;

/** Dialog chrome: dimmed backdrop (click closes), titled panel, labelled close button. */
export function overlayFrame(app: App, titleText: string, cls = '', onClose: () => void = () => app.closeOverlay()): OverlayFrame {
  const id = `ov-title-${++frameCount}`;
  const title = h('h2', { class: 'overlay__title', attrs: { id } }, titleText);
  const close = h('button', { class: 'btn btn--small btn--ghost overlay__close', attrs: { type: 'button', 'aria-label': 'Close (Esc)' }, html: markIcon('close') });
  close.addEventListener('click', onClose);
  const body = h('div', { class: 'overlay__body' });
  const panel = h('div', { class: ['overlay__panel panel', cls], attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id } }, h('header', { class: 'overlay__head' }, title, close), body);
  const el = h('div', { class: 'overlay' }, h('div', { class: 'overlay__backdrop', on: { click: onClose } }), panel);
  const trapTab = (e: KeyboardEvent): boolean => {
    if (e.key !== 'Tab') return false;
    const items = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]')].filter((x) => x.offsetParent !== null);
    if (items.length === 0) return false;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === -1 || i === items.length - 1 ? 0 : i + 1;
    items[next]!.focus();
    return true;
  };
  return { el, panel, body, title, trapTab };
}

function pileOf(s: GameState, which: 'deck' | 'draw' | 'discard'): CardInstance[] {
  const c = s.combat;
  if (which === 'deck' || !c) return s.run.deck;
  const uids = which === 'draw' ? c.piles.draw : c.piles.discard;
  return uids.map((u) => c.cards[u]).filter((x): x is NonNullable<typeof x> => !!x);
}

export function deckOverlay(app: App): ScreenController {
  const which = app.overlay === 'draw' || app.overlay === 'discard' ? app.overlay : 'deck';
  const frame = overlayFrame(app, '', 'overlay__panel--wide deck-overlay');
  const note = h('p', { class: 'deck-overlay__note muted' });
  const toggle = h('label', { class: 'deck-overlay__toggle' }, h('input', { attrs: { type: 'checkbox' } }), h('span', null, 'Show upgrades'));
  const gridHost = h('div', { class: 'deck-overlay__grid scroll' });
  const tools = h('div', { class: 'deck-overlay__tools' }, note, which === 'deck' ? toggle : null);
  frame.body.append(tools, gridHost);
  let showUpgraded = false;
  toggle.querySelector('input')!.addEventListener('change', (e) => {
    showUpgraded = (e.target as HTMLInputElement).checked;
    render();
  });

  function render(): void {
    const s = app.state;
    if (!s) {
      frame.title.textContent = 'Deck';
      gridHost.replaceChildren(h('p', { class: 'muted' }, 'Start a run to see your deck.'));
      return;
    }
    const cards = pileOf(s, which);
    const summary = app.engine.deckSummary(s);
    const titles = { deck: 'Your deck', draw: 'Draw pile', discard: 'Discard pile' } as const;
    frame.title.textContent = `${titles[which]} (${cards.length})`;
    note.textContent =
      which === 'draw'
        ? 'Grouped by Light. The order stays hidden.'
        : which === 'discard'
          ? 'Played and discarded cards. They shuffle back when the draw pile runs out.'
          : `${summary.total} cards${summary.buried ? `, ${summary.buried} Buried (Weight ${summary.buriedWeight})` : ''}${summary.insight ? `, ${summary.insight} Insight` : ''}.`;
    gridHost.replaceChildren(
      renderCardGrid({
        engine: app.engine,
        cards: cards.map(viewOf),
        showUpgraded,
        emptyText: which === 'draw' ? 'The draw pile is empty.' : which === 'discard' ? 'Nothing discarded yet.' : 'Your deck is empty.',
      }),
    );
    requestAnimationFrame(() => fitCards(gridHost));
  }

  render();
  requestAnimationFrame(() => (frame.panel.querySelector<HTMLElement>('.card-face, .overlay__close'))?.focus({ preventScroll: true }));

  return {
    el: frame.el,
    update() {},
    onKey(e) {
      if (frame.trapTab(e)) return true;
      if (arrowFocus(e, gridHost, '.card-face')) return true;
      const k = e.key.toLowerCase();
      if ((k === 'd' && which === 'deck') || (k === 'f' && which === 'discard') || (k === 'd' && which === 'draw')) {
        app.closeOverlay();
        return true;
      }
      return false;
    },
  };
}
