// Combat animation (DESIGN 16.2 "Enemy turn presentation", 18.1, 18.2): plays a step's engine events in
// order on a mirror of the view model, then hands over to update(), which renders the new state.
// Timing goes through app.dur, so speed settings and click-to-skip work; the enemy phase stays under
// 1.5 s at 1x. Leave animations (Resolve, Suppress) run on detached copies so input frees quickly.

import { BAD_ADVICE, BANNERS, BURIED_LINES, SHADE_LINES } from '../../content/index';
import type { EnemyState, GameEvent, GameState, Light, Relation, Uid } from '../../engine/types';
import type { App } from '../app';
import { hitStop, prefersReducedMotion } from '../kit/motion';
import { setShadeReaction } from '../kit/shadeArt';
import { defaultMatchups, type FloatKind } from '../kit/widgets';
import { appendLog, describeEvents } from '../overlays/log';
import type { CombatModel, ShadeModel } from '../screens/combat/model';
import type { CombatView } from '../screens/combat/screen';
import { pickLine, playerChips, shadeChips } from '../screens/combat/text';
import { banner, bloom, buriedToDeck, dottedLine, floatLine, floatNumber, flyTo, lift, moteTo, restartClass, ring, type Point } from './fx';
import { wait, waitSince, type Clock } from './timing';

const FLOAT_KIND: Record<Relation, FloatKind> = {
  opposite: 'opposite',
  neutral: 'neutral',
  dissonant: 'dissonant',
  felt: 'felt',
  muffled: 'muffled',
  veiled: 'muffled',
};

class Player {
  private readonly m: CombatModel;
  private readonly nextModel: CombatModel | null;
  private readonly clock: Clock;
  private readonly enemyBags = new Map<Uid, EnemyState>();
  private playerBag: Record<string, number>;
  private lastNote: Light[];
  private moveStart = 0;
  private lastFlash = new Map<Uid, number>();
  private glimmers: number;
  private strikesSummary: string[] = [];
  private heartBefore: number;
  private inEnemyPhase = false;
  /** After the player's turn starts, the new hand deals in by CSS without holding input. */
  private turnStarted = false;

  constructor(
    private readonly v: CombatView,
    private readonly prev: GameState,
    private readonly next: GameState,
    private readonly app: App,
    speed: number,
  ) {
    this.m = v.plainModel(prev);
    // Predictions describe the old state; hide them while the step plays out.
    this.m.player = { ...this.m.player, previewLoss: 0, previewGain: 0, guardAfter: null, lethal: false };
    this.nextModel = next.phase.kind === 'combat' && next.combat ? v.plainModel(next) : null;
    this.clock = { app, speed };
    for (const e of prev.combat!.enemies) this.enemyBags.set(e.uid, structuredClone(e));
    this.playerBag = { ...(prev.combat!.player.statuses as Record<string, number>) };
    this.lastNote = [...prev.combat!.note];
    this.glimmers = prev.run.glimmers;
    this.heartBefore = prev.combat!.player.hp;
  }

  /** A pause after an effect; inside a Shade's action the 300 ms action window already paces it. */
  private beat(t: number): Promise<void> {
    return this.inEnemyPhase && this.moveStart ? Promise.resolve() : wait(this.clock, t);
  }

  private get sfx() {
    return this.v.sfx;
  }

  private render(dealing = false): void {
    this.v.renderModel(this.m, { dealing });
  }

  private shade(uid: Uid): ShadeModel | undefined {
    return this.m.shades.find((s) => s.uid === uid);
  }

  private artPoint(uid: Uid): Point {
    const slot = this.v.shades.slot(uid);
    return this.v.centerOf(slot?.svg ?? slot?.art);
  }

  private heartPoint(): Point {
    const w = this.v.player.wanderer();
    if (!w) return this.v.centerOf(this.v.player.avatar);
    const r = w.getBoundingClientRect();
    const root = this.v.root.getBoundingClientRect();
    return { x: r.left - root.left + (72 / 160) * r.width, y: r.top - root.top + (114 / 180) * r.height };
  }

