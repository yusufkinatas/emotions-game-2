// Codex (DESIGN 16.6): four tabs. 1: the 6x6 type chart with x2 / x1/2 marks and the bad-advice lines.
// 2: Blends, the two-faced Shades and which Blend answers each. 3: afflictions. 4: rules and words.
// Keys: 1-4 or Left/Right on the tabs switch tabs; Esc or C closes.

import type { AfflictionId, Light, Shade } from '../../engine/index';
import { AFFLICTIONS, BLENDS, LIGHTS, SHADES, blendOf, cureOf, dissonantLightOf, lightsOfBlend } from '../../engine/index';
import { AFFLICTION_INFO, BAD_ADVICE, BLEND_INFO, CODEX_RULES, GLOSSARY } from '../../content/index';
import type { App, ScreenController } from '../app';
import { h } from '../dom';
import { BLEND_NAME, LIGHT_NAME, SHADE_NAME } from '../kit/names';
import { markIcon, sigil } from '../kit/sigils';
import { afflictionDrop } from '../kit/widgets';
import { overlayFrame } from './deck';
import '../styles/overlays.css';

type TabId = 'chart' | 'blends' | 'afflictions' | 'rules';
const TABS: [TabId, string][] = [
  ['chart', 'Type chart'],
  ['blends', 'Blends'],
  ['afflictions', 'Afflictions'],
  ['rules', 'Rules'],
];

let lastTab: TabId = 'chart';

const lightHead = (l: Light): HTMLElement => h('span', { class: 'codex-light', dataset: { light: l }, html: `${sigil(l)}<span>${LIGHT_NAME[l]}</span>` });
const shadeHead = (s: Shade): HTMLElement => h('span', { class: 'codex-shade', dataset: { face: s }, html: `${sigil(s)}<span>${SHADE_NAME[s]}</span>` });

function chartTab(app: App): HTMLElement {
  const rules = app.engine.rules;
  const table = h(
    'table',
    { class: 'codex-chart' },
    h('caption', { class: 'sr-only' }, 'Type chart: rows are the Light you play, columns the Shade it meets.'),
    h('thead', null, h('tr', null, h('th', { attrs: { scope: 'col' } }, h('span', { class: 'muted' }, 'Light \\ Shade')), SHADES.map((s) => h('th', { attrs: { scope: 'col' } }, shadeHead(s))))),
    h(
      'tbody',
      null,
      LIGHTS.map((l) =>
        h(
          'tr',
          null,
          h('th', { attrs: { scope: 'row' } }, lightHead(l)),
          SHADES.map((s) => {
            const opposite = cureOf(s) === l;
            const dissonant = dissonantLightOf(s, rules) === l;
            const [mark, text, cls, spoken] = opposite
              ? [markIcon('chevronUp2'), 'x2', 'is-opposite', `OPPOSITE x2: ${LIGHT_NAME[l]} answers ${SHADE_NAME[s]}`]
              : dissonant
                ? [markIcon('chevronDown'), 'x1/2', 'is-dissonant', `DISSONANT x1/2: ${LIGHT_NAME[l]} deepens ${SHADE_NAME[s]}`]
                : ['', 'x1', 'is-neutral', `x1: ${LIGHT_NAME[l]} against ${SHADE_NAME[s]}`];
            return h('td', { class: cls, dataset: opposite ? { light: l } : {}, attrs: { 'aria-label': spoken } }, h('span', { class: 'codex-mark', html: mark }), h('span', null, text));
          }),
        ),
      ),
    ),
  );
  const advice = h(
    'ul',
    { class: 'codex-advice' },
    SHADES.map((s) =>
      h(
        'li',
        null,
        shadeHead(s),
        h('span', { class: 'codex-advice__line' }, `"${BAD_ADVICE[s]}"`),
        h('span', { class: 'muted' }, `${LIGHT_NAME[dissonantLightOf(s, rules)]} alone deepens it: half, and it Flares.`),
      ),
    ),
  );
  return h(
    'div',
    { class: 'codex-tab codex-tab--chart' },
    h('p', { class: 'codex-lead' }, CODEX_RULES[0]?.text ?? ''),
    table,
    h('h3', { class: 'eyebrow' }, 'Bad advice (DISSONANT)'),
    advice,
  );
}

function blendsTab(app: App): HTMLElement {
  const blends = BLENDS.map((b) => {
    const [a, c] = lightsOfBlend(b);
    const info = BLEND_INFO[b];
    const card = app.engine.pack.cards[info.card]?.name ?? info.card;
    const key = app.engine.pack.enemies[info.keyTo]?.name;
    return h(
      'li',
      { class: 'codex-blend', dataset: { light: a, light2: c } },
      h('span', { class: 'codex-blend__swatch', attrs: { 'aria-hidden': 'true' }, html: `<span data-light="${a}">${sigil(a)}</span><span data-light="${c}">${sigil(c)}</span>` }),
      h('span', { class: 'codex-blend__name' }, BLEND_NAME[b]),
      h('span', { class: 'muted' }, `${LIGHT_NAME[a]} + ${LIGHT_NAME[c]}. Card: ${card}${/[.!?]$/.test(card) ? '' : '.'}${key ? ` The key to ${key}.` : ''}`),
    );
  });
  const compounds = Object.values(app.engine.pack.enemies)
    .filter((d) => d.faces.length === 2 && d.tier !== 'minion')
    .map((d) => {
      const [outer, inner] = [d.faces[0]!, d.faces[1]!];
      const b = blendOf(cureOf(outer), cureOf(inner));
      return h(
        'li',
        { class: 'codex-compound' },
        h('span', { class: 'codex-compound__faces' }, shadeHead(outer), h('span', { class: 'muted' }, 'over'), shadeHead(inner)),
        h('span', { class: 'codex-compound__name' }, d.name),
        h('span', null, b ? `Answered by ${BLEND_NAME[b]} (${LIGHT_NAME[cureOf(outer)]} + ${LIGHT_NAME[cureOf(inner)]}), or a Harmonized pair.` : ''),
      );
    });
  return h(
    'div',
    { class: 'codex-tab codex-tab--blends' },
    h('p', { class: 'codex-lead' }, CODEX_RULES.find((r) => r.rule === 'Harmony')?.text ?? ''),
    h('h3', { class: 'eyebrow' }, 'The six Blends'),
    h('ul', { class: 'codex-blends' }, blends),
    h('h3', { class: 'eyebrow' }, 'Two-faced Shades'),
    h('p', { class: 'codex-lead muted' }, CODEX_RULES.find((r) => r.rule === 'Faces')?.text ?? ''),
    h('ul', { class: 'codex-compounds' }, compounds),
  );
}

