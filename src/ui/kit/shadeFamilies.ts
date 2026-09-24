// One silhouette generator per Shade family (DESIGN 16.7). Each returns body parts in the 200x210 frame;
// shadeArt.ts assembles them. Variety comes only from seeded streams, one per feature (shape, eyes,
// limbs, cracks...), so features that depend on Flare (spikes, open eyes, ring, pit) never shift the
// random draws of the others: the same Shade keeps its cracks and timing as it Flares.

import type { Shade } from '../../engine/emotions';
import { SHADES } from '../../engine/emotions';
import type { Rand } from './hash';
import { CX, GROUND, closedPath, expression, fissures, limb, openPath } from './shadeGeometry';
import type { EyeSpot, FaceSpec, P } from './shadeGeometry';
import type { ShadeArtOpts, ShadeFamily } from './shadeArt';
import { sigilBody } from './sigils';
import { n, polar } from './svg';

export interface Parts {
  /** Closed body path: fill, crack clip and hit flash (and the rim unless `outline` is given). */
  body: string;
  /** Replaces the default rim stroke of the body path (Anxiety's scribbled outline). */
  outline?: string;
  /** Static layers outside the idle group (Despair's pit, the Loneliness ring). */
  staticBack?: string;
  staticFront?: string;
  /** Idle-animated layers behind and in front of the body. */
  back?: string;
  front?: string;
  /** Facial expression for a mood; compounds draw one per face and crossfade them. */
  face: (mood: Shade) => string;
  crack: { x: number; y: number; spread: number; count: number; lo?: number; hi?: number } | null;
  /** Extra crack-colour marks (the Loneliness point, Anxiety threads, Doubt ember). */
  glow?: string;
  /** Transform origin of the idle animation. */
  idleOrigin?: [number, number];
  /** Shadow width (rx) under the silhouette. */
  shadow: number;
  /** Anger only: apply the heat shimmer. */
  heat?: boolean;
  /** Custom flash overlay (defaults to the body path). */
  flash?: string;
  /** Where the Resolve form rises from. */
  core: [number, number];
  /** Compound inner-face badge centre, on the body. */
  badge: [number, number];
  /** Ornament anchors: the top of the head, and the waist (x, y, half width). */
  top: [number, number];
  waist: [number, number, number];
}

export interface GenCtx {
  /** A seeded stream for one feature of this Shade. */
  rng: (feature: string) => Rand;
  flare: number;
  opts: ShadeArtOpts;
}

/** Expression builder bound to this Shade's blink stream (fresh per call, so every mood blinks alike). */
const faceOf = (c: GenCtx, spec: FaceSpec) => (mood: Shade) => expression(mood, spec, c.rng('blink'));

// ------------------------------------------------------------------------------------------------
// Anger: hunched, broad, crown of 5 to 9 spikes
// ------------------------------------------------------------------------------------------------

function anger(c: GenCtx): Parts {
  const r = c.rng('shape');
  const W = r.range(128, 146);
  const H = r.range(100, 116);
  const top = GROUND - H;
  const x0 = CX - W / 2;
  const x1 = CX + W / 2;
  const spikes = r.int(5, 9);
  const grow = 1 + 0.14 * c.flare;
  const crown: P[] = [];
  const xa = x0 + 20;
  const xb = x1 - 20;
  const arcY = (t: number) => top + 14 - 18 * Math.sin(Math.PI * t);
  const centre = { x: CX, y: GROUND - H * 0.15 };
  let peak = top;
  for (let k = 0; k < spikes; k++) {
    const tv = k / spikes;
    const tt = (k + 0.5) / spikes;
    const valleyJ = r.jitter(1.5);
    const valleyY = r.range(0, 3);
    if (k > 0) crown.push({ x: xa + (xb - xa) * tv + valleyJ, y: arcY(tv) + valleyY, sharp: true });
    const bx = xa + (xb - xa) * tt;
    const by = arcY(tt);
    const len = (r.range(11, 17) + 9 * Math.sin(Math.PI * tt)) * grow;
    const dx = bx - centre.x;
    const dy = by - centre.y;
    const m = Math.hypot(dx, dy);
    const tip = { x: bx + (dx / m) * len + r.jitter(2), y: by + (dy / m) * len, sharp: true };
    peak = Math.min(peak, tip.y);
    crown.push(tip);
  }
  const pts: P[] = [
    { x: x0 + 12, y: GROUND },
    { x: x0 - 2, y: GROUND - H * 0.34 },
    { x: x0 + 7, y: GROUND - H * 0.7 },
    { x: xa, y: arcY(0) + 4 },
    ...crown,
    { x: xb, y: arcY(1) + 4 },
    { x: x1 - 7, y: GROUND - H * 0.7 },
    { x: x1 + 2, y: GROUND - H * 0.34 },
    { x: x1 - 12, y: GROUND },
    { x: CX, y: GROUND + 3 },
  ];
  const ey = GROUND - H * 0.56;
  const ex = 21 * (W / 136);
  const armY = GROUND - H * 0.42;
  const arms =
    limb(`M${n(x0 + 10)} ${n(armY)}Q${n(x0 - 10)} ${n(armY + 8)} ${n(x0 - 8)} ${n(armY + 26)}`, 13) +
    `<circle class="sa-fist" cx="${n(x0 - 8)}" cy="${n(armY + 28)}" r="9.5"/>` +
    limb(`M${n(x1 - 10)} ${n(armY)}Q${n(x1 + 10)} ${n(armY + 8)} ${n(x1 + 8)} ${n(armY + 26)}`, 13) +
    `<circle class="sa-fist" cx="${n(x1 + 8)}" cy="${n(armY + 28)}" r="9.5"/>`;
  const my = GROUND - H * 0.3;
  const puffs = `<path class="sa-puff" d="M${n(x0 + 16)} ${n(ey - 30)}q-6 -8 -2 -15M${n(x1 - 16)} ${n(ey - 30)}q6 -8 2 -15"/>`;
  const crackAt = c.rng('crackAt');
  const side = crackAt.pick([-1, 1]);
  const crackX = CX + side * crackAt.range(20, 30);
  const lo = side > 0 ? 40 : 150;
  return {
    body: closedPath(pts),
    back: arms,
    front: puffs,
    face: faceOf(c, {
      eyes: [
        { x: CX - ex, y: ey, rx: 10.5, ry: 11.5 },
        { x: CX + ex, y: ey, rx: 10.5, ry: 11.5 },
      ],
      mouth: { x: CX, y: my, w: 26 },
      brows: true,
      fang: true,
    }),
    crack: { x: crackX, y: GROUND - H * 0.3, spread: 38, count: 3, lo, hi: lo + 170 },
    shadow: W * 0.55,
    heat: true,
    core: [CX, GROUND - H * 0.42],
    badge: [CX - side * W * 0.3, GROUND - H * 0.24],
    top: [CX, peak + 6],
    waist: [CX, GROUND - H * 0.4, W * 0.5],
  };
}

