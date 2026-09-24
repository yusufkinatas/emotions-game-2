// Top bar (DESIGN 16.1): Heart, Glimmers, Keepsakes, Act and floor, deck count with Buried count, the
// Numbness meter, Codex (C), Settings and a mute toggle. Used by combat, map and every run screen.
// Built once and updated in place; every number comes from the run state or engine.deckSummary.

import { ACT_NAMES } from '../../content/index';
import type { App } from '../app';
import { h } from '../dom';
import { numbnessMeterMarkup } from '../kit/runHud';
import { keepsakeIcon, markIcon, resourceIcon } from '../kit/sigils';
import '../styles/topbar.css';

export interface TopBar {
  el: HTMLElement;
  update(app: App): void;
}

/** The combat screen also drives the live Heart and pulses counters while animating. */
export interface LiveTopBar extends TopBar {
  setHeart(hp: number, max: number): void;
  setGlimmers(n: number): void;
  pulse(what: 'heart' | 'glimmers' | 'deck' | { keepsake: string }): void;
  glimmerEl(): HTMLElement;
  deckEl(): HTMLElement;
}

const kbd = (k: string): HTMLElement => h('span', { class: 'kbd', attrs: { 'aria-hidden': 'true' } }, k);

function tipped(cls: string, tip: string, ...children: (Node | string)[]): HTMLElement {
  return h('span', { class: `${cls} has-tip`, attrs: { tabindex: '0', 'data-tip': tip } }, ...children);
}

function bump(el: Element): void {
  el.classList.remove('is-bumped');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('is-bumped');
}

