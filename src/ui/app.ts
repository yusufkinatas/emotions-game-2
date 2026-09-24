// App controller: owns the GameState, dispatches actions through the engine, runs animations,
// autosaves, and mounts one screen controller per phase plus an optional overlay.
// The UI never computes game rules: every number comes from the engine.

import type { Action, Engine, GameEvent, GameState, NewRunOpts, Phase } from '../engine/types';
import { h } from './dom';
import * as storage from './storage';

export const SAVE_KEY = 'heartward.save';
export const PROFILE_KEY = 'heartward.profile';

export interface Settings {
  master: number;
  sfx: number;
  ui: number;
  ambience: number;
  muted: boolean;
  /** Animation speed multiplier; 0 = instant. */
  animSpeed: 1 | 2 | 0;
  motion: 'system' | 'full' | 'reduced';
  palette: 'default' | 'cb';
}

export interface Profile {
  v: 1;
  tutorialDone: boolean;
  seenTips: string[];
  settings: Settings;
  stats: { runs: number; wins: number; resolvedEndings: number };
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  sfx: 0.8,
  ui: 0.6,
  ambience: 0.5,
  muted: false,
  animSpeed: 1,
  motion: 'system',
  palette: 'default',
};

export type OverlayKey = 'deck' | 'codex' | 'settings' | 'pause' | 'draw' | 'discard' | 'log';
export type ScreenKey = 'title' | Phase['kind'];

export interface ScreenController {
  el: HTMLElement;
  /** Called after every state or UI change while this screen is mounted. */
  update(app: App): void;
  /** Play events produced by a step before the new state is rendered. Resolve when done or skipped. */
  animate?(events: GameEvent[], prev: GameState, next: GameState, app: App): Promise<void>;
  /** Return true if the key was handled. */
  onKey?(e: KeyboardEvent, app: App): boolean;
  destroy?(): void;
}

export type ScreenFactory = (app: App) => ScreenController;

/** Audio facade (implemented by src/ui/audio). No-op until main.ts installs the real one. */
export interface AudioApi {
  init(): void;
  setVolume(bus: 'master' | 'sfx' | 'ui' | 'ambience', v: number): void;
  setMuted(muted: boolean): void;
  [k: string]: unknown;
}

/** Coach marks (implemented by src/ui/tips.ts). */
export interface TipsApi {
  /** Show tip `id` once per profile, anchored to `anchor`. */
  show(id: string, anchor: Element | null, text: string): void;
  /** Dismiss the visible tip if it matches id (or any tip if omitted). */
  dismiss(id?: string): void;
  reset(): void;
}

export interface AppOptions {
  debug: boolean;
  seed?: number;
  encounter?: string;
  tutorial?: boolean;
  screens: Partial<Record<ScreenKey, ScreenFactory>>;
  overlays: Partial<Record<OverlayKey, ScreenFactory>>;
  fallback: ScreenFactory;
}

const noopAudio: AudioApi = { init() {}, setVolume() {}, setMuted() {} };
const noopTips: TipsApi = { show() {}, dismiss() {}, reset() {} };

export const sameAction = (a: Action, b: Action): boolean => JSON.stringify(a) === JSON.stringify(b);

export function loadProfile(): Profile {
  const p = storage.load<Profile>(PROFILE_KEY);
  if (!p || p.v !== 1) {
    return { v: 1, tutorialDone: false, seenTips: [], settings: { ...DEFAULT_SETTINGS }, stats: { runs: 0, wins: 0, resolvedEndings: 0 } };
  }
  return { ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } };
}

export class App {
  readonly engine: Engine;
  readonly root: HTMLElement;
  readonly options: AppOptions;
  audio: AudioApi = noopAudio;
  tips: TipsApi = noopTips;
  profile: Profile;
  /** True if localStorage works (otherwise the tutorial can be skipped explicitly). */
  readonly storageOk: boolean;

  state: GameState | null = null;
  screen: 'title' | 'run' = 'title';
  overlay: OverlayKey | null = null;
  /** Per-screen UI state bag (selection, focus, scroll). Cleared when the phase changes. */
  ui: Record<string, unknown> = {};
  busy = false;
  /** Plain-text event log for the log overlay (most recent last). */
  log: string[] = [];
  /** Actions taken this run with the run seed, for "Copy replay". */
  replay: { seed: number; opts: NewRunOpts; actions: Action[] } | null = null;

  /** Why the last Continue failed (a save that could not be read); the title shows it once. */
  saveNotice: string | null = null;

  private undoStack: GameState[] = [];
  /** The overlay to go back to when the current one closes (Pause > Codex returns to Pause). */
  private overlayBack: OverlayKey | null = null;
  private screenKey: ScreenKey | null = null;
  private screenCtl: ScreenController | null = null;
  private overlayCtl: ScreenController | null = null;
  private readonly stage: HTMLElement;
  private readonly overlayLayer: HTMLElement;
  private readonly listeners: ((events: GameEvent[], prev: GameState, next: GameState) => void)[] = [];
  private skipRequested = false;

