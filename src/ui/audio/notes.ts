// Pitch and timbre tables for the synth (DESIGN 18.2). Lights are pentatonic in wheel order, so walking
// the wheel plays a rising scale: Love C5, Joy D5, Friendship E5, Courage G5, Hope A5, Calm C6.

import type { Light, Shade } from '../../engine/emotions';

export const LIGHT_FREQ: Record<Light, number> = {
  love: 523.25,
  joy: 587.33,
  friendship: 659.25,
  courage: 783.99,
  hope: 880,
  calm: 1046.5,
};

/** Frequency ratio of n equal-tempered semitones. */
export const semis = (n: number): number => Math.pow(2, n / 12);

export interface VoiceSpec {
  /** Oscillator layers: type, detune in cents, relative gain, frequency multiple. */
  layers: { type: OscillatorType; detune?: number; gain: number; mult?: number }[];
  attack: number;
  release: number;
  /** Optional lowpass on the voice. */
  lowpass?: number;
  /** Reverb send 0..1. */
  reverb: number;
  /** Gentle vibrato depth in cents (Hope's shimmer). */
  vibrato?: number;
}

export const LIGHT_VOICE: Record<Light, VoiceSpec> = {
  // soft sine, slow attack
  love: { layers: [{ type: 'sine', gain: 1 }], attack: 0.07, release: 0.6, reverb: 0.25 },
  // triangle pluck
  joy: { layers: [{ type: 'triangle', gain: 1 }], attack: 0.004, release: 0.34, reverb: 0.15 },
  // two detuned saws through a lowpass
  friendship: {
    layers: [
      { type: 'sawtooth', detune: -8, gain: 0.5 },
      { type: 'sawtooth', detune: 8, gain: 0.5 },
    ],
    attack: 0.02,
    release: 0.42,
    lowpass: 1900,
    reverb: 0.2,
  },
  // square through a lowpass (brassy)
  courage: { layers: [{ type: 'square', gain: 0.6 }], attack: 0.03, release: 0.34, lowpass: 1500, reverb: 0.15 },
  // sine with octave shimmer
  hope: {
    layers: [
      { type: 'sine', gain: 0.85 },
      { type: 'sine', gain: 0.28, mult: 2 },
    ],
    attack: 0.05,
    release: 0.75,
    vibrato: 7,
    reverb: 0.35,
  },
  // sine, long release, reverb
  calm: { layers: [{ type: 'sine', gain: 0.9 }], attack: 0.04, release: 1.5, reverb: 0.65 },
};

export interface StrikeSpec {
  /** Noise band. */
  noise: { type: BiquadFilterType; freq: number; q: number; gain: number; dur: number };
  /** Low body. */
  sine: { from: number; to: number; gain: number; dur: number };
  /** Flavour extras. */
  distort?: boolean;
  tremolo?: number;
  echo?: { time: number; feedback: number };
  ticks?: number;
  thin?: number;
}

/** Shade strike flavours: Anger harsh, Sadness long, Fear tremolo, Loneliness echo, Anxiety ticks, Despair sub. */
export const STRIKE: Record<Shade | 'numb', StrikeSpec> = {
  anger: {
    noise: { type: 'bandpass', freq: 900, q: 1.1, gain: 0.55, dur: 0.22 },
    sine: { from: 120, to: 70, gain: 0.5, dur: 0.2 },
    distort: true,
  },
  sadness: {
    noise: { type: 'lowpass', freq: 520, q: 0.7, gain: 0.5, dur: 0.7 },
    sine: { from: 98, to: 70, gain: 0.45, dur: 0.8 },
  },
  loneliness: {
    noise: { type: 'bandpass', freq: 1200, q: 2, gain: 0.18, dur: 0.18 },
    sine: { from: 150, to: 110, gain: 0.3, dur: 0.25 },
    thin: 660,
    echo: { time: 0.26, feedback: 0.45 },
  },
  fear: {
    noise: { type: 'bandpass', freq: 1500, q: 1.6, gain: 0.85, dur: 0.32 },
    sine: { from: 150, to: 100, gain: 0.35, dur: 0.25 },
    tremolo: 18,
  },
  despair: {
    noise: { type: 'lowpass', freq: 220, q: 0.8, gain: 0.45, dur: 0.45 },
    sine: { from: 58, to: 34, gain: 0.9, dur: 0.55 },
  },
  anxiety: {
    noise: { type: 'highpass', freq: 2800, q: 0.8, gain: 0.25, dur: 0.035 },
    sine: { from: 130, to: 100, gain: 0.25, dur: 0.15 },
    ticks: 6,
  },
  numb: {
    noise: { type: 'lowpass', freq: 380, q: 0.6, gain: 0.35, dur: 0.3 },
    sine: { from: 90, to: 60, gain: 0.35, dur: 0.3 },
  },
};

/** Per-act drone: two detuned oscillators with a slowly drifting lowpass. The Deep is a single quiet sine. */
export const AMBIENCE = {
  1: { freq: 110, detune: 9, type: 'triangle' as OscillatorType, cutoff: 420, gain: 0.16 },
  2: { freq: 98, detune: 14, type: 'sawtooth' as OscillatorType, cutoff: 320, gain: 0.12 },
  deep: { freq: 82.4, detune: 0, type: 'sine' as OscillatorType, cutoff: 600, gain: 0.05 },
} as const;
