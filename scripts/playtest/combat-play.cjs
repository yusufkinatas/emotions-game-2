// Plays combat fights through the real UI (mouse or keyboard only) and saves screenshots of key moments.
// Usage: NODE_PATH="$(npm root -g)" node scripts/playtest/combat-play.cjs <baseUrl> <outDir> [mode=mouse|keys] [query] [w] [h] [maxSteps]
// The page exposes window.heartward (the App). The script reads state from it but acts only through
// clicks and key presses, like a player.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [base, outDir, mode = 'mouse', query = 'encounter=enc.a1.kettle&seed=3', w = '1280', hh = '720', maxSteps = '120', setupFile] = process.argv.slice(2);
// Optional setup: a JS file evaluated in the page after load (build a special fight state).
const setup = setupFile ? fs.readFileSync(setupFile, 'utf8') : null;
fs.mkdirSync(outDir, { recursive: true });

/** In-page: choose the best play by engine preview (Resolve first, then most Intensity), else end turn. */
function chooseInPage() {
  const app = window.heartward;
  const s = app.state;
  if (!s || s.phase.kind !== 'combat') return { kind: 'none', phase: s && s.phase.kind };
  const c = s.combat;
  const legal = app.engine.legalActions(s);
  if (c.pending) return { kind: 'choose', uid: legal[0].uid, index: 0 };
  let best = null;
  let bestScore = 0;
  for (const a of legal) {
    if (a.t !== 'play') continue;
    const p = app.engine.preview(s, a);
    if (!p) continue;
    let sc = 0.5;
    for (const t of p.targets) {
      sc += t.hpBefore - t.hpAfter;
      if (t.outcome === 'resolve' || t.outcome === 'deepResolve') sc += 200;
      if (t.outcome === 'suppress') sc += 20;
    }
    sc += (p.player.guardAfter - p.player.guardBefore) * 0.6 + (p.player.hpAfter - p.player.hpBefore);
    if (a.inward) sc += Object.values(p.player.cleansed).reduce((n, x) => n + x, 0) * 3 + (p.player.tended ? 8 : 0);
    if (sc > bestScore) { bestScore = sc; best = a; }
  }
  if (!best) return { kind: 'end' };
  const handOrder = [...document.querySelectorAll('.cb-hand .cb-card')].map((e) => Number(e.dataset.uid));
  const targetOrder = best.inward ? 'inward' : best.target !== undefined ? best.target : 'none';
  return { kind: 'play', card: best.card, target: targetOrder, handIndex: handOrder.indexOf(best.card), action: best };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(hh) }, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?${query}`);
  await page.waitForTimeout(900);
  if (query.includes('run=1')) {
    const tutorial = query.includes('tutorial=1');
    await page.evaluate((t) => {
      localStorage.clear();
      window.heartward.newRun({ tutorial: t });
    }, tutorial);
    await page.waitForTimeout(600);
  }
  if (setup) {
    await page.evaluate(setup);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, 'start.png') });
  }
  const shot = async (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
  const idle = async () => page.waitForFunction(() => !window.heartward.busy, null, { timeout: 15000 });
  let turnShots = 0;
  const runMode = query.includes('run=1');
  const maxFights = Number((query.match(/fights=(\d+)/) || [0, 99])[1]);
  let fights = 0;
  let combatIndex = 0;
  let lastPhase = '';
  let steps = 0;
  const seen = new Set();
  for (; steps < Number(maxSteps); steps++) {
    await idle();
    const pick = await page.evaluate(chooseInPage);
    if (pick.kind === 'none') {
      // Run mode: step through non-combat screens (not this script's subject) with the engine.
      if (!runMode || pick.phase === 'victory' || pick.phase === 'defeat' || !pick.phase) break;
      const moved = await page.evaluate(() => {
        const app = window.heartward;
        const legal = app.engine.legalActions(app.state);
        const order = ['takeKeepsake', 'takeCard', 'pickCharm', 'move', 'option', 'rest', 'continue', 'leave', 'skip', 'choose', 'confirm'];
        for (const t of order) {
          const a = legal.find((x) => x.t === t);
          if (a) {
            void app.dispatch(a);
            return t;
          }
        }
        return null;
      });
      if (!moved) break;
      lastPhase = pick.phase;
      await page.waitForTimeout(250);
      fights += pick.phase === 'reward' && moved === 'continue' ? 1 : 0;
      if (fights >= maxFights) break;
      continue;
    }
    if (pick.kind !== 'none' && lastPhase !== 'combat') {
      combatIndex++;
      await page.waitForTimeout(500);
      await shot(`fight-${combatIndex}-start`);
    }
    lastPhase = 'combat';
    if (pick.kind === 'choose') {
      if (mode === 'keys') await page.keyboard.press('1');
      else await page.click('.cb-pending button');
      continue;
    }
    if (pick.kind === 'end') {
      if (mode === 'keys') await page.keyboard.press('e');
      else await page.click('.cb-endturn');
      if (turnShots < 2) {
        await page.waitForTimeout(turnShots === 0 ? 420 : 700);
        await shot(`enemy-phase-${turnShots}`);
        turnShots++;
      }
      continue;
    }
    // Select the card.
    if (mode === 'keys') {
      const key = String((pick.handIndex + 1) % 10);
      await page.keyboard.press(key);
    } else {
      await page.click(`.cb-hand .cb-card[data-uid="${pick.card}"] .card-face`);
    }
    await page.waitForTimeout(120);
    const info = await page.evaluate(() => ({
      banners: [...document.querySelectorAll('.lethal-banner')].map((b) => b.className),
      callouts: document.querySelectorAll('.cb-callout').length,
      inward: !!document.querySelector('.inward-target'),
      line: document.querySelector('.cb-playline')?.textContent ?? '',
    }));
    for (const b of info.banners) {
      const k = b.split(' ').find((x) => x.startsWith('lethal-banner--'));
      if (k && !seen.has(k)) {
        seen.add(k);
        await shot(`select-${k.replace('lethal-banner--', '')}`);
      }
    }
    if (info.inward && !seen.has('inward')) {
      seen.add('inward');
      await shot('select-inward');
    }
    if (!seen.has('select') && info.callouts) {
      seen.add('select');
      await page.keyboard.down('Shift');
      await page.waitForTimeout(80);
      await shot('select-breakdown');
      await page.keyboard.up('Shift');
      await shot('select');
    }
    // Confirm the target.
    if (mode === 'keys') {
      const focus = await page.evaluate(() => document.activeElement?.className ?? '');
      // Cycle to the wanted target with Left/Right, reading the screen's focus through the model.
      for (let i = 0; i < 6; i++) {
        const ok = await page.evaluate((want) => {
          const f = document.querySelector('.cb-slot[data-focused="true"]');
          const inw = document.querySelector('.inward-target[data-focused="true"]');
          if (want === 'inward') return !!inw;
          if (want === 'none') return true;
          return f && Number(f.dataset.uid) === want;
        }, pick.target);
        if (ok) break;
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(40);
      }
      void focus;
      await page.keyboard.press('Enter');
    } else if (pick.target === 'inward') {
      await page.click('.inward-target');
    } else if (pick.target === 'none') {
      await page.click(`.cb-hand .cb-card[data-uid="${pick.card}"] .card-face`);
    } else {
      await page.click(`.cb-slot[data-uid="${pick.target}"] .cb-slot__hit`);
    }
    // Catch the impact mid-animation once.
    if (!seen.has('impact')) {
      seen.add('impact');
      await page.waitForTimeout(230);
      await shot('impact');
    }
  }
  await idle().catch(() => {});
  const end = await page.evaluate(() => ({ phase: window.heartward.state?.phase.kind, log: window.heartward.log.slice(-6) }));
  await shot('end');
  console.log(JSON.stringify({ steps, end, errors }, null, 1));
  await browser.close();
})();