// ------------------------------------------------------------------------------------------------
// Sadness: tall, a drooping raincloud hood over the face, long arms, rain from the hem
// ------------------------------------------------------------------------------------------------

function sadness(c: GenCtx): Parts {
  const r = c.rng('shape');
  const H = r.range(150, 166);
  const W = r.range(112, 124);
  const top = GROUND - H;
  const bw = W * r.range(0.74, 0.82);
  const capY = top + 26;
  const lobeY = top + r.range(86, 92);
  const neckY = top + 100;
  const hx0 = CX - W * 0.56;
  const hx1 = CX + W * 0.56;
  const bumps = r.int(5, 6);
  const step = (hx1 - hx0) / bumps;
  // Left side up to the hood, which drapes down past the face in a low, soft lobe.
  let d = `M${n(CX - bw / 2)} ${GROUND}`;
  d += `C${n(CX - bw / 2 - 3)} ${n(GROUND - 40)} ${n(CX - W * 0.38)} ${n(neckY + 30)} ${n(CX - W * 0.36)} ${n(neckY)}`;
  d += `Q${n(CX - W * 0.42)} ${n(lobeY + 5)} ${n(CX - W * 0.5)} ${n(lobeY)}`;
  d += `C${n(CX - W * 0.6)} ${n(lobeY - 12)} ${n(hx0 - 4)} ${n(capY + 24)} ${n(hx0)} ${n(capY)}`;
  // Even cloud bumps across the top.
  for (let i = 1; i <= bumps; i++) {
    const rad = step * (0.54 + r.jitter(0.02));
    d += `A${n(rad)} ${n(rad)} 0 0 1 ${n(hx0 + step * i)} ${n(capY)}`;
  }
  d += `C${n(hx1 + 4)} ${n(capY + 24)} ${n(CX + W * 0.6)} ${n(lobeY - 12)} ${n(CX + W * 0.5)} ${n(lobeY)}`;
  d += `Q${n(CX + W * 0.42)} ${n(lobeY + 5)} ${n(CX + W * 0.36)} ${n(neckY)}`;
  d += `C${n(CX + W * 0.38)} ${n(neckY + 30)} ${n(CX + bw / 2 + 3)} ${n(GROUND - 40)} ${n(CX + bw / 2)} ${GROUND}`;
  const scallops = r.int(3, 4);
  const hem: number[] = [];
  for (let i = scallops - 1; i >= 0; i--) {
    const x = CX - bw / 2 + (bw * i) / scallops;
    d += `A${n(bw / scallops / 2)} ${n(r.range(4, 7))} 0 0 1 ${n(x)} ${GROUND}`;
    hem.push(x + bw / scallops / 2);
  }
  d += 'Z';
  const faceY = top + 54;
  // The hood's cloud edge hangs over the top of the face hollow.
  const hollow = `<ellipse class="sa-hollow" cx="${CX}" cy="${n(faceY)}" rx="${n(W * 0.27)}" ry="22"/>`;
  const bx0 = CX - W * 0.32;
  const bx1 = CX + W * 0.32;
  const brimY = faceY - 11;
  const brimBumps = 4;
  let brim = `M${n(bx0)} ${n(brimY - 16)}L${n(bx0)} ${n(brimY)}`;
  for (let i = 1; i <= brimBumps; i++) {
    const x = bx0 + ((bx1 - bx0) * i) / brimBumps;
    brim += `A${n((bx1 - bx0) / brimBumps / 2)} ${n(6.5)} 0 0 0 ${n(x)} ${n(brimY)}`;
  }
  brim += `L${n(bx1)} ${n(brimY - 16)}Z`;
  const hoodShade = `<path class="sa-hood-shade" d="${d}" style="opacity:${n(Math.min(5, c.flare) * 0.09)}" clip-path="url(#HOODCLIP)"/>`;
  const limbs = c.rng('limbs');
  const arm = (s: -1 | 1) => {
    const sx = CX + s * W * 0.34;
    const sy = neckY + 2;
    const hx = CX + s * (bw / 2 + limbs.range(8, 13));
    const hy = GROUND - limbs.range(14, 24);
    return (
      limb(`M${n(sx)} ${n(sy)}C${n(sx + s * 14)} ${n(sy + 24)} ${n(hx + s * 2)} ${n(hy - 44)} ${n(hx)} ${n(hy)}`, 9.5) +
      `<ellipse class="sa-fist" cx="${n(hx)}" cy="${n(hy + 5)}" rx="6" ry="7.5"/>`
    );
  };
  const rain = hem
    .map((x, i) => `<path class="sa-rain" style="animation-delay:${n(-i * 0.37)}s" d="M${n(x + 2)} ${GROUND + 1}l-1.2 7"/>`)
    .join('');
  return {
    body: d,
    back: arm(-1) + arm(1),
    front: hollow + `<path class="sa-brim" d="${brim}"/>` + hoodShade,
    face: faceOf(c, {
      eyes: [
        { x: CX - 14, y: faceY + 3, rx: 7.6, ry: 8.2 },
        { x: CX + 14, y: faceY + 3, rx: 7.6, ry: 8.2 },
      ],
      mouth: { x: CX, y: faceY + 16, w: 12 },
      tears: true,
    }),
    staticFront: rain,
    crack: { x: CX + c.rng('crackAt').jitter(6), y: top + 112, spread: 28, count: 3, lo: 60, hi: 300 },
    shadow: bw * 0.62,
    core: [CX, top + 106],
    badge: [CX + W * 0.2, top + 136],
    top: [CX, capY - step * 0.4],
    waist: [CX, top + 118, bw / 2 + 4],
  };
}

