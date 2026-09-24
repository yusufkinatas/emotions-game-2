// Memory events (DESIGN 10, 16.6): a procedural SVG motif panel, the title and italic text, option buttons
// with bracketed results and disabled reasons from engine.eventOptions, then the italic after-line.

import type { EventDef } from '../../engine/index';
import type { App, ScreenController } from '../app';
import { h, replaceChildren } from '../dom';
import { createTopBar } from '../components/topBar';
import { arrowFocus, focusedControl } from '../components/cardGrid';
import { fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

const WATER = `<path d="M0 190C60 180 120 196 180 188C240 180 300 194 360 186V240H0Z" fill="#1b2438"/>
<path d="M20 206H90M150 214H230M270 204H340" stroke="rgb(237 232 245 / 0.12)" stroke-width="2" stroke-linecap="round"/>`;

const REEDS = `<path d="M30 190C28 160 34 130 30 100M44 192C46 166 40 140 46 118M318 190C320 164 314 140 318 112" stroke="#3a4a3a" stroke-width="3" fill="none" stroke-linecap="round"/>`;

/** One small illustrated scene per motif hint (EventDef.motif). Ink shapes with a single warm accent. */
const MOTIFS: Record<string, string> = {
  letter: `${WATER}${REEDS}
<g transform="rotate(-8 180 150)"><rect x="118" y="112" width="124" height="80" rx="6" fill="#efe6d6"/>
<path d="M118 116L180 158L242 116" fill="none" stroke="#b9ab94" stroke-width="3"/>
<circle cx="180" cy="160" r="10" fill="#ff5c8a"/><path d="M175 159.5c0-3 4-4 5-1c1-3 5-2 5 1c0 3-5 6-5 6s-5-3-5-6z" fill="#efe6d6"/></g>`,
  campfire: `<ellipse cx="180" cy="200" rx="170" ry="40" fill="#1a1626"/>
<ellipse cx="180" cy="170" rx="120" ry="60" fill="rgb(255 190 110 / 0.18)"/>
<path d="M140 196L220 180M150 180L230 198" stroke="#5b4636" stroke-width="9" stroke-linecap="round"/>
<path class="event-flicker" d="M180 186C160 178 162 150 176 130C176 148 188 150 186 126C204 146 206 178 180 186Z" fill="#ff8c42"/>
<path d="M60 160a18 22 0 1 1 36 0v30h-36z M270 156a18 22 0 1 1 36 0v34h-36z M100 170a14 18 0 1 1 28 0v22h-28z" fill="#2d2840"/>
<circle cx="78" cy="138" r="3" fill="#f4efe6"/><circle cx="288" cy="134" r="3" fill="#f4efe6"/><circle cx="114" cy="152" r="2.4" fill="#f4efe6"/>`,
  pond: `<ellipse cx="180" cy="170" rx="150" ry="46" fill="#1b2438"/>
<ellipse cx="180" cy="170" rx="150" ry="46" fill="none" stroke="rgb(237 232 245 / 0.12)" stroke-width="2"/>
<path d="M150 150a30 34 0 1 1 60 0v10h-60z" fill="#2d2840"/><circle cx="180" cy="128" r="16" fill="#e9e3d6"/>
<path d="M150 190a30 34 0 1 0 60 0v-10h-60z" fill="#2d2840" opacity="0.5"/><circle cx="180" cy="212" r="16" fill="#e9e3d6" opacity="0.45"/>
<circle cx="174" cy="126" r="2" fill="#15121f"/><circle cx="186" cy="126" r="2" fill="#15121f"/>`,
  balloon: `<path d="M40 200C40 120 90 70 150 70C230 70 300 110 300 200Z" fill="#1d2a22"/>
<path d="M170 200V120" stroke="#3a2e26" stroke-width="12"/>
<path d="M170 130L120 96M170 120L220 90M170 140L240 124" stroke="#3a2e26" stroke-width="5" stroke-linecap="round"/>
<path d="M232 88Q226 110 214 128" stroke="#e9e3d6" stroke-width="1.5" fill="none"/>
<ellipse cx="238" cy="70" rx="18" ry="22" fill="#ff5c8a"/>
<path d="M150 200a16 18 0 1 1 32 0z" fill="#3b3656"/><circle cx="160" cy="190" r="2" fill="#f4efe6"/><circle cx="172" cy="190" r="2" fill="#f4efe6"/>`,
  teapot: `<rect x="40" y="186" width="280" height="12" rx="4" fill="#3a2e26"/>
<path d="M140 184C130 150 150 130 180 130C210 130 230 150 220 184Z" fill="#e9e3d6"/>
<path d="M220 150C240 150 244 172 226 178" fill="none" stroke="#e9e3d6" stroke-width="7"/>
<path d="M140 160L110 146L116 156L138 170Z" fill="#e9e3d6"/>
<rect x="168" y="120" width="24" height="10" rx="4" fill="#e9e3d6"/>
<path class="event-steam" d="M112 136C104 124 118 116 110 104M122 132C116 120 128 114 122 102" stroke="rgb(237 232 245 / 0.4)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M260 184a24 18 0 0 1 48 0z" fill="#4a5a44"/><circle cx="302" cy="170" r="7" fill="#4a5a44"/>`,
  well: `<ellipse cx="180" cy="200" rx="160" ry="30" fill="#1a1626"/>
<rect x="120" y="140" width="120" height="60" rx="6" fill="#4a4460"/>
<path d="M120 150H240M120 170H240M150 140V200M200 140V200" stroke="#3a3452" stroke-width="3"/>
<path d="M126 140V80M234 140V80M116 82H244" stroke="#5b4636" stroke-width="7" stroke-linecap="round"/>
<path d="M180 82V118" stroke="#b9ab94" stroke-width="2"/><rect x="170" y="116" width="20" height="16" rx="3" fill="#c7cedb"/>
<circle cx="180" cy="60" r="4" fill="#b18cff" class="event-twinkle"/>`,
  still_water: `<rect x="0" y="120" width="360" height="120" fill="#1b2438"/>
<path d="M40 150H320M70 176H290M100 202H260" stroke="rgb(237 232 245 / 0.08)" stroke-width="2"/>
<circle cx="180" cy="80" r="26" fill="#e9e3d6" opacity="0.8"/><ellipse cx="180" cy="160" rx="26" ry="8" fill="#e9e3d6" opacity="0.2"/>`,
};

function motifMarkup(def: EventDef | undefined): string {
  const body = (def?.motif && MOTIFS[def.motif]) ?? MOTIFS.still_water!;
  return `<svg class="event-motif" viewBox="0 0 360 240" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
<defs><radialGradient id="ev-sky" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#2c2548"/><stop offset="1" stop-color="#110e1c"/></radialGradient></defs>
<rect width="360" height="240" fill="url(#ev-sky)"/><circle cx="60" cy="40" r="1.4" fill="#f4efe6"/><circle cx="300" cy="30" r="1.2" fill="#f4efe6"/><circle cx="250" cy="60" r="1" fill="#f4efe6"/>${body}</svg>`;
}

export function eventScreen(app: App): ScreenController {
  const top = createTopBar(app);
  const art = h('div', { class: 'event-art' });
  const title = h('h1', { class: 'screen__title event-title' });
  const text = h('p', { class: 'event-text' });
  const options = h('div', { class: 'event-options', attrs: { role: 'list' } });
  const after = h('p', { class: 'event-after', attrs: { 'aria-live': 'polite' } });
  const contBtn = h('button', { class: 'btn btn--primary event-continue', attrs: { type: 'button', disabled: true } }, 'Continue', h('span', { class: 'kbd' }, 'Enter'));
  const panel = h('div', { class: 'event-panel panel' }, title, text, options, after, contBtn);
  const body = h('div', { class: 'event-layout' }, art, panel);
  const el = h('div', { class: 'screen event-screen' }, top.el, body);
  let signature = '';

  contBtn.addEventListener('click', () => {
    uiSound(app, 'confirm');
    void app.dispatch({ t: 'continue' });
  });

  function render(): void {
    const s = app.state;
    if (!s || s.phase.kind !== 'event') return;
    const phase = s.phase;
    const def = app.engine.pack.events[phase.eventId];
    const views = app.engine.eventOptions(s);
    const sig = `${phase.eventId}:${phase.chosen}:${JSON.stringify(views)}`;
    if (sig === signature) return;
    const first = signature === '';
    signature = sig;
    art.innerHTML = motifMarkup(def);
    title.textContent = def?.title ?? 'A Memory';
    text.textContent = def?.text ?? '';
    const chosen = phase.chosen;
    replaceChildren(
      options,
      views.map((o, i) => {
        const legal = chosen === null && o.enabled && app.isLegal({ t: 'option', i });
        const picked = chosen === i;
        return h(
          'button',
          {
            class: ['event-option', !o.enabled && 'is-unavailable', picked && 'is-picked', chosen !== null && !picked && 'is-passed'],
            attrs: {
              type: 'button',
              role: 'listitem',
              'aria-disabled': legal ? null : 'true',
              'aria-label': `${i + 1}. ${o.label}. ${o.result}${!o.enabled && o.reason ? ` Not available: ${o.reason}.` : ''}`,
            },
            on: {
              click: () => {
                if (!legal) {
                  if (chosen === null) uiSound(app, 'notEnough');
                  return;
                }
                uiSound(app, 'confirm');
                void app.dispatch({ t: 'option', i });
              },
            },
          },
          h('span', { class: 'kbd event-option__key', attrs: { 'aria-hidden': 'true' } }, String(i + 1)),
          h('span', { class: 'event-option__label' }, o.label),
          h('span', { class: 'event-option__result' }, `[${o.result}]`),
          !o.enabled && o.reason ? h('span', { class: 'event-option__reason' }, o.reason) : null,
        );
      }),
    );
    const afterLine = chosen !== null ? def?.options[chosen]?.after : undefined;
    after.textContent = afterLine ?? '';
    // Both rows keep their space before a choice (visibility, not display), so the centred panel stays put.
    after.classList.toggle('is-reserved', !afterLine);
    const canContinue = app.isLegal({ t: 'continue' });
    contBtn.disabled = !canContinue;
    contBtn.classList.toggle('is-reserved', !canContinue);
    contBtn.setAttribute('aria-hidden', String(!canContinue));
    if (first) fadeIn(el, app, 400);
    requestAnimationFrame(() => {
      const target = !contBtn.disabled ? contBtn : options.querySelector<HTMLElement>('.event-option:not([aria-disabled="true"])');
      if (target && (!el.contains(document.activeElement) || !contBtn.disabled)) target.focus({ preventScroll: true });
    });
  }

  return {
    el,
    update(a) {
      top.update(a);
      render();
    },
    onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const buttons = [...options.querySelectorAll<HTMLElement>('.event-option')];
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= buttons.length) {
        buttons[n - 1]!.focus();
        return true;
      }
      if (arrowFocus(e, panel)) return true;
      if (e.key === 'Enter' && !focusedControl(el)) {
        if (!contBtn.disabled) contBtn.click();
        else buttons.find((b) => b.getAttribute('aria-disabled') !== 'true')?.focus();
        return true;
      }
      return false;
    },
  };
}
