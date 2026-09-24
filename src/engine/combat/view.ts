// UI data (DESIGN 16.2): IntentView incl. the M2 projection after your end-of-turn steps, HandHints and
// card text. Everything is derived from engine state; the UI never computes rules.

import { moveOutline } from '../conditions';
import { typingOf } from '../damage';
import { afflictionSoothedBy, blendOfLights, relationOf } from '../emotions';
import type { EngineCtx, EnemyState, GameState, HandHint, IntentView, Uid } from '../types';
import { inwardTendCandidate, isBuried } from './buried';
import { hasKeyword } from './cards';
import { deriveIntent, overrideGauge, overrideName } from './enemy';
import { canTarget, cardCtx, inwardLegal, planCard } from './legal';
import { hitSpecFor } from './lethal';
import { CombatOver, createRt, enemyDef, findEnemy, SealedStop, type Rt } from './runtime';
import { capitalize, describeInCombat, shadeName, statusName } from './text';
import { endTurnSteps } from './turn';

function intentText(rt: Rt, e: EnemyState, v: Omit<IntentView, 'text'>, overrideEmpties: boolean): string {
  const parts: string[] = [];
  const outline = e.intent ? moveOutline(rt, e, e.intent.moveId) : null;
  if (outline) {
    for (const s of outline.strikes) {
      const flare = e.statuses.flare ?? 0;
      const hush = e.statuses.hush ?? 0;
      const why = flare || hush ? ` (${s.base}${flare ? ` + ${flare} Flare` : ''}${hush ? ` - ${hush} Hush` : ''})` : '';
      parts.push(s.count > 1 ? `Strikes ${s.count} times for ${s.perStrike} each${why}.` : `Strikes for ${s.perStrike}${why}.`);
    }
  }
  if (v.guard) parts.push(`Gains ${v.guard} Guard.`);
  if (v.afflict) parts.push(`Gives you ${v.afflict.stacks} ${statusName(rt, v.afflict.id)}.`);
  if (outline && outline.mend > 0) parts.push(`Restores ${outline.mend} Intensity.`);
  if (v.kinds.includes('buff')) parts.push('Grows stronger.');
  if (v.kinds.includes('summon')) parts.push('Calls for company.');
  if (v.kinds.includes('scatter')) parts.push('Sends a Companion away.');
  if (v.overriddenBy) {
    const gauge = capitalize(statusName(rt, v.overriddenBy));
    parts.push(overrideEmpties ? `(${gauge} has run out.)` : `(${gauge} is full.)`);
  }
  return parts.join(' ') || `${v.name}.`;
}

/** The current (not projected) intent of one Shade, with numbers from the one pipeline. */
export function intentViewOf(rt: Rt, e: EnemyState): IntentView | null {
  if (!e.intent) return null;
  const def = enemyDef(rt, e);
  const moveId = e.intent.moveId;
  const move = def.moves[moveId];
  const outline = moveOutline(rt, e, moveId);
  const d = deriveIntent(rt, e);
  const forced = d.moveId === moveId ? d.override : null;
  const first = outline.strikes[0];
  const sameStrikes = outline.strikes.every((s) => s.perStrike === first?.perStrike);
  const base: Omit<IntentView, 'text'> = {
    enemy: e.uid,
    moveId,
    name: move?.name ?? moveId,
    kinds: move ? [...move.intent] : [],
    strikes: first
      ? { perStrike: first.perStrike, count: sameStrikes ? outline.strikes.reduce((n, s) => n + s.count, 0) : first.count }
      : null,
    guard: outline.shield > 0 ? outline.shield : null,
    afflict: outline.afflict,
    overriddenBy: forced ? overrideName(forced) : null,
    projected: false,
    projectedReason: null,
  };
  return { ...base, text: intentText(rt, e, base, forced ? overrideGauge(forced)?.empties === true : false) };
}

function sameNumbers(a: IntentView, b: IntentView): boolean {
  return (
    a.moveId === b.moveId &&
    JSON.stringify(a.strikes) === JSON.stringify(b.strikes) &&
    a.guard === b.guard &&
    JSON.stringify(a.afflict) === JSON.stringify(b.afflict)
  );
}

/** Tooltip cause of a projected change ("Lantern Moth will turn it to Fear."). */
function projectionReason(proj: Rt, uid: Uid, cur: IntentView, next: IntentView): string {
  let lastHitter: string | null = null;
  let faceTo: string | null = null;
  let flare = false;
  for (const ev of proj.events) {
    if (ev.e === 'hit' && ev.to.side === 'enemy' && ev.to.uid === uid && ev.from.side === 'companion') {
      const fromUid = ev.from.uid;
      const comp = proj.c.companions.find((x) => x.uid === fromUid);
      lastHitter = comp ? (proj.pack.companions[comp.defId]?.name ?? 'Your Companion') : 'Your Companion';
    }
    if (ev.e === 'face' && ev.enemy === uid) faceTo = shadeName(ev.face);
    if (ev.e === 'status' && ev.to.side === 'enemy' && ev.to.uid === uid && ev.id === 'flare' && ev.delta > 0) flare = true;
  }
  if (faceTo) return `${lastHitter ?? 'Your end of turn'} will turn it to ${faceTo}.`;
  const e = findEnemy(proj, uid);
  const passive = e ? enemyDef(proj, e).passives?.find((p) => p.on === 'playerTurnEnd')?.name : undefined;
  if (flare) return `${passive ?? 'It'} will add Flare at the end of your turn.`;
  if (cur.moveId !== next.moveId && lastHitter) return `${lastHitter} will change its move.`;
  return 'This changes at the end of your turn.';
}

