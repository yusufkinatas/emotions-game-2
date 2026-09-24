// previewCombat (DESIGN 20.1.6): the real interpreter on a clone with sealed RNG. Any draw or shuffle stops
// the run there and marks the preview uncertain; numbers after that point are not shown.

import { ST } from '../constants';
import { moveOutline } from '../conditions';
import { resolveStrikes } from '../damage';
import { cureOf } from '../emotions';
import type {
  Action,
  CombatState,
  Effect,
  EngineCtx,
  EnemyState,
  GameEvent,
  GameState,
  HitBreakdown,
  LethalOutcome,
  Preview,
  PreviewTarget,
  StatusBag,
  Uid,
} from '../types';
import { IllegalActionError } from '../types';
import { cardEffects, cardName, hasKeyword } from './cards';
import { enemyPhase } from './enemy';
import { canTarget, checkPlay, planCard, type PlayPlan } from './legal';
import { playCard } from './play';
import { numbBoss } from './buried';
import { CombatOver, createRt, enemyDef, SealedStop, showing, type Rt } from './runtime';
import { shadeName, statusName } from './text';
import { endTurnSteps } from './turn';
import { intentViewOf } from './view';

type PlayAction = Extract<Action, { t: 'play' }>;

export interface PreviewOpts {
  /** Skip the Resolve-with search (used for the nested previews of that search). */
  nested?: boolean;
}

export function previewAction(s: GameState, ectx: EngineCtx, a: Action, opts: PreviewOpts = {}): Preview | null {
  const c0 = s.combat;
  if (!c0 || c0.outcome || c0.pending) return null;
  if (a.t !== 'play' && a.t !== 'endTurn') return null;
  const rt = createRt(s, ectx, { sealed: true });
  let plan: PlayPlan | null = null;
  if (a.t === 'play') {
    try {
      plan = checkPlay(rt, a);
    } catch (err) {
      if (err instanceof IllegalActionError) return null;
      throw err;
    }
  }
  let uncertain = false;
  try {
    if (a.t === 'play') playCard(rt, plan!, a.inward ? null : (a.target ?? null), a.inward === true);
    else {
      endTurnSteps(rt, 8);
      enemyPhase(rt);
    }
  } catch (err) {
    if (err instanceof SealedStop) uncertain = true;
    else if (!(err instanceof CombatOver)) throw err;
  }
  return summarize(s, ectx, a, rt, plan, uncertain, opts);
}

function statusDiff(before: StatusBag, after: StatusBag, skip: string | null): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (k === skip) continue;
    const b = before[k] ?? 0;
    const a = after[k] ?? 0;
    if (a !== b) out[k] = [b, a];
  }
  return out;
}

function sameStatuses(a: StatusBag, b: StatusBag): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

