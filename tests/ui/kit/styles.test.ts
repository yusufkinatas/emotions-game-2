import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(__dirname, '../../../src/ui/styles');
const css = (f: string) => readFileSync(join(DIR, f), 'utf8');
const all = () => readdirSync(DIR).filter((f) => f.endsWith('.css')).map((f) => [f, css(f)] as const);

describe('styles', () => {
  it('defines every 16.0 token with its exact value', () => {
    const t = css('tokens.css').toLowerCase();
    const tokens: Record<string, string> = {
      '--bg-0': '#0e0c16',
      '--bg-1': '#1c1830',
      '--surface': '#231e33',
      '--text': '#ede8f5',
      '--text-2': '#a89fbf',
      '--pearl': '#f4efe6',
      '--silver': '#c7cedb',
      '--ink': '#15121f',
      '--ink-rim': '#2e2645',
      '--love': '#ff5c8a',
      '--joy': '#ffd23f',
      '--friendship': '#3ddc84',
      '--courage': '#ff8c42',
      '--hope': '#b18cff',
      '--calm': '#4cc9f0',
    };
    for (const [k, v] of Object.entries(tokens)) expect(t, k).toContain(`${k}: ${v};`);
    const cb = t.slice(t.indexOf("[data-palette='cb']"));
    for (const [k, v] of Object.entries({ '--love': '#cc79a7', '--joy': '#f0e442', '--friendship': '#009e73', '--courage': '#e69f00', '--hope': '#0072b2', '--calm': '#56b4e9' })) {
      expect(cb, k).toContain(`${k}: ${v};`);
    }
    expect(t).toContain('--u: min(calc(100vw / 1280), calc(100vh / 720));');
    expect(t).toContain(":root[data-motion='reduced']");
    expect(t).toContain('@media (prefers-reduced-motion: reduce)');
    expect(t).toContain('ui-rounded, system-ui, sans-serif');
    expect(t).toContain('ui-serif, georgia, serif');
  });

  it('keyframes animate transform and opacity only (18.3)', () => {
    // The Harmony arc's dash draw is the one allowed SVG attribute animation in CSS.
    const allowed = /^(transform|opacity|stroke-dashoffset)$/;
    for (const [file, text] of all()) {
      for (const m of text.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
        for (const prop of m[2]!.matchAll(/([a-z-]+)\s*:/g)) {
          expect(prop[1], `${file} ${m[1]}`).toMatch(allowed);
        }
      }
    }
  });

  it('reduced motion switches every kit animation variable', () => {
    const t = css('tokens.css');
    const defaults = new Set([...t.slice(0, t.indexOf("[data-palette='cb']")).matchAll(/(--a-[\w-]+):/g)].map((m) => m[1]));
    const reducedBlock = t.slice(t.indexOf(":root[data-motion='reduced']"), t.indexOf('@media (prefers-reduced-motion'));
    const reduced = new Set([...reducedBlock.matchAll(/(--a-[\w-]+):/g)].map((m) => m[1]));
    for (const name of defaults) {
      if (name === '--a-idle-numb') continue;
      expect(reduced.has(name), name).toBe(true);
    }
  });

  it('uses no external assets, web fonts or em dashes', () => {
    for (const [file, text] of all()) {
      expect(text, file).not.toMatch(/url\((?!["']?data:|#)/);
      expect(text, file).not.toMatch(/@font-face|@import\s+url\(\s*['"]?https?:/);
      expect(text, file).not.toContain('\u2014');
    }
  });
});
