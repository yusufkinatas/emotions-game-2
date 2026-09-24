// Coach mark triggers for combat (DESIGN 17.3). Copy comes from COACH_MARKS with braced names filled from
// the triggering data; app.tips shows each tip once per profile and queues them.

import { BAD_ADVICE, COACH_MARKS } from '../../../content/index';
import { cureOf, dissonantLightOf } from '../../../engine/index';
import type { GameState, Uid } from '../../../engine/types';
import type { App } from '../../app';
import { LIGHT_NAME, SHADE_NAME } from '../../kit/names';
import { afflictionCoach, type CombatModel } from './model';

export interface CoachAnchors {
  slot(uid: Uid): HTMLElement | undefined;
  card(uid: Uid): HTMLElement | undefined;
  endTurn: HTMLElement;
  inward(): HTMLElement | null;
  playerChips: HTMLElement;
}

const copy = (id: string): string => COACH_MARKS.find((c) => c.id === id)?.copy ?? '';

export class Coach {
  private asked = new Set<string>();

  constructor(private readonly app: App) {}

  private show(id: string, anchor: Element | null | undefined, text: string): void {
    if (this.asked.has(id) || !anchor || !text) return;
    this.asked.add(id);
    this.app.tips.show(id, anchor, text);
  }

  check(s: GameState, m: CombatModel, a: CoachAnchors): void {
    const c = s.combat;
    if (!c || c.pending) return;
    const pack = this.app.engine.pack;
    const firstTutorial = c.tier === 'tutorial' && c.encounter === pack.pools.tutorial[0];

    if (firstTutorial && c.turn === 1) {
      const sh = m.shades[0];
      const strike = sh?.intent?.strikes;
      if (sh && strike) {
        const pill = a.slot(sh.uid)?.querySelector('.intent-pill');
        this.show('C1', pill, copy('C1').replace(/\d+/, String(strike.perStrike * strike.count)));
      }
      const kind = m.hand.find((x) => x.def.id === 'love.kind_word');
      if (kind) this.show('C2', a.card(kind.uid), copy('C2'));
    }
    if (firstTutorial && c.energy === 0 && c.turnFlags.played > 0) this.show('C3', a.endTurn, copy('C3'));

    for (const sh of m.shades) {
      const slot = a.slot(sh.uid);
      const b = sh.preview?.banner;
      if (b && (b.kind === 'resolve' || b.kind === 'deepResolve')) this.show('C4', slot?.querySelector('.lethal-banner'), copy('C4'));
      if (b && b.kind === 'suppress') this.show('C8', slot?.querySelector('.lethal-banner'), copy('C8'));
      if (sh.preview?.callout?.relation === 'dissonant' && sh.face) {
        const light = dissonantLightOf(sh.face);
        this.show(
          'C5',
          slot?.querySelector('.matchup--dissonant') ?? slot,
          copy('C5').replace('{line}', BAD_ADVICE[sh.face]).replace('{Light}', LIGHT_NAME[light]).replace('{Shade}', SHADE_NAME[sh.face]),
        );
      }
      if (sh.wavering) this.show('C12', slot, copy('C12'));
      if (sh.innerFace && sh.beneath) this.show('C14', slot?.querySelector('.nameplate'), copy('C14'));
      if (!sh.face && sh.defId !== 'shade.numbness') this.show('C15', slot?.querySelector('.nameplate'), copy('C15'));
      if (sh.surfaced) this.show('C16', slot, copy('C16'));
      if (sh.defId === 'shade.numbness') this.show('C17', slot, copy('C17'));
    }

    const harmony = m.hand.find((x) => x.hint?.chips.some((ch) => ch.startsWith('HARMONY')));
    if (harmony && c.note.length) {
      const neighbour = c.note.find((l) => !harmony.def.lights.includes(l)) ?? c.note[0]!;
      this.show('C7', a.card(harmony.uid), copy('C7').replace('{Card}', harmony.def.name).replace('{Light}', LIGHT_NAME[neighbour]));
    }

    const aff = Object.entries(c.player.statuses).find(([id, n]) => (n ?? 0) > 0 && pack.statuses[id]?.affliction && id !== 'numb');
    if (aff) {
      const text = afflictionCoach(copy('C9'), aff[0]);
      if (text) this.show('C9', a.playerChips.querySelector('.chip--affliction') ?? a.playerChips, text);
    }

    if (m.inward) this.show('C10', a.inward(), copy('C10'));

    const buried = m.hand.find((x) => x.def.buried);
    if (buried?.def.buried) {
      const shade = buried.def.buried.shade;
      this.show('C11', a.card(buried.uid), copy('C11').replace('{Shade}', SHADE_NAME[shade]).replace('{Light}', LIGHT_NAME[cureOf(shade)]));
    }
  }
}