function summarize(
  s: GameState,
  ectx: EngineCtx,
  a: Action,
  rt: Rt,
  plan: PlayPlan | null,
  uncertain: boolean,
  opts: PreviewOpts,
): Preview {
  const before = s.combat!;
  const after = rt.c;
  const hits = new Map<Uid, HitBreakdown[]>();
  const resolved = new Map<Uid, Extract<GameEvent, { e: 'resolved' }>>();
  const wavering = new Set<Uid>();
  const cleansed: StatusBag = {};
  let endTurnLoss = 0;
  for (const ev of rt.events) {
    if (ev.e === 'hit' && ev.to.side === 'enemy') {
      const list = hits.get(ev.to.uid) ?? [];
      list.push(ev.b);
      hits.set(ev.to.uid, list);
    } else if (ev.e === 'resolved') resolved.set(ev.enemy, ev);
    else if (ev.e === 'wavering') wavering.add(ev.enemy);
    else if (ev.e === 'cleanse') cleansed[ev.id] = (cleansed[ev.id] ?? 0) + ev.removed;
    else if (ev.e === 'strike') endTurnLoss += ev.amount - ev.blocked;
    else if (ev.e === 'hpLoss') endTurnLoss += ev.amount;
  }
  const actionTarget = a.t === 'play' && !a.inward ? (a.target ?? null) : null;
  const goneBefore = new Set(before.gone.map((g) => g.uid));
  const targets: PreviewTarget[] = [];
  for (const e0 of before.enemies) {
    const e1 = after.enemies.find((x) => x.uid === e0.uid);
    const gone = after.gone.find((g) => g.uid === e0.uid && !goneBefore.has(g.uid));
    const hs = hits.get(e0.uid) ?? [];
    const intentChanged = (e1?.intent?.moveId ?? null) !== (e0.intent?.moveId ?? null);
    const statusesChanged = e1 ? !sameStatuses(e0.statuses, e1.statuses) : false;
    const changed =
      hs.length > 0 ||
      !!gone ||
      !e1 ||
      e1.hp !== e0.hp ||
      e1.guard !== e0.guard ||
      e1.maxHp !== e0.maxHp ||
      e1.faceIndex !== e0.faceIndex ||
      statusesChanged ||
      intentChanged ||
      e0.uid === actionTarget;
    if (!changed) continue;
    const last = hs[hs.length - 1];
    const outcome: LethalOutcome | null = gone ? gone.outcome : wavering.has(e0.uid) ? 'wavering' : null;
    const r = resolved.get(e0.uid);
    targets.push({
      uid: e0.uid,
      hpBefore: e0.hp,
      hpAfter: e1 ? e1.hp : (last?.hpAfter ?? 0),
      maxHpAfter: e1 ? e1.maxHp : e0.maxHp,
      guardBefore: e0.guard,
      guardAfter: e1 ? e1.guard : (last?.guardAfter ?? 0),
      hits: hs,
      outcome,
      flareDelta: e1 ? (e1.statuses[ST.flare] ?? 0) - (e0.statuses[ST.flare] ?? 0) : 0,
      faceAfter: e1 ? showing(e1) : (gone?.face ?? showing(e0)),
      gauges: e1 ? statusDiff(e0.statuses, e1.statuses, ST.flare) : {},
      intentAfter: e1 && (intentChanged || statusesChanged || e1.faceIndex !== e0.faceIndex) ? intentViewOf(rt, e1) : null,
      buried: rt.notes.buried[e0.uid] ?? null,
      afterglows: r ? r.afterglows.slice() : [],
      glimmers: r ? r.glimmers : 0,
    });
  }

  const p0 = before.player;
  const p1 = after.player;
  let incomingLoss = endTurnLoss;
  let lethalToPlayer = after.outcome === 'lost' || (after.paperCraneUsed && !before.paperCraneUsed);
  if (a.t === 'play') {
    incomingLoss = projectedLoss(rt, p1.guard);
    lethalToPlayer = lethalToPlayer || (after.outcome !== 'won' && p1.hp - incomingLoss <= 0);
  }
  const preview: Preview = {
    action: a,
    targets,
    player: {
      hpBefore: p0.hp,
      hpAfter: p1.hp,
      guardBefore: p0.guard,
      guardAfter: p1.guard,
      energyAfter: after.energy,
      cleansed,
      statuses: statusDiff(p0.statuses, p1.statuses, null),
      tended: rt.notes.tended ? { ...rt.notes.tended } : null,
      incomingLoss,
      lethalToPlayer,
    },
    harmonized: plan?.harmonized ?? false,
    effectiveLights: plan ? plan.effective.slice() : [],
    noteAfter: after.note.slice(),
    cost: plan?.cost ?? 0,
    uncertain,
    partial: after.pending !== null,
    line: '',
    resolveWith: [],
  };
  if (a.t === 'play' && !opts.nested) preview.resolveWith = resolveWith(s, ectx, a, targets);
  preview.line = playLine(rt, before, a, plan, preview);
  return preview;
}

/** Seething tick plus the current intents' strikes against your Guard (play previews). */
function projectedLoss(rt: Rt, guard: number): number {
  let g = guard;
  let loss = rt.c.player.statuses[ST.seething] ?? 0;
  for (const e of rt.c.enemies) {
    if (!e.intent) continue;
    for (const st of moveOutline(rt, e, e.intent.moveId).strikes) {
      const r = resolveStrikes(st.perStrike, st.count, g, Number.MAX_SAFE_INTEGER);
      g = r.guardAfter;
      loss += r.hpLoss;
    }
  }
  return loss;
}

const hasHit = (e: Effect): boolean =>
  e.op === 'hit' || (e.op === 'if' && (e.then.some(hasHit) || (e.else ?? []).some(hasHit))) || (e.op === 'promise' && e.effects.some(hasHit));

