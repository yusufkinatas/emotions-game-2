// Measures how long End Turn animations block input at 1x (DESIGN 16.2: enemy phase <= 1.5 s).
// Usage: NODE_PATH="$(npm root -g)" node scripts/playtest/combat-timing.cjs <baseUrl> <query> [setupFile] [turns]
const { chromium } = require('playwright');
const fs = require('fs');
const [base, query, setupFile, turns = '4'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/?${query}`);
  await page.waitForTimeout(800);
  if (setupFile) {
    await page.evaluate(fs.readFileSync(setupFile, 'utf8'));
    await page.waitForTimeout(500);
  }
  const out = [];
  for (let i = 0; i < Number(turns); i++) {
    const r = await page.evaluate(async () => {
      const app = window.heartward;
      if (app.state?.phase.kind !== 'combat') return null;
      const shades = app.state.combat.enemies.length;
      const t0 = performance.now();
      const p = app.dispatch({ t: 'endTurn' });
      await p;
      return { shades, ms: Math.round(performance.now() - t0) };
    });
    if (!r) break;
    out.push(r);
    await page.waitForTimeout(300);
  }
  console.log(JSON.stringify({ out, errors }));
  await browser.close();
})();