  async run(events: readonly GameEvent[]): Promise<void> {
    this.render();
    // Playtests can set window.__cbTrace = [] to time each event.
    const trace = (globalThis as { __cbTrace?: [string, number][] }).__cbTrace;
    for (let i = 0; i < events.length; i++) {
      trace?.push([events[i]!.e, Math.round(performance.now())]);
      await this.handle(events[i]!, events, i);
    }
    if (this.inEnemyPhase) this.announceEnemyPhase();
  }

  private announceEnemyPhase(): void {
    const lost = Math.max(0, this.heartBefore - this.m.player.hp);
    const text = this.strikesSummary.length ? `${this.strikesSummary.join(' ')} You lost ${lost} Heart.` : lost > 0 ? `You lost ${lost} Heart.` : 'The Shades waited.';
    this.v.live.textContent = text;
  }

  private async handle(ev: GameEvent, all: readonly GameEvent[], i: number): Promise<void> {
    const m = this.m;
    const pack = this.app.engine.pack;
    switch (ev.e) {
      case 'energy': {
        m.energy = ev.after;
        m.compass = { ...m.compass, energy: ev.after };
        this.render();
        if (ev.delta < 0) this.sfx.ui?.('spirit');
        return;
      }
      case 'cardPlayed':
        return this.cardPlayed(ev);
      case 'note': {
        m.compass = { ...m.compass, note: ev.lights };
        m.player = { ...m.player, note: ev.lights };
        this.render();
        return;
      }
      case 'harmony': {
        const from = this.lastNote[this.lastNote.length - 1];
        const to = m.compass.note.find((l) => l !== from) ?? m.compass.note[0];
        m.compass = { ...m.compass, harmoniesThisTurn: m.compass.harmoniesThisTurn + 1 };
        this.v.compass.update(m.compass, m.drawCount, from && to ? { harmonyArc: [from, to] } : {});
        this.v.compass.harmonyPop(this.app.dur(900));
        this.sfx.harmony?.(m.compass.note);
        this.lastNote = [...m.compass.note];
        await wait(this.clock, 250);
        return;
      }
      case 'hit':
        return this.hit(ev);
      case 'strike':
        return this.strike(ev);
      case 'guard': {
        if (ev.to.side === 'player') {
          m.player = { ...m.player, guard: ev.after };
          this.render();
          restartClass(this.v.player.heartRow.querySelector('.guard-badge'), 'cb-bump', 420);
        } else if (ev.to.side === 'enemy') {
          const sm = this.shade(ev.to.uid);
          if (sm) {
            sm.guard = ev.after;
            this.render();
          }
        }
        await this.beat(90);
        return;
      }
      case 'mend': {
        if (ev.to.side === 'player') {
          m.player = { ...m.player, hp: ev.after };
          this.render();
          this.v.topBar.setHeart(ev.after, m.player.maxHp);
          floatNumber(this.v, { kind: 'mend', value: ev.amount }, this.v.centerOf(this.v.player.heartBar()));
        } else if (ev.to.side === 'enemy') {
          const sm = this.shade(ev.to.uid);
          if (sm) {
            sm.hp = ev.after;
            this.render();
          }
        }
        await this.beat(120);
        return;
      }
      case 'hpLoss': {
        if (ev.to.side === 'player') {
          m.player = { ...m.player, hp: ev.after };
          this.render();
          this.v.topBar.setHeart(ev.after, m.player.maxHp);
          floatNumber(this.v, { kind: 'loss', value: ev.amount }, this.v.centerOf(this.v.player.heartBar()));
          restartClass(this.v.vignette, 'is-hit', 320);
          await this.beat(140);
        }
        return;
      }
      case 'status':
        return this.status(ev);
      case 'cleanse': {
        if (ev.id === 'isolated' && ev.byLight === 'friendship') this.v.compass.clearFog();
        const chip = [...this.v.player.chipsEl.querySelectorAll('.chip--affliction')].find((c) => c.textContent?.includes(pack.statuses[ev.id]?.name ?? ev.id));
        restartClass(chip, 'cb-dissolve', 400);
        return;
      }
      case 'face':
        return this.face(ev.enemy, ev.face);
      case 'intent': {
        const sm = this.shade(ev.enemy);
        const nx = this.nextModel?.shades.find((s) => s.uid === ev.enemy);
        if (sm && nx) {
          sm.intent = nx.intent;
          sm.order = nx.order;
          this.render();
          restartClass(this.v.shades.slot(ev.enemy)?.intent, 'cb-pop', 300);
        }
        return;
      }
      case 'enemyMove':
        return this.enemyMove(ev.enemy, ev.moveId);
      case 'turn': {
        if (ev.side === 'enemy') {
          this.inEnemyPhase = true;
          if (this.moveStart) await waitSince(this.clock, this.moveStart, 300);
          banner(this.v, BANNERS.shadesStir, this.app.dur(650));
          await wait(this.clock, 250);
        } else {
          // The last Shade walks back while the new hand deals in.
          if (this.moveStart) await waitSince(this.clock, this.moveStart, 200);
          this.moveStart = 0;
          this.turnStarted = true;
          this.sfx.resetHarmony?.();
          m.turn = ev.n;
          m.compass = { ...m.compass, harmoniesThisTurn: 0 };
        }
        return;
      }
      case 'festering':
        banner(this.v, BANNERS.festering, this.app.dur(900), 'fester');
        await wait(this.clock, 250);
        return;
      case 'discard':
        return this.discard(ev.uids);
      case 'burn':
      case 'letGo':
        return this.fadeCards(ev.e === 'burn' ? ev.uids : [ev.uid]);
      case 'draw':
      case 'toHand':
        return this.draw(ev.e === 'draw' ? ev.uids : [ev.uid], ev.e === 'draw');
      case 'shuffle':
        restartClass(this.v.compass.draw.btn, 'cb-bump', 420);
        m.drawCount = ev.count;
        m.discardCount = 0;
        this.render();
        await wait(this.clock, 120);
        return;
      case 'resolved':
        return this.resolved(ev.enemy, ev.deep, ev.by, ev.glimmers);
      case 'suppressed':
        return this.suppressed(ev.enemy, ev.buried);
      case 'faded':
        return this.leave(ev.enemy, 'fade');
      case 'wavering': {
        const sm = this.shade(ev.enemy);
        if (sm) {
          sm.wavering = true;
          this.render();
        }
        await this.beat(120);
        return;
      }
      case 'spawn':
      case 'surfaced':
        return this.arrive(ev.enemy, ev.e === 'surfaced');
      case 'summon':
      case 'companionLeft': {
        if (this.nextModel) {
          m.player = { ...m.player, companions: this.nextModel.player.companions };
          this.render();
          if (ev.e === 'summon') {
            const slots = this.v.player.companionsEl.querySelectorAll('.companion-slot:not(.companion-slot--empty)');
            restartClass(slots[slots.length - 1], 'cb-pop', 400);
            this.sfx.light?.(['friendship'], 'neutral');
          }
        }
        await wait(this.clock, 200);
        return;
      }
      case 'companionAct': {
        const idx = this.prev.combat!.companions.findIndex((c) => c.uid === ev.companion);
        const slot = this.v.player.companionsEl.querySelectorAll('.companion-slot')[idx];
        restartClass(slot, 'cb-pop', 400);
        const hit = all.slice(i + 1).find((x) => x.e === 'hit' || x.e === 'guard');
        if (hit && hit.e === 'hit' && hit.to.side === 'enemy') dottedLine(this.v, this.v.centerOf(slot), this.artPoint(hit.to.uid), this.app.dur(450));
        await wait(this.clock, 140);
        return;
      }
      case 'tended':
      case 'insight':
      case 'peace':
        return this.tend(ev);
      case 'promise':
        if (ev.created) {
          if (this.nextModel) {
            m.player = { ...m.player, promises: this.nextModel.player.promises };
            for (const s of m.shades) s.promises = this.nextModel.shades.find((x) => x.uid === s.uid)?.promises ?? s.promises;
            this.render();
          }
          await wait(this.clock, 120);
        }
        return;
      case 'keepsake':
        this.v.topBar.pulse({ keepsake: ev.id });
        return;
      case 'combatEnd':
        // The screen changes after this: let the last Resolve or Suppress play out first.
        if (ev.outcome === 'lost') {
          restartClass(this.v.vignette, 'is-hit', 600);
          await wait(this.clock, 600);
        } else await wait(this.clock, 900);
        return;
      default:
        return;
    }
  }