/** Cards in hand that could Resolve a Shade this play would Suppress (SUPPRESS banner "Resolve with"). */
function resolveWith(s: GameState, ectx: EngineCtx, a: PlayAction, targets: PreviewTarget[]): Uid[] {
  const suppressed = targets.filter((t) => t.outcome === 'suppress').map((t) => t.uid);
  if (suppressed.length === 0) return [];
  const c = s.combat!;
  const rt = createRt(s, ectx, { readonly: true });
  // Cheap filter before the nested previews: a card can only Resolve with a hit carrying a cure of one of
  // the Shade's faces, two Lights against numb rules, or on an Understood Shade.
  const couldResolve = (plan: PlayPlan): boolean =>
    cardEffects(plan.def, plan.upgraded).some(hasHit) &&
    suppressed.some((uid) => {
      const e = c.enemies.find((x) => x.uid === uid);
      if (!e) return false;
      if (e.faces.length === 0) return plan.effective.length >= 2;
      return (e.statuses[ST.understood] ?? 0) > 0 || e.faces.some((f) => plan.effective.includes(cureOf(f)));
    });
  const out: Uid[] = [];
  for (const uid of c.piles.hand) {
    if (uid === a.card) continue;
    const plan = planCard(rt, uid);
    if (!plan || plan.cost > c.energy || !couldResolve(plan)) continue;
    const shy = hasKeyword(plan.def, plan.upgraded, 'reachesShy');
    const tries: Action[] = [];
    if (plan.def.target === 'enemy') {
      for (const t of suppressed) {
        const e = c.enemies.find((x) => x.uid === t);
        if (e && canTarget(rt, e, shy)) tries.push({ t: 'play', card: uid, target: t });
      }
    } else if (plan.def.target === 'all') tries.push({ t: 'play', card: uid });
    for (const act of tries) {
      const p = previewAction(s, ectx, act, { nested: true });
      if (p && p.targets.some((t) => suppressed.includes(t.uid) && (t.outcome === 'resolve' || t.outcome === 'deepResolve'))) {
        out.push(uid);
        break;
      }
    }
  }
  return out;
}

function relationWord(b: HitBreakdown): string {
  switch (b.relation) {
    case 'opposite':
      return 'OPPOSITE x2';
    case 'dissonant':
      return b.typePct === 100 ? 'DISSONANT x1' : 'DISSONANT x1/2';
    case 'felt':
      return 'FELT x2';
    case 'muffled':
      return 'MUFFLED x1/2';
    case 'veiled':
      return 'VEILED';
    default:
      return 'x1';
  }
}

function outcomeLine(rt: Rt, t: PreviewTarget, e0: EnemyState | undefined): string {
  switch (t.outcome) {
    case 'resolve':
    case 'deepResolve': {
      const bits = [t.outcome === 'deepResolve' ? 'DEEP RESOLVE' : 'RESOLVE'];
      if (t.glimmers > 0) bits.push(`+${t.glimmers} Glimmers`);
      const insight = e0 ? surfacedInsightLine(rt, e0) : null;
      if (insight) bits.push(insight);
      for (const sh of t.afterglows) {
        const ag = rt.pack.afterglows[sh];
        if (ag) bits.push(`${ag.name}: ${ag.text.replace(/\.$/, '')}`);
      }
      return ` Finishes it: ${bits.join(', ')}.`;
    }
    case 'suppress': {
      if (t.buried) {
        const name = `Buried ${shadeName(t.buried.shade)}`;
        if (t.buried.overflow) return ` Finishes it: SUPPRESS. ${name} is full: lose ${rt.rules.buriedOverflowMaxHeart} max Heart.`;
        if (t.buried.weightAfter === 1) return ` Finishes it: SUPPRESS. ${name} joins your deck (Weight 1).`;
        return ` Finishes it: SUPPRESS. ${name} W${(t.buried.weightAfter ?? 1) - 1} -> W${t.buried.weightAfter}.`;
      }
      const growth = e0 ? surfacedGrowthLine(rt, e0) : null;
      return growth ? ` Finishes it: SUPPRESS. ${growth}.` : ' Finishes it: SUPPRESS.';
    }
    case 'fade':
      return ' It fades.';
    case 'wavering':
      return ' It stops at 1.';
    default:
      return '';
  }
}

