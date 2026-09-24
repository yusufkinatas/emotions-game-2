// One silhouette generator per Shade family (DESIGN 16.7). Each returns body parts in the 200x210 frame;
// shadeArt.ts assembles them. Variety comes only from the seeded Rand: height, spikes, eye and limb
// counts, crack paths. Flare-dependent geometry (spikes, eyes, ring, pit) is drawn here.

import { SHADES } from '../../engine/emotions';
import type { Rand } from './hash';
import { rand } from './hash';
import { CX, GROUND, blink, closedPath, cracks, eye, limb, mouth, openPath } from './shadeGeometry';
import type { P } from './shadeGeometry';
import type { ShadeArtOpts, ShadeFamily } from './shadeArt';
import { sigilBody } from './sigils';
import { n, polar } from './svg';

export interface Parts {
  /** Closed body path: fill, rim, crack clip and hit flash. */
  body: string;
  /** Static layers outside the idle group (Despair's pit, the Loneliness ring). */
  staticBack?: string;
  staticFront?: string;
  /** Idle-animated layers behind and in front of the body. */
  back?: string;
  front?: string;
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
  /** Where the Resolve mote rises from. */
  core: [number, number];
}

export interface GenCtx {
  r: Rand;
  flare: number;
  opts: ShadeArtOpts;
}

