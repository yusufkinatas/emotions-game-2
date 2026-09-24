// Page setup for combat-play.cjs: The Numbness with three Buried cards in the deck (Surfacing, Veiled).
(() => {
  const app = window.heartward;
  const eng = app.engine;
  let s = eng.newRun(11, { tutorial: false });
  const add = (defId, weight) => s.run.deck.push({ uid: s.nextUid++, defId, upgraded: false, weight, peakWeight: weight });
  add('buried.anger', 2);
  add('buried.sadness', 1);
  add('buried.fear', 3);
  s.run.keepsakes.push({ id: 'ks.compass', counter: 0 });
  for (const id of ['blend.sunbeam', 'blend.tag_youre_it', 'love.kind_word', 'joy.bright_spark']) s.run.deck.push({ uid: s.nextUid++, defId: id, upgraded: false });
  s.run.act = 3;
  s = eng.debug.startCombat(s, 'enc.deep.numbness');
  app.state = s;
  app.screen = 'run';
  app.render();
})();
