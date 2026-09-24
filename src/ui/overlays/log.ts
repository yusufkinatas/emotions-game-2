// Combat log overlay (DESIGN 16.2 "Log (L)"): a slide-out panel with every event in plain text.
// describeEvents turns engine GameEvents into sentences; the combat screen appends them to app.log.

import { BANNERS } from '../../content/index';
import type { GameEvent, GameState, Uid } from '../../engine/types';
import type { App, ScreenController } from '../app';
import { h } from '../dom';
import { AFFLICTION_NAME, LIGHT_NAME, SHADE_NAME } from '../kit/names';
import { markIcon } from '../kit/sigils';
import '../styles/combat.css';

const MAX_LINES = 400;

function enemyName(app: App, uid: Uid, ...states: GameState[]): string {
  for (const s of states) {
    const c = s.combat;
    const e = c?.enemies.find((x) => x.uid === uid) ?? c?.gone.find((x) => x.uid === uid);
    if (e) return app.engine.pack.enemies[e.defId]?.name ?? 'A Shade';
  }
  return 'A Shade';
}

function cardNameOf(app: App, uid: Uid, ...states: GameState[]): string {
  for (const s of states) {
    const card = s.combat?.cards[uid];
    if (card) return (app.engine.pack.cards[card.defId]?.name ?? 'a card') + (card.upgraded ? '+' : '');
  }
  return 'a card';
}

function relationWord(r: string, typePct: number): string {
  switch (r) {
    case 'opposite':
      return 'OPPOSITE x2';
    case 'dissonant':
      return typePct >= 100 ? 'DISSONANT x1' : 'DISSONANT x1/2';
    case 'felt':
      return 'FELT x2';
    case 'muffled':
      return 'MUFFLED x1/2';
    case 'veiled':
      return 'Veiled';
    default:
      return 'x1';
  }
}

/** Plain sentences for a step's events (log and screen readers). */
export function describeEvents(app: App, events: readonly GameEvent[], prev: GameState, next: GameState): string[] {
  const pack = app.engine.pack;
  const out: string[] = [];
  let heart = prev.combat?.player.hp ?? prev.run.heart;
  const who = (uid: Uid) => enemyName(app, uid, prev, next);
  for (const ev of events) {
    switch (ev.e) {
      case 'turn':
        out.push(ev.side === 'player' ? `Turn ${ev.n}.` : `${BANNERS.shadesStir}.`);
        break;
      case 'cardPlayed': {
        const name = cardNameOf(app, ev.uid, prev, next);
        const where = ev.inward ? ' Inward' : ev.target !== null ? ` on ${who(ev.target)}` : '';
        out.push(`You play ${name}${where}${ev.harmonized ? ' (Harmonized)' : ''}.`);
        break;
      }
      case 'harmony':
        out.push(`Harmony${ev.blend ? `: ${ev.blend.charAt(0).toUpperCase()}${ev.blend.slice(1)}` : ''}.`);
        break;
      case 'hit': {
        if (ev.to.side !== 'enemy') break;
        const from =
          ev.from.side === 'companion'
            ? (pack.companions[next.combat?.companions.find((c) => c.uid === (ev.from as { uid: Uid }).uid)?.defId ?? '']?.name ?? 'A Companion')
            : ev.b.fromCard
              ? 'You'
              : 'It';
        const b = ev.b;
        const guard = b.blocked > 0 ? ` Guard blocks ${b.blocked}.` : '';
        out.push(`${from} Ease ${who(ev.to.uid)} by ${b.damage} (${relationWord(b.relation, b.typePct)}).${guard} Intensity ${b.hpBefore} -> ${b.hpAfter}.`);
        break;
      }
      case 'strike': {
        const lost = Math.max(0, heart - ev.hpAfter);
        heart = ev.hpAfter;
        out.push(`${who(ev.enemy)} strikes for ${ev.amount}.${ev.blocked ? ` Guard blocks ${ev.blocked}.` : ''} You lose ${lost} Heart.`);
        break;
      }
      case 'guard':
        out.push(ev.to.side === 'player' ? `You gain ${ev.amount} Guard.` : ev.to.side === 'enemy' ? `${who(ev.to.uid)} gains ${ev.amount} Guard.` : '');
        break;
      case 'mend':
        if (ev.to.side === 'player') {
          heart = ev.after;
          out.push(`You Mend ${ev.amount}.`);
        } else if (ev.to.side === 'enemy') out.push(`${who(ev.to.uid)} Mends ${ev.amount}.`);
        break;
      case 'hpLoss':
        if (ev.to.side === 'player') {
          heart = ev.after;
          out.push(ev.cause === 'seething' ? `Seething: you lose ${ev.amount} Heart.` : `You lose ${ev.amount} Heart.`);
        }
        break;
      case 'status': {
        if (ev.delta <= 0) break;
        const name = pack.statuses[ev.id]?.name ?? ev.id;
        if (ev.to.side === 'player') out.push(`You gain ${ev.delta} ${name} (${ev.after}).`);
        else if (ev.to.side === 'enemy') out.push(`${who(ev.to.uid)}: ${name} ${ev.after}.`);
        break;
      }
      case 'afflictBlocked':
        out.push(`${pack.statuses[ev.id]?.name ?? ev.id} is blocked.`);
        break;
      case 'cleanse':
        out.push(`${LIGHT_NAME[ev.byLight]} soothes ${ev.removed} ${AFFLICTION_NAME[ev.id]}.`);
        break;
      case 'face':
        out.push(`${who(ev.enemy)} turns to ${SHADE_NAME[ev.face]}.`);
        break;
      case 'enemyMove': {
        const e = prev.combat?.enemies.find((x) => x.uid === ev.enemy) ?? next.combat?.enemies.find((x) => x.uid === ev.enemy);
        const move = e ? pack.enemies[e.defId]?.moves[ev.moveId]?.name : null;
        out.push(`${who(ev.enemy)}: ${move ?? ev.moveId}.`);
        break;
      }
      case 'summon':
        out.push(`${pack.companions[ev.defId]?.name ?? 'A Companion'} joins you.`);
        break;
      case 'companionLeft':
        out.push(`A Companion ${BANNERS.companionLeaves}.`);
        break;
      case 'spawn':
        out.push(`${pack.enemies[ev.defId]?.name ?? 'A Shade'} appears.`);
        break;
      case 'surfaced':
        out.push(`${who(ev.enemy)} surfaces from your Buried card.`);
        break;
      case 'resolved':
        out.push(`${who(ev.enemy)} is ${ev.deep ? 'Deeply ' : ''}Resolved${ev.glimmers ? `: +${ev.glimmers} Glimmers` : ''}.`);
        break;
      case 'suppressed':
        out.push(`${who(ev.enemy)} is Suppressed.${ev.buried ? ` Buried ${SHADE_NAME[ev.buried]} goes into your deck.` : ''}`);
        break;
      case 'faded':
        out.push(`${who(ev.enemy)} fades.`);
        break;
      case 'wavering':
        out.push(`${who(ev.enemy)} is Wavering at 1. ${BANNERS.wavering}.`);
        break;
      case 'tended':
        out.push(`You Tend ${cardNameOf(app, ev.uid, prev, next)} (Weight ${ev.weightAfter}).`);
        break;
      case 'insight':
        out.push(`A Buried card becomes ${pack.cards[ev.to]?.name ?? 'Insight'}.`);
        break;
      case 'peace':
        out.push('A Buried card is released.');
        break;
      case 'moodActive':
        out.push(`${cardNameOf(app, ev.uid, prev, next)} lingers as a Mood.`);
        break;
      case 'promise':
        if (ev.created) out.push('You make a Promise.');
        break;
      case 'festering':
        out.push(BANNERS.festering);
        break;
      case 'keepsake':
        out.push(`${pack.keepsakes[ev.id]?.name ?? 'A Keepsake'} glows.`);
        break;
      case 'draw':
        if (ev.uids.length) out.push(`You draw ${ev.uids.length} card${ev.uids.length === 1 ? '' : 's'}.`);
        break;
      case 'shuffle':
        out.push('Your discard pile is shuffled into your draw pile.');
        break;
      case 'combatEnd':
        out.push(ev.outcome === 'won' ? 'The Shades are quiet.' : 'Your Heart needs rest.');
        break;
      default:
        break;
    }
  }
  return out.filter(Boolean);
}

