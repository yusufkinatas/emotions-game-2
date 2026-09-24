// One combat decision point: the state, its intents and the distinct candidate plays with their previews.
// Built once per decision and shared by every belief that scores it (the divergence probe reuses it).

import type {
  Action,
  CardDef,
  CombatState,
  Engine,
  EnemyState,
  GameState,
  IntentView,
  Preview,
  Uid,
} from '../../src/engine/index';

export interface Candidate {
  /** Merge key: identical def + upgrade + card memory + target (21.1 distinct legal actions). */
  key: string;
  action: Extract<Action, { t: 'play' }>;
  preview: Preview | null;
  def: CardDef;
  upgraded: boolean;
  inward: boolean;
}

export interface CombatView {
  engine: Engine;
  s: GameState;
  c: CombatState;
  legal: Action[];
  candidates: Candidate[];
  intents: Map<Uid, IntentView>;
  /** Strike total per Shade from its displayed intent (threat_t in 21.1). */
  threat: Map<Uid, number>;
  /** Sum of all threats (incoming strikes before Guard). */
  incoming: number;
  /** Rough number of turns this combat still lasts. */
  turnsLeft: number;
  floorsLeft: number;
  hasCompass: boolean;
  mirror: boolean;
  /** Lazily computed: ending the turn now would drop Heart to 0 (resolveOnly). */
  dyingIfEndTurn(): boolean;
}

/** Total Floors of a run (2 acts of 10 + The Deep's 3, DESIGN 3.1). */
export const RUN_FLOORS = 23;
/** Heart of Shade Intensity a typical deck removes per turn, for the turns-left estimate. */
const EASE_PER_TURN = 14;

export const strikeTotal = (iv: IntentView | null | undefined): number =>
  iv?.strikes ? iv.strikes.perStrike * iv.strikes.count : 0;

export function enemyOf(c: CombatState, uid: Uid): EnemyState | undefined {
  for (const e of c.enemies) if (e.uid === uid) return e;
  return undefined;
}

function candidateKey(c: CombatState, a: Extract<Action, { t: 'play' }>): string {
  const card = c.cards[a.card]!;
  const head = `${card.defId}:${card.upgraded ? 1 : 0}:${card.mem.lingered}:${card.mem.timesPlayed}`;
  return a.inward ? `${head}:in` : `${head}:${a.target ?? '-'}`;
}

export function buildCombatView(engine: Engine, s: GameState, legal: Action[], opts: { previews: boolean } = { previews: true }): CombatView {
  const c = s.combat!;
  const intents = new Map<Uid, IntentView>();
  const threat = new Map<Uid, number>();
  let incoming = 0;
  for (const iv of engine.intents(s)) {
    intents.set(iv.enemy, iv);
    const t = strikeTotal(iv);
    threat.set(iv.enemy, t);
    incoming += t;
  }
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const a of legal) {
    if (a.t !== 'play') continue;
    const key = candidateKey(c, a);
    if (seen.has(key)) continue;
    seen.add(key);
    const card = c.cards[a.card]!;
    candidates.push({
      key,
      action: a,
      preview: opts.previews ? engine.preview(s, a) : null,
      def: engine.pack.cards[card.defId]!,
      upgraded: card.upgraded,
      inward: a.inward === true,
    });
  }
  let hpLeft = 0;
  for (const e of c.enemies) if (!e.fleeting) hpLeft += e.hp + e.guard;
  const keepsakes = s.run.keepsakes;
  let dying: boolean | null = null;
  return {
    engine,
    s,
    c,
    legal,
    candidates,
    intents,
    threat,
    incoming,
    turnsLeft: Math.max(1, Math.min(6, Math.ceil(hpLeft / EASE_PER_TURN))),
    floorsLeft: Math.max(0, RUN_FLOORS - s.run.floor),
    hasCompass: keepsakes.some((k) => k.id === 'ks.compass'),
    mirror: keepsakes.some((k) => k.id === 'ks.mirror_shard'),
    dyingIfEndTurn() {
      if (dying === null) dying = engine.preview(s, { t: 'endTurn' })?.player.lethalToPlayer ?? false;
      return dying;
    },
  };
}
