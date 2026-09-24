// Haven (DESIGN 14, 16.6): choose one of Rest, Kindle or Reflect. Outcomes and availability come from
// engine.havenOptions ("Rest: Heart 40 -> 61"); unavailable options show the engine's reason.

import type { HavenOptionView } from '../../engine/index';
import type { App, ScreenController } from '../app';
import { h } from '../dom';
import { markIcon, resourceIcon, sigil } from '../kit/sigils';
import { SHADE_NAME } from '../kit/names';
import { createTopBar } from '../components/topBar';
import { arrowFocus, focusedControl } from '../components/cardGrid';
import { fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

/** A small campfire under the lantern light. Decorative; the flames flicker unless motion is reduced. */
export function campfireMarkup(): string {
  return `<svg class="campfire" viewBox="0 0 220 150" aria-hidden="true" focusable="false">
  <defs><radialGradient id="hv-glow" cx="50%" cy="70%" r="55%"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.45"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="110" cy="112" rx="108" ry="40" fill="url(#hv-glow)"/>
  <ellipse cx="110" cy="132" rx="70" ry="9" fill="rgb(0 0 0 / 0.4)"/>
  <path d="M60 128L150 112M70 112L160 130" stroke="#5b4636" stroke-width="10" stroke-linecap="round"/>
  <g class="campfire__flames">
    <path class="campfire__flame campfire__flame--a" d="M110 118C88 110 90 84 104 66C104 82 116 84 114 62C132 80 136 110 110 118Z" fill="#ff8c42"/>
    <path class="campfire__flame campfire__flame--b" d="M110 118C98 112 98 96 108 86C110 96 118 96 118 86C126 98 124 114 110 118Z" fill="#ffd23f"/>
  </g>
  <circle cx="84" cy="54" r="1.6" fill="#ffd23f" class="campfire__spark"/>
  <circle cx="132" cy="40" r="1.2" fill="#ffcf8a" class="campfire__spark campfire__spark--b"/>
</svg>`;
}

const ICONS: Record<HavenOptionView['id'], string> = {
  rest: resourceIcon('heart'),
  kindle: markIcon('sunburst'),
  reflect: markIcon('seal'),
};

const TITLES: Record<HavenOptionView['id'], string> = { rest: 'Rest', kindle: 'Kindle', reflect: 'Reflect' };

export function havenScreen(app: App): ScreenController {
  const top = createTopBar(app);
  const row = h('div', { class: 'haven-options', attrs: { role: 'list' } });
  const walkOn = h('button', { class: 'btn', attrs: { type: 'button', hidden: true } }, 'Walk on');
  const body = h(
    'div',
    { class: 'screen__body haven-body' },
    h('div', { class: 'haven-art', html: campfireMarkup() }),
    h('h1', { class: 'screen__title' }, 'Haven'),
    h('p', { class: 'screen__subtitle' }, 'A warm place to stop for a while. Choose one.'),
    row,
    walkOn,
  );
  const el = h('div', { class: 'screen haven-screen' }, top.el, body);

  walkOn.addEventListener('click', () => void app.dispatch({ t: 'leave' }));

  function outcome(o: HavenOptionView): (HTMLElement | string)[] {
    const s = app.state!;
    if (o.id === 'rest') {
      const pct = app.engine.rules.havenRestPct;
      return [
        h('span', { class: 'haven-option__result num' }, `Heart ${s.run.heart} -> ${o.heartAfter ?? s.run.heart}`),
        h('span', { class: 'haven-option__what' }, `Mend ${pct}% of your max Heart.`),
      ];
    }
    if (o.id === 'kindle') {
      return [h('span', { class: 'haven-option__result' }, 'Upgrade a card'), h('span', { class: 'haven-option__what' }, 'Pick any card and see it before and after.')];
    }
    const buried = s.run.deck.filter((c) => app.engine.pack.cards[c.defId]?.buried);
    return [
      h('span', { class: 'haven-option__result' }, 'Tend a Buried card'),
      buried.length
        ? h(
            'span',
            { class: 'haven-option__buried' },
            buried.map((c) => {
              const shade = app.engine.pack.cards[c.defId]!.buried!.shade;
              const w = c.weight ?? 1;
              return h('span', { class: 'haven-buried', dataset: { face: shade } }, h('span', { class: 'haven-buried__sigil', html: sigil(shade) }), `${SHADE_NAME[shade]} W${w} -> ${w > 1 ? `W${w - 1}` : 'Insight'}`);
            }),
          )
        : null,
      h('span', { class: 'haven-option__what' }, 'Any type. At Weight 0 it becomes Insight.'),
    ].filter((x): x is HTMLElement => !!x);
  }

  let signature = '';
  function render(): void {
    const s = app.state;
    if (!s || s.phase.kind !== 'haven') return;
    const options = app.engine.havenOptions(s);
    const sig = JSON.stringify(options) + s.run.heart;
    if (sig === signature) return;
    signature = sig;
    row.replaceChildren(
      ...options.map((o, i) => {
        const legal = o.available && app.isLegal({ t: o.id });
        const label = `${i + 1}. ${TITLES[o.id]}. ${legal ? '' : `${o.reason ?? 'Not available'}.`}`;
        const btn = h(
          'button',
          {
            class: ['haven-option', !legal && 'is-unavailable'],
            dataset: { option: o.id },
            attrs: { type: 'button', role: 'listitem', 'aria-disabled': legal ? null : 'true' },
            on: {
              click: () => {
                if (!legal) {
                  uiSound(app, 'notEnough');
                  return;
                }
                uiSound(app, 'confirm');
                void app.dispatch({ t: o.id });
              },
              pointerenter: () => legal && uiSound(app, 'hover'),
            },
          },
          h('span', { class: 'kbd haven-option__key', attrs: { 'aria-hidden': 'true' } }, String(i + 1)),
          h('span', { class: 'haven-option__icon', html: ICONS[o.id] }),
          h('span', { class: 'haven-option__title' }, TITLES[o.id]),
          ...(legal ? outcome(o) : [h('span', { class: 'haven-option__reason' }, o.reason ?? 'Not available')]),
        );
        const spoken = [...btn.children].filter((c) => c.getAttribute('aria-hidden') !== 'true').map((c) => c.textContent).filter(Boolean);
        btn.setAttribute('aria-label', legal ? `${i + 1}. ${spoken.join('. ')}` : label);
        return btn;
      }),
    );
    walkOn.hidden = !app.isLegal({ t: 'leave' });
    requestAnimationFrame(() => {
      const first = row.querySelector<HTMLElement>('.haven-option:not([aria-disabled="true"])') ?? walkOn;
      if (!el.contains(document.activeElement)) first.focus({ preventScroll: true });
    });
  }

  fadeIn(el, app);
  return {
    el,
    update(a) {
      top.update(a);
      render();
    },
    onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const buttons = [...row.querySelectorAll<HTMLElement>('.haven-option')];
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= buttons.length) {
        buttons[n - 1]!.focus();
        return true;
      }
      if (arrowFocus(e, body)) return true;
      if (e.key === 'Enter' && !focusedControl(el)) {
        (row.querySelector<HTMLElement>('.haven-option:not([aria-disabled="true"])') ?? walkOn).focus();
        return true;
      }
      return false;
    },
  };
}
