// Sound building blocks for the synth (DESIGN 18.2): the audio graph shape, tones, filtered noise, Light
// voices and bells. Every function schedules nodes on an existing graph and never touches global state
// except a rolling offset into the shared noise buffer.

import type { Light } from '../../engine/emotions';
import { LIGHT_FREQ, LIGHT_VOICE } from './notes';

export type OutBus = 'sfx' | 'ui' | 'ambience';

/** The built audio graph: buses and the reverb send feed master -> compressor -> destination. */
export interface Graph {
  ctx: AudioContext;
  master: GainNode;
  buses: Record<OutBus, GainNode>;
  reverb: GainNode;
  /** One 1 s noise buffer shared by every noisy sound. */
  noise: AudioBuffer;
}

/** Stereo reverb impulse from exponentially decaying noise. */
export function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 0x1234567;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) | 0;
      const r = ((seed >>> 8) & 0xffff) / 32768 - 1;
      d[i] = r * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

let noiseOffset = 0;

export interface ToneOpts {
  type: OscillatorType;
  freq: number;
  t: number;
  attack: number;
  release: number;
  gain: number;
  bus: OutBus;
  detune?: number;
  lowpass?: number;
  reverb?: number;
  bendTo?: number;
  vibrato?: number;
}

export function tone(g: Graph, o: ToneOpts): void {
  const { ctx } = g;
  const osc = ctx.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, o.t);
  if (o.bendTo) osc.frequency.exponentialRampToValueAtTime(o.bendTo, o.t + o.attack + o.release);
  if (o.detune) osc.detune.value = o.detune;
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = o.vibrato;
    lfo.connect(depth);
    depth.connect(osc.detune);
    lfo.start(o.t);
    lfo.stop(o.t + o.attack + o.release + 0.05);
  }
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, o.t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), o.t + o.attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, o.t + o.attack + o.release);
  let head: AudioNode = osc;
  if (o.lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lowpass;
    head.connect(f);
    head = f;
  }
  head.connect(amp);
  amp.connect(g.buses[o.bus]);
  if (o.reverb) {
    const send = ctx.createGain();
    send.gain.value = o.reverb;
    amp.connect(send);
    send.connect(g.reverb);
  }
  osc.start(o.t);
  osc.stop(o.t + o.attack + o.release + 0.05);
}

export interface NoiseOpts {
  t: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  sweepTo?: number;
  bus: OutBus;
  attack?: number;
  reverb?: number;
  dest?: AudioNode;
}

export function noise(g: Graph, o: NoiseOpts): GainNode {
  const { ctx } = g;
  const src = ctx.createBufferSource();
  src.buffer = g.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter;
  f.frequency.setValueAtTime(o.freq, o.t);
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, o.t + o.dur);
  f.Q.value = o.q ?? 0.8;
  const amp = ctx.createGain();
  const a = o.attack ?? 0.005;
  amp.gain.setValueAtTime(0.0001, o.t);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), o.t + a);
  amp.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  src.connect(f);
  f.connect(amp);
  amp.connect(o.dest ?? g.buses[o.bus]);
  if (o.reverb) {
    const send = ctx.createGain();
    send.gain.value = o.reverb;
    amp.connect(send);
    send.connect(g.reverb);
  }
  noiseOffset = (noiseOffset + 0.137) % 0.5;
  src.start(o.t, noiseOffset);
  src.stop(o.t + o.dur + 0.05);
  return amp;
}

/** One Light's voice at time t. */
export function voice(g: Graph, l: Light, t: number, o: { gain?: number; mult?: number; lowpass?: number; releaseScale?: number; bendTo?: number } = {}): void {
  const spec = LIGHT_VOICE[l];
  const base = LIGHT_FREQ[l] * (o.mult ?? 1);
  for (const layer of spec.layers) {
    const freq = base * (layer.mult ?? 1);
    tone(g, {
      type: layer.type,
      freq,
      t,
      attack: spec.attack,
      release: spec.release * (o.releaseScale ?? 1),
      gain: 0.22 * layer.gain * (o.gain ?? 1),
      bus: 'sfx',
      ...(layer.detune ? { detune: layer.detune } : {}),
      ...(o.lowpass ?? spec.lowpass ? { lowpass: Math.min(o.lowpass ?? Infinity, spec.lowpass ?? Infinity) } : {}),
      reverb: spec.reverb,
      ...(o.bendTo ? { bendTo: freq * o.bendTo } : {}),
      ...(spec.vibrato ? { vibrato: spec.vibrato } : {}),
    });
  }
}

export function bell(g: Graph, freq: number, t: number, gain: number, release = 0.9): void {
  tone(g, { type: 'triangle', freq, t, attack: 0.004, release, gain, bus: 'sfx', reverb: 0.4 });
  tone(g, { type: 'sine', freq: freq * 2, t, attack: 0.004, release: release * 0.6, gain: gain * 0.35, bus: 'sfx', reverb: 0.4 });
}