function anger({ r, flare }: GenCtx): Parts {
  const W = r.range(128, 146);
  const H = r.range(100, 116);
  const top = GROUND - H;
  const x0 = CX - W / 2;
  const x1 = CX + W / 2;
  const spikes = r.int(5, 9);
  const grow = 1 + 0.14 * flare;
  const crown: P[] = [];
  const xa = x0 + 20;
  const xb = x1 - 20;
  const arcY = (t: number) => top + 14 - 18 * Math.sin(Math.PI * t);
  const centre = { x: CX, y: GROUND - H * 0.15 };
  for (let k = 0; k < spikes; k++) {
    const tv = k / spikes;
    const tt = (k + 0.5) / spikes;
    if (k > 0) crown.push({ x: xa + (xb - xa) * tv + r.jitter(1.5), y: arcY(tv) + r.range(0, 3), sharp: true });
    const bx = xa + (xb - xa) * tt;
    const by = arcY(tt);
    const len = (r.range(11, 17) + 9 * Math.sin(Math.PI * tt)) * grow;
    const dx = bx - centre.x;
    const dy = by - centre.y;
    const m = Math.hypot(dx, dy);
    crown.push({ x: bx + (dx / m) * len + r.jitter(2), y: by + (dy / m) * len, sharp: true });
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
  const look: [number, number] = [-2.2, 1.6];
  const b = blink(r);
  const armY = GROUND - H * 0.42;
  const arms =
    limb(`M${n(x0 + 10)} ${n(armY)}Q${n(x0 - 10)} ${n(armY + 8)} ${n(x0 - 8)} ${n(armY + 26)}`, 13) +
    `<circle class="sa-fist" cx="${n(x0 - 8)}" cy="${n(armY + 28)}" r="9.5"/>` +
    limb(`M${n(x1 - 10)} ${n(armY)}Q${n(x1 + 10)} ${n(armY + 8)} ${n(x1 + 8)} ${n(armY + 26)}`, 13) +
    `<circle class="sa-fist" cx="${n(x1 + 8)}" cy="${n(armY + 28)}" r="9.5"/>`;
  const my = GROUND - H * 0.3;
  const front =
    eye(CX - ex, ey, 10.5, 11.5, { lid: 'angry', side: -1, look, ...b }) +
    eye(CX + ex, ey, 10.5, 11.5, { lid: 'angry', side: 1, look, ...b }) +
    mouth(`M${n(CX - 13)} ${n(my + 3)}Q${n(CX)} ${n(my - 7)} ${n(CX + 13)} ${n(my + 3)}`) +
    `<path class="sa-fang" d="M${n(CX + 5)} ${n(my - 1.9)}L${n(CX + 10)} ${n(my - 0.4)}L${n(CX + 7.8)} ${n(my + 4.6)}Z"/>` +
    `<path class="sa-puff" d="M${n(x0 + 16)} ${n(ey - 30)}q-6 -8 -2 -15M${n(x1 - 16)} ${n(ey - 30)}q6 -8 2 -15"/>`;
  return {
    body: closedPath(pts),
    back: arms,
    front,
    crack: (() => {
      const side = r.pick([-1, 1]);
      const lo = side > 0 ? 40 : 150;
      return { x: CX + side * r.range(20, 30), y: GROUND - H * 0.3, spread: 38, count: 3, lo, hi: lo + 170 };
    })(),
    shadow: W * 0.55,
    heat: true,
    core: [CX, GROUND - H * 0.4],
  };
}

function sadness({ r, flare }: GenCtx): Parts {
  const H = r.range(150, 166);
  const W = r.range(112, 124);
  const top = GROUND - H;
  const bw = W * r.range(0.74, 0.82);
  const hoodBase = top + 30;
  const lobeY = top + r.range(56, 62);
  const neckY = top + 74;
  const bumps = r.int(4, 6);
  const hx0 = CX - W * 0.52;
  const hx1 = CX + W * 0.52;
  // Left side up to the drooping hood lobe.
  let d = `M${n(CX - bw / 2)} ${GROUND}`;
  d += `C${n(CX - bw / 2 - 3)} ${n(GROUND - 40)} ${n(CX - W * 0.38)} ${n(neckY + 30)} ${n(CX - W * 0.36)} ${n(neckY)}`;
  d += `Q${n(CX - W * 0.43)} ${n(lobeY + 6)} ${n(CX - W * 0.48)} ${n(lobeY)}`;
  d += `Q${n(hx0 - 5)} ${n(lobeY - 12)} ${n(hx0)} ${n(hoodBase)}`;
  // Cloud scallops across the top, the middle ones highest.
  for (let i = 0; i < bumps; i++) {
    const x = hx0 + ((hx1 - hx0) * (i + 1)) / bumps;
    const mid = 1 - Math.abs((i + 0.5) / bumps - 0.5) * 2;
    const y = hoodBase + r.jitter(2) - (i === bumps - 1 ? 0 : 0);
    const rad = ((hx1 - hx0) / bumps) * (0.52 + mid * 0.12 + r.range(0, 0.06));
    d += `A${n(rad)} ${n(rad * r.range(0.9, 1.08))} 0 0 1 ${n(x)} ${n(y)}`;
  }
  d += `Q${n(hx1 + 5)} ${n(lobeY - 12)} ${n(CX + W * 0.48)} ${n(lobeY)}`;
  d += `Q${n(CX + W * 0.43)} ${n(lobeY + 6)} ${n(CX + W * 0.36)} ${n(neckY)}`;
  d += `C${n(CX + W * 0.38)} ${n(neckY + 30)} ${n(CX + bw / 2 + 3)} ${n(GROUND - 40)} ${n(CX + bw / 2)} ${GROUND}`;
  // Dripping hem, right to left.
  const scallops = r.int(3, 4);
  for (let i = scallops - 1; i >= 0; i--) {
    const x = CX - bw / 2 + (bw * i) / scallops;
    d += `A${n(bw / scallops / 2)} ${n(r.range(4, 7))} 0 0 1 ${n(x)} ${GROUND}`;
  }
  d += 'Z';
  const faceY = top + 50;
  const b = blink(r);
  const look: [number, number] = [-1.4, 2];
  const tearDelay = r.range(0, 2);
  const tear = (x: number, y: number, delay: number) =>
    `<path class="sa-tear" style="animation-delay:${n(delay)}s" d="M${n(x)} ${n(y)}c1.8 2.8 3.5 4.8 3.5 6.5a3.5 3.5 0 0 1 -7 0c0 -1.7 1.7 -3.7 3.5 -6.5Z"/>`;
  const arm = (s: -1 | 1) => {
    const sx = CX + s * W * 0.34;
    const sy = neckY + 2;
    const hx = CX + s * (bw / 2 + r.range(8, 13));
    const hy = GROUND - r.range(14, 24);
    return (
      limb(`M${n(sx)} ${n(sy)}C${n(sx + s * 14)} ${n(sy + 24)} ${n(hx + s * 2)} ${n(hy - 44)} ${n(hx)} ${n(hy)}`, 9.5) +
      `<ellipse class="sa-fist" cx="${n(hx)}" cy="${n(hy + 5)}" rx="6" ry="7.5"/>`
    );
  };
  const hollow = `<ellipse class="sa-hollow" cx="${CX}" cy="${n(faceY + 2)}" rx="${n(W * 0.27)}" ry="21"/>`;
  const hoodShade = `<path class="sa-hood-shade" d="${d}" style="opacity:${n(Math.min(5, flare) * 0.09)}" clip-path="url(#HOODCLIP)"/>`;
  return {
    body: d,
    back: arm(-1) + arm(1),
    front:
      hollow +
      eye(CX - 14, faceY, 7.6, 8.6, { lid: 'sad', side: -1, look, ...b }) +
      eye(CX + 14, faceY, 7.6, 8.6, { lid: 'sad', side: 1, look, ...b }) +
      mouth(`M${n(CX - 6)} ${n(faceY + 15)}Q${n(CX)} ${n(faceY + 11)} ${n(CX + 6)} ${n(faceY + 15)}`) +
      tear(CX - 16, faceY + 8, tearDelay) +
      tear(CX + 16, faceY + 8, tearDelay + 1.3) +
      hoodShade,
    crack: { x: CX + r.jitter(6), y: top + 104, spread: 28, count: 3, lo: 60, hi: 300 },
    shadow: bw * 0.62,
    core: [CX, top + 100],
  };
}

function loneliness({ r, flare }: GenCtx): Parts {
  const ringR = 76 + Math.min(5, flare) * 3;
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
  const b = blink(r);
  const ring =
    `<circle class="sa-ring__rim" cx="${CX}" cy="${ringY}" r="${n(ringR)}"/>` +
    `<circle class="sa-ring" cx="${CX}" cy="${ringY}" r="${n(ringR)}"/>` +
    `<circle class="sa-ring__inner" cx="${CX}" cy="${ringY}" r="${n(ringR - 5)}"/>`;
  const px = fx + fw * 0.08;
  const py = fb - fh * 0.26;
  return {
    body: closedPath(pts),
    staticBack: ring,
    front:
      `<g class="sa-glance">` +
      eye(fx - 8.5, ey, 5.4, 6.4, { lid: 'sad', side: -1, look: [1.6, 0.6], ...b }) +
      eye(fx + 8.5, ey, 5.4, 6.4, { lid: 'sad', side: 1, look: [1.6, 0.6], ...b }) +
      `</g>` +
      `<path class="sa-hug" d="M${n(fx - fw * 0.44)} ${n(fb - fh * 0.3)}Q${n(fx)} ${n(fb - fh * 0.12)} ${n(fx + fw * 0.44)} ${n(fb - fh * 0.3)}"/>`,
    crack: { x: px, y: py, spread: 10, count: 2 },
    glow: `<circle class="sa-point__glow" cx="${n(px)}" cy="${n(py)}" r="5"/><circle class="sa-point" cx="${n(px)}" cy="${n(py)}" r="2.4"/>`,
    idleOrigin: [fx, fb],
    shadow: fw * 0.6,
    core: [px, py],
  };
}

const EYE_SLOTS: [number, number, number][] = [
  [-12, -2, 8],
  [12, -2, 8],
  [0, -19, 6],
  [-24, -15, 5],
  [24, -15, 5],
  [-21, 13, 4.5],
  [21, 13, 4.5],
];

function fear({ r, flare }: GenCtx): Parts {
  const legH = r.range(50, 66);
  const R = r.range(30, 37);
  const cy = GROUND - legH - R;
  const tufts = r.int(14, 18);
  const pts: P[] = [];
  for (let i = 0; i < tufts; i++) {
    const a = (i / tufts) * 360 + r.jitter(5);
    const [ox, oy] = polar(CX, cy, R + r.range(5, 11), a);
    const [ix, iy] = polar(CX, cy, R - 1, a + 180 / tufts);
    pts.push({ x: ox, y: oy, sharp: true }, { x: ix, y: iy });
  }
  const legs = r.int(4, 6);
  let legMarkup = '';
  for (let i = 0; i < legs; i++) {
    // Legs fan out from the lower body; outer legs reach wide with high knees, inner ones stay close.
    const t = i / (legs - 1);
    const side = t < 0.5 ? -1 : 1;
    const spreadK = Math.abs(t - 0.5) * 2;
    const a = side < 0 ? 250 - spreadK * 40 + r.jitter(5) : 110 + spreadK * 40 + r.jitter(5);
    const [ax, ay] = polar(CX, cy, R * 0.62, a);
    const kx = ax + side * (14 + spreadK * r.range(18, 26));
    const ky = cy - R * (0.05 + spreadK * r.range(0.55, 0.8));
    const fx = kx + side * (12 + spreadK * r.range(12, 18));
    const d = `M${n(ax)} ${n(ay)}Q${n(ax + (kx - ax) * 0.2)} ${n(ky - 4)} ${n(kx)} ${n(ky)}Q${n(kx + (fx - kx) * 0.9)} ${n(ky + 8)} ${n(fx)} ${n(GROUND)}`;
    legMarkup += limb(d, 4.2);
    legMarkup += `<ellipse class="sa-fist" cx="${n(fx + side * 1.5)}" cy="${GROUND - 1}" rx="3.4" ry="2"/>`;
  }
  const slots = r.int(3, 7);
  const open = Math.min(slots, Math.max(2, slots - 2) + Math.max(0, flare));
  let eyes = '';
  for (let i = 0; i < slots; i++) {
    const [dx, dy, rr] = EYE_SLOTS[i]!;
    const x = CX + dx + r.jitter(1.5);
    const y = cy + dy + r.jitter(1.5);
    if (i < open) {
      eyes += eye(x, y, rr, rr * 1.08, {
        lid: 'none',
        side: dx < 0 ? -1 : 1,
        look: [-rr * 0.18, rr * 0.08],
        pupil: rr * 0.3,
        iris: true,
        ...blink(r),
      });
    } else {
      eyes += `<path class="sa-closed-eye" d="M${n(x - rr)} ${n(y)}Q${n(x)} ${n(y + rr * 0.7)} ${n(x + rr)} ${n(y)}"/>`;
    }
  }
  return {
    body: closedPath(pts),
    back: legMarkup,
    front: eyes + mouth(`M${n(CX - 5)} ${n(cy + 20)}q2.5 -2.5 5 0t5 0`),
    crack: { x: CX, y: cy + 12, spread: R * 0.8, count: 3, lo: 105, hi: 255 },
    shadow: 50,
    core: [CX, cy],
  };
}

function despair({ r, flare }: GenCtx): Parts {
  const f = Math.min(5, flare);
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
  const b = blink(r);
  const back =
    `<ellipse class="sa-pit" cx="${CX}" cy="${pitY}" rx="${n(pitRx)}" ry="${n(pitRy)}"/>` +
    `<ellipse class="sa-pit__deep" cx="${CX}" cy="${n(pitY + 2)}" rx="${n(pitRx * 0.7)}" ry="${n(pitRy * 0.6)}"/>` +
    `<ellipse class="sa-pit__rim" cx="${CX}" cy="${pitY}" rx="${n(pitRx)}" ry="${n(pitRy)}"/>`;
  const gx = CX + r.pick([-1, 1]) * r.range(pitRx * 0.5, pitRx * 0.66);
  const gy = pitY + 1;
  const gs = 7;
  const gk = 1.1;
  const glint = `<path class="sa-glint-star" style="transform-origin:${n(gx)}px ${n(gy)}px" d="M${n(gx)} ${n(gy - gs)}C${n(gx + gk)} ${n(gy - gk)} ${n(gx + gk)} ${n(gy - gk)} ${n(gx + gs)} ${n(gy)}C${n(gx + gk)} ${n(gy + gk)} ${n(gx + gk)} ${n(gy + gk)} ${n(gx)} ${n(gy + gs)}C${n(gx - gk)} ${n(gy + gk)} ${n(gx - gk)} ${n(gy + gk)} ${n(gx - gs)} ${n(gy)}C${n(gx - gk)} ${n(gy - gk)} ${n(gx - gk)} ${n(gy - gk)} ${n(gx)} ${n(gy - gs)}Z"/>`;
  const lip =
    `<path class="sa-pit__lip" d="M${n(CX - pitRx)} ${pitY}A${n(pitRx)} ${n(pitRy)} 0 0 0 ${n(CX + pitRx)} ${pitY}Q${CX} ${n(pitY + pitRy * 0.36)} ${n(CX - pitRx)} ${pitY}Z"/>`;
  let particles = '';
  const count = r.int(6, 8);
  for (let i = 0; i < count; i++) {
    const a = r.range(-80, 80);
    const [px, py] = polar(0, 0, r.range(pitRx * 0.8, pitRx * 1.25), a);
    particles += `<circle class="sa-particle" cx="${CX}" cy="${pitY}" r="${n(r.range(1.8, 3))}" style="--px:${n(px)}px;--py:${n(Math.min(py, -10) * 0.8)}px;animation-duration:${n(r.range(2.4, 3.6))}s;animation-delay:${n(-r.range(0, 3.6))}s"/>`;
  }
  const armSide = r.pick([-1, 1] as const);
  const sx = fx + armSide * (hw - 2);
  const hx = CX + armSide * (pitRx * 0.78);
  const arm =
    limb(`M${n(sx)} 136Q${n(sx + armSide * 18)} 146 ${n(hx)} ${pitY - 4}`, 10) +
    `<ellipse class="sa-fist" cx="${n(hx)}" cy="${pitY - 3}" rx="8" ry="5.5"/>`;
  return {
    body: closedPath(pts),
    staticBack: back + glint,
    front:
      eye(fx - 11 - tilt, ey, 7.2, 6.8, { lid: 'tired', side: -1, look: [-1, 2.4], ...b }) +
      eye(fx + 11 - tilt, ey, 7.2, 6.8, { lid: 'tired', side: 1, look: [-1, 2.4], ...b }) +
      mouth(`M${n(fx - 6 - tilt)} ${n(ey + 15)}q3 -1.4 6 0t6 0`) +
      arm,
    staticFront: lip + particles,
    crack: { x: fx, y: 146, spread: 24, count: 2, lo: 60, hi: 300 },
    idleOrigin: [fx, pitY],
    shadow: pitRx * 0.9,
    core: [fx, 132],
  };
}

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

function anxiety({ r }: GenCtx): Parts {
  const R = r.range(46, 53);
  const cy = GROUND - 26 - R;
  const pts: P[] = [];
  const lumps = 11;
  for (let i = 0; i < lumps; i++) {
    const [x, y] = polar(CX, cy, R + r.jitter(4), (i / lumps) * 360);
    pts.push({ x, y });
  }
  const scribA = scribble(r, CX, cy, R, 26);
  const scribB = scribble(r, CX, cy, R, 26);
  const threads = [scribble(r, CX, cy, R * 0.85, 9), scribble(r, CX, cy, R * 0.8, 7)];
  const armCount = r.int(2, 4);
  const armAngles = [238, 122, 292, 68].slice(0, armCount);
  let arms = '';
  for (const a of armAngles) {
    const [ax, ay] = polar(CX, cy, R - 4, a);
    const [bx, by] = polar(CX, cy, R + r.range(13, 18), a + r.jitter(10));
    const [f1x, f1y] = polar(bx, by, 5, a - 40);
    const [f2x, f2y] = polar(bx, by, 5, a + 40);
    arms += limb(`M${n(ax)} ${n(ay)}L${n(bx)} ${n(by)}M${n(f1x)} ${n(f1y)}L${n(bx)} ${n(by)}L${n(f2x)} ${n(f2y)}`, 3.6);
  }
  const legs =
    limb(`M${n(CX - 14)} ${n(cy + R - 8)}L${n(CX - 18)} ${GROUND}`, 5) + limb(`M${n(CX + 14)} ${n(cy + R - 8)}L${n(CX + 18)} ${GROUND}`, 5);
  const b = blink(r);
  const ey = cy - 5;
  return {
    body: closedPath(pts),
    back: legs + arms,
    front:
      `<path class="sa-scribble sa-scribble--a" d="${scribA}"/><path class="sa-scribble sa-scribble--b" d="${scribB}"/>` +
      eye(CX - 13, ey, 9, 10.5, { lid: 'worried', side: -1, look: [-1, 0], pupil: 2.8, ...b }) +
      eye(CX + 13, ey, 9, 10.5, { lid: 'worried', side: 1, look: [-1, 0], pupil: 2.8, ...b }) +
      `<path class="sa-brow" d="M${n(CX - 23)} ${n(ey - 15)}L${n(CX - 7)} ${n(ey - 20)}M${n(CX + 23)} ${n(ey - 15)}L${n(CX + 7)} ${n(ey - 20)}"/>` +
      mouth(`M${n(CX - 8)} ${n(ey + 19)}l4 -2.5l4 2.5l4 -2.5l4 2.5`),
    crack: null,
    glow: threads.map((d) => `<path class="sa-thread" d="${d}"/>`).join(''),
    shadow: 46,
    core: [CX, cy],
  };
}

function doubt({ r }: GenCtx): Parts {
  const hook = `M76 96C74 66 94 50 110 50C128 50 140 64 140 80C140 100 118 106 112 122C109 131 112 138 107 148`;
  const b = blink(r);
  const dotY = 176;
  const flash = `<path class="sa-flash sa-flash--stroke" d="${hook}"/><circle class="sa-flash" cx="105" cy="${dotY}" r="13"/>`;
  return {
    body: `M92 ${dotY}a13 13 0 1 0 26 0a13 13 0 1 0 -26 0Z`,
    back:
      `<path class="sa-hook__rim" d="${hook}"/><path class="sa-hook" d="${hook}"/>` +
      eye(100, 70, 5.6, 6.6, { lid: 'worried', side: -1, look: [-1.4, 1], ...b }) +
      eye(118, 68, 5.6, 6.6, { lid: 'worried', side: 1, look: [-1.4, 1], ...b }) +
      mouth('M104 86q3 -2 6 0'),
    crack: null,
    glow: `<circle class="sa-ember__glow" cx="105" cy="${dotY}" r="9"/><circle class="sa-ember" cx="105" cy="${dotY}" r="4"/>`,
    shadow: 18,
    flash,
    core: [105, dotY],
  };
}

function mask({ r }: GenCtx): Parts {
  const hem: P[] = [];
  const teeth = r.int(5, 7);
  const hx0 = 40;
  const hx1 = 160;
  for (let i = teeth; i >= 0; i--) {
    const x = hx0 + ((hx1 - hx0) * i) / teeth;
    hem.push({ x, y: 170 + r.jitter(3), sharp: true });
    if (i > 0) hem.push({ x: x - (hx1 - hx0) / teeth / 2, y: 156 + r.jitter(3) });
  }
  const pts: P[] = [
    { x: CX, y: 22 },
    { x: 138, y: 40 },
    { x: 154, y: 84 },
    { x: 156, y: 130 },
    { x: hx1 + 4, y: 172, sharp: true },
    ...hem.slice(1, -1),
    { x: hx0 - 4, y: 172, sharp: true },
    { x: 44, y: 130 },
    { x: 46, y: 84 },
    { x: 62, y: 40 },
  ];
  const mcx = CX;
  const mcy = 94;
  const faces = SHADES.map(
    (s) =>
      `<g class="sa-mface sa-mface--${s}" transform="translate(${mcx - 16} ${mcy + 2}) scale(${n(32 / 24)})">${sigilBody(s)}</g>`,
  ).join('');
  const next = SHADES.map(
    (s) => `<g class="sa-nface sa-nface--${s}" transform="translate(${mcx - 7} ${mcy - 38}) scale(${n(14 / 24)})">${sigilBody(s)}</g>`,
  ).join('');
  const maskCracks = cracks(r, mcx + 4, mcy + 8, 30, 6)
    .map((d, i) => `<path class="sa-mcrack" d="${d}" style="opacity:clamp(0, calc(var(--flare) + 1 - ${i}), 1)"/>`)
    .join('');
  const almond = (x: number, y: number) =>
    `<path class="sa-slit" d="M${n(x - 9)} ${n(y)}Q${n(x)} ${n(y - 8)} ${n(x + 9)} ${n(y)}Q${n(x)} ${n(y + 5)} ${n(x - 9)} ${n(y)}Z"/>`;
  return {
    body: closedPath(pts),
    front:
      `<ellipse class="sa-maskface" cx="${mcx}" cy="${mcy}" rx="34" ry="43"/>` +
      `<ellipse class="sa-maskface__shine" cx="${mcx - 10}" cy="${mcy - 20}" rx="14" ry="9"/>` +
      `<g class="sa-mcracks" clip-path="url(#MASKCLIP)">${maskCracks}</g>` +
      almond(mcx - 14, mcy - 12) +
      almond(mcx + 14, mcy - 12) +
      `<path class="sa-maskbrow" d="M${mcx - 24} ${mcy - 24}Q${mcx - 14} ${mcy - 30} ${mcx - 5} ${mcy - 25}M${mcx + 24} ${mcy - 24}Q${mcx + 14} ${mcy - 30} ${mcx + 5} ${mcy - 25}"/>` +
      `<g class="sa-mfaces">${faces}</g><g class="sa-nfaces">${next}</g>`,
    crack: null,
    idleOrigin: [CX, 100],
    shadow: 44,
    core: [mcx, mcy],
  };
}

function numb({ r, opts }: GenCtx): Parts {
  const slouched = opts.slouched ?? false;
  const rx = slouched ? 60 : 62;
  const ry = slouched ? 42 : 84;
  const cy = slouched ? GROUND - ry + 4 : GROUND - ry - 2;
  const body = `M${CX - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
  let lines = '';
  for (let y = cy - ry; y < cy + ry; y += 5) lines += `M${CX - rx} ${n(y + r.jitter(0.8))}H${CX + rx}`;
  const felt = (opts.feltCracks ?? [])
    .slice(0, 6)
    .map(([a, b], i) => {
      const cr = rand(opts.seed * 31 + i * 7919);
      const [d] = cracks(cr, CX + cr.jitter(rx * 0.5), cy + cr.jitter(ry * 0.5), Math.min(rx, ry) * 0.7, 1);
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
    crack: null,
    idleOrigin: [CX, GROUND],
    shadow: rx * 0.95,
    core: [CX, cy],
  };
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
