// Screenshot one combat URL at a viewport size and print console errors.
// Usage: NODE_PATH="$(npm root -g)" node scripts/playtest/combat-shot.cjs <url> <out.png> [width] [height] [js-to-run-before-shot]
const { chromium } = require('playwright');

(async () => {
  const [url, out, w = '1280', hgt = '720', script] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(hgt) } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(1200);
  if (script) {
    await page.evaluate(script);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: out });
  console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
  await browser.close();
})();
