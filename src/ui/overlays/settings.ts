// Settings (DESIGN 16.6, 19): master, SFX, UI and ambience volume, mute (M), animation speed (1x, 2x,
// Instant), motion (system, full, reduced), the colour-blind palette and Reset tips. Every change goes
// through app.setSettings, which saves the profile and re-applies audio and root switches at once.

import type { App, ScreenController, Settings } from '../app';
import { h } from '../dom';
import { overlayFrame } from './deck';
import '../styles/overlays.css';

/** Where Back goes: Pause opens Settings and expects to come back to it. */
let returnTo: 'pause' | null = null;
export function openSettingsFrom(app: App, from: 'pause' | null): void {
  returnTo = from;
  app.openOverlay('settings');
}

type Volume = 'master' | 'sfx' | 'ui' | 'ambience';
const VOLUMES: [Volume, string][] = [
  ['master', 'Master volume'],
  ['sfx', 'Sound effects'],
  ['ui', 'Interface sounds'],
  ['ambience', 'Ambience'],
];

function radioGroup<K extends keyof Settings>(
  app: App,
  key: K,
  label: string,
  options: [Settings[K], string][],
): HTMLElement {
  const name = `set-${String(key)}`;
  return h(
    'fieldset',
    { class: 'settings-group' },
    h('legend', null, label),
    h(
      'div',
      { class: 'settings-seg' },
      options.map(([value, text]) =>
        h(
          'label',
          { class: 'settings-seg__opt' },
          h('input', {
            attrs: { type: 'radio', name, value: String(value) },
            checked: app.profile.settings[key] === value,
            on: { change: () => app.setSettings({ [key]: value } as Partial<Settings>) },
          }),
          h('span', null, text),
        ),
      ),
    ),
  );
}

export function settingsOverlay(app: App): ScreenController {
  const back = (): void => {
    if (returnTo === 'pause' && app.state) {
      returnTo = null;
      app.openOverlay('pause');
    } else {
      returnTo = null;
      app.closeOverlay();
    }
  };
  const frame = overlayFrame(app, 'Settings', 'settings', back);
  const sliders = VOLUMES.map(([key, label]) => {
    const value = h('span', { class: 'settings-slider__v num' });
    const input = h('input', {
      class: 'settings-slider__input',
      attrs: { type: 'range', min: 0, max: 100, step: 5, 'aria-label': label },
      on: { input: (e: Event) => app.setSettings({ [key]: Number((e.target as HTMLInputElement).value) / 100 } as Partial<Settings>) },
    });
    const row = h('label', { class: 'settings-slider' }, h('span', { class: 'settings-slider__k' }, label), input, value);
    return { key, input, value, row };
  });
  const mute = h('input', { attrs: { type: 'checkbox' }, on: { change: (e: Event) => app.setSettings({ muted: (e.target as HTMLInputElement).checked }) } });
  const palette = h('input', {
    attrs: { type: 'checkbox' },
    on: { change: (e: Event) => app.setSettings({ palette: (e.target as HTMLInputElement).checked ? 'cb' : 'default' }) },
  });
  const tipsNote = h('span', { class: 'muted settings-note', attrs: { 'aria-live': 'polite' } });
  const resetTips = h('button', { class: 'btn btn--small', attrs: { type: 'button' } }, 'Reset tips');
  resetTips.addEventListener('click', () => {
    app.tips.reset();
    tipsNote.textContent = 'Tips will show again.';
  });

  const speed = radioGroup(app, 'animSpeed', 'Animation speed', [
    [1, '1x'],
    [2, '2x'],
    [0, 'Instant'],
  ]);
  const motion = radioGroup(app, 'motion', 'Motion', [
    ['system', 'Follow system'],
    ['full', 'Full'],
    ['reduced', 'Reduced'],
  ]);

  frame.body.append(
    h(
      'div',
      { class: 'settings-cols' },
      h(
        'section',
        { class: 'settings-col' },
        h('h3', { class: 'eyebrow' }, 'Sound'),
        ...sliders.map((s) => s.row),
        h('label', { class: 'settings-check' }, mute, h('span', null, 'Mute everything'), h('span', { class: 'kbd' }, 'M')),
        h('p', { class: 'muted settings-note' }, 'Every sound has a visual twin, so muting hides nothing.'),
      ),
      h(
        'section',
        { class: 'settings-col' },
        h('h3', { class: 'eyebrow' }, 'Motion and colour'),
        speed,
        motion,
        h('label', { class: 'settings-check' }, palette, h('span', null, 'Colour-blind palette')),
        h('h3', { class: 'eyebrow' }, 'Guidance'),
        h('div', { class: 'settings-row' }, resetTips, tipsNote),
      ),
    ),
    h('div', { class: 'settings-foot' }, h('button', { class: 'btn', attrs: { type: 'button' }, on: { click: back } }, returnTo === 'pause' ? 'Back' : 'Done')),
  );

  function sync(): void {
    const st = app.profile.settings;
    for (const s of sliders) {
      const v = Math.round(st[s.key] * 100);
      if (document.activeElement !== s.input) s.input.value = String(v);
      s.value.textContent = `${v}%`;
    }
    mute.checked = st.muted;
    palette.checked = st.palette === 'cb';
    for (const input of frame.body.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      const key = input.name.replace('set-', '') as keyof Settings;
      input.checked = String(st[key]) === input.value;
    }
  }

  sync();
  requestAnimationFrame(() => sliders[0]?.input.focus({ preventScroll: true }));

  return {
    el: frame.el,
    update() {
      sync();
    },
    onKey(e) {
      if (frame.trapTab(e)) return true;
      if (e.key === 'Escape') {
        back();
        return true;
      }
      // Sliders and radios use the arrow keys themselves.
      return false;
    },
  };
}
