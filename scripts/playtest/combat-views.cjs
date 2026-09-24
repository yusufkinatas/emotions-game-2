// Screenshots of a combat state at the three reference sizes, keyboard selection, greyscale and reduced
// motion. Usage: NODE_PATH="$(npm root -g)" node scripts/playtest/combat-views.cjs <baseUrl> <outDir> <query> [setupFile]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [base, outDir, query, setupFile] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const sizes = [[1280, 720], [1920, 1080], [1024, 576]];
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [w, h] of sizes) {
    for (const variant of ['plain', 'gray', 'reduced']) {
      if (variant !== 'plain' && w !== 1280) continue;
      const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: variant === 'reduced' ? 'reduce' : 'no-preference' });
      page.on('pageerror', (e) => errors.push(`${w}x${h} ${variant}: ${e}`));
      page.on('console', (m) => m.type() === 'error' && errors.push(`${w}x${h} ${variant}: ${m.text()}`));
      await page.goto(`${base}/?${query}${variant === 'gray' ? '&gray=1' : ''}`);
      await page.waitForTimeout(700);
      if (setupFile) await page.evaluate(fs.readFileSync(setupFile, 'utf8'));
      await page.evaluate(() => window.heartward.tips.dismiss());
      await page.waitForTimeout(2600);
      const tag = `${w}x${h}-${variant}`;
      await page.screenshot({ path: path.join(outDir, `${tag}-idle.png`) });
      // Keyboard: select card 1, move focus to the second target, hold Shift for the breakdown.
      await page.keyboard.press('1');
      await page.waitForTimeout(200);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(outDir, `${tag}-selected.png`) });
      const overflow = await page.evaluate(() => {
        const bad = [];
        for (const el of document.querySelectorAll('.combat *')) {
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > innerWidth + 2 || r.left < -2) && !el.closest('.cb-fx')) bad.push(el.className.baseVal ?? el.className);
        }
        return bad.slice(0, 8);
      });
      if (overflow.length) errors.push(`${tag} offscreen: ${overflow.join(' | ')}`);
      await page.close();
    }
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
