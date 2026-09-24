// WebAudio synthesis (DESIGN 18.2): no audio files, one AudioContext created on the first user gesture.
// Graph: buses (sfx, ui, ambience) and a reverb return -> master gain -> compressor -> destination.
// Every public method is safe to call at any time: before the first gesture, without WebAudio (tests,
// old browsers) or after an audio error, calls simply do nothing. Muting loses no information because
// every sound has a visual equivalent in the UI.

import type { Light, Relation, Shade } from '../../engine/emotions';
import { AMBIENCE, LIGHT_FREQ, STRIKE, semis } from './notes';
import { bell, impulse, noise, tone, voice } from './voices';
import type { Graph } from './voices';

export type Bus = 'master' | 'sfx' | 'ui' | 'ambience';
export type UiSound = 'hover' | 'play' | 'spirit' | 'notEnough' | 'glimmer' | 'confirm' | 'cancel';
export type AmbienceAct = 1 | 2 | 'deep' | null;

export interface Synth {
  /** Install one-time listeners so the AudioContext is created on the first pointer, key or touch. */
  init(): void;
  /** Create (or resume) the AudioContext now. Call only inside a user-gesture handler. */
  unlock(): void;
  /** True once the AudioContext exists and the graph is built. */
  readonly ready: boolean;
  /** Bus volume 0..1 (master, sfx, ui, ambience). Remembered before the context exists. */
  setVolume(bus: Bus, v: number): void;
  getVolume(bus: Bus): number;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  /** A hit's sound: the Light's voice shaped by the relation (opposite, dissonant, felt, muffled, neutral, veiled). */
  light(lights: Light | readonly Light[], relation?: Relation): void;
  /** Harmony: previous and current notes together; a chain within 3 s keeps adding notes. */
  harmony(lights: readonly Light[]): void;
  /** Forget the Harmony chain (e.g. at end of turn). */
  resetHarmony(): void;
  /** Resolve: major arpeggio from the Light's root plus shimmer. deep = arpeggio of both roots. */
  resolve(lights: Light | readonly Light[], deep?: boolean): void;
  /** Suppress: low thump, muffled noise, a tritone pair. */
  suppress(): void;
  /** Inward play: a soft reversed swell into the Light's note. */
  inward(light: Light): void;
  /** A Shade's strike, flavoured by its showing face ('numb' for Apathy and The Numbness). */
  strike(shade: Shade | 'numb'): void;
  /** UI sounds: hover tick, play whoosh, Spirit pluck, not-enough double thud, Glimmer tick, confirm, cancel. */
  ui(kind: UiSound): void;
  /** Glimmer count-up: one tick per Glimmer, at most 12. */
  glimmers(count: number): void;
  /** Start the per-act drone (null stops it). Resets the brightening. */
  ambience(act: AmbienceAct): void;
  /** Open the drone's filter one notch (call once per Resolve in the fight). */
  ambienceBrighten(): void;
  /** "The wheel closes" chord. */
  wheelCloses(): void;
  /** Low Heart heartbeat (one lub-dub). */
  heartbeat(): void;
  /** Close the context and forget everything (tests, hot reload). */
  dispose(): void;
}

type Ctor = new () => AudioContext;

export interface SynthEnv {
  /** AudioContext constructor. Default: globalThis.AudioContext or webkitAudioContext. */
  AudioContext?: Ctor | null;
  /** Where to listen for the first gesture. Default: globalThis.window, if any. */
  gestureTarget?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null;
}

const DEFAULT_VOLUME: Record<Bus, number> = { master: 0.8, sfx: 0.8, ui: 0.55, ambience: 0.5 };
const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const;

interface Drone {
  stop(at: number): void;
  filter: BiquadFilterNode;
  base: number;
}

/** Swallow a possibly-rejected promise (resume and close may return undefined in fakes). */
function settle(p: unknown): void {
  if (p && typeof (p as Promise<unknown>).catch === 'function') (p as Promise<unknown>).catch(() => undefined);
}