  // --------------------------------------------------------------------------------------------

  private async cardPlayed(ev: Extract<GameEvent, { e: 'cardPlayed' }>): Promise<void> {
    const m = this.m;
    this.lastNote = [...m.compass.note];
    const def = this.app.engine.pack.cards[this.prev.combat!.cards[ev.uid]?.defId ?? ''];
    const wrap = this.v.hand.detach(ev.uid);
    m.hand = m.hand.filter((c) => c.uid !== ev.uid);
    let to: Point;
    if (ev.inward) to = this.heartPoint();
    else if (ev.target !== null) to = this.artPoint(ev.target);
    else if (def?.target === 'all' || def?.target === 'enemy') to = this.v.centerOf(this.v.shades.el);
    else to = this.v.centerOf(this.v.player.avatar);
    const t = ev.inward ? 250 : 180;
    if (wrap) {
      const card = wrap.querySelector('.card-face');
      card?.setAttribute('data-state', 'idle');
      const { box } = lift(this.v, wrap);
      void flyTo(wrap, box, to, this.clock.app.dur(t) / this.clock.speed, { scale: ev.inward ? 0.2 : 0.3 });
    }
    this.render();
    await wait(this.clock, t);
    if (ev.inward) {
      const light = ev.effectiveLights[0] ?? null;
      ring(this.v, to, light, this.v.player.avatar.getBoundingClientRect().width * 0.8);
      if (light) this.sfx.inward?.(light);
      restartClass(this.v.player.wanderer(), 'cb-glow', 500);
    }
  }

