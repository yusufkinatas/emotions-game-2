// The Sanctuary, run by Mo the heron (DESIGN 13, 16.6): shelves of Light cards, Blends, a neutral card and
// Keepsakes with prices, the sale tag, sold and unaffordable states, the Set Down and Talk it through
// services, Mo's line in a speech bubble, a Light Mix preview on hover, and Leave.

import type { CardDef, GameState, ShopItem, ShopStock } from '../../engine/index';
import type { App, ScreenController } from '../app';
import { h } from '../dom';
import { fitCards } from '../kit/cardFace';
import { resourceIcon } from '../kit/sigils';
import { createTopBar } from '../components/topBar';
import { cardElement } from '../components/cards';
import { arrowFocus, focusedControl, lightMixFor } from '../components/cardGrid';
import { keepsakeFace } from '../components/keepsakes';
import { fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

/** Mo the heron, drawn in ink with a pearl breast and a tiny scarf. Decorative. */
export function heronMarkup(): string {
  return `<svg class="heron" viewBox="0 0 140 220" aria-hidden="true" focusable="false">
  <ellipse cx="72" cy="212" rx="44" ry="6" fill="rgb(0 0 0 / 0.35)"/>
  <path d="M62 150L56 210M80 150L86 210" stroke="#8d86a3" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M56 210L46 212M56 210L62 213M86 210L96 212M86 210L80 213" stroke="#8d86a3" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M40 118C40 92 62 80 84 86C106 92 114 118 104 140C96 156 70 160 54 150C44 144 40 132 40 118Z" fill="#3a3452"/>
  <path d="M100 124C112 132 124 146 128 162C116 156 104 148 96 138Z" fill="#2b2640"/>
  <path d="M52 132C60 146 80 150 94 142C84 156 60 158 50 146Z" fill="#f4efe6" opacity="0.85"/>
  <path d="M66 90C60 72 58 56 66 44C72 34 70 26 62 22" fill="none" stroke="#3a3452" stroke-width="11" stroke-linecap="round"/>
  <path d="M66 90C60 72 58 56 66 44C72 34 70 26 62 22" fill="none" stroke="#f4efe6" stroke-width="3" stroke-linecap="round" opacity="0.55" transform="translate(-3 1)"/>
  <ellipse cx="60" cy="20" rx="11" ry="9" fill="#3a3452"/>
  <path d="M50 18L14 24L50 24Z" fill="#e8c46a"/>
  <path d="M62 12C70 6 80 6 86 10C78 10 72 12 66 16Z" fill="#15121f"/>
  <circle cx="58" cy="18" r="2.2" fill="#f4efe6"/>
  <circle cx="58.4" cy="18.2" r="1" fill="#15121f"/>
  <path d="M58 58C66 62 76 60 80 54L82 62C74 68 62 68 56 64Z" fill="#ff8c42" opacity="0.9"/>
  <path d="M78 60L90 76L84 78L76 64Z" fill="#ff8c42" opacity="0.8"/>
</svg>`;
}

function itemName(app: App, item: ShopItem): string {
  return item.kind === 'card' ? (app.engine.pack.cards[item.id]?.name ?? item.id) : (app.engine.pack.keepsakes[item.id]?.name ?? item.id);
}

function priceTag(item: { price: number; sale?: boolean; sold?: boolean }, glimmers: number): HTMLElement {
  const short = !item.sold && glimmers < item.price;
  return h(
    'span',
    { class: ['price-tag', short && 'is-short', item.sale && 'is-sale', item.sold && 'is-sold'] },
    item.sold ? h('span', null, 'Sold') : [h('span', { class: 'price-tag__icon', html: resourceIcon('glimmer') }), h('span', { class: 'num' }, String(item.price))],
    short ? h('span', { class: 'price-tag__need' }, `need ${item.price - glimmers}`) : null,
  );
}

export function shopScreen(app: App): ScreenController {
  const top = createTopBar(app);
  const bubble = h('div', { class: 'mo-bubble' });
  const services = h('div', { class: 'shop-services' });
  const leaveBtn = h('button', { class: 'btn shop-leave', attrs: { type: 'button' } }, 'Leave', h('span', { class: 'kbd' }, 'L'));
  const shelves = h('div', { class: 'shop-shelves' });
  const mixHost = h('div', { class: 'shop-mix' });
  const body = h(
    'div',
    { class: 'shop-layout' },
    h(
      'aside',
      { class: 'shop-counter' },
      h('h1', { class: 'screen__title shop-title' }, 'Sanctuary'),
      h('div', { class: 'mo' }, bubble, h('div', { class: 'mo__heron', html: heronMarkup() }), h('span', { class: 'mo__name muted' }, 'Mo, keeper of the Sanctuary')),
      services,
      leaveBtn,
    ),
    h('main', { class: 'shop-main', attrs: { 'aria-label': 'Shelves' } }, shelves, mixHost),
  );
  const el = h('div', { class: 'screen shop-screen' }, top.el, body);
  let hoverDef: CardDef | null = null;
  let lastFocus: string | null = null;

  const stockOf = (): ShopStock | null => (app.state?.phase.kind === 'shop' ? app.state.phase.stock : null);

  function renderMix(s: GameState): void {
    mixHost.innerHTML = lightMixFor(app.engine, s, hoverDef ?? undefined, true);
    mixHost.querySelector('button')?.addEventListener('click', () => app.openOverlay('deck'));
  }

  function buy(slot: number): void {
    if (!app.isLegal({ t: 'buy', slot })) {
      uiSound(app, 'notEnough');
      return;
    }
    uiSound(app, 'glimmer');
    lastFocus = `slot-${slot}`;
    hoverDef = null;
    void app.dispatch({ t: 'buy', slot });
  }

  function itemCell(s: GameState, item: ShopItem, slot: number): HTMLElement {
    const legal = app.isLegal({ t: 'buy', slot });
    const name = itemName(app, item);
    const state = item.sold ? 'Sold.' : legal ? `Buy for ${item.price} Glimmers.` : `${item.price} Glimmers, you have ${s.run.glimmers}.`;
    let face: HTMLElement;
    if (item.kind === 'card') {
      const def = app.engine.pack.cards[item.id];
      face = cardElement(app.engine, { defId: item.id, upgraded: false }, { tag: 'button', className: 'shop-card', state: legal ? 'idle' : 'unaffordable' });
      face.setAttribute('aria-label', `${name}${item.sale ? ', on sale' : ''}. ${app.engine.describeCard(item.id, false)} ${state}`);
      face.addEventListener('pointerenter', () => {
        hoverDef = item.sold ? null : (def ?? null);
        renderMix(s);
      });
      face.addEventListener('pointerleave', () => {
        hoverDef = null;
        renderMix(s);
      });
    } else {
      const def = app.engine.pack.keepsakes[item.id];
      face = h('button', { class: 'shop-keepsake', attrs: { type: 'button', 'aria-label': `${name}${item.sale ? ', on sale' : ''}. ${def?.text ?? ''} ${state}` } }, keepsakeFace(app.engine, item.id));
    }
    face.dataset.focusKey = `slot-${slot}`;
    if (item.sold || !legal) face.setAttribute('aria-disabled', 'true');
    face.addEventListener('click', () => (item.sold ? undefined : buy(slot)));
    return h(
      'div',
      { class: ['shop-item', `shop-item--${item.kind}`, item.sold && 'is-sold', !legal && !item.sold && 'is-short'] },
      item.sale && !item.sold ? h('span', { class: 'shop-item__sale caps' }, 'Sale') : null,
      face,
      item.sold ? h('span', { class: 'shop-item__stamp caps', attrs: { 'aria-hidden': 'true' } }, 'Sold') : null,
      priceTag(item, s.run.glimmers),
    );
  }

  function shelf(title: string, cells: HTMLElement[], cls = ''): HTMLElement | null {
    if (cells.length === 0) return null;
    return h('section', { class: ['shop-shelf', cls] }, h('h2', { class: 'eyebrow' }, title), h('div', { class: 'shop-shelf__row' }, cells));
  }

  function serviceButton(s: GameState, stock: ShopStock, id: 'remove' | 'talk'): HTMLElement {
    const legal = app.isLegal({ t: 'service', id });
    const used = id === 'remove' ? stock.removeUsed : stock.talkUsed;
    const price = id === 'remove' ? stock.removePrice : stock.talkPrice;
    const title = id === 'remove' ? 'Set Down a card' : 'Talk it through';
    const what = id === 'remove' ? 'Remove a card of your choice from your deck.' : 'Tend a Buried card of your choice.';
    const hasBuried = s.run.deck.some((c) => app.engine.pack.cards[c.defId]?.buried);
    const reason = legal
      ? null
      : used
        ? 'Used this visit'
        : s.run.glimmers < price
          ? `Need ${price - s.run.glimmers} more Glimmers`
          : id === 'talk' && !hasBuried
            ? 'Nothing is Buried right now'
            : 'Not possible right now';
    const btn = h(
      'button',
      {
        class: ['btn', 'btn--stack', 'shop-service'],
        attrs: { type: 'button', 'aria-disabled': legal ? null : 'true', 'aria-label': `${title}, ${price} Glimmers. ${what}${reason ? ` ${reason}.` : ''}` },
        dataset: { focusKey: `service-${id}` },
        on: {
          click: () => {
            if (!legal) {
              uiSound(app, 'notEnough');
              return;
            }
            uiSound(app, 'confirm');
            void app.dispatch({ t: 'service', id });
          },
        },
      },
      h('span', { class: 'shop-service__head' }, h('span', null, title), priceTag({ price, sold: used }, s.run.glimmers)),
      h('span', { class: 'btn__sub' }, reason ?? what),
    );
    return btn;
  }

  function render(): void {
    const s = app.state;
    const stock = stockOf();
    if (!s || !stock) return;
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.focusKey ?? lastFocus;
    bubble.textContent = stock.line;
    const cells = stock.items.map((item, slot) => ({ item, slot, el: itemCell(s, item, slot) }));
    const lightsOf = (id: string): number => app.engine.pack.cards[id]?.lights.length ?? 0;
    const lightCards = cells.filter((c) => c.item.kind === 'card' && lightsOf(c.item.id) === 1).map((c) => c.el);
    const blends = cells.filter((c) => c.item.kind === 'card' && lightsOf(c.item.id) === 2).map((c) => c.el);
    const neutral = cells.filter((c) => c.item.kind === 'card' && lightsOf(c.item.id) === 0).map((c) => c.el);
    const keepsakes = cells.filter((c) => c.item.kind === 'keepsake').map((c) => c.el);
    shelves.replaceChildren(
      ...[
        shelf('Light cards', lightCards, 'shop-shelf--lights'),
        h(
          'div',
          { class: 'shop-shelves__pair' },
          shelf(neutral.length ? 'Blends and neutral' : 'Blends', [...blends, ...neutral], 'shop-shelf--blends'),
          shelf('Keepsakes', keepsakes, 'shop-shelf--keepsakes'),
        ),
      ].filter((x): x is HTMLElement => !!x),
    );
    services.replaceChildren(h('h2', { class: 'eyebrow' }, 'Services'), serviceButton(s, stock, 'remove'), serviceButton(s, stock, 'talk'));
    renderMix(s);
    requestAnimationFrame(() => {
      fitCards(shelves);
      const target = focused ? el.querySelector<HTMLElement>(`[data-focus-key="${focused}"]`) : null;
      (target ?? el.querySelector<HTMLElement>('.shop-item button:not([aria-disabled="true"])') ?? leaveBtn).focus({ preventScroll: true });
    });
  }

  leaveBtn.addEventListener('click', () => {
    uiSound(app, 'confirm');
    void app.dispatch({ t: 'leave' });
  });
  fadeIn(el, app);

  let signature = '';
  return {
    el,
    update(a) {
      top.update(a);
      const s = a.state;
      const stock = stockOf();
      if (!s || !stock) return;
      const sig = `${s.run.glimmers}:${stock.items.map((i) => (i.sold ? 1 : 0)).join('')}:${stock.removeUsed}:${stock.talkUsed}:${s.run.deck.length}`;
      if (sig === signature) return;
      signature = sig;
      render();
    },
    onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (e.key.toLowerCase() === 'l') {
        leaveBtn.click();
        return true;
      }
      const buttons = [...shelves.querySelectorAll<HTMLElement>('.shop-item > button')];
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, buttons.length)) {
        buttons[n - 1]!.focus();
        return true;
      }
      if (arrowFocus(e, body)) return true;
      if (e.key === 'Enter' && !focusedControl(el)) {
        leaveBtn.focus();
        return true;
      }
      return false;
    },
  };
}