export function createTopBar(app0: App): LiveTopBar {
  let current: App = app0;
  const heartN = h('b', { class: 'num' });
  const heartSr = h('span', { class: 'sr-only' });
  const heart = tipped('tb-stat tb-heart', 'Heart', h('span', { html: resourceIcon('heart'), attrs: { 'aria-hidden': 'true' } }), heartN, heartSr);
  const glimN = h('b', { class: 'num' });
  const glim = tipped(
    'tb-stat tb-glimmers',
    'Glimmers: spend them at the Sanctuary.',
    h('span', { html: resourceIcon('glimmer'), attrs: { 'aria-hidden': 'true' } }),
    glimN,
    h('span', { class: 'sr-only' }, ' Glimmers'),
  );
  const keepsakes = h('div', { class: 'tb-keepsakes', attrs: { role: 'list', 'aria-label': 'Keepsakes' } });
  const act = tipped('tb-act', '');
  const deckN = h('b', { class: 'num' });
  const buriedN = h('span', { class: 'tb-deck__buried' });
  const deck = h(
    'button',
    { class: 'btn btn--small tb-deck', type: 'button', on: { click: (e) => (e.stopPropagation(), current.openOverlay('deck')) } },
    h('span', { html: markIcon('deck'), attrs: { 'aria-hidden': 'true' } }),
    'Deck ',
    deckN,
    buriedN,
  );
  const numb = h('div', { class: 'tb-numb' });
  const codex = h(
    'button',
    { class: 'btn btn--small tb-btn', type: 'button', attrs: { 'aria-label': 'Codex (C)' }, on: { click: (e) => (e.stopPropagation(), current.openOverlay('codex')) } },
    h('span', { html: markIcon('codex'), attrs: { 'aria-hidden': 'true' } }),
    h('span', { class: 'tb-btn__word' }, 'Codex'),
    kbd('C'),
  );
  const settings = h(
    'button',
    { class: 'btn btn--small tb-btn', type: 'button', attrs: { 'aria-label': 'Settings' }, on: { click: (e) => (e.stopPropagation(), current.openOverlay('settings')) } },
    h('span', { html: markIcon('settings'), attrs: { 'aria-hidden': 'true' } }),
  );
  const muteIcon = h('span', { attrs: { 'aria-hidden': 'true' } });
  const mute = h(
    'button',
    {
      class: 'btn btn--small tb-btn tb-mute',
      type: 'button',
      on: { click: (e) => (e.stopPropagation(), current.setSettings({ muted: !current.profile.settings.muted })) },
    },
    muteIcon,
    kbd('M'),
  );
  const el = h(
    'header',
    { class: 'top-bar' },
    h('div', { class: 'tb-left' }, heart, glim, keepsakes),
    h('div', { class: 'tb-mid' }, act, deck, numb),
    h('div', { class: 'tb-right' }, codex, settings, mute),
  );

  let ksSig = '';
  let numbSig = '';
  let fitSig = '';
  let muted: boolean | null = null;

  /**
   * Never let items overlap: when everything does not fit on one row, step through compact levels
   * (1 Codex keeps only its icon and key, 2 the Numbness meter drops "The Numbness:", 3 the Act label
   * keeps only the floor and the meter only its count and pips, 4 Keepsakes overlap a little). Every
   * dropped word stays in the item's tip and aria-label.
   */
  const fit = (): void => {
    if (!el.isConnected || el.hidden) return;
    for (let lvl = 0; lvl <= 4; lvl++) {
      el.dataset.compact = String(lvl);
      if (el.scrollWidth <= el.clientWidth + 1) break;
    }
  };
  if (typeof ResizeObserver !== 'undefined') {
    let w = 0;
    new ResizeObserver(() => {
      if (el.clientWidth !== w) {
        w = el.clientWidth;
        fit();
      }
    }).observe(el);
  }

  const setHeart = (hp: number, max: number): void => {
    heartN.textContent = `${hp}/${max}`;
    heartSr.textContent = ` Heart ${hp} of ${max}`;
    heart.dataset.tip = `Heart ${hp}/${max}. At 0 your Heart needs rest and the run ends.`;
    heart.dataset.low = String(hp < max * 0.3);
  };
  const setGlimmers = (n: number): void => {
    glimN.textContent = String(n);
  };

  return {
    el,
    setHeart,
    setGlimmers,
    glimmerEl: () => glim,
    deckEl: () => deck,
    pulse(what) {
      if (what === 'heart') bump(heart);
      else if (what === 'glimmers') bump(glim);
      else if (what === 'deck') bump(deck);
      else {
        const k = keepsakes.querySelector(`[data-ks="${CSS.escape(what.keepsake)}"]`);
        if (k) bump(k);
      }
    },
    update(app) {
      current = app;
      const s = app.state;
      el.hidden = !s;
      if (!s) return;
      const run = s.run;
      const c = s.phase.kind === 'combat' ? s.combat : null;
      setHeart(c ? c.player.hp : run.heart, c ? c.player.maxHp : run.maxHeart);
      setGlimmers(run.glimmers);

      const pack = app.engine.pack;
      const sig = JSON.stringify(run.keepsakes);
      if (sig !== ksSig) {
        keepsakes.replaceChildren(
          ...run.keepsakes.map((k) => {
            const def = pack.keepsakes[k.id];
            const name = def?.name ?? k.id;
            const tip = `${name}: ${def?.text ?? ''}`;
            const item = tipped('tb-ks', tip, h('span', { html: keepsakeIcon(def?.icon), attrs: { 'aria-hidden': 'true' } }));
            item.setAttribute('role', 'listitem');
            item.dataset.ks = k.id;
            item.setAttribute('aria-label', tip);
            if (k.counter > 0) item.append(h('b', { class: 'tb-ks__n num', attrs: { 'aria-hidden': 'true' } }, String(k.counter)));
            return item;
          }),
        );
        ksSig = sig;
      }

      const actName = ACT_NAMES[run.act];
      act.replaceChildren(
        h('span', { class: 'tb-act__lead' }, run.act === 3 ? `${actName} · ` : `Act ${run.act} · `),
        h('span', { class: 'tb-act__floor' }, `Floor ${run.floor}`),
      );
      act.dataset.tip = `${actName}. Floor ${run.floor}.`;
      act.setAttribute('aria-label', `${run.act === 3 ? actName : `Act ${run.act}, ${actName}`}, floor ${run.floor}`);

      const summary = app.engine.deckSummary(s);
      deckN.textContent = String(summary.total);
      buriedN.textContent = summary.buried > 0 ? ` (${summary.buried} Buried)` : '';
      deck.setAttribute('aria-label', `Deck, ${summary.total} cards${summary.buried ? `, ${summary.buried} Buried` : ''}. Open the deck view.`);

      const nm = summary.numbness;
      const nSig = JSON.stringify(nm);
      if (nSig !== numbSig) {
        numb.innerHTML = nm
          ? numbnessMeterMarkup({
              count: nm.willSurface.length,
              title: `At The Numbness your ${nm.willSurface.length} heaviest Buried card${nm.willSurface.length === 1 ? '' : 's'} will surface as Shades${nm.hiddenIntensity > 0 ? `; the rest add up to +${nm.hiddenIntensity} Intensity` : ''}.`,
            })
          : '';
        // Wrap the meter's words so the compact levels can drop them and keep the count.
        const text = numb.querySelector('.numb-meter__text');
        const lead = text?.firstChild;
        const tail = text?.lastChild;
        if (lead && lead.nodeType === Node.TEXT_NODE) lead.replaceWith(h('span', { class: 'tb-numb__lead' }, lead.textContent ?? ''));
        if (tail && tail !== lead && tail.nodeType === Node.TEXT_NODE) tail.replaceWith(h('span', { class: 'tb-numb__tail' }, tail.textContent ?? ''));
        numbSig = nSig;
      }

      const fs = [ksSig, act.textContent, deck.textContent, numbSig].join('|');
      if (fs !== fitSig) {
        fitSig = fs;
        fit();
        // First mount: the bar is attached after this update; measure once it is on screen.
        if (!el.isConnected) requestAnimationFrame(fit);
      }

      const m = app.profile.settings.muted;
      if (m !== muted) {
        muteIcon.innerHTML = markIcon(m ? 'mute' : 'sound');
        mute.setAttribute('aria-label', m ? 'Sound is off. Turn sound on (M)' : 'Sound is on. Mute (M)');
        mute.setAttribute('aria-pressed', String(m));
        muted = m;
      }
    },
  };
}