  private async hit(ev: Extract<GameEvent, { e: 'hit' }>): Promise<void> {
    const b = ev.b;
    if (ev.to.side !== 'enemy') return;
    const uid = ev.to.uid;
    const sm = this.shade(uid);
    const slot = this.v.shades.slot(uid);
    if (sm) {
      sm.hp = b.hpAfter;
      sm.guard = b.guardAfter;
      if (b.relation === 'felt' && sm.family === 'numb' && b.lights.length >= 2) {
        const cracks = [...(this.v.feltCracks.get(uid) ?? []), [b.lights[0]!, b.lights[1]!] as [Light, Light]];
        this.v.feltCracks.set(uid, cracks);
        sm.feltCracks = cracks;
      }
      this.render();
    }
    if (slot) {
      // Impacts within 333 ms merge into one flash (18.1); the extra impacts only squash.
      const now = performance.now();
      slot.svg.classList.toggle('cb-noflash', now - (this.lastFlash.get(uid) ?? -1e9) < 333);
      if (!slot.svg.classList.contains('cb-noflash')) this.lastFlash.set(uid, now);
      setShadeReaction(slot.svg, 'hit');
    }
    const at = this.artPoint(uid);
    const kind = FLOAT_KIND[b.relation];
    const line = b.relation === 'dissonant' && sm?.face ? BAD_ADVICE[sm.face] : undefined;
    floatNumber(this.v, { kind, value: b.damage, lights: b.lights, ...(line ? { line } : {}) }, { x: at.x, y: at.y - 30 });
    if (b.blocked > 0) floatNumber(this.v, { kind: 'blocked', value: b.blocked }, { x: at.x + 50, y: at.y + 10 });
    this.sfx.light?.(b.lights, b.relation === 'veiled' ? 'veiled' : b.relation);
    if (b.relation === 'opposite' || b.relation === 'felt') hitStop(this.v.stage, this.app.dur(60));
    await this.beat(b.relation === 'opposite' || b.relation === 'felt' ? 220 : 160);
  }

