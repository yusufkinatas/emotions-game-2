// Meta-screen tour: plays a whole run on one seed, preferring map nodes of kinds not seen yet, and saves a
// screenshot of the first time each screen (and screen variant) shows up. Combats are auto-played through
// the engine; every other screen is driven with the keyboard or real clicks.
// Usage: PORT=5431 SEED=5 W=1280 H=720 NODE_PATH="$(npm root -g)" node scripts/playtest/meta-tour.cjs
const L = require('./meta-lib.cjs');

const SEED = Number(process.env.SEED || 5);
const W = Number(process.env.W || 1280);
const H = Number(process.env.H || 720);
const TAG = process.env.TAG || `s${SEED}`;
const QUERY = process.env.QUERY || '';

(async () => {
  const browser = await L.launch();
  const { page, errors } = await L.openPage(browser, { width: W, height: H, query: `?seed=${SEED}${process.env.TUT ? '' : '&tutorial=0'}${QUERY}` });
  const seen = new Set();
  const shots = [];
  const snap = async (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    shots.push(await L.shot(page, `${TAG}-${key}`));
    // Keep the state so meta-shots.cjs can re-render this exact screen at other sizes and palettes.
    const json = await page.evaluate(() => (window.heartward.state ? window.heartward.engine.serialize(window.heartward.state) : null));
    if (json) L.saveState(`${TAG}-${key}`, json);
  };

  await snap('title');
  // Real input: toggle the tutorial off if it is on, then New Run.
  // TUT=1 keeps the fresh profile's tutorial run (it starts inside its first combat).
  const tut = await page.$('.title-toggle input');
  if (tut && (await tut.isChecked()) !== !!process.env.TUT) await tut.click();
  await page.click('.title-menu .btn--primary');
  await L.idle(page);

  const kindsSeen = new Set();
  for (let step = 0; step < 900; step++) {
    await L.idle(page);
    const info = await page.evaluate(() => {
      const app = window.heartward;
      const s = app.state;
      if (!s || app.screen === 'title') return { phase: 'title' };
      const ph = s.phase;
      let key = ph.kind;
      if (ph.kind === 'reward') key = `reward-${ph.offer.source}${ph.offer.compass ? '-compass' : ''}${ph.offer.fullBloom ? '-bloom' : ''}`;
      if (ph.kind === 'deckSelect') key = `deckSelect-${ph.purpose}`;
      if (ph.kind === 'event') key = `event-${ph.eventId}${ph.chosen !== null ? '-after' : ''}`;
      if (ph.kind === 'map') key = `map-act${s.run.act}`;
      if (ph.kind === 'shop') key = `shop-act${s.run.act}`;
      return { phase: ph.kind, key, act: s.run.act };
    });
    if (info.phase === 'title') break;
    if (info.phase === 'combat') {
      await L.autoCombat(page);
      continue;
    }
    await page.waitForTimeout(info.phase === 'wheelCloses' ? 2600 : 500);
    await snap(info.key);
    if (info.phase === 'victory' || info.phase === 'defeat') break;

    switch (info.phase) {
      case 'charmSelect':
        await page.keyboard.press('3');
        await page.keyboard.press('Enter');
        break;
      case 'map': {
        const target = await page.evaluate((seenKinds) => {
          const app = window.heartward;
          const s = app.state;
          const moves = app.engine.legalActions(s).filter((a) => a.t === 'move');
          const kind = (id) => s.run.map.nodes.find((n) => n.id === id).kind;
          const order = ['sanctuary', 'memory', 'haven', 'elite', 'chest', 'fight', 'boss'];
          const fresh = moves.filter((m) => !seenKinds.includes(kind(m.node)));
          const pool = fresh.length ? fresh : moves;
          pool.sort((a, b) => order.indexOf(kind(a.node)) - order.indexOf(kind(b.node)));
          const reach = moves.map((m) => m.node).sort((a, b) => s.run.map.nodes.find((n) => n.id === a).col - s.run.map.nodes.find((n) => n.id === b).col);
          return { key: reach.indexOf(pool[0].node) + 1, kind: kind(pool[0].node) };
        }, [...kindsSeen]);
        kindsSeen.add(target.kind);
        await page.keyboard.press(String(target.key));
        await page.waitForTimeout(150);
        await page.keyboard.press('Enter');
        break;
      }
      case 'reward': {
        // Take the first card with its key, take a Keepsake with K or a click, then Continue.
        const r = await page.evaluate(() => {
          const o = window.heartward.state.phase.offer;
          return { cards: o.cards.length && !o.taken.card, ks: o.keepsakes.length && !o.taken.keepsake, choice: o.keepsakeChoice };
        });
        if (r.cards) {
          await page.keyboard.press('1');
          await page.keyboard.press('Enter');
          await L.idle(page);
        }
        if (r.ks) {
          if (r.choice) await page.click('.reward-keepsake--pick:not(:disabled)');
          else await page.keyboard.press('k');
          await L.idle(page);
        }
        await page.keyboard.press('Enter');
        break;
      }
      case 'wheelCloses':
        await page.keyboard.press('2');
        await page.keyboard.press('Enter');
        break;
      case 'shop': {
        // Buy the first affordable thing once, then use Set Down once, then leave.
        const did = await page.evaluate(() => {
          const app = window.heartward;
          return app.ui.metaTourShop ?? 0;
        });
        if (did === 0) {
          await page.evaluate(() => (window.heartward.ui.metaTourShop = 1));
          const buy = await page.$('.shop-item:not(.is-sold):not(.is-short) > button');
          if (buy) {
            await buy.click();
            break;
          }
        }
        if (did <= 1) {
          await page.evaluate(() => (window.heartward.ui.metaTourShop = 2));
          const svc = await page.$('.shop-service:not([aria-disabled="true"])');
          if (svc) {
            await svc.click();
            break;
          }
        }
        await page.keyboard.press('l');
        break;
      }
      case 'haven': {
        const btn = await page.$('.haven-option:not([aria-disabled="true"])');
        if (btn) await btn.click();
        else await page.click('.haven-body .btn');
        break;
      }
      case 'event': {
        const cont = await page.$('.event-continue:not(:disabled)');
        if (cont) await cont.click();
        else {
          const opt = await page.$('.event-option:not([aria-disabled="true"])');
          if (opt) await opt.click();
        }
        break;
      }
      case 'deckSelect': {
        const card = await page.$('.card-grid__cell.is-eligible .card-face');
        if (card) {
          await card.click();
          await page.waitForTimeout(250);
          await snap(`${info.key}-picked`);
          await page.keyboard.press('Enter');
        } else await page.keyboard.press('s');
        break;
      }
      default:
        await L.act(page, 'true');
    }
    await page.waitForTimeout(120);
  }
  const final = await page.evaluate(() => window.heartward.state?.phase.kind);
  console.log(JSON.stringify({ final, screens: [...seen], errors }, null, 1));
  await browser.close();
})();