// ------------------------------------------------------------------------------------------------
// Loneliness: a small figure set back inside a wide empty ring
// ------------------------------------------------------------------------------------------------

function loneliness(c: GenCtx): Parts {
  const r = c.rng('shape');
  const ringR = 76 + Math.min(5, c.flare) * 3;
  const ringY = 106;
  const fx = CX + r.jitter(16);
  const fb = GROUND - 16;
  const fh = r.range(58, 70);
  const fw = r.range(44, 52);
  const pts: P[] = [
    { x: fx - fw * 0.5, y: fb },
    { x: fx - fw * 0.54, y: fb - fh * 0.42 },
    { x: fx - fw * 0.36, y: fb - fh * 0.82 },
    { x: fx, y: fb - fh },
    { x: fx + fw * 0.36, y: fb - fh * 0.82 },
    { x: fx + fw * 0.54, y: fb - fh * 0.42 },
    { x: fx + fw * 0.5, y: fb },
    { x: fx, y: fb + 2 },
  ];
  const ey = fb - fh * 0.62;
  const ring =
    `<circle class="sa-ring__rim" cx="${CX}" cy="${ringY}" r="${n(ringR)}"/>` +
    `<circle class="sa-ring" cx="${CX}" cy="${ringY}" r="${n(ringR)}"/>` +
    `<circle class="sa-ring__inner" cx="${CX}" cy="${ringY}" r="${n(ringR - 5)}"/>`;
  const px = fx + fw * 0.08;
  const py = fb - fh * 0.26;
  const face = faceOf(c, {
    eyes: [
      { x: fx - 8.5, y: ey, rx: 5.4, ry: 6.4 },
      { x: fx + 8.5, y: ey, rx: 5.4, ry: 6.4 },
    ],
    mouth: { x: fx, y: ey + 11, w: 9 },
  });
  // The badge sits on the ring itself at a fixed angle, so it moves out as the ring widens.
  const [bx, by] = polar(CX, ringY, 76, 128);
  return {
    body: closedPath(pts),
    staticBack: ring,
    front: `<path class="sa-hug" d="M${n(fx - fw * 0.44)} ${n(fb - fh * 0.3)}Q${n(fx)} ${n(fb - fh * 0.12)} ${n(fx + fw * 0.44)} ${n(fb - fh * 0.3)}"/>`,
    face: (mood) => `<g class="sa-glance">${face(mood)}</g>`,
    crack: { x: px, y: py, spread: 10, count: 2 },
    glow: `<circle class="sa-point__glow" cx="${n(px)}" cy="${n(py)}" r="5"/><circle class="sa-point" cx="${n(px)}" cy="${n(py)}" r="2.4"/>`,
    idleOrigin: [fx, fb],
    shadow: fw * 0.6,
    core: [px, py],
    badge: [bx, by],
    top: [fx, fb - fh],
    waist: [fx, fb - fh * 0.34, fw * 0.56],
  };
}