  private async strike(ev: Extract<GameEvent, { e: 'strike' }>): Promise<void> {
    const m = this.m;
    const before = m.player.hp;
    const guardBefore = m.player.guard;
    const lost = Math.max(0, before - ev.hpAfter);
    const name = this.shade(ev.enemy)?.name ?? 'A Shade';
    this.strikesSummary.push(`${name} struck for ${ev.amount}.${ev.blocked ? ` Guard blocked ${ev.blocked}.` : ''}`);
    m.player = { ...m.player, hp: ev.hpAfter, guard: ev.guardAfter };
    const bubble = this.v.player.bubble();
    if (bubble && ev.blocked > 0) bubble.dataset.state = ev.guardAfter <= 0 ? 'shatter' : 'crack';
    const keepBubble = bubble && ev.blocked > 0 && ev.guardAfter <= 0 && guardBefore > 0;
    this.v.topBar.setHeart(ev.hpAfter, m.player.maxHp);
    const heartAt = this.v.centerOf(this.v.player.heartBar());
    if (ev.blocked > 0) floatNumber(this.v, { kind: 'blocked', value: ev.blocked }, { x: heartAt.x - 60, y: heartAt.y - 70 });
    if (lost > 0) {
      floatNumber(this.v, { kind: 'loss', value: lost }, { x: heartAt.x + 30, y: heartAt.y - 40 });
      restartClass(this.v.vignette, 'is-hit', 320);
      restartClass(this.v.player.wanderer(), 'is-hit', 300);
      const big = lost >= m.player.maxHp * 0.2;
      this.v.player.el.style.setProperty('--shake-amp', `calc(var(--u) * ${big ? 8 : 4})`);
      restartClass(this.v.player.el, 'is-shake-h', 320);
    }
    const sm = this.shade(ev.enemy);
    this.sfx.strike?.(sm?.face ?? 'numb');
    // Let the shatter play before the bubble is removed by the re-render.
    if (keepBubble) await wait(this.clock, 120);
    this.render();
    await this.beat(110);
  }

  private async status(ev: Extract<GameEvent, { e: 'status' }>): Promise<void> {
    const pack = this.app.engine.pack;
    if (ev.to.side === 'player') {
      if (ev.after > 0) this.playerBag[ev.id] = ev.after;
      else delete this.playerBag[ev.id];
      this.m.player = { ...this.m.player, chips: playerChips(pack, this.playerBag) };
      this.render();
      if (ev.delta > 0 && pack.statuses[ev.id]?.affliction) {
        const chip = [...this.v.player.chipsEl.querySelectorAll('.chip')].find((c) => c.textContent?.includes(pack.statuses[ev.id]!.name));
        restartClass(chip, 'cb-pop', 400);
        await this.beat(120);
      }
      return;
    }
    if (ev.to.side !== 'enemy') return;
    const uid = ev.to.uid;
    const e = this.enemyBags.get(uid);
    const sm = this.shade(uid);
    if (!e || !sm) return;
    if (ev.after > 0) e.statuses[ev.id] = ev.after;
    else delete e.statuses[ev.id];
    sm.chips = shadeChips(pack, e, sm.def);
    if (ev.id === 'flare') {
      sm.flare = ev.after;
      const nx = this.nextModel?.shades.find((s) => s.uid === uid);
      if (nx && ev.delta > 0) sm.intent = nx.intent;
    }
    if (ev.id === 'wavering') sm.wavering = ev.after > 0;
    if (ev.id === 'coil' && sm.ornament === 'spiral') sm.gauge = ev.after;
    this.render();
    if (ev.id === 'flare' && ev.delta > 0) {
      restartClass(this.v.shades.slot(uid)?.intent.querySelector('.intent-pill'), 'is-flipping', 260);
      await this.beat(120);
    }
  }