export function appendLog(app: App, lines: readonly string[]): void {
  app.log.push(...lines.map((l) => l.replace(/->/g, '→')));
  if (app.log.length > MAX_LINES) app.log.splice(0, app.log.length - MAX_LINES);
}

export function logOverlay(app0: App): ScreenController {
  const list = h('ol', { class: 'log-panel__list', attrs: { 'aria-live': 'polite', 'aria-relevant': 'additions' } });
  const close = h(
    'button',
    { class: 'btn btn--small log-panel__close', type: 'button', attrs: { 'aria-label': 'Close the log (Esc)' }, on: { click: () => app0.closeOverlay() } },
    h('span', { html: markIcon('close'), attrs: { 'aria-hidden': 'true' } }),
  );
  const panel = h(
    'aside',
    { class: 'log-panel', attrs: { role: 'dialog', 'aria-label': 'Log', 'aria-modal': 'false' } },
    h('header', { class: 'log-panel__head' }, h('h2', { class: 'log-panel__title' }, 'Log'), h('span', { class: 'kbd', attrs: { 'aria-hidden': 'true' } }, 'L'), close),
    h('div', { class: 'log-panel__scroll scroll', attrs: { tabindex: '0' } }, list),
  );
  const el = h('div', { class: 'log-overlay', on: { click: (e) => e.target === e.currentTarget && app0.closeOverlay() } }, panel);
  let shown = 0;
  let first = true;
  return {
    el,
    update(app) {
      if (shown > app.log.length) {
        list.replaceChildren();
        shown = 0;
      }
      if (app.log.length > shown) list.querySelector('.log-panel__empty')?.remove();
      for (const line of app.log.slice(shown)) list.append(h('li', null, line));
      if (!app.log.length && !list.children.length) list.append(h('li', { class: 'log-panel__empty' }, 'Nothing has happened yet.'));
      shown = app.log.length;
      const scroll = panel.querySelector('.log-panel__scroll');
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
      if (first) {
        requestAnimationFrame(() => close.focus({ preventScroll: true }));
        first = false;
      }
    },
    onKey(e, app) {
      if (e.key === 'l' || e.key === 'L') {
        app.closeOverlay();
        return true;
      }
      return false;
    },
  };
}