  constructor(root: HTMLElement, engine: Engine, options: AppOptions) {
    this.root = root;
    this.engine = engine;
    this.options = options;
    this.profile = loadProfile();
    this.storageOk = storage.storageAvailable();
    this.stage = h('div', { class: 'app-stage' });
    this.overlayLayer = h('div', { class: 'app-overlay-layer' });
    root.replaceChildren(this.stage, this.overlayLayer);
    this.applySettings();
    window.addEventListener('keydown', (e) => this.onKey(e));
    // Any click during an animation fast-forwards it.
    root.addEventListener('pointerdown', () => {
      if (this.busy) this.skipRequested = true;
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Run lifecycle

  /** True if a saved run exists and can be read. An unreadable save is removed (and noted for the title). */
  hasSave(): boolean {
    const raw = storage.loadRaw(SAVE_KEY);
    if (raw === null) return false;
    if (this.readSave(raw)) return true;
    storage.remove(SAVE_KEY);
    this.saveNotice = 'Your saved run could not be read, so it was cleared.';
    return false;
  }

  private readSave(raw: string): GameState | null {
    try {
      return this.engine.deserialize(raw);
    } catch {
      return null;
    }
  }

  /**
   * Start a run. `debug` runs (the ?encounter= fight) neither overwrite the saved run nor count in the
   * profile's stats.
   */
  newRun(opts: NewRunOpts = {}, seed?: number, debug = false): void {
    const s = seed ?? this.options.seed ?? (Math.floor(Math.random() * 2 ** 31) >>> 0);
    const runOpts: NewRunOpts = { tutorial: opts.tutorial ?? !this.profile.tutorialDone, ...opts };
    this.state = this.engine.newRun(s, runOpts);
    this.replay = { seed: s, opts: runOpts, actions: [] };
    this.undoStack = [];
    this.log = [];
    this.screen = 'run';
    this.debugRun = debug;
    if (!debug) {
      // Unticking "Tutorial run" is an explicit opt-out: later New Runs (the ending's included) skip it too.
      if (opts.tutorial === false) this.profile.tutorialDone = true;
      this.profile.stats.runs += 1;
      this.saveProfile();
      this.persist();
    }
    this.render();
  }

  /** True while playing a debug fight (?encounter=): nothing is saved and the profile is untouched. */
  debugRun = false;

  continueRun(): boolean {
    const raw = storage.loadRaw(SAVE_KEY);
    const s = raw ? this.readSave(raw) : null;
    if (!s) {
      if (raw !== null) this.saveNotice = 'Your saved run could not be read, so it was cleared.';
      storage.remove(SAVE_KEY);
      return false;
    }
    this.debugRun = false;
    this.state = s;
    this.replay = null;
    this.undoStack = [];
    this.screen = 'run';
    this.render();
    return true;
  }

  abandonRun(): void {
    storage.remove(SAVE_KEY);
    this.state = null;
    this.toTitle();
  }

  toTitle(): void {
    this.screen = 'title';
    this.overlay = null;
    this.overlayBack = null;
    this.render();
  }

  // ---------------------------------------------------------------------------------------------
  // Actions

  isLegal(a: Action): boolean {
    return !!this.state && this.engine.legalActions(this.state).some((x) => sameAction(x, a));
  }

  /** Step the engine, animate the events, then render the new state. Ignores illegal actions. */
  async dispatch(a: Action): Promise<void> {
    const prev = this.state;
    if (!prev || this.busy || !this.isLegal(a)) return;
    this.busy = true;
    this.skipRequested = false;
    try {
      const { state: next, events, revealedHiddenInfo } = this.engine.step(prev, a);
      this.undoStack = revealedHiddenInfo || a.t !== 'play' ? [] : [...this.undoStack, prev];
      this.replay?.actions.push(a);
      for (const fn of this.listeners) fn(events, prev, next);
      const ctl = this.screenCtl;
      if (ctl?.animate && this.screenKey === prev.phase.kind) {
        await ctl.animate(events, prev, next, this);
      }
      const phaseChanged = prev.phase.kind !== next.phase.kind;
      this.state = next;
      if (phaseChanged) this.ui = {};
      this.onRunStateChanged(next);
      this.persist();
    } finally {
      this.busy = false;
    }
    this.render();
  }

  /** Animations poll this to fast-forward (a click or Space was pressed). */
  get skipping(): boolean {
    return this.skipRequested || this.profile.settings.animSpeed === 0;
  }

  /** Scale a duration by the animation speed setting (0 when instant or skipping). */
  dur(ms: number): number {
    if (this.skipping) return 0;
    return ms / (this.profile.settings.animSpeed || 1);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0 && !this.busy;
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.state = prev;
    this.replay?.actions.pop();
    this.persist();
    this.render();
  }

  /** Subscribe to every step (coach marks, audio, log). */
  onStep(fn: (events: GameEvent[], prev: GameState, next: GameState) => void): void {
    this.listeners.push(fn);
  }

  private onRunStateChanged(s: GameState): void {
    if (this.debugRun) return;
    const k = s.phase.kind;
    if (k === 'victory' || k === 'defeat') {
      storage.remove(SAVE_KEY);
      if (s.run.tutorial) this.profile.tutorialDone = true;
      if (k === 'victory') {
        this.profile.stats.wins += 1;
        if (s.phase.kind === 'victory' && s.phase.ending === 'resolved') this.profile.stats.resolvedEndings += 1;
      }
      this.saveProfile();
    } else if (s.run.tutorial && s.run.act >= 2 && !this.profile.tutorialDone) {
      this.profile.tutorialDone = true;
      this.saveProfile();
    }
  }

  private persist(): void {
    if (!this.state || this.debugRun) return;
    const k = this.state.phase.kind;
    if (k === 'victory' || k === 'defeat') return;
    storage.save(SAVE_KEY, this.engine.serialize(this.state));
  }

  // ---------------------------------------------------------------------------------------------
  // Profile and settings

  saveProfile(): void {
    storage.save(PROFILE_KEY, this.profile);
  }

  setSettings(patch: Partial<Settings>): void {
    this.profile.settings = { ...this.profile.settings, ...patch };
    this.saveProfile();
    this.applySettings();
    this.render();
  }

  reducedMotion(): boolean {
    const m = this.profile.settings.motion;
    if (m !== 'system') return m === 'reduced';
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  applySettings(): void {
    const s = this.profile.settings;
    const rootEl = document.documentElement;
    rootEl.dataset.palette = s.palette;
    rootEl.dataset.motion = this.reducedMotion() ? 'reduced' : 'full';
    this.audio.setMuted(s.muted);
    this.audio.setVolume('master', s.master);
    this.audio.setVolume('sfx', s.sfx);
    this.audio.setVolume('ui', s.ui);
    this.audio.setVolume('ambience', s.ambience);
  }

  // ---------------------------------------------------------------------------------------------
  // Overlays and rendering

  /** Open an overlay. With `back`, closing it (Esc, its close button) returns to that overlay instead. */
  openOverlay(o: OverlayKey, back: OverlayKey | null = null): void {
    this.overlay = o;
    this.overlayBack = back;
    this.render();
  }

  closeOverlay(): void {
    const back = this.overlayBack;
    this.overlayBack = null;
    this.overlay = back && this.state && this.screen === 'run' ? back : null;
    this.render();
  }

  currentScreenKey(): ScreenKey {
    if (this.screen === 'title' || !this.state) return 'title';
    return this.state.phase.kind;
  }

  render(): void {
    const key = this.currentScreenKey();
    if (key !== this.screenKey || !this.screenCtl) {
      this.screenCtl?.destroy?.();
      const factory = this.options.screens[key] ?? this.options.fallback;
      this.screenCtl = factory(this);
      this.screenKey = key;
      this.stage.replaceChildren(this.screenCtl.el);
      this.stage.dataset.screen = key;
    }
    this.screenCtl.update(this);

    if (this.overlay) {
      if (!this.overlayCtl || this.overlayLayer.dataset.overlay !== this.overlay) {
        this.overlayCtl?.destroy?.();
        const factory = this.options.overlays[this.overlay] ?? this.options.fallback;
        this.overlayCtl = factory(this);
        this.overlayLayer.replaceChildren(this.overlayCtl.el);
        this.overlayLayer.dataset.overlay = this.overlay;
      }
      this.overlayCtl.update(this);
      this.overlayLayer.hidden = false;
    } else {
      this.overlayCtl?.destroy?.();
      this.overlayCtl = null;
      this.overlayLayer.replaceChildren();
      delete this.overlayLayer.dataset.overlay;
      this.overlayLayer.hidden = true;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    if (this.busy && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
      this.skipRequested = true;
      e.preventDefault();
      return;
    }
    if (this.overlayCtl?.onKey?.(e, this)) return e.preventDefault();
    if (this.overlay && e.key === 'Escape') {
      this.closeOverlay();
      return e.preventDefault();
    }
    const k = e.key.toLowerCase();
    const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !['checkbox', 'radio', 'range', 'button'].includes((e.target as HTMLInputElement).type));
    // Mute works everywhere, overlays included (Settings shows its M key).
    if (k === 'm' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.setSettings({ muted: !this.profile.settings.muted });
      return e.preventDefault();
    }
    // The log is a side panel, not a modal: the fight behind it keeps its keys.
    if (this.overlay && this.overlay !== 'log') return;
    if (this.screenCtl?.onKey?.(e, this)) return e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.overlay) return;
    if (this.screen === 'run' && this.state) {
      if (k === 'c') this.openOverlay('codex');
      else if (k === 'd' && this.state.phase.kind !== 'combat') this.openOverlay('deck');
      else if (e.key === 'Escape') this.openOverlay('pause');
      else return;
    } else return;
    e.preventDefault();
  }
}