  private async face(uid: Uid, face: EnemyState['faces'][number]): Promise<void> {
    const sm = this.shade(uid);
    const e = this.enemyBags.get(uid);
    if (!sm || !e) return;
    e.faceIndex = Math.max(0, e.faces.indexOf(face));
    sm.face = face;
    if (e.faces.length === 2) sm.beneath = e.faces[(e.faceIndex + 1) % 2]!;
    if (e.faces.length > 2) sm.nextFace = e.faces[(e.faceIndex + 1) % e.faces.length]!;
    sm.matchups = defaultMatchups(face, BAD_ADVICE[face]);
    this.render();
    restartClass(this.v.shades.slot(uid)?.plate.querySelector('.nameplate'), 'is-turning', 320);
    await this.beat(200);
  }

  private async enemyMove(uid: Uid, moveId: string): Promise<void> {
    if (this.moveStart) await waitSince(this.clock, this.moveStart, this.actionMs());
    this.moveStart = performance.now();
    const slot = this.v.shades.slot(uid);
    const sm = this.shade(uid);
    if (!slot || !sm) return;
    const move = sm.def.moves[moveId];
    const striking = !!move?.intent.includes('strike');
    // Step toward the player (60px), act at the peak, and return: about 300 ms per action.
    slot.root.style.setProperty('--lunge-x', 'calc(var(--u) * -60)');
    restartClass(slot.root, striking ? 'is-striking' : 'cb-stepping', this.app.dur(300) || 1);
    if (!this.v.barked.has(uid)) {
      this.v.barked.add(uid);
      const line = pickLine(SHADE_LINES[sm.defId]?.bark ?? sm.def.lines.bark, uid);
      if (line) this.v.shades.bark(uid, line, 1800);
    }
    await wait(this.clock, 140);
  }

  /** About 300 ms per Shade action; a little less with a full row so the phase stays under 1.5 s. */
  private actionMs(): number {
    return this.m.shades.length >= 4 ? 280 : 300;
  }

  private async discard(uids: readonly Uid[]): Promise<void> {
    const target = this.v.centerOf(this.v.right.discard.btn);
    let n = 0;
    for (const uid of uids) {
      const wrap = this.v.hand.detach(uid);
      if (!wrap) continue;
      const { box } = lift(this.v, wrap);
      const delay = this.app.dur(25 * n++);
      setTimeout(() => void flyTo(wrap, box, target, this.app.dur(200), { scale: 0.25 }), delay);
    }
    this.m.hand = this.m.hand.filter((c) => !uids.includes(c.uid));
    this.m.discardCount += uids.length;
    this.render();
    // The cards fly while the next beat starts (the enemy phase budget is 1.5 s).
    if (n) await wait(this.clock, 20);
  }

  private async fadeCards(uids: readonly Uid[]): Promise<void> {
    for (const uid of uids) {
      const wrap = this.v.hand.detach(uid);
      if (wrap) {
        const { box } = lift(this.v, wrap);
        void flyTo(wrap, box, { x: box.x + box.width / 2, y: box.y - 40 }, this.app.dur(250), { scale: 0.9, fade: 0 });
      }
    }
    this.m.hand = this.m.hand.filter((c) => !uids.includes(c.uid));
    this.render();
  }

  private async draw(uids: readonly Uid[], fromDraw: boolean): Promise<void> {
    const nx = this.nextModel;
    if (!nx) return;
    for (const uid of uids) {
      const card = nx.hand.find((c) => c.uid === uid);
      if (card && !this.m.hand.some((c) => c.uid === uid)) this.m.hand.push({ ...card, props: { ...card.props, state: 'idle' } });
    }
    this.m.hand.sort((a, b) => nx.hand.findIndex((c) => c.uid === a.uid) - nx.hand.findIndex((c) => c.uid === b.uid));
    if (fromDraw) this.m.drawCount = Math.max(0, this.m.drawCount - uids.length);
    this.render(true);
    if (!this.turnStarted) await wait(this.clock, Math.min(120, 40 * uids.length));
  }

