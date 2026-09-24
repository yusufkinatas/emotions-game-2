// Top bar (DESIGN 16.1): Heart, Glimmers, Keepsakes, Act and floor, deck count, Numbness meter,
// Codex and Settings buttons. Used by combat, map and every run screen.
// STUB: implemented by the combat-screen agent.
import type { App } from '../app';
import { h } from '../dom';

export interface TopBar {
  el: HTMLElement;
  update(app: App): void;
}

export function createTopBar(_app: App): TopBar {
  const el = h('header', { class: 'top-bar' });
  return {
    el,
    update(app) {
      const s = app.state;
      el.textContent = s ? `Heart ${s.combat?.player.hp ?? s.run.heart}/${s.run.maxHeart}  Glimmers ${s.run.glimmers}` : '';
    },
  };
}