function findCtor(): Ctor | null {
  const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function findTarget(): SynthEnv['gestureTarget'] {
  const g = globalThis as unknown as { window?: EventTarget };
  return g.window ?? null;
}

/** Build a synth. The app uses the shared `synth`; tests inject a fake AudioContext. */
export function createSynth(env: SynthEnv = {}): Synth {
  const volumes: Record<Bus, number> = { ...DEFAULT_VOLUME };
  let muted = false;
  let graph: Graph | null = null;
  let failed = false;
  let listening = false;
  let drone: Drone | null = null;
  let droneAct: AmbienceAct = null;
  let brighten = 0;
  let chain: Light[] = [];
  let chainAt = -Infinity;

  const ctorOf = (): Ctor | null => (env.AudioContext === undefined ? findCtor() : env.AudioContext);
  const targetOf = () => (env.gestureTarget === undefined ? findTarget() : env.gestureTarget);

  // ---------------------------------------------------------------------------------------------
  // Graph
  // ---------------------------------------------------------------------------------------------

  function build(): Graph | null {
    if (graph || failed) return graph;
    const Ctor = ctorOf();
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 3;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;
      comp.connect(ctx.destination);
      const master = ctx.createGain();
      master.gain.value = muted ? 0 : volumes.master;
      master.connect(comp);
      const bus = (v: number) => {
        const g = ctx.createGain();
        g.gain.value = v;
        g.connect(master);
        return g;
      };
      const buses = { sfx: bus(volumes.sfx), ui: bus(volumes.ui), ambience: bus(volumes.ambience) };
      // Reverb: impulse from decaying noise, fed by per-voice sends.
      const conv = ctx.createConvolver();
      conv.buffer = impulse(ctx, 2.2, 3);
      const reverb = ctx.createGain();
      reverb.gain.value = 1;
      const ret = ctx.createGain();
      ret.gain.value = 0.32;
      reverb.connect(conv);
      conv.connect(ret);
      ret.connect(master);
      // One 1 s noise buffer, reused by every noisy sound.
      const noise = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate)), ctx.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 0x2545f491;
      for (let i = 0; i < data.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        data[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
      }
      graph = { ctx, master, buses, reverb, noise };
      if (ctx.state === 'suspended') settle(ctx.resume());
      if (droneAct !== null) startDrone(droneAct);
      return graph;
    } catch {
      failed = true;
      graph = null;
      return null;
    }
  }

  /** Run a sound recipe only when the graph exists; swallow any audio error. */
  function play(fn: (g: Graph, t: number) => void): void {
    const g = graph;
    if (!g) return;
    try {
      fn(g, g.ctx.currentTime + 0.005);
    } catch {
      // Audio must never break the game.
    }
  }

  function unlockNow(): void {
    try {
      const g = build();
      if (g && g.ctx.state === 'suspended') settle(g.ctx.resume());
    } catch {
      // ignore
    }
  }

  const onGesture = (): void => {
    unlockNow();
    const t = targetOf();
    if (graph && t) for (const e of GESTURES) t.removeEventListener(e, onGesture, true);
  };

  // ---------------------------------------------------------------------------------------------
  // Shared strike effects (built once per graph, not per strike)
  // ---------------------------------------------------------------------------------------------

  let curve: Float32Array<ArrayBuffer> | null = null;
  const echoes = new Map<string, AudioNode>();

  /** The Anger distortion curve, computed once. */
  function distortionCurve(): Float32Array<ArrayBuffer> {
    if (curve) return curve;
    curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh(((i / 255) * 2 - 1) * 3.2);
    return curve;
  }

  /** A persistent echo send (delay with feedback) per echo setting, created on first use and reused. */
  function echoSend(g: Graph, echo: { time: number; feedback: number }): AudioNode {
    const key = `${echo.time}:${echo.feedback}`;
    const hit = echoes.get(key);
    if (hit) return hit;
    const { ctx } = g;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = echo.time;
    const fb = ctx.createGain();
    fb.gain.value = echo.feedback;
    const mix = ctx.createGain();
    mix.gain.value = 1;
    mix.connect(g.buses.sfx);
    mix.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(g.buses.sfx);
    echoes.set(key, mix);
    return mix;
  }

  // ---------------------------------------------------------------------------------------------
  // Ambience
  // ---------------------------------------------------------------------------------------------

  function startDrone(act: Exclude<AmbienceAct, null>): void {
    const g = graph;
    if (!g) return;
    const { ctx } = g;
    const spec = AMBIENCE[act];
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(spec.gain, t + 2.5);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = spec.cutoff;
    filter.Q.value = 0.9;
    filter.connect(out);
    out.connect(g.buses.ambience);
    const oscs: OscillatorNode[] = [];
    const detunes = spec.detune ? [-spec.detune, spec.detune] : [0];
    for (const d of detunes) {
      const o = ctx.createOscillator();
      o.type = spec.type;
      o.frequency.value = spec.freq;
      o.detune.value = d;
      o.connect(filter);
      o.start(t);
      oscs.push(o);
    }
    // Slow filter drift.
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.05;
    depth.gain.value = spec.cutoff * 0.3;
    lfo.connect(depth);
    depth.connect(filter.frequency);
    lfo.start(t);
    oscs.push(lfo);
    drone = {
      filter,
      base: spec.cutoff,
      stop: (at) => {
        out.gain.cancelScheduledValues(at);
        out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), at);
        out.gain.exponentialRampToValueAtTime(0.0001, at + 1.5);
        for (const o of oscs) o.stop(at + 1.6);
      },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------------------------

  const api: Synth = {
    init() {
      try {
        const t = targetOf();
        if (!t || listening || graph) return;
        listening = true;
        for (const e of GESTURES) t.addEventListener(e, onGesture, true);
      } catch {
        // ignore
      }
    },

    unlock() {
      unlockNow();
    },

    get ready() {
      return graph !== null;
    },

    setVolume(bus, v) {
      const val = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
      volumes[bus] = val;
      play((g, t) => {
        const node = bus === 'master' ? g.master : g.buses[bus];
        const target = bus === 'master' && muted ? 0 : val;
        node.gain.cancelScheduledValues(t);
        node.gain.setTargetAtTime(target, t, 0.03);
      });
    },

    getVolume(bus) {
      return volumes[bus];
    },

    setMuted(m) {
      muted = m;
      play((g, t) => {
        g.master.gain.cancelScheduledValues(t);
        g.master.gain.setTargetAtTime(m ? 0 : volumes.master, t, 0.03);
      });
    },

    get muted() {
      return muted;
    },

    light(lights, relation = 'neutral') {
      const ls: readonly Light[] = typeof lights === 'string' ? [lights] : lights;
      play((g, t) => {
        if (relation === 'veiled') {
          noise(g, { t, dur: 0.18, gain: 0.3, filter: 'lowpass', freq: 300, bus: 'sfx' });
          return;
        }
        if (ls.length === 0) {
          tone(g, { type: 'sine', freq: 740, t, attack: 0.005, release: 0.25, gain: 0.12, bus: 'sfx', reverb: 0.2 });
          return;
        }
        const [a, b] = ls as [Light, Light | undefined];
        switch (relation) {
          case 'opposite':
            voice(g, a, t);
            voice(g, a, t + 0.01, { mult: 2, gain: 0.55 });
            if (b) voice(g, b, t + 0.02, { gain: 0.6 });
            break;
          case 'dissonant':
            voice(g, a, t, { releaseScale: 0.45, bendTo: 0.94 });
            tone(g, { type: 'sine', freq: LIGHT_FREQ[a] * semis(1), t, attack: 0.005, release: 0.16, gain: 0.14, bus: 'sfx', bendTo: LIGHT_FREQ[a] * semis(1) * 0.93 });
            break;
          case 'felt':
            voice(g, a, t);
            voice(g, b ?? a, t, { mult: b ? 1 : 2 });
            break;
          case 'muffled':
            voice(g, a, t, { lowpass: 400, gain: 2.6 });
            break;
          default:
            voice(g, a, t);
            if (b) voice(g, b, t, { gain: 0.8 });
        }
      });
    },

    harmony(lights) {
      play((g, t) => {
        if (g.ctx.currentTime - chainAt > 3) chain = [];
        chainAt = g.ctx.currentTime;
        for (const l of lights) if (!chain.includes(l)) chain.push(l);
        chain = chain.slice(-6);
        chain.forEach((l, i) => voice(g, l, t + i * 0.012, { gain: 0.75 / Math.sqrt(chain.length), releaseScale: 1.6 }));
      });
    },

    resetHarmony() {
      chain = [];
      chainAt = -Infinity;
    },

    resolve(lights, deep = false) {
      const ls: readonly Light[] = typeof lights === 'string' ? [lights] : lights;
      play((g, t) => {
        const roots = (deep ? ls.slice(0, 2) : ls.slice(0, 1)).map((l) => LIGHT_FREQ[l]);
        if (roots.length === 0) roots.push(LIGHT_FREQ.love);
        const steps = [0, 4, 7];
        let k = 0;
        for (const step of steps) {
          for (const root of roots) {
            bell(g, root * semis(step), t + k * 0.06, 0.18);
            k++;
          }
        }
        bell(g, roots[0]! * 2, t + k * 0.06, 0.12, 1.4);
        noise(g, { t: t + 0.03, dur: 0.7, gain: 0.08, filter: 'highpass', freq: 6000, sweepTo: 9000, bus: 'sfx', attack: 0.08, reverb: 0.5 });
      });
    },

    suppress() {
      play((g, t) => {
        tone(g, { type: 'sine', freq: 80, t, attack: 0.004, release: 0.45, gain: 0.7, bus: 'sfx', bendTo: 40 });
        noise(g, { t, dur: 0.32, gain: 0.25, filter: 'lowpass', freq: 400, bus: 'sfx' });
        tone(g, { type: 'sine', freq: 220, t: t + 0.08, attack: 0.02, release: 0.7, gain: 0.07, bus: 'sfx', reverb: 0.3 });
        tone(g, { type: 'sine', freq: 220 * semis(6), t: t + 0.08, attack: 0.02, release: 0.7, gain: 0.06, bus: 'sfx', reverb: 0.3 });
      });
    },

    inward(l) {
      play((g, t) => {
        const { ctx } = g;
        const swell = 0.36;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(LIGHT_FREQ[l] / 2, t);
        osc.frequency.exponentialRampToValueAtTime(LIGHT_FREQ[l], t + swell);
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(0.16, t + swell);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + swell + 0.04);
        osc.connect(amp);
        amp.connect(g.buses.sfx);
        const send = ctx.createGain();
        send.gain.value = 0.5;
        amp.connect(send);
        send.connect(g.reverb);
        osc.start(t);
        osc.stop(t + swell + 0.08);
        noise(g, { t, dur: swell, gain: 0.05, filter: 'bandpass', freq: 800, sweepTo: 3000, bus: 'sfx', attack: swell * 0.9 });
        voice(g, l, t + swell - 0.02);
      });
    },

    strike(shade) {
      const spec = STRIKE[shade] ?? STRIKE.numb;
      play((g, t) => {
        const { ctx } = g;
        let dest: AudioNode = g.buses.sfx;
        if (spec.echo) dest = echoSend(g, spec.echo);
        if (spec.distort) {
          // One shaper per strike, fed the shared curve; it is released with the strike's sources.
          const shaper = ctx.createWaveShaper();
          shaper.curve = distortionCurve();
          shaper.connect(dest);
          dest = shaper;
        }
        if (spec.tremolo) {
          const trem = ctx.createGain();
          trem.gain.value = 0.5;
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = spec.tremolo;
          depth.gain.value = 0.5;
          lfo.connect(depth);
          depth.connect(trem.gain);
          lfo.start(t);
          lfo.stop(t + spec.noise.dur + 0.1);
          trem.connect(dest);
          dest = trem;
        }
        const ticks = spec.ticks ?? 1;
        for (let i = 0; i < ticks; i++) {
          noise(g, { t: t + i * 0.045, dur: spec.noise.dur, gain: spec.noise.gain * 0.5, filter: spec.noise.type, freq: spec.noise.freq, q: spec.noise.q, bus: 'sfx', dest });
        }
        const s = spec.sine;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(s.from, t);
        osc.frequency.exponentialRampToValueAtTime(s.to, t + s.dur);
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(s.gain * 0.5, t + 0.008);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + s.dur);
        osc.connect(amp);
        amp.connect(dest);
        osc.start(t);
        osc.stop(t + s.dur + 0.05);
        if (spec.thin) tone(g, { type: 'sine', freq: spec.thin, t, attack: 0.01, release: 0.3, gain: 0.06, bus: 'sfx', reverb: 0.3 });
      });
    },

    ui(kind) {
      play((g, t) => {
        switch (kind) {
          case 'hover':
            tone(g, { type: 'sine', freq: 2400, t, attack: 0.002, release: 0.03, gain: 0.08, bus: 'ui' });
            break;
          case 'play':
            noise(g, { t, dur: 0.18, gain: 0.4, filter: 'bandpass', freq: 600, sweepTo: 2600, q: 1.4, bus: 'ui', attack: 0.04 });
            break;
          case 'spirit':
            tone(g, { type: 'triangle', freq: 880, t, attack: 0.002, release: 0.13, gain: 0.12, bus: 'ui' });
            break;
          case 'notEnough':
            tone(g, { type: 'sine', freq: 95, t, attack: 0.004, release: 0.12, gain: 0.35, bus: 'ui' });
            tone(g, { type: 'sine', freq: 85, t: t + 0.13, attack: 0.004, release: 0.14, gain: 0.35, bus: 'ui' });
            break;
          case 'glimmer':
            tone(g, { type: 'sine', freq: 1760, t, attack: 0.002, release: 0.06, gain: 0.07, bus: 'ui' });
            tone(g, { type: 'sine', freq: 2637, t, attack: 0.002, release: 0.05, gain: 0.04, bus: 'ui' });
            break;
          case 'confirm':
            tone(g, { type: 'triangle', freq: LIGHT_FREQ.love, t, attack: 0.004, release: 0.12, gain: 0.1, bus: 'ui' });
            tone(g, { type: 'triangle', freq: LIGHT_FREQ.courage, t: t + 0.07, attack: 0.004, release: 0.18, gain: 0.1, bus: 'ui' });
            break;
          case 'cancel':
            tone(g, { type: 'triangle', freq: LIGHT_FREQ.courage, t, attack: 0.004, release: 0.1, gain: 0.08, bus: 'ui' });
            tone(g, { type: 'triangle', freq: LIGHT_FREQ.love, t: t + 0.06, attack: 0.004, release: 0.14, gain: 0.08, bus: 'ui' });
            break;
        }
      });
    },

    glimmers(count) {
      const n = Math.max(0, Math.min(12, Math.floor(count)));
      play((g, t) => {
        for (let i = 0; i < n; i++) {
          const f = 1760 * semis(i % 5);
          tone(g, { type: 'sine', freq: f, t: t + i * 0.055, attack: 0.002, release: 0.05, gain: 0.06, bus: 'ui' });
        }
      });
    },

    ambience(act) {
      droneAct = act;
      brighten = 0;
      play((g) => {
        const now = g.ctx.currentTime;
        if (drone) drone.stop(now);
        drone = null;
        if (act !== null) startDrone(act);
      });
    },

    ambienceBrighten() {
      brighten = Math.min(8, brighten + 1);
      play((_g, t) => {
        if (!drone) return;
        const target = drone.base * (1 + brighten * 0.22);
        drone.filter.frequency.cancelScheduledValues(t);
        drone.filter.frequency.setTargetAtTime(target, t, 0.6);
      });
    },

    wheelCloses() {
      play((g, t) => {
        (['love', 'joy', 'friendship', 'courage', 'hope', 'calm'] as const).forEach((l, i) => voice(g, l, t + i * 0.09, { gain: 0.6, releaseScale: 2 }));
      });
    },

    heartbeat() {
      play((g, t) => {
        tone(g, { type: 'sine', freq: 62, t, attack: 0.01, release: 0.14, gain: 0.35, bus: 'sfx' });
        tone(g, { type: 'sine', freq: 55, t: t + 0.19, attack: 0.01, release: 0.18, gain: 0.28, bus: 'sfx' });
      });
    },

    dispose() {
      try {
        const t = targetOf();
        if (t) for (const e of GESTURES) t.removeEventListener(e, onGesture, true);
        listening = false;
        drone = null;
        droneAct = null;
        echoes.clear();
        if (graph) settle(graph.ctx.close());
      } catch {
        // ignore
      }
      graph = null;
      failed = false;
    },
  };
  return api;
}

/** The game's shared synth. Call synth.init() once at boot. */
export const synth: Synth = createSynth();