// ------------------------------------------------------------------------------------------------
// Fear: a scared (not scary) fur ball on spindly ink legs, 3 to 7 eyes; Flare opens more eyes
// ------------------------------------------------------------------------------------------------

const EYE_SLOTS: [number, number, number][] = [
  [-11, -1, 8.4],
  [11, -1, 8.4],
  [0, -19, 5.6],
  [-24, -14, 4.8],
  [24, -14, 4.8],
  [-21, 14, 4.4],
  [21, 14, 4.4],
];

function fear(c: GenCtx): Parts {
  const r = c.rng('shape');
  const legH = r.range(50, 64);
  const R = r.range(30, 36);
  const cy = GROUND - legH - R;
  const tufts = r.int(14, 18);
  const pts: P[] = [];
  for (let i = 0; i < tufts; i++) {
    const a = (i / tufts) * 360 + r.jitter(5);
    const [ox, oy] = polar(CX, cy, R + r.range(5, 10), a);
    const [ix, iy] = polar(CX, cy, R - 1, a + 180 / tufts);
    pts.push({ x: ox, y: oy, sharp: true }, { x: ix, y: iy });
  }
  const limbs = c.rng('limbs');
  const legs = limbs.int(4, 6);
  let legMarkup = '';
  for (let i = 0; i < legs; i++) {
    // Legs fan out from the lower body; outer legs reach wide with high knees, inner ones stay close.
    const t = i / (legs - 1);
    const side = t < 0.5 ? -1 : 1;
    const spreadK = Math.abs(t - 0.5) * 2;
    const a = side < 0 ? 250 - spreadK * 40 + limbs.jitter(5) : 110 + spreadK * 40 + limbs.jitter(5);
    const [ax, ay] = polar(CX, cy, R * 0.62, a);
    const kx = ax + side * (12 + spreadK * limbs.range(16, 22));
    const ky = cy - R * (0.02 + spreadK * limbs.range(0.45, 0.65));
    const fx = kx + side * (10 + spreadK * limbs.range(10, 14));
    const d = `M${n(ax)} ${n(ay)}Q${n(ax + (kx - ax) * 0.2)} ${n(ky - 4)} ${n(kx)} ${n(ky)}Q${n(kx + (fx - kx) * 0.9)} ${n(ky + 8)} ${n(fx)} ${n(GROUND - 1)}`;
    legMarkup += limb(d, 6.4, 'sa-limb sa-limb--leg');
    legMarkup += `<ellipse class="sa-fist" cx="${n(fx + side * 2)}" cy="${GROUND - 1.5}" rx="5" ry="2.6"/>`;
  }
  const eyeR = c.rng('eyes');
  const slots = eyeR.int(3, 7);
  const open = Math.min(slots, Math.max(2, slots - 2) + Math.max(0, c.flare));
  const spots: EyeSpot[] = [];
  for (let i = 0; i < slots; i++) {
    const [dx, dy, rr] = EYE_SLOTS[i]!;
    spots.push({ x: CX + dx + eyeR.jitter(1.5), y: cy + dy + eyeR.jitter(1.5), rx: rr, ry: rr * 1.1, open: i < open });
  }
  return {
    body: closedPath(pts),
    back: legMarkup,
    face: faceOf(c, { eyes: spots, mouth: { x: CX, y: cy + 17, w: 13 }, brows: true, iris: true }),
    crack: { x: CX, y: cy + 12, spread: R * 0.8, count: 3, lo: 105, hi: 255 },
    shadow: 52,
    core: [CX, cy],
    badge: [CX + R * 0.78, cy + R * 0.62],
    top: [CX, cy - R - 8],
    waist: [CX, cy + R * 0.25, R + 6],
  };
}

// ------------------------------------------------------------------------------------------------
// Despair: a figure sinking into a pit; Flare widens the pit
// ------------------------------------------------------------------------------------------------

