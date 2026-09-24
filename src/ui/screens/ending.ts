// Victory and defeat (DESIGN 15.2 to 15.4): the ending text (two endings, or the defeat line), run stats
// (floors, Resolved / Deep Resolved / Suppressed, Insights, a Lights-used ring, Harmonies, most played card,
// a copyable seed) and New Run / Title.

import type { GameState, Light } from '../../engine/index';
import { LIGHTS } from '../../engine/index';
import { DEFEAT_TEXT, ENDINGS } from '../../content/index';
import type { App, ScreenController } from '../app';
import { h } from '../dom';
import { LIGHT_NAME } from '../kit/names';
import { sigilBody } from '../kit/sigils';
import { polar } from '../kit/svg';
import { ambienceFor, fadeIn, uiSound } from '../components/titleCard';
import '../styles/screens.css';

/** Six-segment ring of card plays per Light (15.4), each segment with its sigil and count. */
export function lightsRingMarkup(plays: Partial<Record<Light, number>>): string {
  const total = LIGHTS.reduce((t, l) => t + (plays[l] ?? 0), 0);
  const C = 100;
  const R = 70;
  const W = 22;
  let a = 0;
  const segs: string[] = [];
  for (const l of LIGHTS) {
    const n = plays[l] ?? 0;
    if (n <= 0 || total === 0) continue;
    const sweep = (n / total) * 360;
    const gap = sweep >= 359.9 ? 0 : 1.5;
    const a0 = a + gap / 2;
    const a1 = a + sweep - gap / 2;
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = polar(C, C, R, a0);
    const [x1, y1] = polar(C, C, R, Math.min(a1, a0 + 359.99));
    const mid = a0 + (a1 - a0) / 2;
    const [sx, sy] = polar(C, C, R, mid);
    segs.push(
      `<g data-light="${l}"><path d="M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="var(--c)" stroke-width="${W}"/>` +
        (sweep > 22 ? `<g transform="translate(${(sx - 7).toFixed(2)} ${(sy - 7).toFixed(2)}) scale(0.58)" color="var(--ink)">${sigilBody(l)}</g>` : '') +
        `<title>${LIGHT_NAME[l]}: ${n}</title></g>`,
    );
    a += sweep;
  }
  const label = total === 0 ? 'No Light cards played' : LIGHTS.filter((l) => (plays[l] ?? 0) > 0).map((l) => `${LIGHT_NAME[l]} ${plays[l]}`).join(', ');
  return (
    `<svg class="lights-ring" viewBox="0 0 200 200" role="img" aria-label="Lights used: ${label}">` +
    `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="var(--ink-rim)" stroke-width="${W}"/>${segs.join('')}` +
    `<text x="${C}" y="${C - 4}" text-anchor="middle" class="lights-ring__n">${total}</text>` +
    `<text x="${C}" y="${C + 18}" text-anchor="middle" class="lights-ring__cap">plays</text></svg>`
  );
}

function stat(label: string, value: string | number, cls = ''): HTMLElement {
  return h('div', { class: ['end-stat', cls] }, h('span', { class: 'end-stat__v num' }, String(value)), h('span', { class: 'end-stat__k' }, label));
}

function mostPlayed(app: App, s: GameState): string {
  let best: string | null = null;
  let n = 0;
  for (const [id, c] of Object.entries(s.run.stats.playsByCard)) {
    if (c > n) {
      n = c;
      best = id;
    }
  }
  return best ? `${app.engine.pack.cards[best]?.name ?? best} (${n})` : 'None yet';
}

