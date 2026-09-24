// Charm select (DESIGN 16.3, 9.2): four large Charm cards, each with its effect and the card it adds.
// Keys 1-4 choose a Charm, Enter takes the chosen one; a click takes it at once.

import type { App, ScreenController } from '../app';
import { h } from '../dom';
import { fitCards } from '../kit/cardFace';
import { cardElement } from '../components/cards';
import { arrowFocus, focusedControl } from '../components/cardGrid';
import { keepsakeFace } from '../components/keepsakes';
import { fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

export function charmScreen(app: App): ScreenController {
  const row = h('div', { class: 'charm-row', attrs: { role: 'list' } });
  const el = h(
    'div',
    { class: 'screen charm-screen' },
    h(
      'div',
      { class: 'screen__body charm-screen__body' },
      h('h1', { class: 'screen__title' }, 'Choose a Charm'),
      h('p', { class: 'screen__subtitle' }, 'It stays with you for the whole run and adds one card to your deck.'),
      row,
      h('p', { class: 'screen__hint muted' }, h('span', { class: 'kbd' }, '1'), '-', h('span', { class: 'kbd' }, '4'), ' choose, ', h('span', { class: 'kbd' }, 'Enter'), ' take'),
    ),
  );

  const pick = (i: number): void => {
    uiSound(app, 'confirm');
    void app.dispatch({ t: 'pickCharm', i });
  };

  let built = '';
  return {
    el,
    update(a) {
      const s = a.state;
      if (!s || s.phase.kind !== 'charmSelect') return;
      const key = s.phase.options.join(',');
      if (key === built) return;
      built = key;
      row.replaceChildren();
      s.phase.options.forEach((id, i) => {
        const def = a.engine.pack.keepsakes[id];
        const added = def?.addsCard;
        const addedName = added ? a.engine.pack.cards[added]?.name : undefined;
        const btn = h(
          'button',
          {
            class: 'charm-card',
            attrs: {
              type: 'button',
              role: 'listitem',
              'aria-label': `${i + 1}. ${def?.name ?? id}. ${def?.text ?? ''}${addedName ? ` Adds ${addedName} to your deck.` : ''}`,
            },
            on: { click: () => pick(i), pointerenter: () => uiSound(a, 'hover') },
          },
          h('span', { class: 'charm-card__key kbd', attrs: { 'aria-hidden': 'true' } }, String(i + 1)),
          keepsakeFace(a.engine, id),
          added
            ? h(
                'span',
                { class: 'charm-card__adds' },
                h('span', { class: 'eyebrow' }, 'Adds to your deck'),
                cardElement(a.engine, { defId: added, upgraded: false }, { className: 'charm-card__card' }),
              )
            : null,
        );
        row.append(btn);
      });
      fadeIn(el, a);
      requestAnimationFrame(() => {
        fitCards(row);
        (row.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true });
      });
    },
    onKey(e) {
      const n = Number(e.key);
      const buttons = [...row.querySelectorAll<HTMLButtonElement>('button.charm-card')];
      if (Number.isInteger(n) && n >= 1 && n <= buttons.length) {
        buttons[n - 1]!.focus();
        uiSound(app, 'hover');
        return true;
      }
      if (arrowFocus(e, row, 'button.charm-card')) return true;
      if (e.key === 'Enter' && !focusedControl(el)) {
        buttons[0]?.focus();
        return true;
      }
      return false;
    },
  };
}