  private async resolved(uid: Uid, deep: boolean, by: Light[], glimmers: number): Promise<void> {
    const slot = this.v.shades.slot(uid);
    const sm = this.shade(uid);
    const at = this.artPoint(uid);
    const light = by[0] ?? null;
    hitStop(this.v.stage, this.app.dur(110));
    this.sfx.resolve?.(by, deep);
    this.sfx.ambienceBrighten?.();
    if (slot) {
      const clone = slot.svg;
      const { el } = lift(this.v, clone);
      setShadeReaction(el as SVGSVGElement, deep ? 'deepResolving' : 'resolving');
      setTimeout(() => el.remove(), this.app.dur(1300) || 0);
    }
    bloom(this.v, at, light, 260);
    if (!prefersReducedMotion()) restartClass(this.v.stage, 'is-breathing', 950);
    const farewell = SHADE_LINES[sm?.defId ?? '']?.resolved ?? sm?.def.lines.resolved;
    if (farewell && sm?.defId !== 'shade.numbness') floatLine(this.v, farewell, { x: at.x, y: at.y - 120 }, 1800);
    this.v.shades.drop(uid);
    this.m.shades = this.m.shades.filter((s) => s.uid !== uid);
    this.m.resolved += 1;
    this.render();
    const glim = this.v.centerOf(this.v.topBar.glimmerEl());
    const moteMs = this.app.dur(1000);
    const lights = deep ? by : light ? [light] : [];
    lights.forEach((l, k) => void moteTo(this.v, { x: at.x + k * 24, y: at.y }, glim, l, moteMs));
    const total = this.glimmers + glimmers;
    this.glimmers = total;
    setTimeout(() => {
      this.v.topBar.setGlimmers(total);
      this.v.topBar.pulse('glimmers');
      if (glimmers > 0) this.sfx.glimmers?.(glimmers);
    }, moteMs);
    await wait(this.clock, 260);
  }

  private async suppressed(uid: Uid, buried: EnemyState['faces'][number] | null): Promise<void> {
    const slot = this.v.shades.slot(uid);
    const sm = this.shade(uid);
    const at = this.artPoint(uid);
    this.sfx.suppress?.();
    if (slot) {
      const { el } = lift(this.v, slot.svg);
      setShadeReaction(el as SVGSVGElement, 'suppressed');
      setTimeout(() => el.remove(), this.app.dur(1000) || 0);
    }
    restartClass(this.v.stage, 'is-shake-v', 420);
    restartClass(this.v.root, 'cb-desat', 420);
    // A small ink smudge stays on the stage floor for the rest of the fight (18.1 ambient).
    const rootBox = this.v.root.getBoundingClientRect();
    this.v.smudges.push(at.x / Math.max(1, rootBox.width));
    const floor = this.v.stage.querySelector('.cb-floor');
    if (floor) {
      const s = document.createElement('span');
      s.className = 'cb-smudge';
      s.style.left = `${(at.x / Math.max(1, rootBox.width)) * 100}%`;
      floor.append(s);
    }
    if (buried) {
      const deckCard = this.next.run.deck.filter((c) => this.app.engine.pack.cards[c.defId]?.buried?.shade === buried);
      const weight = Math.max(1, ...deckCard.map((c) => c.weight ?? 1));
      const label = deckCard.length && weight > 1 ? `W${weight}` : '+1 Buried';
      buriedToDeck(this.v, at, this.v.centerOf(this.v.topBar.deckEl()), buried, weight, label, this.app.dur(900));
      setTimeout(() => this.v.topBar.pulse('deck'), this.app.dur(850));
    }
    const farewell = SHADE_LINES[sm?.defId ?? '']?.suppressed ?? sm?.def.lines.suppressed;
    if (farewell && sm?.defId !== 'shade.numbness') floatLine(this.v, farewell, { x: at.x, y: at.y - 120 }, 1800, 'cb-float-line--ink');
    this.v.shades.drop(uid);
    this.m.shades = this.m.shades.filter((s) => s.uid !== uid);
    this.render();
    await wait(this.clock, 300);
  }