function despair(c: GenCtx): Parts {
  const r = c.rng('shape');
  const f = Math.min(5, c.flare);
  const pitRx = 62 + f * 4;
  const pitRy = 15 + f * 0.8;
  const pitY = 182;
  const fx = CX + r.jitter(6);
  const top = r.range(84, 96);
  const hw = r.range(27, 32);
  const tilt = r.range(3, 7);
  const pts: P[] = [
    { x: fx - hw * 0.72, y: pitY + 8 },
    { x: fx - hw * 0.86, y: 160 },
    { x: fx - hw - 3, y: 138 },
    { x: fx - hw * 0.74, y: top + 36 },
    { x: fx - hw * 0.62 - tilt, y: top + 22 },
    { x: fx - hw * 0.46 - tilt, y: top + 6 },
    { x: fx - tilt, y: top },
    { x: fx + hw * 0.5 - tilt, y: top + 5 },
    { x: fx + hw * 0.62 - tilt * 0.5, y: top + 22 },
    { x: fx + hw * 0.74, y: top + 38 },
    { x: fx + hw + 3, y: 140 },
    { x: fx + hw * 0.86, y: 162 },
    { x: fx + hw * 0.72, y: pitY + 8 },
  ];
  const ey = top + 20;
  const back =
    `<ellipse class="sa-pit" cx="${CX}" cy="${pitY}" rx="${n(pitRx)}" ry="${n(pitRy)}"/>` +
    `<ellipse class="sa-pit__deep" cx="${CX}" cy="${n(pitY + 2)}" rx="${n(pitRx * 0.7)}" ry="${n(pitRy * 0.6)}"/>` +
    `<ellipse class="sa-pit__rim" cx="${CX}" cy="${pitY}" rx="${n(pitRx)}" ry="${n(pitRy)}"/>`;
  const gr = c.rng('glint');
  const gx = CX + gr.pick([-1, 1]) * gr.range(0.5, 0.66) * pitRx;
  const gy = pitY + 1;
  const gs = 7;
  const gk = 1.1;
  const glint = `<path class="sa-glint-star" style="transform-origin:${n(gx)}px ${n(gy)}px" d="M${n(gx)} ${n(gy - gs)}C${n(gx + gk)} ${n(gy - gk)} ${n(gx + gk)} ${n(gy - gk)} ${n(gx + gs)} ${n(gy)}C${n(gx + gk)} ${n(gy + gk)} ${n(gx + gk)} ${n(gy + gk)} ${n(gx)} ${n(gy + gs)}C${n(gx - gk)} ${n(gy + gk)} ${n(gx - gk)} ${n(gy + gk)} ${n(gx - gs)} ${n(gy)}C${n(gx - gk)} ${n(gy - gk)} ${n(gx - gk)} ${n(gy - gk)} ${n(gx)} ${n(gy - gs)}Z"/>`;
  const lip = `<path class="sa-pit__lip" d="M${n(CX - pitRx)} ${pitY}A${n(pitRx)} ${n(pitRy)} 0 0 0 ${n(CX + pitRx)} ${pitY}Q${CX} ${n(pitY + pitRy * 0.36)} ${n(CX - pitRx)} ${pitY}Z"/>`;
  const pr = c.rng('particles');
  let particles = '';
  const count = pr.int(6, 8);
  for (let i = 0; i < count; i++) {
    const a = pr.range(-80, 80);
    const dist = pr.range(0.8, 1.25) * pitRx;
    const [px, py] = polar(0, 0, dist, a);
    particles += `<circle class="sa-particle" cx="${CX}" cy="${pitY}" r="${n(pr.range(1.8, 3))}" style="--px:${n(px)}px;--py:${n(Math.min(py, -10) * 0.8)}px;animation-duration:${n(pr.range(2.4, 3.6))}s;animation-delay:${n(-pr.range(0, 3.6))}s"/>`;
  }
  const limbs = c.rng('limbs');
  const armSide = limbs.pick([-1, 1] as const);
  const sx = fx + armSide * (hw - 2);
  const hx = CX + armSide * (pitRx * 0.78);
  const arm =
    limb(`M${n(sx)} 136Q${n(sx + armSide * 18)} 146 ${n(hx)} ${pitY - 4}`, 10) +
    `<ellipse class="sa-fist" cx="${n(hx)}" cy="${pitY - 3}" rx="8" ry="5.5"/>`;
  return {
    body: closedPath(pts),
    staticBack: back + glint,
    front: arm,
    face: faceOf(c, {
      eyes: [
        { x: fx - 11 - tilt, y: ey, rx: 7.2, ry: 6.8 },
        { x: fx + 11 - tilt, y: ey, rx: 7.2, ry: 6.8 },
      ],
      mouth: { x: fx - tilt, y: ey + 15, w: 12 },
      brows: true,
    }),
    staticFront: lip + particles,
    crack: { x: fx, y: 146, spread: 24, count: 2, lo: 60, hi: 300 },
    idleOrigin: [fx, pitY],
    shadow: pitRx * 0.9,
    core: [fx, 132],
    badge: [fx - armSide * (hw * 0.5), 160],
    top: [fx - tilt, top],
    waist: [fx, 146, hw + 4],
  };
}

// ------------------------------------------------------------------------------------------------
// Anxiety: a mass whose own outline is a jittery, self-crossing scribble, hands clutching each other
// ------------------------------------------------------------------------------------------------

function scribble(r: Rand, cx: number, cy: number, R: number, count: number): string {
  const pts: P[] = [];
  let a = r.range(0, 360);
  for (let i = 0; i < count; i++) {
    a += r.range(95, 160);
    const [x, y] = polar(cx, cy, R * r.range(0.25, 0.98), a);
    pts.push({ x, y });
  }
  return openPath(pts);
}

