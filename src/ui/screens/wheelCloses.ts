// "The wheel closes" (DESIGN 12.5, 15.1, 18.1): a 1.5 s cinematic (Hope and Calm ignite on a big Compass,
// the three new Blend edges light, the wheelCloses chord), then the 1-of-3 Hope or Calm card choice.

import type { Light } from '../../engine/index';
import { LIGHTS } from '../../engine/index';
import { TITLE_CARDS } from '../../content/index';
import type { App, ScreenController } from '../app';
import { h } from '../dom';
import { fitCards } from '../kit/cardFace';
import { renderCompass } from '../kit/compass';
import { createTopBar } from '../components/topBar';
import { cardChoiceRow } from '../components/cards';
import { arrowFocus, focusedControl, lightMixFor } from '../components/cardGrid';
import { audioOf, fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

/** The Blend edges that only exist once Hope and Calm are awake. */
const NEW_EDGES: [Light, Light][] = [
  ['courage', 'hope'],
  ['hope', 'calm'],
  ['calm', 'love'],
];

export function wheelClosesScreen(app: App): ScreenController {
  const top = createTopBar(app);
  const compassHost = h('div', { class: 'wheel-compass' });
  const heading = h('div', { class: 'wheel-heading' }, h('h1', { class: 'screen__title wheel-title' }, TITLE_CARDS.wheelCloses.title), h('p', { class: 'screen__subtitle wheel-sub' }, TITLE_CARDS.wheelCloses.text));
  const choice = h('div', { class: 'wheel-choice', attrs: { hidden: true } });
  const mixHost = h('div', { class: 'reward-mix wheel-mix' });
  const skipBtn = h('button', { class: 'btn btn--ghost', attrs: { type: 'button' } }, 'Skip', h('span', { class: 'kbd' }, 'S'));
  const body = h('div', { class: 'screen__body wheel-body' }, heading, compassHost, choice);
  const el = h('div', { class: 'screen wheel-screen' }, top.el, body);
  let revealed = false;
  let timer = 0;

  const compassProps = (ignite: boolean) => {
    const s = app.state;
    const owned = LIGHTS.filter((l) => s?.run.deck.some((c) => app.engine.pack.cards[c.defId]?.lights.includes(l)));
    return {
      enabled: true,
      note: [] as Light[],
      harmoniesThisTurn: 0,
      energy: 3,
      maxEnergy: 3,
      hollow: false,
      isolated: false,
      act2Unlocked: true,
      ownedLights: [...owned, 'hope', 'calm'] as Light[],
      activeShades: [],
      glowEdges: NEW_EDGES,
      wheelCloses: ignite,
      size: 'calc(var(--u) * 300)',
    };
  };

  function reveal(): void {
    if (revealed) return;
    revealed = true;
    clearTimeout(timer);
    el.classList.add('is-choosing');
    compassHost.replaceChildren(renderCompass({ ...compassProps(false), size: 'calc(var(--u) * 150)' }));
    choice.hidden = false;
    renderChoice();
    fadeIn(choice, app, 300);
    requestAnimationFrame(() => (choice.querySelector('button.card-face') as HTMLElement | null)?.focus({ preventScroll: true }));
  }

  function renderChoice(): void {
    const s = app.state;
    if (!s || s.phase.kind !== 'wheelCloses') return;
    const row = cardChoiceRow({
      engine: app.engine,
      cards: s.phase.options,
      deck: s.run.deck,
      takenIndex: null,
      locked: false,
      onTake: (i) => {
        uiSound(app, 'confirm');
        void app.dispatch({ t: 'takeCard', i });
      },
      onHover: (def) => {
        mixHost.innerHTML = lightMixFor(app.engine, s, def ?? undefined);
      },
    });
    mixHost.innerHTML = lightMixFor(app.engine, s);
    choice.replaceChildren(
      h('h2', { class: 'eyebrow' }, 'Choose a card of the new Lights'),
      row,
      h('div', { class: 'reward-footer wheel-footer' }, mixHost, h('div', { class: 'reward-footer__actions' }, skipBtn)),
    );
    requestAnimationFrame(() => fitCards(row));
  }

  skipBtn.addEventListener('click', () => {
    uiSound(app, 'cancel');
    void app.dispatch({ t: 'skip' });
  });

  // The cinematic: the ring ignites, the chord sounds, then the choice slides in.
  compassHost.replaceChildren(renderCompass(compassProps(!app.reducedMotion())));
  audioOf(app).wheelCloses?.();
  fadeIn(el, app, 500);
  const hold = app.dur(1500) + app.dur(700);
  if (hold === 0) queueMicrotask(reveal);
  else timer = window.setTimeout(reveal, hold);
  el.addEventListener('pointerdown', () => reveal());

  return {
    el,
    update(a) {
      top.update(a);
    },
    onKey(e) {
      if (!revealed) {
        reveal();
        return true;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const cards = [...choice.querySelectorAll<HTMLElement>('button.card-face')];
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= cards.length) {
        cards[n - 1]!.focus();
        return true;
      }
      if (e.key.toLowerCase() === 's') {
        skipBtn.click();
        return true;
      }
      if (arrowFocus(e, choice)) return true;
      if (e.key === 'Enter' && !focusedControl(el)) {
        cards[0]?.focus();
        return true;
      }
      return false;
    },
    destroy() {
      clearTimeout(timer);
    },
  };
}
