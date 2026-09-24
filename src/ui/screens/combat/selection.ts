// Targeting (DESIGN 16.2): the selected card, every legal target for it with its engine preview, and
// the focused target. Legality always comes from engine.legalActions.

import type { Action, GameState, Preview, Uid } from '../../../engine/types';
import type { App } from '../../app';

export type TargetKey = number | 'inward' | 'none';

export interface TargetOption {
  key: TargetKey;
  action: Action;
  preview: Preview | null;
}

export interface Selection {
  card: Uid;
  /** INWARD first, then Shades left to right, then the untargeted play. */
  options: TargetOption[];
  focus: TargetKey;
}

const keyOf = (a: Action): TargetKey => (a.t !== 'play' ? 'none' : a.inward ? 'inward' : a.target !== undefined ? a.target : 'none');

/** Legal play actions of one card with their previews, or null if the card can't be played now. */
export function buildSelection(app: App, s: GameState, uid: Uid, prefer?: TargetKey | null): Selection | null {
  const c = s.combat;
  if (!c) return null;
  const acts = app.engine.legalActions(s).filter((a) => a.t === 'play' && a.card === uid);
  if (!acts.length) return null;
  const order = (k: TargetKey): number => {
    if (k === 'inward') return -1;
    if (k === 'none') return 1000;
    const i = c.enemies.findIndex((e) => e.uid === k);
    return i < 0 ? 999 : i;
  };
  const options = acts
    .map((a) => ({ key: keyOf(a), action: a, preview: app.engine.preview(s, a) }))
    .sort((a, b) => order(a.key) - order(b.key));
  return { card: uid, options, focus: defaultFocus(options, prefer ?? null, c.lastTarget) };
}

function defaultFocus(options: TargetOption[], prefer: TargetKey | null, lastTarget: Uid | null): TargetKey {
  const has = (k: TargetKey | null): k is TargetKey => k !== null && options.some((o) => o.key === k);
  if (has(prefer)) return prefer;
  if (has(lastTarget)) return lastTarget;
  const outward = options.find((o) => o.key !== 'inward');
  return (outward ?? options[0]!).key;
}

export function optionFor(sel: Selection | null, key: TargetKey | null): TargetOption | null {
  if (!sel || key === null) return null;
  return sel.options.find((o) => o.key === key) ?? null;
}

export const focusedOption = (sel: Selection | null): TargetOption | null => optionFor(sel, sel?.focus ?? null);

/** Cycle the focused target (Left/Right). */
export function cycleFocus(sel: Selection, dir: 1 | -1): TargetKey {
  const i = sel.options.findIndex((o) => o.key === sel.focus);
  const next = (i + dir + sel.options.length) % sel.options.length;
  return sel.options[next]!.key;
}

/** True if the card has an untargeted play (click the card again, the stage, or Enter). */
export const hasUntargeted = (sel: Selection): boolean => sel.options.some((o) => o.key === 'none');
export const hasEnemyTargets = (sel: Selection): boolean => sel.options.some((o) => typeof o.key === 'number');
