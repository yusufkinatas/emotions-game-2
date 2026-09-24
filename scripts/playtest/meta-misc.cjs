// Map hover route and scrolling, the draw and discard piles in combat, and the Settings sliders by keyboard.
// Usage: PORT=5432 TAG=s11 NODE_PATH="$(npm root -g)" node scripts/playtest/meta-misc.cjs
const L = require('./meta-lib.cjs');
const TAG = process.env.TAG || 's11';

(async () => {
  const browser = await L.launch();
  const report = {};
  const { page, errors } = await L.openPage(browser, { query: '?tutorial=0' });

  // Map: hover a node three rows up and check the route edges light; Up/Down scroll the column.
  await L.loadState(page, `${TAG}-map-act2`);
  const target = await page.$$('.map-node-wrap .map-node');
  const far = target[target.length - 8];
  await far.hover();
  await page.waitForTimeout(250);
  report.routeEdges = await page.$$eval('.map-edge[data-state="route"]', (x) => x.length);
  report.detailTitle = await page.$eval('.map-detail h3', (x) => x.textContent);
  await L.shot(page, 'misc-map-route');
  await page.mouse.move(5, 5);
  // Hovering scrolled the far node into view, so step back down first, then up.
  const top0 = await page.$eval('.map-scroll', (x) => x.scrollTop);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(600);
  const top1 = await page.$eval('.map-scroll', (x) => x.scrollTop);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(600);
  const top2 = await page.$eval('.map-scroll', (x) => x.scrollTop);
  report.scroll = { top0, afterDown: top1, afterUp: top2, ok: top1 > top0 && top2 < top1 };
  await L.shot(page, 'misc-map-scrolled');

  // Combat piles: enter the first fight, then open the draw and discard piles.
  await page.evaluate(async () => {
    const app = window.heartward;
    await app.dispatch(app.engine.legalActions(app.state).find((a) => a.t === 'move'));
  });
  await L.idle(page);
  if ((await page.evaluate(() => window.heartward.state.phase.kind)) === 'combat') {
    await page.evaluate(() => window.heartward.openOverlay('draw'));
    await page.waitForTimeout(300);
    report.drawTitle = await page.$eval('.overlay__title', (x) => x.textContent);
    await L.shot(page, 'misc-draw-pile');
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const app = window.heartward;
      await app.dispatch({ t: 'endTurn' });
      app.openOverlay('discard');
    });
    await page.waitForTimeout(300);
    report.discardTitle = await page.$eval('.overlay__title', (x) => x.textContent);
    await L.shot(page, 'misc-discard-pile');
    await page.keyboard.press('Escape');
  }

  // Settings sliders by keyboard.
  await page.evaluate(() => window.heartward.openOverlay('settings'));
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  report.master = await page.evaluate(() => window.heartward.profile.settings.master);
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowLeft');
  report.sfx = await page.evaluate(() => window.heartward.profile.settings.sfx);
  report.focusStaysInDialog = await page.evaluate(() => !!document.activeElement.closest('.overlay'));
  report.errors = errors;
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
