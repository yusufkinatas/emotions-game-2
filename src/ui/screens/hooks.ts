// Global UI reactions to engine events outside any one screen: "The Deep" title card when the run enters
// act 3 (DESIGN 15.1), the act's ambience when a run moves into a new act away from the map, and a short
// card reveal when a Tend outside combat (Shop "Talk it through", Haven Reflect, an event) turns a Buried
// card into its Insight, so the payoff of the Buried loop is seen where it happens.
import { BURIED_LINES, TITLE_CARDS } from '../../content/index';
import type { GameState } from '../../engine/index';
import type { App } from '../app';
import { h } from '../dom';
import { fitCards } from '../kit/cardFace';
import { cardElement } from '../components/cards';
import { ambienceFor, showTitleCard, uiSound } from '../components/titleCard';
import '../styles/screens.css';

export interface InsightChange {
  /** The Buried card's name before ("Buried Fear"). */
  from: string;
  /** The Insight it became, or null when it was set down in peace (that Insight already exists this run). */
  to: { defId: string; upgraded: boolean } | null;
}

/** Buried cards that left the Buried state between two run states outside combat (DOM-free, tested). */
export function insightChanges(app: Pick<App, 'engine'>, prev: GameState, next: GameState): InsightChange[] {
  if (prev.phase.kind === 'combat' || next.phase.kind === 'combat') return [];
  const cards = app.engine.pack.cards;
  const out: InsightChange[] = [];
  for (const c of prev.run.deck) {
    const def = cards[c.defId];
    if (!def?.buried) continue;
    const now = next.run.deck.find((x) => x.uid === c.uid);
    if (now && cards[now.defId]?.insightOf) out.push({ from: def.name, to: { defId: now.defId, upgraded: now.upgraded } });
    // Weight 1 Tended with its Insight already made: set down in peace (not a removal service).
    else if (!now && (c.weight ?? 1) === 1 && next.run.stats.tends > prev.run.stats.tends) out.push({ from: def.name, to: null });
  }
  return out;
}

let activeReveal: HTMLElement | null = null;

function showInsightReveal(app: App, ch: InsightChange): void {
  activeReveal?.remove();
  const toName = ch.to ? (app.engine.pack.cards[ch.to.defId]?.name ?? 'Insight') : null;
  const text = toName ? `${ch.from} became ${toName}${ch.to?.upgraded ? '+' : ''}.` : `${ch.from}: ${BURIED_LINES.peace}`;
  const el = h(
    'div',
    { class: 'insight-reveal', attrs: { role: 'status', 'aria-live': 'polite' } },
    ch.to ? h('div', { class: 'insight-reveal__card' }, cardElement(app.engine, { defId: ch.to.defId, upgraded: ch.to.upgraded })) : null,
    h('div', { class: 'insight-reveal__text' }, h('span', { class: 'eyebrow' }, ch.to ? 'Insight' : 'At peace'), h('strong', null, text)),
  );
  let gone = false;
  const close = (): void => {
    if (gone) return;
    gone = true;
    el.classList.add('is-leaving');
    window.setTimeout(() => el.remove(), 260);
    if (activeReveal === el) activeReveal = null;
  };
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    close();
  });
  app.root.append(el);
  activeReveal = el;
  requestAnimationFrame(() => fitCards(el));
  uiSound(app, 'glimmer');
  // Long enough to read even at Instant animation speed; any click on it closes it sooner.
  window.setTimeout(close, 3600);
}

export function installMetaHooks(app: App): void {
  app.onStep((events, prev, next) => {
    for (const ev of events) {
      if (ev.e === 'run' && ev.what === 'act' && ev.after === 3) {
        // The Deep opens straight into its Sanctuary; the card covers the change of scene.
        ambienceFor(app, 3);
        void showTitleCard(app, TITLE_CARDS.deep, 2400);
      }
    }
    const changes = insightChanges(app, prev, next);
    if (changes.length) showInsightReveal(app, changes[0]!);
  });
}
