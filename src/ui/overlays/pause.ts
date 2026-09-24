// Pause (DESIGN 16.6, 19: Esc with nothing selected): Resume, Settings, Codex, quit to the title (the run
// is saved) and Abandon run behind a confirm step.

import type { App, ScreenController } from '../app';
import { h, replaceChildren } from '../dom';
import { arrowFocus } from '../components/cardGrid';
import { uiSound } from '../components/titleCard';
import { overlayFrame } from './deck';
import { openSettingsFrom } from './settings';
import '../styles/overlays.css';

export function pauseOverlay(app: App): ScreenController {
  const frame = overlayFrame(app, 'Paused', 'pause');
  const list = h('div', { class: 'pause-list' });
  frame.body.append(list);
  let confirming = false;

  const item = (label: string, sub: string | null, onClick: () => void, cls = ''): HTMLButtonElement =>
    h('button', { class: ['btn', 'btn--stack', 'pause-btn', cls], attrs: { type: 'button' }, on: { click: onClick } }, h('span', null, label), sub ? h('span', { class: 'btn__sub' }, sub) : null);

  function render(): void {
    if (confirming) {
      replaceChildren(
        list,
        h('p', { class: 'pause-confirm' }, 'Abandon this run? Your Heart, deck and Keepsakes from it will be gone.'),
        item('Yes, abandon it', null, () => {
          uiSound(app, 'cancel');
          app.abandonRun();
        }, 'pause-btn--danger'),
        item('Keep going', null, () => {
          confirming = false;
          render();
        }, 'btn--primary'),
      );
      list.querySelector<HTMLElement>('.btn--primary')?.focus();
      return;
    }
    const s = app.state;
    const where = s ? `Act ${s.run.act}, ${s.run.floor === 0 ? 'at the start' : `floor ${s.run.floor}`}. Heart ${s.combat?.player.hp ?? s.run.heart}/${s.run.maxHeart}.` : '';
    replaceChildren(
      list,
      where ? h('p', { class: 'pause-where muted' }, where) : null,
      item('Resume', null, () => app.closeOverlay(), 'btn--primary'),
      item('Settings', null, () => openSettingsFrom(app, 'pause')),
      item('Codex', null, () => app.openOverlay('codex', 'pause')),
      item('Quit to title', 'Your run is saved', () => app.toTitle()),
      item('Abandon run', 'Ends this run for good', () => {
        confirming = true;
        render();
      }, 'pause-btn--quiet'),
    );
    requestAnimationFrame(() => list.querySelector<HTMLElement>('.btn--primary')?.focus({ preventScroll: true }));
  }

  render();
  return {
    el: frame.el,
    update() {},
    onKey(e) {
      if (frame.trapTab(e)) return true;
      if (e.key === 'Escape' && confirming) {
        confirming = false;
        render();
        return true;
      }
      if (arrowFocus(e, list)) return true;
      return false;
    },
  };
}