/** A loop drawn round and round the rim with a shaky hand: 2 to 3 turns that cross each other. */
function scribbleOutline(r: Rand, cx: number, cy: number, R: number): string {
  const pts: P[] = [];
  const turns = r.range(2.2, 2.7);
  const steps = Math.round(turns * 15);
  let a = r.range(0, 360);
  for (let i = 0; i <= steps; i++) {
    a += 360 / 15 + r.jitter(6);
    const [x, y] = polar(cx, cy, R + r.jitter(4.2), a);
    pts.push({ x, y, sharp: r.chance(0.18) });
  }
  return openPath(pts);
}

function anxiety(c: GenCtx): Parts {
  const r = c.rng('shape');
  const R = r.range(46, 52);
  const cy = GROUND - 26 - R;
  const pts: P[] = [];
  const lumps = 11;
  for (let i = 0; i < lumps; i++) {
    const [x, y] = polar(CX, cy, R - 2 + r.jitter(3), (i / lumps) * 360);
    pts.push({ x, y });
  }
  const sr = c.rng('outline');
  const outlineA = scribbleOutline(sr, CX, cy, R);
  const outlineB = scribbleOutline(sr, CX, cy, R);
  // Threads stay in the lower body behind the hands, clear of the face.
  const tr = c.rng('threads');
  const threads = [scribble(tr, CX, cy + R * 0.54, R * 0.34, 8), scribble(tr, CX + tr.jitter(4), cy + R * 0.56, R * 0.3, 6)];
  const hy = cy + R * 0.6;
  const limbs = c.rng('limbs');
  const lift = limbs.range(-3, 3);
  const arms =
    limb(`M${n(CX - R * 0.86)} ${n(cy + R * 0.08)}Q${n(CX - R * 0.7)} ${n(hy + 6)} ${n(CX - 7)} ${n(hy + lift)}`, 4.6) +
    limb(`M${n(CX + R * 0.86)} ${n(cy + R * 0.08)}Q${n(CX + R * 0.7)} ${n(hy + 6)} ${n(CX + 7)} ${n(hy - lift)}`, 4.6);
  const hands =
    `<ellipse class="sa-hand" cx="${n(CX - 4)}" cy="${n(hy + lift)}" rx="7.2" ry="6.2"/>` +
    `<ellipse class="sa-hand" cx="${n(CX + 4)}" cy="${n(hy - lift + 1.5)}" rx="7.2" ry="6.2"/>` +
    `<path class="sa-hand__line" d="M${n(CX - 1)} ${n(hy - 4)}q-3 4 0 8M${n(CX + 3)} ${n(hy - 3.5)}q-2.5 3.5 0 7"/>`;
  const legs =
    limb(`M${n(CX - 14)} ${n(cy + R - 8)}L${n(CX - 18)} ${GROUND}`, 5.4) + limb(`M${n(CX + 14)} ${n(cy + R - 8)}L${n(CX + 18)} ${GROUND}`, 5.4);
  const ey = cy - 12;
  return {
    body: closedPath(pts),
    outline: `<path class="sa-scribble-rim sa-scribble-rim--a" d="${outlineA}"/><path class="sa-scribble-rim sa-scribble-rim--b" d="${outlineB}"/>`,
    back: legs,
    front: arms + hands,
    face: faceOf(c, {
      eyes: [
        { x: CX - 13, y: ey, rx: 9, ry: 10.5 },
        { x: CX + 13, y: ey, rx: 9, ry: 10.5 },
      ],
      mouth: { x: CX, y: ey + 18, w: 16 },
      brows: true,
    }),
    crack: null,
    glow: threads.map((d) => `<path class="sa-thread" d="${d}"/>`).join(''),
    shadow: 46,
    core: [CX, cy + R * 0.3],
    badge: [CX + R * 0.66, cy - R * 0.5],
    top: [CX, cy - R - 3],
    waist: [CX, cy + R * 0.28, R + 4],
  };
}

// ------------------------------------------------------------------------------------------------
// Doubt: a question-mark wisp (Fleeting)
// ------------------------------------------------------------------------------------------------

function doubt(c: GenCtx): Parts {
  const hook = `M76 96C74 66 94 50 110 50C128 50 140 64 140 80C140 100 118 106 112 122C109 131 112 138 107 148`;
  const dotY = 176;
  const flash = `<path class="sa-flash sa-flash--stroke" d="${hook}"/><circle class="sa-flash" cx="105" cy="${dotY}" r="13"/>`;
  return {
    body: `M92 ${dotY}a13 13 0 1 0 26 0a13 13 0 1 0 -26 0Z`,
    back: `<path class="sa-hook__rim" d="${hook}"/><path class="sa-hook" d="${hook}"/>`,
    face: (mood) =>
      expression(mood === 'fear' ? 'anxiety' : mood, { eyes: [{ x: 100, y: 70, rx: 5.6, ry: 6.6 }, { x: 118, y: 68, rx: 5.6, ry: 6.6 }], mouth: { x: 108, y: 85, w: 8 } }, c.rng('blink')),
    crack: null,
    glow: `<circle class="sa-ember__glow" cx="105" cy="${dotY}" r="9"/><circle class="sa-ember" cx="105" cy="${dotY}" r="4"/>`,
    shadow: 18,
    flash,
    core: [105, dotY],
    badge: [128, 132],
    top: [110, 48],
    waist: [110, 110, 16],
  };
}