/** M2: every intent as it will be after 5.6 steps 1 to 6 (from the real interpreter, sealed). */
export function intentsView(s: GameState, ectx: EngineCtx): IntentView[] {
  const c = s.combat;
  if (!c || c.outcome) return [];
  const rt = createRt(s, ectx, { readonly: true });
  let proj: Rt | null = null;
  if (!c.pending) {
    proj = createRt(s, ectx, { sealed: true });
    try {
      endTurnSteps(proj, 6);
    } catch (err) {
      if (!(err instanceof SealedStop) && !(err instanceof CombatOver)) throw err;
    }
    if (proj.c.outcome) proj = null;
  }
  const out: IntentView[] = [];
  for (const e of c.enemies) {
    const cur = intentViewOf(rt, e);
    if (!cur) continue;
    const pe = proj ? findEnemy(proj, e.uid) : undefined;
    const next = pe && proj ? intentViewOf(proj, pe) : null;
    if (next && !sameNumbers(cur, next)) {
      out.push({ ...next, projected: true, projectedReason: projectionReason(proj!, e.uid, cur, next) });
    } else out.push(cur);
  }
  return out;
}

export function handHintsView(s: GameState, ectx: EngineCtx): HandHint[] {
  const c = s.combat;
  if (!c) return [];
  const rt = createRt(s, ectx, { readonly: true });
  const ps = c.player.statuses;
  const numbFirst = (ps.numb ?? 0) >= 1 && !c.turnFlags.firstCardDone;
  return c.piles.hand.map((uid) => {
    const card = c.cards[uid]!;
    const def = ectx.pack.cards[card.defId]!;
    const plan = c.outcome || c.pending ? null : planCard(rt, uid);
    if (!plan) {
      return {
        uid,
        playable: false,
        cost: typeof def.cost === 'number' ? def.cost : 0,
        inwardLegal: false,
        harmonizesNow: false,
        blend: blendOfLights(def.lights),
        relations: [],
        tends: null,
        soothes: [],
        chips: [],
        numbed: numbFirst && !isBuried(def) && def.lights.length > 0,
      };
    }
    const affordable = plan.cost <= c.energy;
    const shy = hasKeyword(def, card.upgraded, 'reachesShy');
    const targets = c.enemies.filter((e) => canTarget(rt, e, shy));
    const inward = affordable && inwardLegal(rt, plan);
    const outward = affordable && (def.target !== 'enemy' || targets.length > 0);
    const relations = c.enemies
      .filter((e) => canTarget(rt, e, true))
      .map((e) => {
        const spec = hitSpecFor(rt, e, 1, cardCtx(uid, e.uid, plan.effective, plan.harmonized));
        return { enemy: e.uid, relation: relationOf(plan.effective, typingOf(spec.target), { fromCard: true, lightningRod: spec.lightningRod }, ectx.rules).relation };
      });
    const tends = plan.effective.length > 0 && def.lights.length > 0 ? inwardTendCandidate(rt, plan.effective) : null;
    const soothes = [...new Set(plan.effective.map(afflictionSoothedBy))].filter((id) => (ps[id] ?? 0) > 0);
    const blend = blendOfLights(plan.effective);
    const chips: string[] = [];
    if (tends !== null) {
      const sh = ectx.pack.cards[c.cards[tends]!.defId]?.buried?.shade;
      if (sh) chips.push(`Tends Buried ${shadeName(sh)}`);
    }
    if (plan.harmonized) chips.push(blend ? `HARMONY -> ${capitalize(blend)}` : 'HARMONY');
    for (const id of soothes) chips.push(`Soothes ${statusName(ectx, id)}`);
    return {
      uid,
      playable: outward || inward,
      cost: plan.cost,
      inwardLegal: inward,
      harmonizesNow: plan.harmonized,
      blend,
      relations,
      tends,
      soothes,
      chips: chips.slice(0, 2),
      numbed: plan.greyed,
    };
  });
}

/** Rules text of a combat card with slots filled in context (target optional). */
export function cardTextView(s: GameState, ectx: EngineCtx, uid: Uid, target?: Uid): string {
  const c = s.combat;
  if (!c) throw new Error('No combat in progress');
  const card = c.cards[uid];
  if (!card) throw new Error(`Unknown card uid ${uid}`);
  const def = ectx.pack.cards[card.defId];
  if (!def) throw new Error(`Unknown card ${card.defId}`);
  const rt = createRt(s, ectx, { readonly: true });
  const plan = !c.pending && !c.outcome ? planCard(rt, uid) : null;
  const t = findEnemy(rt, target);
  const ctx = cardCtx(uid, t ? t.uid : null, plan ? plan.effective : [...def.lights], plan ? plan.harmonized : false);
  return describeInCombat(rt, def, card.upgraded, ctx, t, card.weight);
}
