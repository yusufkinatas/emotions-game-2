import { describe, expect, it } from 'vitest';
import { createSynth, synth } from '../../../src/ui/audio/synth';
import type { Synth } from '../../../src/ui/audio/synth';

function exercise(s: Synth): void {
  s.init();
  s.unlock();
  s.setVolume('sfx', 0.5);
  s.setVolume('master', 2);
  s.setMuted(true);
  s.setMuted(false);
  s.light('love', 'opposite');
  s.light(['love', 'joy'], 'felt');
  s.light('calm', 'dissonant');
  s.light('joy', 'muffled');
  s.light([], 'neutral');
  s.light('hope', 'veiled');
  s.harmony(['love', 'joy']);
  s.harmony(['joy', 'friendship']);
  s.resetHarmony();
  s.resolve('joy');
  s.resolve(['love', 'joy'], true);
  s.suppress();
  s.inward('calm');
  for (const sh of ['anger', 'sadness', 'loneliness', 'fear', 'despair', 'anxiety', 'numb'] as const) s.strike(sh);
  for (const u of ['hover', 'play', 'spirit', 'notEnough', 'glimmer', 'confirm', 'cancel'] as const) s.ui(u);
  s.glimmers(30);
  s.ambience(1);
  s.ambienceBrighten();
  s.ambience('deep');
  s.ambience(null);
  s.wheelCloses();
  s.heartbeat();
}

/** A permissive fake AudioContext: every node method is a no-op, every param records its last target. */
function fakeAudio() {
  const created: string[] = [];
  const param = () => {
    const p = {
      value: 0,
      last: 0,
      setValueAtTime: (v: number) => ((p.last = v), p),
      linearRampToValueAtTime: (v: number) => ((p.last = v), p),
      exponentialRampToValueAtTime: (v: number) => ((p.last = v), p),
      setTargetAtTime: (v: number) => ((p.last = v), p),
      cancelScheduledValues: () => p,
    };
    return p;
  };
  const node = (kind: string): unknown => {
    created.push(kind);
    const params = new Map<string, ReturnType<typeof param>>();
    const base: Record<string, unknown> = {
      connect: () => undefined,
      disconnect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
      type: '',
      buffer: null,
      curve: null,
      loop: false,
    };
    return new Proxy(base, {
      get(t, prop: string) {
        if (prop in t) return t[prop];
        if (!params.has(prop)) params.set(prop, param());
        return params.get(prop);
      },
      set(t, prop: string, v) {
        t[prop] = v;
        return true;
      },
    });
  };
  let instance: Record<string, unknown> | null = null;
  class FakeContext {
    currentTime = 0;
    sampleRate = 8000;
    state = 'suspended';
    destination = node('destination');
    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      instance = this as unknown as Record<string, unknown>;
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    createBuffer(ch: number, len: number) {
      const data = Array.from({ length: ch }, () => new Float32Array(len));
      return { getChannelData: (i: number) => data[i]! };
    }
    createGain = () => node('gain');
    createOscillator = () => node('oscillator');
    createBiquadFilter = () => node('filter');
    createBufferSource = () => node('source');
    createConvolver = () => node('convolver');
    createDynamicsCompressor = () => node('compressor');
    createDelay = () => node('delay');
    createWaveShaper = () => node('shaper');
  }
  return { FakeContext: FakeContext as unknown as new () => AudioContext, created, get instance() { return instance; } };
}

describe('synth', () => {
  it('never throws without WebAudio (headless tests)', () => {
    const s = createSynth({ AudioContext: null, gestureTarget: null });
    expect(() => exercise(s)).not.toThrow();
    expect(s.ready).toBe(false);
    expect(() => exercise(synth)).not.toThrow();
  });

  it('never throws when the AudioContext constructor fails', () => {
    class Broken {
      constructor() {
        throw new Error('no audio device');
      }
    }
    const s = createSynth({ AudioContext: Broken as unknown as new () => AudioContext, gestureTarget: null });
    expect(() => exercise(s)).not.toThrow();
    expect(s.ready).toBe(false);
  });

  it('creates the context on the first gesture, only once', () => {
    const fake = fakeAudio();
    const listeners = new Map<string, () => void>();
    const target = {
      addEventListener: (e: string, fn: () => void) => listeners.set(e, fn),
      removeEventListener: (e: string) => listeners.delete(e),
    };
    const s = createSynth({ AudioContext: fake.FakeContext, gestureTarget: target as never });
    s.light('love', 'opposite');
    expect(s.ready).toBe(false);
    s.init();
    expect([...listeners.keys()]).toEqual(['pointerdown', 'keydown', 'touchstart']);
    listeners.get('pointerdown')!();
    expect(s.ready).toBe(true);
    expect(listeners.size).toBe(0);
    expect(fake.created.filter((k) => k === 'compressor')).toHaveLength(1);
  });

  it('plays through the graph and remembers volumes and mute', () => {
    const fake = fakeAudio();
    const s = createSynth({ AudioContext: fake.FakeContext, gestureTarget: null });
    s.setVolume('ui', 0.2);
    s.unlock();
    const before = fake.created.length;
    expect(() => exercise(s)).not.toThrow();
    expect(fake.created.length).toBeGreaterThan(before + 50);
    expect(fake.created).toContain('oscillator');
    expect(s.getVolume('ui')).toBe(0.2);
    expect(s.getVolume('master')).toBe(1);
    s.setMuted(true);
    expect(s.muted).toBe(true);
    s.dispose();
    expect(s.ready).toBe(false);
  });
});