function buildEnding(app: App): ScreenController {
  const s = app.state!;
  const phase = s.phase;
  const victory = phase.kind === 'victory';
  const resolved = phase.kind === 'victory' && phase.ending === 'resolved';
  const text = phase.kind === 'victory' ? ENDINGS[phase.ending] : DEFEAT_TEXT;
  const eyebrow = victory ? (resolved ? 'The Numbness is Resolved' : 'The Numbness is Suppressed. Still a win.') : 'Your Heart rests';
  const st = s.run.stats;
  const seedBtn = h('button', { class: 'btn btn--small btn--ghost end-seed', attrs: { type: 'button', 'aria-label': `Copy seed ${s.seed}` } }, `Seed ${s.seed}`, h('span', { class: 'end-seed__state muted' }, 'Copy'));
  const newRun = h('button', { class: 'btn btn--primary', attrs: { type: 'button' } }, 'New Run', h('span', { class: 'kbd' }, 'Enter'));
  const toTitle = h('button', { class: 'btn btn--ghost', attrs: { type: 'button' } }, 'Title', h('span', { class: 'kbd' }, 'T'));

  const el = h(
    'div',
    { class: ['screen', 'end-screen', victory ? (resolved ? 'end-screen--resolved' : 'end-screen--suppressed') : 'end-screen--rest'] },
    h('div', { class: 'end-bloom', attrs: { 'aria-hidden': 'true' } }, LIGHTS.map((l, i) => h('span', { class: 'end-bloom__mote', dataset: { light: l }, style: { '--i': String(i) } as Record<string, string> }))),
    h(
      'main',
      { class: 'end-main' },
      h('p', { class: 'eyebrow end-eyebrow' }, eyebrow),
      h('h1', { class: 'end-text' }, text),
      phase.kind === 'defeat' && phase.cause === 'turnLimit' ? h('p', { class: 'muted end-cause' }, 'The fight went on for a very long time. Rest now.') : null,
      h(
        'section',
        { class: 'end-stats panel', attrs: { 'aria-label': 'Run stats' } },
        h('div', { class: 'end-ring', html: lightsRingMarkup(st.playsByLight) }, h('span', { class: 'eyebrow' }, 'Lights used')),
        h(
          'div',
          { class: 'end-grid' },
          stat('Floors reached', st.floors),
          stat('Resolved', st.resolved),
          stat('Deep Resolved', st.deepResolved),
          stat('Suppressed', st.suppressed),
          stat('Insights found', st.insights),
          stat('Harmonies played', st.harmonies),
          stat('Most played card', mostPlayed(app, s), 'end-stat--wide'),
        ),
      ),
      h('div', { class: 'screen__actions end-actions' }, newRun, toTitle, seedBtn),
    ),
  );

  seedBtn.addEventListener('click', () => {
    const done = (msg: string): void => {
      seedBtn.querySelector('.end-seed__state')!.textContent = msg;
    };
    try {
      void navigator.clipboard.writeText(String(s.seed)).then(
        () => done('Copied'),
        () => done('Select to copy'),
      );
    } catch {
      done('Select to copy');
    }
  });
  newRun.addEventListener('click', () => {
    uiSound(app, 'confirm');
    app.newRun({});
  });
  toTitle.addEventListener('click', () => {
    uiSound(app, 'cancel');
    app.toTitle();
  });

  fadeIn(el, app, 900);
  ambienceFor(app, null);
  requestAnimationFrame(() => newRun.focus({ preventScroll: true }));

  return {
    el,
    update() {},
    onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (e.key.toLowerCase() === 't') {
        toTitle.click();
        return true;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const list = [newRun, toTitle, seedBtn];
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length]!.focus();
        return true;
      }
      if (e.key === 'Enter' && !el.contains(document.activeElement)) {
        newRun.click();
        return true;
      }
      // Escape would open Pause over a finished run; there is nothing to pause.
      if (e.key === 'Escape') return true;
      return false;
    },
  };
}

/** Victory and defeat share this screen; a different ending (or a loaded save) rebuilds it. */
export function endingScreen(app: App): ScreenController {
  const host = h('div', { class: 'end-host' });
  let key = '';
  let inner: ScreenController | null = null;
  const sync = (): void => {
    const next = JSON.stringify(app.state?.phase ?? null) + String(app.state?.seed);
    if (next === key && inner) return;
    key = next;
    inner = buildEnding(app);
    host.replaceChildren(inner.el);
  };
  sync();
  return {
    el: host,
    update() {
      sync();
    },
    onKey: (e, a) => inner?.onKey?.(e, a) ?? false,
  };
}