// ------------------------------------------------------------------------------------------------
// The Mask: a floating mask in an ink cowl; each face has its own expression, its sigil on the cheek
// ------------------------------------------------------------------------------------------------

const MASK_C = { x: CX, y: 94, rx: 34, ry: 43 };

/** The Mask's own expressions: slit eyes in the showing face's cure colour, brows and mouth per feeling. */
function maskExpression(s: Shade): string {
  const { x, y } = MASK_C;
  const ey = y - 12;
  const slit = (cx: number, dir: -1 | 1, tiltIn: number, open: number) =>
    `<path class="sa-slit" d="M${n(cx - 9)} ${n(ey + (dir < 0 ? tiltIn : -tiltIn))}Q${n(cx)} ${n(ey - open)} ${n(cx + 9)} ${n(ey + (dir < 0 ? -tiltIn : tiltIn))}Q${n(cx)} ${n(ey + open * 0.6)} ${n(cx - 9)} ${n(ey + (dir < 0 ? tiltIn : -tiltIn))}Z"/>`;
  const line = (d: string) => `<path class="sa-maskline" d="${d}"/>`;
  switch (s) {
    case 'anger':
      return (
        slit(x - 14, -1, -3, 6) + slit(x + 14, 1, -3, 6) +
        line(`M${x - 24} ${ey - 15}L${x - 5} ${ey - 8}M${x + 24} ${ey - 15}L${x + 5} ${ey - 8}`) +
        line(`M${x - 11} ${y + 21}Q${x} ${y + 12} ${x + 11} ${y + 21}`)
      );
    case 'sadness':
      return (
        slit(x - 14, -1, 3, 5) + slit(x + 14, 1, 3, 5) +
        line(`M${x - 23} ${ey - 7}Q${x - 14} ${ey - 13} ${x - 5} ${ey - 16}M${x + 23} ${ey - 7}Q${x + 14} ${ey - 13} ${x + 5} ${ey - 16}`) +
        line(`M${x - 8} ${y + 20}Q${x} ${y + 15} ${x + 8} ${y + 20}`) +
        `<path class="sa-masktear" d="M${x - 15} ${ey + 6}c1.6 2.6 3 4.4 3 6a3 3 0 0 1 -6 0c0 -1.6 1.4 -3.4 3 -6Z"/>`
      );
    case 'loneliness':
      return (
        `<g transform="translate(5 1)">${slit(x - 14, -1, 1, 4)}${slit(x + 14, 1, 1, 4)}</g>` +
        line(`M${x - 5} ${y + 19}L${x + 7} ${y + 19}`)
      );
    case 'fear':
      return (
        `<ellipse class="sa-slit" cx="${x - 14}" cy="${ey}" rx="7" ry="8"/><ellipse class="sa-slit" cx="${x + 14}" cy="${ey}" rx="7" ry="8"/>` +
        `<circle class="sa-maskpupil" cx="${x - 14}" cy="${ey}" r="1.6"/><circle class="sa-maskpupil" cx="${x + 14}" cy="${ey}" r="1.6"/>` +
        line(`M${x - 22} ${ey - 13}Q${x - 14} ${ey - 20} ${x - 6} ${ey - 14}M${x + 22} ${ey - 13}Q${x + 14} ${ey - 20} ${x + 6} ${ey - 14}`) +
        `<ellipse class="sa-maskmouth" cx="${x}" cy="${y + 19}" rx="4" ry="5"/>`
      );
    case 'despair':
      return (
        slit(x - 14, -1, 0, 2.5) + slit(x + 14, 1, 0, 2.5) +
        line(`M${x - 22} ${ey - 7}L${x - 6} ${ey - 7}M${x + 22} ${ey - 7}L${x + 6} ${ey - 7}`) +
        line(`M${x - 9} ${y + 20}q4.5 -2 9 0t9 0`)
      );
    case 'anxiety':
      return (
        slit(x - 14, -1, 2, 5) + slit(x + 14, 1, 2, 5) +
        line(`M${x - 22} ${ey - 10}Q${x - 13} ${ey - 14} ${x - 5} ${ey - 18}M${x + 22} ${ey - 10}Q${x + 13} ${ey - 14} ${x + 5} ${ey - 18}`) +
        line(`M${x - 9} ${y + 20}l3 -2.5l3 2.5l3 -2.5l3 2.5l3 -2.5`)
      );
  }
}

