// Title screen (DESIGN 16.3): serif name, tagline, the premise on first launch, a slow ink-water background
// with six faint Light motes, and Continue / New Run / Codex / Settings. A fresh profile's New Run is the
// tutorial, which starts inside its first combat.

import { LIGHTS } from '../../engine/index';
import { GAME_TITLE, TAGLINE, TITLE_PREMISE } from '../../content/index';
import type { App, ScreenController } from '../app';
import { h, replaceChildren } from '../dom';
import { sigil } from '../kit/sigils';
import { wandererMarkup } from '../kit/player';
import { arrowFocus, focusedControl } from '../components/cardGrid';
import { audioOf, fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

/** Where the six faint Light motes drift, away from the text column. */
const MOTE_SPOTS: [string, string][] = [
  ['14%', '22%'],
  ['80%', '16%'],
  ['88%', '52%'],
  ['70%', '78%'],
  ['24%', '62%'],
  ['8%', '44%'],
];

function inkWater(): HTMLElement {
  const motes = LIGHTS.map((l, i) =>
    h('span', {
      class: 'title-mote',
      dataset: { light: l },
      style: { '--i': String(i), left: MOTE_SPOTS[i]![0], top: MOTE_SPOTS[i]![1] } as Record<string, string>,
      html: sigil(l),
    }),
  );
  return h(
    'div',
    { class: 'ink-water', attrs: { 'aria-hidden': 'true' } },
    h('div', { class: 'ink-water__blob ink-water__blob--a' }),
    h('div', { class: 'ink-water__blob ink-water__blob--b' }),
    h('div', { class: 'ink-water__blob ink-water__blob--c' }),
    h('div', { class: 'ink-water__ripples' }),
    ...motes,
  );
}

export function titleScreen(app: App): ScreenController {
  const firstLaunch = app.profile.stats.runs === 0 && !app.hasSave();
  const defaultTutorial = app.options.tutorial ?? !app.profile.tutorialDone;
  let tutorial = defaultTutorial;
  let confirming = false;
  /** Shown under the menu when a saved run could not be read. */
  let notice: string | null = null;

  const menu = h('nav', { class: 'title-menu', attrs: { 'aria-label': 'Main menu' } });
  const el = h(
    'div',
    { class: 'screen title-screen' },
    inkWater(),
    h(
      'main',
      { class: 'title-screen__main' },
      h('h1', { class: 'title-screen__name' }, GAME_TITLE),
      h('p', { class: 'title-screen__tagline' }, TAGLINE),
      firstLaunch ? h('p', { class: 'title-screen__premise' }, TITLE_PREMISE) : null,
      menu,
    ),
    h('div', { class: 'title-screen__wanderer', html: wandererMarkup({ note: [], compass: false, size: 'calc(var(--u) * 150)', label: 'You, with your lantern' }) }),
    h('p', { class: 'title-screen__hint muted' }, 'Keys: Up and Down to choose, Enter to go, M to mute'),
  );

  const start = (tut: boolean): void => {
    audioOf(app).unlock?.();
    uiSound(app, 'confirm');
    app.newRun({ tutorial: tut });
  };

  const button = (label: string, onClick: () => void, cls = '', sub?: string): HTMLButtonElement =>
    h(
      'button',
      { class: ['btn', 'title-menu__btn', cls], attrs: { type: 'button' }, on: { click: onClick, pointerenter: () => uiSound(app, 'hover') } },
      h('span', null, label),
      sub ? h('span', { class: 'btn__sub' }, sub) : null,
    );

  function renderMenu(): void {
    if (confirming) {
      replaceChildren(
        menu,
        h('p', { class: 'title-menu__confirm' }, 'Start a new run? The one in progress will end.'),
        button('Start a new run', () => start(tutorial), 'btn--primary'),
        button('Keep my run', () => {
          confirming = false;
          uiSound(app, 'cancel');
          renderMenu();
          (menu.querySelector('button') as HTMLElement | null)?.focus();
        }),
      );
      (menu.querySelector('.btn--primary') as HTMLElement | null)?.focus();
      return;
    }
    const hasSave = app.hasSave();
    notice = app.saveNotice ?? notice;
    app.saveNotice = null;
    const newRun = (): void => {
      if (app.hasSave()) {
        confirming = true;
        renderMenu();
      } else start(tutorial);
    };
    const newLabel = firstLaunch && tutorial ? 'Begin' : 'New Run';
    const toggle =
      app.storageOk
        ? h(
            'label',
            { class: 'title-toggle' },
            h('input', {
              attrs: { type: 'checkbox' },
              checked: tutorial,
              on: {
                change: (e: Event) => {
                  tutorial = (e.target as HTMLInputElement).checked;
                  renderMenu();
                  (menu.querySelector('.title-toggle input') as HTMLElement | null)?.focus();
                },
              },
            }),
            h('span', null, 'Tutorial run'),
          )
        : null;
    replaceChildren(
      menu,
      hasSave
        ? button('Continue', () => {
            audioOf(app).unlock?.();
            uiSound(app, 'confirm');
            if (!app.continueRun()) renderMenu();
          }, 'btn--primary')
        : null,
      notice ? h('p', { class: 'title-menu__notice', attrs: { role: 'status' } }, notice) : null,
      button(newLabel, newRun, hasSave ? '' : 'btn--primary', tutorial ? 'Starts with a short guided fight' : undefined),
      // Blocked storage means the game can't remember a finished tutorial, so offer the way out every time.
      !app.storageOk ? button('Skip tutorial', () => start(false), '', 'Straight to Charm select') : toggle,
      h(
        'div',
        { class: 'title-menu__row' },
        button('Codex', () => app.openOverlay('codex'), 'btn--ghost'),
        button('Settings', () => app.openOverlay('settings'), 'btn--ghost'),
      ),
    );
  }

  renderMenu();
  fadeIn(el, app, 600);
  audioOf(app).ambience?.(null);
  requestAnimationFrame(() => (menu.querySelector('.btn--primary') as HTMLElement | null)?.focus({ preventScroll: true }));

  return {
    el,
    update() {},
    onKey(e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        return arrowFocus(e, menu);
      }
      if ((e.key === 'Enter' || e.key === ' ') && !focusedControl(el)) {
        (menu.querySelector('.btn--primary') as HTMLElement | null)?.click();
        return true;
      }
      if (e.key === 'Escape' && confirming) {
        confirming = false;
        renderMenu();
        return true;
      }
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (k === 'c') {
        app.openOverlay('codex');
        return true;
      }
      if (k === 's') {
        app.openOverlay('settings');
        return true;
      }
      return false;
    },
  };
}
