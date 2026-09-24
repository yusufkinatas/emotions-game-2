// Playing a card (5.3): cost, Note, Harmony, cleanse, Inward, effects, cleanup; and resuming a pending choice.

import { afflictionSoothedBy, blendOfLights } from '../emotions';
import { runEffects, runFrames, settle } from '../interpreter';
import { beginPlay, cleanse, emit, endPlay, setEnergy, setNote } from '../primitives';
import type { CardId, Frame, Light, Uid } from '../types';
import { resolveChoicePick, tendCard } from './buried';
import { cardEffects, hasKeyword } from './cards';
import { cardCtx, inwardOutcome, type PlayPlan } from './legal';
import type { Rt } from './runtime';
import { fireKeepsakes, firePassives, firePassivesAll } from './triggers';

export function playCard(rt: Rt, plan: PlayPlan, target: Uid | null, inward: boolean): void {
  const c = rt.c;
  const { uid, def } = plan;
  // Step 3: pay.
  setEnergy(rt, c.energy - plan.cost);
  if (plan.usedCenter) c.turnFlags.centerActive = false;
  if (plan.usedPrism) c.turnFlags.prismUsed = true;
  c.turnFlags.firstCardDone = true;
  // Step 4: out of the hand.
  if (target !== null) c.lastTarget = target;
  beginPlay(rt, uid, {
    e: 'cardPlayed',
    uid,
    defId: def.id,
    inward,
    target,
    effectiveLights: plan.effective.slice(),
    harmonized: plan.harmonized,
    energyAfter: c.energy,
  });
  for (const l of plan.effective) if (!c.turnFlags.lightsThisTurn.includes(l)) c.turnFlags.lightsThisTurn.push(l);
  countPlay(rt, def.id, plan.effective);
  if (plan.harmonized) {
    c.turnFlags.harmonies += 1;
    c.stats.harmonies += 1;
    emit(rt, { e: 'harmony', blend: blendOfLights(plan.effective), count: c.turnFlags.harmonies });
    // Keepsake `harmonized` triggers fire after the effect list (L5), in finishPlay.
  }
  // Step 5: the Note becomes the printed Lights (never for neutral or Numb-greyed cards).
  if (def.lights.length > 0 && !plan.greyed) setNote(rt, def.lights);
  rt.play = { uid, target, lights: plan.effective.slice(), harmonized: plan.harmonized, hit: [], cost: plan.cost, suppressed: false };
  settle(rt);
  // Step 6: cleanse.
  if (inward) {
    const o = inwardOutcome(rt, plan);
    for (const x of o.cleanse) cleanse(rt, x.id, Number.MAX_SAFE_INTEGER, x.light, true);
    if (o.tend !== null) tendCard(rt, c.cards[o.tend]!);
    settle(rt);
    finishPlay(rt, true);
    return;
  }
  for (const l of plan.effective) cleanse(rt, afflictionSoothedBy(l), rt.rules.cleansePerOutwardPlay, l, false);
  // Step 7: effects.
  const ctx = cardCtx(uid, target, plan.effective.slice(), plan.harmonized);
  if (runEffects(rt, cardEffects(def, plan.upgraded), ctx) === 'pending') return;
  finishPlay(rt, false);
}

/**
 * Run stats (15.4) count a card once it has left the hand (step 4, like harmonies), so the card that wins or
 * loses the combat mid-play (R-8b, 5.5) is still counted even though step 8 never runs for it.
 */
function countPlay(rt: Rt, defId: CardId, lights: readonly Light[]): void {
  const st = rt.c.stats;
  st.cardsPlayed += 1;
  st.playsByCard[defId] = (st.playsByCard[defId] ?? 0) + 1;
  for (const l of lights) st.playsByLight[l] = (st.playsByLight[l] ?? 0) + 1;
}

/**
 * End of step 7, then step 8. L5: Keepsake `harmonized` triggers (Tuning Fork) fire once the card's effect list
 * has finished (for Inward plays: after the cleanse and Tend; after a pending choice: once the continuation has
 * run), so a sealed preview shows the card's hits before a Keepsake draw stops it. A card that ended the combat
 * (R-8b) never gets here, so its trigger does not fire.
 */
function finishPlay(rt: Rt, inward: boolean): void {
  const c = rt.c;
  const play = rt.play;
  if (!play) return;
  if (play.harmonized) {
    fireKeepsakes(rt, 'harmonized');
    settle(rt);
  }
  // Step 8: cleanup and the card-count passives.
  const card = c.cards[play.uid]!;
  const def = rt.pack.cards[card.defId]!;
  const to =
    def.kind === 'mood' && !inward ? 'moods' : hasKeyword(def, card.upgraded, 'letGo') ? 'letGo' : 'discard';
  endPlay(rt, play.uid, to);
  c.turnFlags.played += 1;
  card.mem.timesPlayed += 1;
  const extra = { lights: play.lights.slice(), fromCard: true };
  for (const e of c.enemies.slice()) if (play.hit.includes(e.uid)) firePassives(rt, e, 'cardHitResolved', extra);
  firePassivesAll(rt, 'cardPlayed', extra);
  rt.play = null;
  settle(rt);
}

/** 'choose' while a choice is pending: apply the pick, run the rest of the card, then its cleanup. */
export function resumeChoice(rt: Rt, pick: Uid): void {
  const p = rt.c.pending!;
  rt.c.pending = null;
  rt.play = p.play ? { ...p.play, lights: p.play.lights.slice(), hit: p.play.hit.slice() } : null;
  resolveChoicePick(rt, p.purpose, pick);
  settle(rt);
  const frames: Frame[] = p.continuation;
  // Frames of one card share one ctx object (hit results such as suppressedTarget stay visible).
  const shared = frames[0]?.ctx;
  if (shared) for (const f of frames) if (f.ctx.source === shared.source && f.ctx.sourceUid === shared.sourceUid) f.ctx = shared;
  if (runFrames(rt, frames) === 'pending') return;
  finishPlay(rt, false);
}