function afflictionText(app: App, id: AfflictionId | 'numb'): string {
  const raw = app.engine.pack.statuses[id]?.text ?? '';
  return raw.replace(/^(\S+) \{n\}:/, '$1:').replace(/\{n\}/g, 'X');
}

function afflictionsTab(app: App): HTMLElement {
  const ids: (AfflictionId | 'numb')[] = [...AFFLICTIONS, 'numb'];
  return h(
    'div',
    { class: 'codex-tab codex-tab--afflictions' },
    h('p', { class: 'codex-lead' }, CODEX_RULES.find((r) => r.rule === 'Afflictions')?.text ?? ''),
    h(
      'ul',
      { class: 'codex-afflictions' },
      ids.map((id) => {
        const info = AFFLICTION_INFO[id];
        return h(
          'li',
          { class: 'codex-affliction' },
          h('span', { class: 'codex-affliction__drop', html: afflictionDrop(id, { size: 'calc(var(--u) * 34)' }) }),
          h(
            'div',
            null,
            h('strong', null, info.name),
            h('span', { class: 'muted' }, info.from ? ` from ${SHADE_NAME[info.from]}` : ' from Apathy and The Numbness'),
            h('p', null, afflictionText(app, id)),
            info.soothedBy ? h('p', { class: 'codex-affliction__soothe' }, h('span', { class: 'muted' }, 'Soothed by'), lightHead(info.soothedBy)) : h('p', { class: 'muted' }, 'Nothing soothes it. It fades on its own.'),
          ),
        );
      }),
    ),
    h('p', { class: 'muted codex-note' }, 'X is the number of stacks.'),
  );
}

function rulesTab(): HTMLElement {
  return h(
    'div',
    { class: 'codex-tab codex-tab--rules' },
    h('dl', { class: 'codex-rules' }, CODEX_RULES.map((r) => [h('dt', null, r.rule), h('dd', null, r.text)])),
    h('h3', { class: 'eyebrow' }, 'Words'),
    h('dl', { class: 'codex-glossary' }, GLOSSARY.map((g) => [h('dt', null, g.term), h('dd', null, g.meaning)])),
  );
}

export function codexOverlay(app: App): ScreenController {
  const frame = overlayFrame(app, 'Codex', 'overlay__panel--wide codex');
  const tablist = h('div', { class: 'codex-tabs', attrs: { role: 'tablist', 'aria-label': 'Codex sections' } });
  const panel = h('div', { class: 'codex-panel scroll', attrs: { role: 'tabpanel', tabindex: 0 } });
  frame.body.append(tablist, panel);
  let tab: TabId = lastTab;

  function select(t: TabId, focus = false): void {
    tab = t;
    lastTab = t;
    tablist.replaceChildren(
      ...TABS.map(([id, label], i) => {
        const b = h(
          'button',
          {
            class: ['codex-tabs__tab', id === tab && 'is-active'],
            attrs: { type: 'button', role: 'tab', 'aria-selected': id === tab ? 'true' : 'false', tabindex: id === tab ? 0 : -1, id: `codex-tab-${id}` },
            on: { click: () => select(id, true) },
          },
          h('span', { class: 'kbd', attrs: { 'aria-hidden': 'true' } }, String(i + 1)),
          label,
        );
        return b;
      }),
    );
    panel.setAttribute('aria-labelledby', `codex-tab-${tab}`);
    panel.replaceChildren(tab === 'chart' ? chartTab(app) : tab === 'blends' ? blendsTab(app) : tab === 'afflictions' ? afflictionsTab(app) : rulesTab());
    panel.scrollTop = 0;
    if (focus) tablist.querySelector<HTMLElement>('.is-active')?.focus();
  }

  select(tab);
  requestAnimationFrame(() => tablist.querySelector<HTMLElement>('.is-active')?.focus({ preventScroll: true }));

  return {
    el: frame.el,
    update() {},
    onKey(e) {
      if (frame.trapTab(e)) return true;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= TABS.length) {
        select(TABS[n - 1]![0], true);
        return true;
      }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && tablist.contains(document.activeElement)) {
        const i = TABS.findIndex(([id]) => id === tab);
        const j = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
        select(TABS[j]![0], true);
        return true;
      }
      if (e.key === 'ArrowDown' && tablist.contains(document.activeElement)) {
        panel.focus();
        return true;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        panel.scrollBy({ top: (e.key === 'ArrowUp' ? -1 : 1) * 80 });
        return true;
      }
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        app.closeOverlay();
        return true;
      }
      return false;
    },
  };
}
