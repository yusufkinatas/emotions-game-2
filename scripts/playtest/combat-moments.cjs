// Captures specific combat moments mid-animation (Harmony, face turn, Resolve, Suppress, Undo, lethal).
// Usage: NODE_PATH="$(npm root -g)" node scripts/playtest/combat-moments.cjs <baseUrl> <outDir> [scenario...]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [base, outDir, ...only] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

// In-page helpers: start a fight from an encounter with a fixed hand and optional tweaks.
const START = (enc, hand, tweak = '', pre = '') => `(() => {
  const app = window.heartward; const eng = app.engine;
  let s = eng.newRun(9, { tutorial: false });
  s.run.keepsakes.push({ id: 'ks.compass', counter: 0 });
  s.run.act = 2;
  ${pre}
  s = eng.debug.startCombat(s, '${enc}');
  s = eng.debug.setHand(s, ${JSON.stringify(hand)});
  ${tweak}
  app.state = s; app.screen = 'run'; app.render(); app.tips.dismiss();
})()`;

const SCENARIOS = {
  harmony: [
    { eval: START('enc.a2.old_grudge', ['love.kind_word', 'joy.bright_spark', 'friendship.reach_out', 'courage.brave_strike', 'courage.stand_firm']) },
    { card: 'love.kind_word' }, { target: 0 }, { idle: true },
    { card: 'joy.bright_spark' }, { shot: 'harmony-select', after: 150 }, { target: 0 },
    { shot: 'harmony-arc', after: 330 }, { idle: true }, { shot: 'harmony-after', after: 50 },
  ],
  faceTurn: [
    { eval: START('enc.a2.old_grudge', ['love.kind_word', 'joy.bright_spark', 'friendship.reach_out']) },
    { card: 'love.kind_word' }, { shot: 'face-select', after: 150 }, { target: 0 },
    { shot: 'face-impact', after: 260 }, { shot: 'face-turn', after: 180 }, { idle: true }, { shot: 'face-after', after: 50 },
  ],
  resolve: [
    { eval: START('enc.a1.kettle', ['love.kind_word', 'joy.bright_spark'], 's.combat.enemies[0].hp = 9;') },
    { card: 'love.kind_word' }, { shot: 'resolve-banner', after: 150 }, { target: 0 },
    { shot: 'resolve-1', after: 330 }, { shot: 'resolve-2', after: 260 }, { shot: 'resolve-3', after: 350 },
  ],
  suppress: [
    { eval: START('enc.a1.kettle', ['courage.brave_strike', 'joy.bright_spark', 'love.kind_word'], 's.combat.enemies[0].hp = 5;') },
    { card: 'courage.brave_strike' }, { shot: 'suppress-banner', after: 150 }, { target: 0 },
    { shot: 'suppress-1', after: 330 }, { shot: 'suppress-2', after: 300 }, { shot: 'suppress-3', after: 300 },
  ],
  undo: [
    { eval: START('enc.a2.wallflower_fret', ['love.kind_word', 'joy.bright_spark', 'courage.stand_firm']) },
    { card: 'courage.stand_firm' }, { card: 'courage.stand_firm' }, { idle: true }, { shot: 'undo-before', after: 100 },
    { key: 'z' }, { shot: 'undo-after', after: 200 },
  ],
  lethal: [
    { eval: START('enc.a1.kettle', ['courage.stand_firm', 'joy.bright_spark'], 's.combat.player.hp = 6;') },
    { shot: 'lethal', after: 400 }, { endTurnHover: true }, { shot: 'lethal-endturn-hover', after: 200 },
  ],
  mask: [
    { eval: START('enc.a1.mask', ['love.kind_word', 'joy.bright_spark', 'friendship.reach_out', 'courage.brave_strike']) },
    { card: 'love.kind_word' }, { shot: 'mask-select', after: 150 }, { target: 0 }, { shot: 'mask-turn', after: 420 }, { idle: true },
    { key: 'e' }, { shot: 'mask-enemy-a', after: 330 }, { shot: 'mask-enemy-b', after: 250 }, { idle: true }, { shot: 'mask-next', after: 50 },
  ],
  dissonant: [
    { eval: START('enc.a1.mope_skitter', ['love.kind_word', 'joy.bright_spark', 'courage.brave_strike']) },
    { card: 'love.kind_word' }, { shot: 'dissonant-select', after: 150 }, { target: 0 },
    { shot: 'dissonant-hit', after: 300 }, { idle: true }, { shot: 'dissonant-after', after: 60 },
  ],
  inward: [
    { eval: START('enc.a1.two_grumbles', ['love.kind_word', 'joy.bright_spark', 'buried.anger', 'courage.brave_strike'], "s.combat.player.statuses.seething = 3; const b = s.combat.piles.hand.find((u) => s.combat.cards[u].defId === 'buried.anger'); s.combat.cards[b].weight = 2;") },
    { card: 'love.kind_word' }, { shot: 'inward-select', after: 200 }, { click: '.inward-target' },
    { shot: 'inward-fly', after: 140 }, { shot: 'inward-ring', after: 160 }, { idle: true }, { shot: 'inward-after', after: 60 },
  ],
  choice: [
    {
      eval: START('enc.a1.kettle', ['neutral.look_inward', 'love.kind_word', 'joy.bright_spark'], '', "for (const d of ['buried.anger', 'buried.fear']) s.run.deck.push({ uid: s.nextUid++, defId: d, upgraded: false, weight: 1, peakWeight: 1 });"),
    },
    { card: 'neutral.look_inward' }, { card: 'neutral.look_inward' }, { idle: true }, { shot: 'choice-open', after: 150 },
    { key: '1' }, { idle: true }, { shot: 'choice-done', after: 150 },
  ],
  looming: [
    { eval: START('enc.a1.looming', ['love.kind_word', 'joy.bright_spark', 'friendship.reach_out', 'courage.brave_strike']) },
    { key: 'e' }, { shot: 'looming-enemy', after: 500 }, { idle: true }, { shot: 'looming-next', after: 100 },
    { key: 'e' }, { shot: 'looming-enemy2', after: 600 }, { idle: true }, { shot: 'looming-next2', after: 100 },
  ],
};

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [name, steps] of Object.entries(SCENARIOS)) {
    if (only.length && !only.includes(name)) continue;
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
    await page.goto(`${base}/?seed=3&tutorial=0`);
    await page.waitForTimeout(600);
    for (const st of steps) {
      if (st.eval) {
        await page.evaluate(st.eval);
        await page.waitForTimeout(900);
      } else if (st.card) {
        const uid = await page.evaluate((def) => {
          const c = window.heartward.state.combat;
          return c.piles.hand.find((u) => c.cards[u].defId === def) ?? null;
        }, st.card);
        if (uid !== null) await page.click(`.cb-hand .cb-card[data-uid="${uid}"] .card-face`);
        await page.waitForTimeout(60);
      } else if (st.target !== undefined) {
        await page.click(`.cb-slot:nth-child(${st.target + 1}) .cb-slot__hit`);
      } else if (st.click) {
        await page.click(st.click);
      } else if (st.key) {
        await page.keyboard.press(st.key);
      } else if (st.idle) {
        await page.waitForFunction(() => !window.heartward.busy, null, { timeout: 10000 });
        await page.waitForTimeout(200);
      } else if (st.endTurnHover) {
        await page.hover('.cb-endturn');
      } else if (st.shot) {
        await page.waitForTimeout(st.after ?? 0);
        await page.screenshot({ path: path.join(outDir, `${st.shot}.png`) });
      }
    }
    await page.close();
  }
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