  private async leave(uid: Uid, _kind: 'fade'): Promise<void> {
    const slot = this.v.shades.slot(uid);
    if (slot) {
      const { el, box } = lift(this.v, slot.svg);
      void flyTo(el, box, { x: box.x + box.width / 2, y: box.y + box.height / 2 - 20 }, this.app.dur(500), { scale: 1.1, fade: 0 });
    }
    this.v.shades.drop(uid);
    this.m.shades = this.m.shades.filter((s) => s.uid !== uid);
    this.render();
    await wait(this.clock, 150);
  }

  private async arrive(uid: Uid, surfaced: boolean): Promise<void> {
    const nx = this.nextModel?.shades.find((s) => s.uid === uid);
    if (!nx || this.shade(uid)) return;
    const order = this.nextModel!.shades.map((s) => s.uid);
    this.m.shades.push({ ...nx, preview: null, reaction: null });
    this.m.shades.sort((a, b) => order.indexOf(a.uid) - order.indexOf(b.uid));
    const e = this.next.combat!.enemies.find((x) => x.uid === uid);
    if (e) this.enemyBags.set(uid, structuredClone(e));
    if (surfaced) {
      const boss = this.m.shades.find((s) => s.ornament === 'numbness');
      if (boss) boss.gauge = (boss.gauge ?? 0) + 1;
    }
    this.render();
    const slot = this.v.shades.slot(uid);
    restartClass(slot?.root, surfaced ? 'cb-surfacing' : 'cb-arriving', surfaced ? 1250 : 450);
    const line = pickLine(SHADE_LINES[nx.defId]?.bark ?? nx.def.lines.bark, uid);
    if (line) {
      this.v.barked.add(uid);
      setTimeout(() => this.v.shades.bark(uid, line, 1800), this.app.dur(surfaced ? 500 : 200));
    }
    await this.beat(surfaced ? 420 : 260);
  }

  private async tend(ev: Extract<GameEvent, { e: 'tended' | 'insight' | 'peace' }>): Promise<void> {
    const card = this.v.hand.card(ev.uid);
    const nx = this.nextModel?.hand.find((c) => c.uid === ev.uid);
    const idx = this.m.hand.findIndex((c) => c.uid === ev.uid);
    if (card) restartClass(card, ev.e === 'insight' ? 'cb-flip' : 'is-tending', 700);
    if (ev.e !== 'tended') {
      const at = card ? this.v.centerOf(card) : this.heartPoint();
      floatLine(this.v, ev.e === 'insight' ? BURIED_LINES.insight : BURIED_LINES.peace, { x: at.x, y: at.y - 130 }, 2000);
    }
    await wait(this.clock, ev.e === 'tended' ? 300 : 450);
    if (idx >= 0) {
      if (nx) this.m.hand[idx] = { ...nx, props: { ...nx.props, state: 'idle' } };
      else this.m.hand.splice(idx, 1);
      this.render();
    }
  }
}

/** ScreenController.animate for combat. */
export async function animateCombat(v: CombatView, events: GameEvent[], prev: GameState, next: GameState, app: App): Promise<void> {
  appendLog(app, describeEvents(app, events, prev, next));
  if (!prev.combat) return;
  const beats = events.filter((e) => e.e === 'hit' || e.e === 'strike' || e.e === 'cardPlayed' || e.e === 'enemyMove').length;
  const player = new Player(v, prev, next, app, beats > 12 ? 2 : 1);
  await player.run(events);
}
