// Act title cards ("The wheel closes", "The Deep", DESIGN 15.1) and gentle screen fades.
// Everything is timed through app.dur(), so the speed setting and click-to-skip apply.

import type { App } from '../app';
import { h } from '../dom';
import '../styles/screens.css';

export interface TitleCardText {
  title: string;
  text: string;
}

type AudioLike = {
  ui?: (k: string) => void;
  ambience?: (a: 1 | 2 | 'deep' | null) => void;
  unlock?: () => void;
  glimmers?: (n: number) => void;
  wheelCloses?: () => void;
};

/** The installed synth (app.audio is typed loosely by the shell). Every method may be missing in tests. */
export const audioOf = (app: App): AudioLike => app.audio as unknown as AudioLike;

export type UiSoundKind = 'hover' | 'confirm' | 'cancel' | 'play' | 'notEnough' | 'glimmer';

/** A UI sound through the synth, if one is installed. */
export function uiSound(app: App, kind: UiSoundKind): void {
  audioOf(app).ui?.(kind);
}

/** Ambience for a run act (3 = The Deep), or null for silence. */
export function ambienceFor(app: App, act: 1 | 2 | 3 | null): void {
  audioOf(app).ambience?.(act === 3 ? 'deep' : act);
}

let active: { el: HTMLElement; finish: () => void } | null = null;

/**
 * Show a full-screen title card over everything but coach marks. Resolves when it has faded out, or at once
 * when it is clicked, or Enter, Space or Escape is pressed.
 */
export function showTitleCard(app: App, card: TitleCardText, holdMs = 2200): Promise<void> {
  active?.finish();
  const hold = app.dur(holdMs);
  return new Promise((resolve) => {
    const el = h(
      'div',
      { class: 'title-card', attrs: { role: 'dialog', 'aria-live': 'assertive', 'aria-label': `${card.title}. ${card.text}` } },
      h('div', { class: 'title-card__rule', attrs: { 'aria-hidden': 'true' } }),
      h('h2', { class: 'title-card__title' }, card.title),
      h('p', { class: 'title-card__text' }, card.text),
      h('div', { class: 'title-card__rule', attrs: { 'aria-hidden': 'true' } }),
      h('p', { class: 'title-card__skip muted' }, 'Click or press Enter to continue'),
    );
    let done = false;
    const timers: number[] = [];
    const finish = (): void => {
      if (done) return;
      done = true;
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener('keydown', onKey, true);
      el.classList.add('is-leaving');
      const out = app.dur(420);
      if (active?.el === el) active = null;
      setTimeout(() => {
        el.remove();
        resolve();
      }, out);
    };
    const onKey = (e: KeyboardEvent): void => {
      // The card owns the keyboard while it is up so nothing underneath reacts.
      e.stopPropagation();
      e.preventDefault();
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') finish();
    };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      finish();
    });
    window.addEventListener('keydown', onKey, true);
    app.root.append(el);
    active = { el, finish };
    if (hold === 0) {
      finish();
      return;
    }
    timers.push(window.setTimeout(finish, hold + app.dur(500)));
  });
}

/** Fade a freshly mounted screen in (opacity only, so it is fine under reduced motion). */
export function fadeIn(el: HTMLElement, app: App, ms = 260): void {
  const d = app.dur(ms);
  if (d === 0) return;
  el.style.setProperty('--fade-ms', `${d}ms`);
  el.classList.add('screen-fade');
  setTimeout(() => el.classList.remove('screen-fade'), d + 50);
}
