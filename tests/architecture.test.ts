// Layering and determinism rules (DESIGN 20.2).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function files(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const importsOf = (src: string): string[] =>
  [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('architecture', () => {
  it('engine imports nothing from content, ui or sim and uses no DOM, clocks or Math.random', () => {
    for (const f of files(join(ROOT, 'src/engine'))) {
      const src = stripComments(readFileSync(f, 'utf8'));
      const rel = relative(ROOT, f);
      for (const imp of importsOf(src)) {
        expect(imp, `${rel} imports ${imp}`).not.toMatch(/content|\/ui|sim\//);
        expect(imp, `${rel} imports ${imp}`).not.toMatch(/^node:|^fs$|^path$/);
      }
      expect(src, `${rel} uses Math.random`).not.toMatch(/Math\.random/);
      expect(src, `${rel} uses Date.now`).not.toMatch(/Date\.now|new Date\(|performance\.now/);
      expect(src, `${rel} uses the DOM`).not.toMatch(/\b(document|window|localStorage)\./);
      expect(src, `${rel} uses structuredClone`).not.toMatch(/structuredClone/);
    }
  });

  it('content imports only engine types, dsl and rules (and other content files)', () => {
    for (const f of files(join(ROOT, 'src/content'))) {
      const src = stripComments(readFileSync(f, 'utf8'));
      const rel = relative(ROOT, f);
      for (const imp of importsOf(src)) {
        if (imp.startsWith('.') && !imp.includes('engine')) continue;
        expect(imp, `${rel} imports ${imp}`).toMatch(/engine\/(types|dsl|rules|emotions)$/);
      }
      expect(src, `${rel} uses Math.random`).not.toMatch(/Math\.random/);
    }
  });

  it('ui and sim import the engine only through engine/index (types via engine/types are allowed)', () => {
    for (const dir of ['src/ui', 'sim']) {
      for (const f of files(join(ROOT, dir))) {
        const src = stripComments(readFileSync(f, 'utf8'));
        const rel = relative(ROOT, f);
        for (const imp of importsOf(src)) {
          if (!imp.includes('engine/')) continue;
          expect(imp, `${rel} imports ${imp}`).toMatch(/engine\/(index|types|emotions|damage|rules)$/);
        }
      }
    }
  });

  it('only primitives.ts assigns hp/guard/energy in the engine', () => {
    const re = /\.(hp|guard|energy|maxHp)\s*([-+*/]?=(?!=)|\+\+|--)/;
    for (const f of files(join(ROOT, 'src/engine'))) {
      if (f.endsWith('primitives.ts')) continue;
      const rel = relative(ROOT, f);
      if (rel.includes('/run/') || rel.endsWith('step.ts') || rel.endsWith('index.ts')) continue; // run state is not combat
      const src = stripComments(readFileSync(f, 'utf8'));
      expect(re.test(src), `${rel} mutates hp/guard/energy outside primitives.ts`).toBe(false);
    }
  });
});