function mask(c: GenCtx): Parts {
  const r = c.rng('shape');
  const sway = r.jitter(4);
  // A cowl: a hood with a soft point at the top that falls into a wisp instead of a hem.
  const pts: P[] = [
    { x: CX + 8 + sway, y: 14, sharp: true },
    { x: 140, y: 32 },
    { x: 157, y: 72 },
    { x: 160, y: 116 },
    { x: 148, y: 150 },
    { x: 128, y: 164 },
    { x: 112, y: 166 },
    { x: CX + 3 + sway, y: 186, sharp: true },
    { x: 90, y: 166 },
    { x: 72, y: 164 },
    { x: 52, y: 150 },
    { x: 40, y: 116 },
    { x: 43, y: 72 },
    { x: 60, y: 32 },
  ];
  const { x: mcx, y: mcy, rx, ry } = MASK_C;
  const expressions = SHADES.map((s) => `<g class="sa-mexpr sa-mexpr--${s}">${maskExpression(s)}</g>`).join('');
  const cheek = SHADES.map(
    (s) => `<g class="sa-mface sa-mface--${s}" transform="translate(${mcx + 12} ${mcy + 4}) scale(${n(13 / 24)})">${sigilBody(s)}</g>`,
  ).join('');
  const next = SHADES.map(
    (s) => `<g class="sa-nface sa-nface--${s}" transform="translate(${mcx - 6} ${mcy - 40}) scale(${n(12 / 24)})">${sigilBody(s)}</g>`,
  ).join('');
  const maskCracks = fissures(c.rng('cracks'), mcx, mcy, rx, ry, 6)
    .map((d, i) => `<path class="sa-mcrack" d="${d}" style="opacity:clamp(0, calc(var(--flare) + 1 - ${i}), 1)"/>`)
    .join('');
  const opening = `<ellipse class="sa-cowl" cx="${mcx}" cy="${mcy + 2}" rx="${rx + 9}" ry="${ry + 9}"/>`;
  return {
    body: closedPath(pts),
    front:
      opening +
      `<ellipse class="sa-maskface" cx="${mcx}" cy="${mcy}" rx="${rx}" ry="${ry}"/>` +
      `<ellipse class="sa-maskface__shine" cx="${mcx - 10}" cy="${mcy - 20}" rx="14" ry="9"/>` +
      `<g class="sa-mcracks" clip-path="url(#MASKCLIP)">${maskCracks}</g>` +
      `<g class="sa-mexprs">${expressions}</g><g class="sa-mfaces">${cheek}</g><g class="sa-nfaces">${next}</g>`,
    face: () => '',
    crack: null,
    idleOrigin: [CX, 100],
    shadow: 40,
    core: [mcx, mcy],
    badge: [CX + 40, 150],
    top: [CX + 8, 16],
    waist: [CX, 140, 56],
  };
}

// ------------------------------------------------------------------------------------------------
// Apathy and The Numbness: a smooth featureless grey oval
// ------------------------------------------------------------------------------------------------

function numb(c: GenCtx): Parts {
  const r = c.rng('static');
  const slouched = c.opts.slouched ?? false;
  const rx = slouched ? 60 : 62;
  const ry = slouched ? 42 : 84;
  const cy = slouched ? GROUND - ry + 4 : GROUND - ry - 2;
  const body = `M${CX - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
  let lines = '';
  for (let y = cy - ry; y < cy + ry; y += 5) lines += `M${CX - rx} ${n(y + r.jitter(0.8))}H${CX + rx}`;
  const felt = (c.opts.feltCracks ?? [])
    .slice(0, 6)
    .map(([a, b], i) => {
      const cr = c.rng(`felt${i}`);
      const [d] = cracksOnce(cr, CX + cr.jitter(rx * 0.5), cy + cr.jitter(ry * 0.5), Math.min(rx, ry) * 0.7);
      return (
        `<path class="sa-felt sa-felt--glow" d="${d}" style="stroke:var(--${a})"/>` +
        `<path class="sa-felt" d="${d}" style="stroke:var(--${a})" transform="translate(-1.1 -0.6)"/>` +
        `<path class="sa-felt" d="${d}" style="stroke:var(--${b})" transform="translate(1.1 0.6)"/>`
      );
    })
    .join('');
  return {
    body,
    front: `<ellipse class="sa-numb__shine" cx="${CX - rx * 0.32}" cy="${n(cy - ry * 0.45)}" rx="${n(rx * 0.3)}" ry="${n(ry * 0.18)}"/><path class="sa-static" d="${lines}" clip-path="url(#BODYCLIP)"/><g clip-path="url(#BODYCLIP)">${felt}</g>`,
    face: () => '',
    crack: null,
    idleOrigin: [CX, GROUND],
    shadow: rx * 0.95,
    core: [CX, cy],
    badge: [CX + rx * 0.6, cy + ry * 0.5],
    top: [CX, cy - ry],
    waist: [CX, cy, rx],
  };
}

/** One jagged FELT crack across the numb oval. */
function cracksOnce(r: Rand, ox: number, oy: number, spread: number): string[] {
  let angle = r.range(0, 360);
  let [x, y] = [ox, oy];
  let d = `M${n(x)} ${n(y)}`;
  for (let s = 0; s < 4; s++) {
    angle += r.jitter(40);
    [x, y] = polar(x, y, (spread / 4) * r.range(0.7, 1.2), angle);
    d += `L${n(x)} ${n(y)}`;
  }
  return [d];
}

export const GENERATORS: Record<ShadeFamily, (c: GenCtx) => Parts> = {
  anger,
  sadness,
  loneliness,
  fear,
  despair,
  anxiety,
  doubt,
  mask,
  numb,
};
