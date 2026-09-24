// Page setup for combat-play.cjs: Act 2 fight with The Compass, Companions, Promises, a Buried card in hand
// and Look Inward, to exercise Harmony, Inward Tending, the light thread, Companion rows and choices.
(() => {
  const app = window.heartward;
  const eng = app.engine;
  let s = eng.newRun(21, { tutorial: false });
  s.run.keepsakes.push({ id: 'ks.compass', counter: 0 });
  const add = (defId, weight) => s.run.deck.push({ uid: s.nextUid++, defId, upgraded: false, ...(weight ? { weight, peakWeight: weight } : {}) });
  for (const id of ['friendship.call_a_friend', 'friendship.buddy_up', 'hope.silver_lining', 'blend.sunbeam', 'neutral.look_inward']) add(id);
  add('buried.anger', 2);
  add('buried.loneliness', 1);
  s.run.act = 2;
  s = eng.debug.startCombat(s, 'enc.a2.wallflower_fret');
  s = eng.debug.setHand(s, ['love.kind_word', 'joy.bright_spark', 'friendship.call_a_friend', 'hope.silver_lining', 'buried.anger']);
  app.state = s;
  app.screen = 'run';
  app.render();
})();
