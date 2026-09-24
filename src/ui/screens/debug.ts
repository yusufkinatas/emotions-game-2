// Fallback screen: lists the phase and every legal action as a button. Used for any screen or
// overlay that has no dedicated implementation, and with ?debug=1 as a raw inspector.

import type { Action, GameState } from '../../engine/types';
import type { App, ScreenController } from '../app';
import { h, replaceChildren } from '../dom';

export function describeAction(s: GameState, app: App, a: Action): string {
  const pack = app.engine.pack;
  const c = s.combat;
  switch (a.t) {
    case 'play': {
      const card = c?.cards[a.card];
      const name = card ? (pack.cards[card.defId]?.name ?? card.defId) + (card.upgraded ? '+' : '') : `#${a.card}`;
      if (a.inward) return `${name} -> INWARD`;
      if (a.target !== undefined) {
        const e = c?.enemies.find((x) => x.uid === a.target);
        return `${name} -> ${e ? (pack.enemies[e.defId]?.name ?? e.defId) : a.target}`;
      }
      return name;
    }
    case 'move': {
      const n = s.run.map.nodes.find((x) => x.id === a.node);
      return `Go to ${n ? `${n.kind} (row ${n.row})` : a.node}`;
    }
    case 'pickCharm':
      return s.phase.kind === 'charmSelect' ? `Charm: ${pack.keepsakes[s.phase.options[a.i]!]?.name}` : `Charm ${a.i}`;
    case 'takeCard':
      return s.phase.kind === 'reward' ? `Take ${pack.cards[s.phase.offer.cards[a.i]!]?.name}` : `Take card ${a.i}`;
    case 'takeKeepsake':
      return s.phase.kind === 'reward'
        ? `Take ${pack.keepsakes[s.phase.offer.keepsakes[a.i]!]?.name}`
        : `Take Keepsake ${a.i}`;
    case 'buy':
      return s.phase.kind === 'shop' ? `Buy ${s.phase.stock.items[a.slot]?.id}` : `Buy ${a.slot}`;
    case 'choose': {
      const card = c?.cards[a.uid] ?? s.run.deck.find((d) => d.uid === a.uid);
      return `Choose ${card ? pack.cards[card.defId]?.name : a.uid}`;
    }
    case 'option':
      return s.phase.kind === 'event' ? (pack.events[s.phase.eventId]?.options[a.i]?.label ?? `Option ${a.i}`) : `Option ${a.i}`;
    default:
      return a.t;
  }
}

export function debugScreen(_app: App): ScreenController {
  const el = h('div', { class: 'debug-screen' });
  return {
    el,
    update(app) {
      const s = app.state;
      if (!s) {
        replaceChildren(
          el,
          h('h1', null, 'Heartward'),
          h('button', { class: 'btn', on: { click: () => app.newRun() } }, 'New Run'),
          app.hasSave() ? h('button', { class: 'btn', on: { click: () => app.continueRun() } }, 'Continue') : null,
        );
        return;
      }
      const run = s.run;
      const c = s.combat;
      const header = h(
        'div',
        { class: 'debug-header' },
        `Phase ${s.phase.kind} | Act ${run.act} | Floor ${run.floor} | Heart ${c ? c.player.hp : run.heart}/${run.maxHeart} | Glimmers ${run.glimmers}`,
      );
      const combatInfo = c
        ? h(
            'pre',
            { class: 'debug-combat' },
            [
              `Turn ${c.turn}  Spirit ${c.energy}  Guard ${c.player.guard}  Note [${c.note.join(', ')}]`,
              `Statuses ${JSON.stringify(c.player.statuses)}`,
              ...c.enemies.map((e) => {
                const d = app.engine.pack.enemies[e.defId];
                return `${d?.name ?? e.defId} [${e.faces.join('/')}] ${e.hp}/${e.maxHp} G${e.guard} ${JSON.stringify(e.statuses)} intent ${e.intent?.moveId ?? '-'}`;
              }),
              `Hand: ${c.piles.hand.map((u) => app.engine.pack.cards[c.cards[u]!.defId]?.name).join(', ')}`,
            ].join('\n'),
          )
        : null;
      const actions = app.engine.legalActions(s);
      const buttons = h(
        'div',
        { class: 'debug-actions' },
        actions.map((a) => h('button', { class: 'btn', on: { click: () => void app.dispatch(a) } }, describeAction(s, app, a))),
      );
      replaceChildren(el, header, combatInfo, buttons, h('button', { class: 'btn', on: { click: () => app.toTitle() } }, 'Title'));
    },
  };
}