/** 16.2 RESOLVE sub-line of a Surfaced Shade, read from the mutation its Resolve recorded on the clone. */
function surfacedInsightLine(rt: Rt, e0: EnemyState): string | null {
  if (e0.surfacedFrom === null) return null;
  for (let i = rt.c.mutations.length - 1; i >= 0; i--) {
    const m = rt.c.mutations[i]!;
    if (m.k === 'transform' && m.uid === e0.surfacedFrom) return `Insight: ${rt.pack.cards[m.to]?.name ?? m.to} joins your hand`;
    if (m.k === 'remove' && m.uid === e0.surfacedFrom) {
      const shade = showing(e0);
      return shade ? `Buried ${shadeName(shade)} is released` : 'Its Buried card is released';
    }
  }
  return null;
}

/** 16.2 SUPPRESS sub-line of a Surfaced Shade: the boss grows +10 x Weight ("The Numbness +20 Intensity"). */
function surfacedGrowthLine(rt: Rt, e0: EnemyState): string | null {
  if (e0.surfacedFrom === null) return null;
  const boss = numbBoss(rt);
  if (!boss) return null;
  const grow = rt.rules.surfacedSuppressGrowPerWeight * (rt.c.cards[e0.surfacedFrom]?.weight ?? 1);
  return `${enemyDef(rt, boss).name} +${grow} Intensity`;
}

/** DESIGN 16.2 Play Line: one sentence built from engine data. `c0` is the state before the action. */
function playLine(rt: Rt, c0: CombatState, a: Action, plan: PlayPlan | null, p: Preview): string {
  if (a.t === 'endTurn') {
    const loss = p.player.incomingLoss;
    const tail = p.uncertain ? ' (then new cards are drawn)' : '';
    if (p.player.lethalToPlayer) return `End turn: you lose ${loss} Heart. Lethal: you will fall.${tail}`;
    return `End turn: you lose ${loss} Heart.${tail}`;
  }
  if (!plan || a.t !== 'play') return '';
  const name = cardName(plan.def, plan.upgraded);
  const before = rt.c;
  if (a.inward) {
    const parts: string[] = [];
    for (const [id, n] of Object.entries(p.player.cleansed)) parts.push(`clear ${n} ${statusName(rt, id)}`);
    const t = p.player.tended;
    if (t) {
      const sh = rt.pack.cards[before.cards[t.uid]?.defId ?? '']?.buried?.shade ?? rt.pack.cards[before.cards[t.uid]?.defId ?? '']?.insightOf;
      const label = sh ? `Buried ${shadeName(sh)}` : 'a Buried card';
      if (t.insight) parts.push(`Tend ${label}: it becomes ${rt.pack.cards[t.insight]?.name ?? t.insight}`);
      else if (t.removed) parts.push(`Tend ${label}: it is released`);
      else parts.push(`Tend ${label} (W${t.weightAfter + 1} -> W${t.weightAfter})`);
    }
    return `${name} -> Inward: ${parts.join('. ') || 'nothing'}.`;
  }
  const sentences: string[] = [];
  const main = p.targets.filter((t) => t.hits.length > 0);
  if (main.length > 0) {
    const bits = main.map((t) => {
      const e = rt.pack.enemies[findDefId(rt, t.uid)];
      const total = t.hits.reduce((n, h) => n + h.damage, 0);
      const rel = relationWord(t.hits[0]!);
      return `${e?.name ?? 'Shade'}: ${total} (${rel}).${outcomeLine(rt, t, c0.enemies.find((x) => x.uid === t.uid))}`;
    });
    sentences.push(`${name} -> ${bits.join(' ')}`);
  } else {
    const parts: string[] = [];
    const g = p.player.guardAfter - p.player.guardBefore;
    if (g > 0) parts.push(`gain ${g} Guard`);
    const m = p.player.hpAfter - p.player.hpBefore;
    if (m > 0) parts.push(`Mend ${m}`);
    sentences.push(`${name}${parts.length ? `: ${parts.join(', ')}` : ''}.`);
  }
  if (p.harmonized) sentences.push('Harmonized.');
  if (p.uncertain) sentences.push('Then draws.');
  return sentences.join(' ').replace(/\s+\./g, '.').replace(/\.\./g, '.');
}

function findDefId(rt: Rt, uid: Uid): string {
  return rt.c.enemies.find((e) => e.uid === uid)?.defId ?? rt.c.gone.find((g) => g.uid === uid)?.defId ?? '';
}

