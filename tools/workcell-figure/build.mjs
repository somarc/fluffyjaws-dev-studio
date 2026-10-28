// The Attached Workcell — hero figure for the FluffyJaws Dev Studio site.
//
//   node tools/workcell-figure/build.mjs            write the poster SVG and a preview page
//   node tools/workcell-figure/build.mjs --audit    also run the anatomy geometry audit
//
// The drawing kit is the `anatomy` agent skill. Its root is read from $ANATOMY_KIT and
// defaults to ~/.agents/skills/anatomy. Stdlib Node only; nothing is added to package.json.
// Outputs: blocks/attached-workcell/workcell-figure.svg (committed) and a preview page at
// $WORKCELL_PREVIEW_DIR (default: <os tmpdir>/workcell-figure/workcell.html) for checks.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FIGURE_CSS } from './style.mjs';
import { fillsOf, polygonsOf, silhouette } from './silhouette.mjs';
import { PARTS, TITLE, DESC } from './parts.mjs';
import { compact } from './compact.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const KIT = resolve(process.env.ANATOMY_KIT || join(homedir(), '.agents/skills/anatomy'));
const load = (rel) => import(pathToFileURL(join(KIT, rel)).href);
const k = await load('kit/iso-kit.mjs');
const G = await load('kit/lathe.mjs');
const { tubePieces, tubeSvg } = await load('kit/tube.mjs');
const A = await load('kit/audit.mjs');

const W = 640;
const H = 400;

// ---------------------------------------------------------------- world plan
// x along the bench, y toward the viewer (front face at y = +64), z up; bench top z = 0.
const CH = { x: -160, y: -64, w: 302, d: 124, r: 5 };
const CH_Z = -18;
const FOOT_Z = -31;
const FRONT = CH.y + CH.d;
const GP = { x: -214, y: 78, w: 118, d: 60, r: 2 };
const GP_Z0 = -20;
const GP_Z1 = -7;

const P = k.fitProjection(
  [
    ...k.boxCorners(CH, FOOT_Z, 0), [-156, -60, 66], [8, -60, 66], [104, -50, 78], [138, -14, 78],
    ...k.boxCorners(GP, FOOT_Z, GP_Z1),
  ],
  W,
  H,
  { pad: 14, azimuth: 56, elevation: 31 },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const f2 = (v) => (Math.round(v * 100) / 100).toString();

// ---------------------------------------------------------------- recorder
const R = A.recorder(P);
const record = R.solid;
let part = 'space';
const within = (name, fn) => {
  const was = part;
  part = name;
  fn();
  part = was;
};
function put(name, ref, svg, shapes, { bias = 0, sil, ...rest } = {}) {
  return R.put({ name, at: ref, bias, svg, shapes, piece: 'cell', part, sil, ...rest });
}
function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.5, steps = 2, bevel = 0, extra = '', inner = '', bias = 0, ground = false } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  const shape = record(A.slab(plan, z0, z1 - z0, { name, ground }, steps));
  put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: 'mid', ...style, inner }) + extra, [shape], { bias });
  return { plan, z0, z1 };
}
function post(name, cx, cy, r, z, h, style = {}, { extra = '', bias = 0, ground = false, bevel = 0 } = {}) {
  const shape = record(A.cylinder(cx, cy, r, z, h, { name, ground }));
  put(name, [cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, stepsOf(r), bevel), { tone: 'mid', ...style }) + extra, [shape], { bias });
}
function turned(name, F, profile, style = {}, { extra = '', inner = '', bias = 0, smooth } = {}) {
  const rMax = Math.max(...profile.map((q) => q[1]));
  const paths = G.solidOf(profile, F, P, { steps: stepsOf(rMax), ...(smooth !== undefined ? { smooth } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name }));
  put(name, add3(F.o, mul3(F.a, mid)), S(paths, { tone: 'mid', ...style, inner }) + extra, [shape], { bias });
  return shape;
}
const stepsOf = (r) => Math.max(20, Math.min(40, Math.round(r * 2.6)));
const discOn = (name, F, s0, s1, r, style, options) => turned(name, F, [[s0, r], [s1, r]], style, options);

const CABLES = [];
function cable(name, points, r, { tone = 'hi', bend = 3, shells = [true, true], bias = 0.05, cls = '' } = {}) {
  const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
  const total = G.pathLength(route);
  const SHELL = Math.max(1.8, r * 2.6);
  const gaps = [...(shells[0] ? [[0, SHELL]] : []), ...(shells[1] ? [[total - SHELL, total]] : [])];
  R.route(name, route, r, { gaps, limp: true, rims: shells.map((on) => (on ? r * 1.7 : r)), piece: 'cell' });
  CABLES.push(name);
  tubePieces(route, r, P, { maxLength: 40, spacing: 1.6, gaps }).forEach((piece, index) => {
    const svg = tubeSvg(piece, { tone });
    put(`${name}:${index}`, piece.mid, cls ? `<g class="${cls}">${svg}</g>` : svg, [A.tube(piece.points, piece.radii)], { bias, route: name, chunk: index });
  });
  [0, 1].forEach((index) => {
    if (!shells[index]) return;
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
    const shape = record(A.disc(F, s0, s1, r * 1.7, { name: `${name}.shell${index}`, owner: name }));
    const svg = S(G.disc(s0, s1, r * 1.7, F, P, { steps: 16, bevel: 0.2 }), { tone: 'hi' });
    put(`${name}.shell${index}`, add3(end, mul3(tangent, (s0 + s1) / 2)), cls ? `<g class="${cls}">${svg}</g>` : svg, [shape], { bias: bias + 0.1 });
  });
  return route;
}

// ---------------------------------------------------------------- planes and recesses
const planeOf = (o, ex, ey, n) => ({ o, ex, ey, n });
const FRONT_AT = (y) => planeOf([0, y, 0], [1, 0, 0], [0, 0, -1], [0, 1, 0]);
const RIGHT_AT = (x) => planeOf([x, 0, 0], [0, -1, 0], [0, 0, -1], [1, 0, 0]);
const TOP_AT = (z) => planeOf([0, 0, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const onPlane = (pl, u, v, d = 0) => add3(add3(add3(pl.o, mul3(pl.ex, u)), mul3(pl.ey, v)), mul3(pl.n, -d));
function matrixOf(pl, d = 0) {
  const o = onPlane(pl, 0, 0, d);
  const p0 = at(o);
  const px = at(add3(o, pl.ex));
  const py = at(add3(o, pl.ey));
  const v = (x) => x.toFixed(4);
  return `matrix(${v(px[0] - p0[0])} ${v(px[1] - p0[1])} ${v(py[0] - p0[0])} ${v(py[1] - p0[1])} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)})`;
}
const flat = (u0, v0, u1, v1, r, steps = 5) => k.pathOf(k.roundedPlan({ x: u0, y: v0, w: u1 - u0, d: v1 - v0, r }, steps), true);
let clipCount = 0;
// an opening in a face: inner walls shaded by facing, content clipped by the opening
function recess(pl, { u0, u1, v0, v1, r = 1.5, depth }, back = '', backClass = 'wc-dark', inside = '') {
  const id = `wc-clip-${clipCount += 1}`;
  const ring = k.roundedPlan({ x: u0, y: v0, w: u1 - u0, d: v1 - v0, r }, 5);
  const cu = (u0 + u1) / 2;
  const cv = (v0 + v1) / 2;
  const buckets = [[], [], [], [], []];
  ring.forEach(([au, av], index) => {
    const [bu, bv] = ring[(index + 1) % ring.length];
    const length = Math.hypot(bu - au, bv - av) || 1;
    let [nu, nv] = [(bv - av) / length, -(bu - au) / length];
    if (nu * (cu - (au + bu) / 2) + nv * (cv - (av + bv) / 2) < 0) [nu, nv] = [-nu, -nv];
    const normal = add3(mul3(pl.ex, nu), mul3(pl.ey, nv));
    if (G.dot3(normal, V) <= 1e-6) return;
    const quad = path3([onPlane(pl, au, av), onPlane(pl, bu, bv), onPlane(pl, bu, bv, depth), onPlane(pl, au, av, depth)], true);
    buckets[G.toneOf(normal, P)].push(quad);
  });
  const shape = flat(u0, v0, u1, v1, r);
  return [
    `<clipPath id="${id}"><path transform="${matrixOf(pl)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    buckets[4].length ? `<path class="iso-top" d="${buckets[4].join('')}"/>` : '',
    ...buckets.slice(0, 4).map((d, shade) => (d.length ? `<path class="iso-shade" data-shade="${shade}" d="${d.join('')}"/>` : '')),
    `<g transform="${matrixOf(pl, depth)}"><path class="${backClass}" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    inside,
    '</g>',
    `<g transform="${matrixOf(pl)}"><path class="iso-line" data-tone="mid" d="${shape}"/></g>`,
  ].join('');
}
const onFace = (pl, svg) => `<g transform="${matrixOf(pl)}">${svg}</g>`;
const screws = (points, size = 0.5) => Dots(points.map(at), { size, tone: 'hi' });
const ringScrew = (x, y, z, r = 1.6) => Ln(k.ring(x, y, r, z, P, 14), { tone: 'lo' }) + screws([[x, y, z]], 0.45);

// ---------------------------------------------------------------- halos (unrecorded, drawn first)
const halos = [
  `<path class="iso-halo" d="${k.haloOf(k.insetPlan(CH, -6), FOOT_Z, 8, P)}"/>`,
  `<path class="iso-halo" d="${k.haloOf(k.insetPlan(GP, -4), FOOT_Z, 6, P)}"/>`,
].join('');

// ================================================================ SPACE: the bench chassis
within('space', () => {
  const feet = [[CH.x + 10, CH.y + 10], [CH.x + CH.w - 10, CH.y + 10], [CH.x + 10, FRONT - 9], [CH.x + CH.w - 10, FRONT - 9]];
  for (const [x, y] of feet) {
    post(`stand.foot${x},${y}`, x, y, 5.6, FOOT_Z, CH_Z - FOOT_Z, { tone: 'mid' }, { ground: true, bevel: 0.6, extra: Ln(k.sideArc(x, y, 5.6, FOOT_Z + 3, P, 16), { tone: 'lo' }) });
  }
  const seam = Ln(k.sideSeam(CH, -6, P, 5), { tone: 'faint' });
  const groove = Ln(k.planOutline(k.insetPlan(CH, 4), 0, P, 5), { tone: 'lo' });
  const corners = k.corners(CH, 9).map(([x, y]) => ringScrew(x, y, 0)).join('');
  const tslots = [-10, 3].map((y) => k.planOutline({ x: CH.x + 12, y, w: CH.w - 24, d: 3, r: 1.5 }, 0, P, 4)).join('');
  const X1 = CH.x + CH.w;
  const grips = onFace(FRONT_AT(FRONT), Ln(flat(X1 - 52, 7.5, X1 - 14, 11.5, 2, 4), { tone: 'mid' }))
    + onFace(RIGHT_AT(X1), Ln(flat(-36, 7.5, 4, 11.5, 2, 4), { tone: 'mid' }));
  box('space.chassis', [CH.x, CH.y, CH_Z], [X1, CH.y + CH.d, 0], { tone: 'hi' }, { r: CH.r, steps: 5, bevel: 1.4, inner: seam, extra: groove + corners + Ln(tslots, { tone: 'lo' }) + grips });
  // ruler strip along the front edge of the top
  const strip = { x: -24, y: FRONT - 12, w: 84, d: 6 };
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 3, 5, strip.y, 0.6, [1.8, 3.2], P);
  box('space.ruler', [strip.x, strip.y, 0], [strip.x + strip.w, strip.y + strip.d, 0.6], { tone: 'mid', crease: 'none' }, { r: 0.6, extra: Ln(ticks.minor, { tone: 'lo' }) + Ln(ticks.major, { tone: 'mid' }) });
  // engraved label plate on the chassis front
  const lp = [-150, FRONT, -14];
  const rules = [24, 30, 18].map((w, i) => k.segment([lp[0] + 4, FRONT + 0.8, -6.5 - i * 2.6], [lp[0] + 4 + w, FRONT + 0.8, -6.5 - i * 2.6], P)).join('');
  box('space.label', [lp[0], FRONT, -15], [lp[0] + 40, FRONT + 0.8, -4], { tone: 'mid' }, { r: 0.4, extra: Ln(rules, { tone: 'mid', free: true }) + screws([[lp[0] + 36.5, FRONT + 0.8, -7], [lp[0] + 36.5, FRONT + 0.8, -12]], 0.45) });
});

// ================================================================ PANES: rack with terminal
const RACK = { x0: -156, x1: 8, y0: -60, y1: -14 };
within('panes', () => {
  box('panes.tray', [RACK.x0, RACK.y0, 0], [RACK.x1, RACK.y1, 4], { tone: 'mid' }, { r: 0.8, bevel: 0.5, extra: Ln(k.sideSeam({ x: RACK.x0, y: RACK.y0, w: RACK.x1 - RACK.x0, d: RACK.y1 - RACK.y0, r: 0.8 }, 2, P, 2), { tone: 'faint' }) });
  // back panel with rack rails: a row of closed slots and screws across its face
  const face = FRONT_AT(-56);
  const slots = Array.from({ length: 13 }, (_, i) => flat(RACK.x0 + 6 + i * 12, -62, RACK.x0 + 9 + i * 12, -60.6, 0.7, 3)).join('');
  box('panes.back', [RACK.x0, RACK.y0, 4], [RACK.x1, -56, 64], { tone: 'mid' }, { r: 0.6, bevel: 0.6, extra: onFace(face, Ln(slots, { tone: 'lo' })) + screws([[RACK.x0 + 3, -56, 61], [RACK.x1 - 3, -56, 61]]) });
  box('panes.cheek', [RACK.x0, -56, 4], [RACK.x0 + 3, RACK.y1, 52], { tone: 'mid' }, { r: 0.4 });
  // terminal module
  const T = { x0: -151, x1: -103, y0: -54, y1: -20, z0: 4, z1: 46 };
  const tFace = FRONT_AT(T.y1);
  const lines = [16, 24, 10, 20].map((w, i) => `M${T.x0 + 9} ${-(39 - i * 4.2)}h${w}`).join('');
  const screen = recess(tFace, { u0: T.x0 + 5, u1: T.x1 - 5, v0: -42, v1: -21, r: 2.4, depth: 2.6 }, `<path class="wc-screen-line" d="${lines}"/><rect class="wc-screen-block" x="${T.x0 + 31}" y="-28" width="2.6" height="3.2"/>`, 'wc-glass');
  const vents = Array.from({ length: 6 }, (_, i) => flat(T.x0 + 6 + i * 3.2, -16.5, T.x0 + 7.4 + i * 3.2, -10.6, 0.7, 3)).join('');
  const tVents = Array.from({ length: 7 }, (_, i) => flat(T.x0 + 8 + i * 4.6, T.y0 + 8, T.x0 + 9.6 + i * 4.6, T.y1 - 10, 0.8, 3)).join('');
  box('panes.terminal', [T.x0, T.y0, T.z0], [T.x1, T.y1, T.z1], { tone: 'hi' }, { r: 1.5, steps: 3, bevel: 0.8, extra: onFace(TOP_AT(T.z1), Ln(tVents, { tone: 'lo' })) + screen + onFace(tFace, Ln(vents, { tone: 'lo' })) + Dots([at([T.x1 - 7, T.y1, 12])], { size: 0.9, tone: 'hi' }) });
  // keyboard ledge with a row of keys
  box('panes.ledge', [T.x0 + 2, T.y1, 4], [T.x1 - 2, -12, 9], { tone: 'mid' }, { r: 0.8, bevel: 0.4 });
  for (let i = 0; i < 6; i += 1) {
    const x = T.x0 + 5 + i * 6.6;
    box(`panes.key${i}`, [x, T.y1 + 1.4, 9], [x + 5.4, -13.6, 11], { tone: 'mid', crease: 'faint' }, { r: 0.8 });
  }
  box('panes.divider', [-100, -56, 4], [-97, RACK.y1, 52], { tone: 'mid' }, { r: 0.4, extra: screws([[-98.5, RACK.y1, 48], [-98.5, RACK.y1, 8]], 0.4) });
});

// ================================================================ CONVERSATION: the console
const C = { x0: -94, x1: 2, y0: -54, y1: -16, z0: 4, z1: 54 };
within('conversation', () => {
  const top = TOP_AT(C.z1);
  const tape = [30, 22, 34, 16, 26].map((w, i) => `M${C.x0 + 12} ${C.y0 + 11 + i * 3.4}h${w}`).join('');
  const topVents = Array.from({ length: 6 }, (_, i) => flat(C.x0 + 64 + i * 4, C.y0 + 8, C.x0 + 65.6 + i * 4, C.y1 - 8, 0.8, 3)).join('');
  const readout = recess(top, { u0: C.x0 + 8, u1: C.x0 + 56, v0: C.y0 + 7, v1: C.y1 - 7, r: 1.6, depth: 2.2 }, Ln(tape, { tone: 'mid', free: true }), 'wc-tape');
  const cFace = FRONT_AT(C.y1);
  const slot = recess(cFace, { u0: -70, u1: -36, v0: -21, v1: -18, r: 1, depth: 3 }, '', 'wc-dark');
  const vents = Array.from({ length: 8 }, (_, i) => flat(C.x0 + 6 + i * 3.2, -48, C.x0 + 7.4 + i * 3.2, -34, 0.7, 3)).join('');
  const panel = flat(-30, -48, -6, -28, 1.4);
  const panelScrews = screws([[-28, C.y1, 46], [-8, C.y1, 46], [-28, C.y1, 30], [-8, C.y1, 30]], 0.4);
  const seam = Ln(k.sideSeam({ x: C.x0, y: C.y0, w: C.x1 - C.x0, d: C.y1 - C.y0, r: 1.5 }, 10, P, 3), { tone: 'faint' });
  box('conversation.console', [C.x0, C.y0, C.z0], [C.x1, C.y1, C.z1], { tone: 'hi' }, { r: 1.5, steps: 3, bevel: 1, inner: seam, extra: readout + onFace(top, Ln(topVents, { tone: 'lo' })) + slot + onFace(cFace, Ln(vents, { tone: 'lo' }) + Ln(panel, { tone: 'lo' })) + panelScrews + screws([[C.x0 + 4, C.y1, C.z1 - 4], [C.x1 - 4, C.y1, C.z1 - 4]], 0.45) });
  // paper roll feeding the readout, in two brackets on the top
  box('conversation.bracketL', [C.x0 + 8, -53, C.z1], [C.x0 + 11, -47, C.z1 + 8], { tone: 'mid' }, { r: 0.5 });
  box('conversation.bracketR', [C.x0 + 53, -53, C.z1], [C.x0 + 56, -47, C.z1 + 8], { tone: 'mid' }, { r: 0.5 });
  const RF = G.frameAlong([C.x0 + 11, -50, C.z1 + 4.6], [1, 0, 0]);
  discOn('conversation.roll', RF, 0, 42, 4.2, { tone: 'hi' }, { inner: Ln(G.arcOf(RF, 6, 4.2, P) + G.arcOf(RF, 36, 4.2, P), { tone: 'faint' }) });
  // knobs on the front
  [[-18, 22], [-8, 22]].forEach(([x, z], i) => {
    const F = G.frameAlong([x, C.y1, z], [0, 1, 0]);
    discOn(`conversation.knob${i}`, F, 0, 3, 3.2, { tone: 'mid' }, { extra: Ln(path3([[x, C.y1 + 3, z + 0.6], [x, C.y1 + 3, z + 2.6]]), { tone: 'hi' }) });
  });
  // three jacks on the right face for the sub-agents
  [-51, -36, -21].forEach((y, i) => {
    discOn(`conversation.jack${i}`, G.frameAlong([C.x1, y, 36], [1, 0, 0]), 0, 2, 2.6, { tone: 'mid' });
  });
});

// ================================================================ AGENTS: satellites docked by cables
within('agents', () => {
  [-51, -36, -21].forEach((yc, i) => {
    const s = { x0: 14, x1: 30, y0: yc - 5, y1: yc + 5, z1: 13 };
    const grille = Array.from({ length: 3 }, (_, j) => flat(s.y0 + 2.4 + j * 2, -9, s.y0 + 3.4 + j * 2, -4, 0.5, 3)).join('');
    box(`agents.base${i}`, [s.x0 - 1, s.y0 - 1, 0], [s.x1 + 1, s.y1 + 1, 1.6], { tone: 'mid' }, { r: 0.6 });
    box(`agents.sat${i}`, [s.x0, s.y0, 1.6], [s.x1, s.y1, s.z1], { tone: 'hi' }, { r: 1, steps: 3, bevel: 0.6, extra: onFace(planeOf([s.x1, 0, 0], [0, 1, 0], [0, 0, -1], [1, 0, 0]), Ln(grille, { tone: 'lo' })) + Dots([at([s.x1, s.y1 - 2, 10])], { size: 0.75, tone: 'hi' }) });
    post(`agents.port${i}`, 22, yc, 2.2, s.z1, 1.2, { tone: 'mid' });
    cable(`agents.cable${i}`, [[22, yc, s.z1 + 1.2], [22, yc, 36], [C.x1 + 2, yc, 36]], 0.75, { bend: 5 });
  });
});

// ================================================================ COMMANDS: motor and flywheel
const MOTOR = { x0: 38, y: -36, z: 21, r: 11 };
const FLY = { x: 76, t: 4.5, r: 17 };
within('commands', () => {
  const X = MOTOR.x0;
  box('commands.plinth', [X - 4, -50, 0], [X + 34, -22, 2], { tone: 'mid' }, { r: 0.8, extra: [[X - 1, -47], [X + 31, -47], [X - 1, -25], [X + 31, -25]].map(([x, y]) => screws([[x, y, 2]], 0.45)).join('') });
  box('commands.cradleA', [X + 4, -44, 2], [X + 10, -28, MOTOR.z - MOTOR.r], { tone: 'mid' }, { r: 0.5 });
  box('commands.cradleB', [X + 20, -44, 2], [X + 26, -28, MOTOR.z - MOTOR.r], { tone: 'mid' }, { r: 0.5 });
  const F = G.frameAlong([MOTOR.x0, MOTOR.y, MOTOR.z], [1, 0, 0]);
  const ribs = [8, 11, 14, 17, 20].map((s) => G.arcOf(F, s, MOTOR.r, P)).join('');
  turned('commands.motor', F, [[0, 8.6], [1.6, MOTOR.r], [26, MOTOR.r], [28, 9.4]], { tone: 'hi' }, { inner: Ln(ribs, { tone: 'faint' }) });
  box('commands.terminal', [X + 10, -41, MOTOR.z + MOTOR.r], [X + 18, -31, MOTOR.z + MOTOR.r + 6], { tone: 'mid' }, { r: 0.6, extra: screws([[X + 12, -36, MOTOR.z + MOTOR.r + 6], [X + 16, -36, MOTOR.z + MOTOR.r + 6]], 0.4) });
  discOn('commands.shaft', F, 28, FLY.x - MOTOR.x0, 2.2, { tone: 'mid' });
  // flywheel; its face carries the turning group
  const FF = G.frameAlong([FLY.x, MOTOR.y, MOTOR.z], [1, 0, 0]);
  const face = RIGHT_AT(FLY.x + FLY.t);
  const u0 = -MOTOR.y;
  const v0 = -MOTOR.z;
  const holes = [0, 1, 2, 3].map((i) => {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    return `<circle class="wc-hole" cx="${f2(Math.cos(a) * 9)}" cy="${f2(Math.sin(a) * 9)}" r="3.4"/>`;
  }).join('');
  const rings = `<path class="iso-line" data-tone="mid" d="${k.pathOf(k.circleRing(0, 0, 13.4, 72), true)}"/><path class="iso-line" data-tone="lo" d="${k.pathOf(k.circleRing(0, 0, 5, 40), true)}"/>`;
  const mark = `<path class="iso-line" data-tone="hi" d="M0 -13.4V${-FLY.r + 0.2}"/>`;
  const spin = `<g transform="${matrixOf(face)}"><g transform="translate(${f2(u0)} ${f2(v0)})"><g id="wc-flywheel" class="wc-spin" data-spin="flywheel">${rings}${holes}${mark}</g></g></g>`;
  turned('commands.flywheel', FF, [[0, FLY.r - 1], [0.6, FLY.r], [FLY.t - 0.6, FLY.r], [FLY.t, FLY.r - 1]], { tone: 'hi' }, { extra: spin });
  discOn('commands.hub', FF, FLY.t, FLY.t + 2.4, 3.6, { tone: 'mid' }, { extra: Dots([at([FLY.x + FLY.t + 2.4, MOTOR.y, MOTOR.z])], { size: 0.6, tone: 'hi' }) });
});

// ================================================================ BROWSER: the outward CRT on a swivel post
const B = { x0: 104, x1: 138, y0: -50, y1: -14, z0: 42, z1: 76 };
const BX = (B.x0 + B.x1) / 2;
within('browser', () => {
  post('browser.foot', BX, -31, 10, 0, 2, { tone: 'mid' }, { bevel: 0.4 });
  post('browser.post', BX, -31, 3, 2, B.z0 - 8, { tone: 'mid' });
  box('browser.yoke', [BX - 8, -37, B.z0 - 4], [BX + 8, -25, B.z0], { tone: 'mid' }, { r: 0.6, extra: screws([[BX + 4, -25, B.z0 - 2], [BX - 4, -25, B.z0 - 2]], 0.4) });
  post('browser.collar', BX, -31, 4.4, B.z0 - 6, 2, { tone: 'mid' });
  const face = RIGHT_AT(B.x1);
  const um = (y) => -y;
  const g0 = 18;
  const gt = -(B.z1 - 4);
  const page = [
    `<rect class="wc-screen-dim" x="${g0}" y="${gt}" width="28" height="4"/>`,
    `<rect class="wc-screen-block" x="${g0 + 3}" y="${gt + 0.9}" width="8" height="2.2" rx=".6"/>`,
    `<rect class="wc-screen-line" x="${g0 + 3}" y="${gt + 5.6}" width="22" height="2.4" rx="1.2"/>`,
    `<rect class="wc-screen-block" x="${g0 + 3}" y="${gt + 10}" width="10" height="8"/>`,
    `<path class="wc-screen-line" d="M${g0 + 15} ${gt + 11}h9M${g0 + 15} ${gt + 14}h7M${g0 + 15} ${gt + 17}h9M${g0 + 3} ${gt + 20.4}h21"/>`,
  ].join('');
  const inner = recess(face, { u0: g0, u1: g0 + 28, v0: gt, v1: -(B.z0 + 9), r: 3, depth: 3 }, page, 'wc-glass');
  const bezel = recess(face, { u0: g0 - 2.6, u1: g0 + 30.6, v0: gt - 2.4, v1: -(B.z0 + 6.4), r: 4, depth: 1.4 }, '', 'wc-well', inner);
  const side = FRONT_AT(B.y1);
  const vents = Array.from({ length: 7 }, (_, i) => flat(B.x0 + 6 + i * 3.2, -(B.z1 - 8), B.x0 + 7.4 + i * 3.2, -(B.z1 - 22), 0.7, 3)).join('');
  const badge = flat(B.x1 - 14, -(B.z0 + 9), B.x1 - 5, -(B.z0 + 5), 0.8);
  const seam = Ln(k.sideSeam({ x: B.x0, y: B.y0, w: B.x1 - B.x0, d: B.y1 - B.y0, r: 2.5 }, B.z0 + 3, P, 4), { tone: 'faint' });
  box('browser.crt', [B.x0, B.y0, B.z0], [B.x1, B.y1, B.z1], { tone: 'hi' }, { r: 2.5, steps: 4, bevel: 1, inner: seam, extra: bezel + onFace(side, Ln(vents, { tone: 'lo' }) + Ln(badge, { tone: 'lo' })) });
  // hood over the screen and two knobs under it
  box('browser.hood', [B.x1, B.y0 + 2, B.z1 - 2.5], [B.x1 + 3.5, B.y1 - 2, B.z1], { tone: 'mid' }, { r: 0.5 });
  [-16, -22].forEach((y, i) => discOn(`browser.knob${i}`, G.frameAlong([B.x1, y, B.z0 + 3.4], [1, 0, 0]), 0, 1.6, 1.1, { tone: 'mid' }));
});

// ================================================================ ARTIFACTS: chute, tray and registered sheets
const TRAY = { x0: -76, x1: -32, y0: 12, y1: 50 };
const SHEET = { x0: -68, x1: -40, y0: 18, y1: 44 };
const CHUTE_Z = 17;
let sheetSvg = '';
within('artifacts', () => {
  box('artifacts.chute', [-72, C.y1, CHUTE_Z - 0.8], [-36, 10, CHUTE_Z], { tone: 'mid' }, { r: 0.4 });
  box('artifacts.railL', [-74, C.y1, CHUTE_Z - 0.8], [-72, 10, CHUTE_Z + 2.2], { tone: 'mid' }, { r: 0.4 });
  box('artifacts.railR', [-36, C.y1, CHUTE_Z - 0.8], [-34, 10, CHUTE_Z + 2.2], { tone: 'mid' }, { r: 0.4 });
  box('artifacts.legL', [-72, 5, 0], [-69, 8, CHUTE_Z - 0.8], { tone: 'mid' }, { r: 0.4 });
  box('artifacts.legR', [-39, 5, 0], [-36, 8, CHUTE_Z - 0.8], { tone: 'mid' }, { r: 0.4 });
  const T = TRAY;
  box('artifacts.floor', [T.x0, T.y0, 0], [T.x1, T.y1, 1.4], { tone: 'mid' }, { r: 1 });
  box('artifacts.wallBack', [T.x0, T.y0, 1.4], [T.x1, T.y0 + 1.4, 8], { tone: 'mid' }, { r: 0.3 });
  box('artifacts.wallLeft', [T.x0, T.y0 + 1.4, 1.4], [T.x0 + 1.4, T.y1 - 1.4, 8], { tone: 'mid' }, { r: 0.3 });
  for (let i = 0; i < 5; i += 1) {
    const dx = [0.4, -0.3, 0.6, -0.2, 0.1][i];
    const dy = [0.3, 0.6, -0.2, 0.4, 0][i];
    box(`artifacts.sheet${i}`, [SHEET.x0 + dx, SHEET.y0 + dy, 1.4 + i * 0.75], [SHEET.x1 + dx, SHEET.y1 + dy, 2.15 + i * 0.75], { tone: 'hi', crease: 'none' }, { r: 0.3 });
  }
  // the moving sheet, built at rest on top of the stack; the motion module translates it
  const z0 = 1.4 + 5 * 0.75;
  const plan = { x: SHEET.x0, y: SHEET.y0, w: SHEET.x1 - SHEET.x0, d: SHEET.y1 - SHEET.y0, r: 0.3 };
  const lines = [16, 22, 12].map((w, i) => k.lineOnTop([SHEET.x0 + 4, SHEET.y0 + 5 + i * 3], [SHEET.x0 + 4 + w, SHEET.y0 + 5 + i * 3], z0 + 0.5, P)).join('');
  sheetSvg = S(k.slabOf(plan, z0, 0.5, P, 2), { tone: 'hi', crease: 'none' }) + Ln(lines, { tone: 'lo', free: true });
  const shape = record(A.slab(plan, z0, 0.5, { name: 'artifacts.sheet' }, 2));
  put('artifacts.sheet', [(SHEET.x0 + SHEET.x1) / 2, (SHEET.y0 + SHEET.y1) / 2, z0 + 0.25], '@SHEET@', [shape], {});
  box('artifacts.wallFront', [T.x0, T.y1 - 1.4, 1.4], [T.x1, T.y1, 8], { tone: 'mid' }, { r: 0.3 });
  box('artifacts.wallRight', [T.x1 - 1.4, T.y0 + 1.4, 1.4], [T.x1, T.y1 - 1.4, 8], { tone: 'mid' }, { r: 0.3 });
});

// ================================================================ INBOX: mailbox with a signal flag
const MB = { x0: 72, x1: 98, y0: 20, y1: 42, z1: 21 };
const PIVOT = { y: 35, z: 14 };
let flagSvg = '';
within('inbox', () => {
  box('inbox.base', [MB.x0 - 2, MB.y0 - 2, 0], [MB.x1 + 2, MB.y1 + 2, 2], { tone: 'mid' }, { r: 0.8, extra: screws([[MB.x0, MB.y1 + 1, 2], [MB.x1, MB.y1 + 1, 2]], 0.4) });
  const door = flat(MB.x0 + 3, -(MB.z1 - 3), MB.x1 - 3, -5, 1.4);
  const seam = Ln(k.sideSeam({ x: MB.x0, y: MB.y0, w: MB.x1 - MB.x0, d: MB.y1 - MB.y0, r: 1.2 }, MB.z1 - 3, P, 3), { tone: 'faint' });
  box('inbox.box', [MB.x0, MB.y0, 2], [MB.x1, MB.y1, MB.z1], { tone: 'hi' }, { r: 1.2, steps: 3, bevel: 0.6, inner: seam, extra: onFace(FRONT_AT(MB.y1), Ln(door, { tone: 'lo' })) });
  box('inbox.pull', [MB.x0 + 11, MB.y1, 12], [MB.x0 + 15, MB.y1 + 1.6, 13.6], { tone: 'mid' }, { r: 0.4 });
  discOn('inbox.pin', G.frameAlong([MB.x1, PIVOT.y, PIVOT.z], [1, 0, 0]), 0, 1.4, 1.4, { tone: 'mid' });
  // the flag lies in the plane x = MB.x1 + 1.4; local u = -y, v = -z; at rest it points back, level
  const face = RIGHT_AT(MB.x1 + 1.4);
  const pu = -PIVOT.y;
  const pv = -PIVOT.z;
  const arm = `<path class="wc-flag-arm" d="M-1.2 -1.2H12V1.2H-1.2Z"/>`;
  const plate = `<path class="wc-flag-face" d="M10.5 -1.2H17.5V4.6H10.5Z"/>`;
  const hub = `<circle class="wc-flag-arm" r="1.6"/>`;
  flagSvg = `<g transform="${matrixOf(face)}"><g transform="translate(${f2(pu)} ${f2(pv)})"><g id="wc-flag" data-rest="0" data-raised="-90">${arm}${plate}${hub}</g></g></g>`;
  const corners = [[pu - 1.6, pv - 1.6], [pu + 17.5, pv - 1.6], [pu + 17.5, pv + 4.6], [pu - 1.6, pv + 4.6]].map(([u, v]) => at(onPlane(face, u, v)));
  const shape = record(A.box([MB.x1 + 1.4, PIVOT.y - 17.5, PIVOT.z - 4.6], [MB.x1 + 1.9, PIVOT.y + 1.6, PIVOT.z + 1.6], { name: 'inbox.flag' }));
  put('inbox.flag', [MB.x1 + 1.6, PIVOT.y - 8, PIVOT.z], '@FLAG@', [shape], { sil: [corners] });
});

// ================================================================ VAULT: locked drawer with a combination dial
within('vault', () => {
  const D = { x0: -6, x1: 64, z0: -15, z1: -3 };
  const pointer = path3([[48 - 1, FRONT + 2, -9 + 5.6], [48 + 1, FRONT + 2, -9 + 5.6], [48, FRONT + 2, -9 + 4.6]], true);
  box('vault.drawer', [D.x0, FRONT, D.z0], [D.x1, FRONT + 2, D.z1], { tone: 'hi' }, { r: 0.6, bevel: 0.5, extra: Ln(pointer, { tone: 'hi' }) + screws([[D.x0 + 2.4, FRONT + 2, D.z1 - 2], [D.x0 + 2.4, FRONT + 2, D.z0 + 2], [D.x1 - 2.4, FRONT + 2, D.z1 - 2], [D.x1 - 2.4, FRONT + 2, D.z0 + 2]], 0.4) });
  const cx = 48;
  const cz = -9;
  const DF = G.frameAlong([cx, FRONT + 2, cz], [0, 1, 0]);
  discOn('vault.collar', DF, 0, 0.8, 4.8, { tone: 'mid' });
  const face = FRONT_AT(FRONT + 2.8 + 2.2);
  const ticks = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    const r0 = i % 5 === 0 ? 2.4 : 2.9;
    return `M${f2(Math.cos(a) * r0)} ${f2(Math.sin(a) * r0)}L${f2(Math.cos(a) * 3.5)} ${f2(Math.sin(a) * 3.5)}`;
  }).join('');
  const dialFace = `<g transform="${matrixOf(face)}"><g transform="translate(${cx} ${-cz})"><path class="iso-line" data-tone="mid" d="${k.pathOf(k.circleRing(0, 0, 3.5, 40), true)}"/><path class="iso-line" data-tone="mid" d="${ticks}"/><path class="iso-line" data-tone="lo" d="${k.pathOf(k.circleRing(0, 0, 1.2, 20), true)}"/></g></g>`;
  const knurl = G.ribsOf(DF, 0.8, 3, 4, 28, P, { fade: [0.1, 0.55], seams: true });
  turned('vault.dial', DF, [[0.8, 4], [3, 4]], { tone: 'hi' }, { inner: k.fadedSvg(knurl, { tone: 'lo' }), extra: dialFace });
  // pull handle: two standoffs and a bar
  box('vault.standL', [12, FRONT + 2, -10], [14, FRONT + 4.5, -8], { tone: 'mid' }, { r: 0.3 });
  box('vault.standR', [28, FRONT + 2, -10], [30, FRONT + 4.5, -8], { tone: 'mid' }, { r: 0.3 });
  box('vault.bar', [11, FRONT + 4.5, -10.4], [31, FRONT + 6, -7.6], { tone: 'mid' }, { r: 0.6 });
});

// ================================================================ WORKTREE: cartridge and tether
const CART = { x0: -148, x1: -122, y0: 18, y1: 40, z0: 3, z1: 17 };
within('worktree', () => {
  box('worktree.dock', [CART.x0 - 4, CART.y0 - 4, 0], [CART.x1 + 4, CART.y1 + 4, CART.z0], { tone: 'mid' }, { r: 0.8, bevel: 0.4, extra: screws([[CART.x0 - 2, CART.y0 - 2, 3], [CART.x1 + 2, CART.y0 - 2, 3], [CART.x0 - 2, CART.y1 + 2, 3], [CART.x1 + 2, CART.y1 + 2, 3]], 0.4) });
  const grip = Array.from({ length: 4 }, (_, i) => k.planOutline({ x: CART.x0 + 4, y: CART.y0 + 3 + i * 2.4, w: 18, d: 1, r: 0.5 }, CART.z1, P, 3)).join('');
  const label = k.planOutline({ x: CART.x0 + 4, y: CART.y0 + 13, w: 18, d: 6, r: 0.8 }, CART.z1, P, 3);
  box('worktree.cartridge', [CART.x0, CART.y0, CART.z0], [CART.x1, CART.y1, CART.z1], { tone: 'hi', className: 'wc-blue' }, { r: 1.4, steps: 3, bevel: 0.8, extra: Ln(grip, { tone: 'mid' }) + Ln(label, { tone: 'mid' }) });
  discOn('worktree.boss', G.frameAlong([-135, CART.y1, 10], [0, 1, 0]), 0, 2, 3.2, { tone: 'hi', className: 'wc-blue' });
  cable('worktree.tether', [[-135, CART.y1 + 2, 10], [-135, 90, 10], [-135, 90, GP_Z1 + 4]], 1.3, { bend: 9, cls: 'wc-blue' });
});

// ================================================================ GIT: granite surface plate on its own feet
within('git', () => {
  const feet = [[GP.x + 10, GP.y + 10], [GP.x + GP.w - 10, GP.y + 10], [GP.x + GP.w / 2, GP.y + GP.d - 8]];
  for (const [x, y] of feet) post(`stand.git${x}`, x, y, 4.6, FOOT_Z, GP_Z0 - FOOT_Z, { tone: 'mid', className: 'wc-granite' }, { ground: true });
  const grid = [];
  for (let x = GP.x + 12; x < GP.x + GP.w - 4; x += 12) grid.push(k.lineOnTop([x, GP.y], [x, GP.y + GP.d], GP_Z1, P));
  for (let y = GP.y + 12; y < GP.y + GP.d - 4; y += 12) grid.push(k.lineOnTop([GP.x, y], [GP.x + GP.w, y], GP_Z1, P));
  const gseam = Ln(k.sideSeam(GP, GP_Z0 + 3, P, 3), { tone: 'faint' });
  box('git.plate', [GP.x, GP.y, GP_Z0], [GP.x + GP.w, GP.y + GP.d, GP_Z1], { tone: 'hi', className: 'wc-granite' }, { r: GP.r, steps: 3, bevel: 1, inner: gseam, extra: `<g class="wc-granite">${Ln(grid.join(''), { tone: 'faint' })}</g>` });
  // grade plate on the front face
  const gy = GP.y + GP.d;
  const rules = [16, 22, 12].map((w, i) => k.segment([-190, gy + 0.6, -12 - i * 2.2], [-190 + w, gy + 0.6, -12 - i * 2.2], P)).join('');
  box('git.grade', [-194, gy, -19.5], [-162, gy + 0.6, -10], { tone: 'mid' }, { r: 0.3, extra: Ln(rules, { tone: 'mid', free: true }) + screws([[-165, gy + 0.6, -12.5], [-165, gy + 0.6, -17]], 0.4) });
  // binding post the tether lands on
  post('git.collar', -135, 90, 4.4, GP_Z1, 1.4, { tone: 'mid' });
  post('git.post', -135, 90, 2.6, GP_Z1 + 1.4, 2.6, { tone: 'hi' }, { extra: '' });
});

// ---------------------------------------------------------------- order: settle, then keep each part contiguous
A.settle(R, P);
const items = R.items;
if (process.env.WC_PAIRS) R.settled.overlaps.pairs.filter((p) => [p.a, p.b].some((i) => R.settled.items[i].name === process.env.WC_PAIRS)).forEach((p) => console.log(R.settled.items[p.a].name, R.settled.items[p.b].name, p.front[0].area.toFixed(2), p.front[1].area.toFixed(2)));
const parts = [...new Set(items.map((item) => item.part))];
const rank = new Map(parts.map((p) => [p, 0]));
{
  const edges = new Map(parts.map((p) => [p, new Set()]));
  const indeg = new Map(parts.map((p) => [p, 0]));
  const { pairs, least } = R.settled.overlaps;
  const settledItems = R.settled.items;
  for (const pair of pairs) {
    const a = settledItems[pair.a];
    const b = settledItems[pair.b];
    if (a.part === b.part) continue;
    const aFront = pair.front[0].area >= least;
    const bFront = pair.front[1].area >= least;
    if (aFront && !bFront && !edges.get(b.part).has(a.part)) { edges.get(b.part).add(a.part); indeg.set(a.part, indeg.get(a.part) + 1); }
    if (bFront && !aFront && !edges.get(a.part).has(b.part)) { edges.get(a.part).add(b.part); indeg.set(b.part, indeg.get(b.part) + 1); }
  }
  const meanKey = (p) => {
    const keys = items.filter((item) => item.part === p).map((item) => item.key);
    return keys.reduce((s, x) => s + x, 0) / keys.length;
  };
  const order = [];
  const ready = parts.filter((p) => indeg.get(p) === 0);
  while (ready.length) {
    ready.sort((x, y) => meanKey(x) - meanKey(y));
    const next = ready.shift();
    order.push(next);
    for (const to of edges.get(next)) {
      indeg.set(to, indeg.get(to) - 1);
      if (indeg.get(to) === 0) ready.push(to);
    }
  }
  if (order.length !== parts.length) {
    const stuck = parts.filter((p) => !order.includes(p));
    console.error('part order has a cycle among', stuck.join(', '), [...edges].filter(([p]) => stuck.includes(p)).map(([p, s]) => `${p}<${[...s].join('|')}`).join(' '));
    stuck.forEach((p) => order.push(p));
  }
  order.forEach((p, i) => rank.set(p, i));
}
// within a part: topological order from the measured pairs plus the moving sheet's path
// (it slides on the chute between the rails: after the chute and far rail, before the near rail), ties by settled key
const AFTER = [['artifacts.chute', 'artifacts.sheet'], ['artifacts.railL', 'artifacts.sheet'], ['artifacts.sheet', 'artifacts.railR']];
{
  const settledItems = R.settled.items;
  const { pairs, least } = R.settled.overlaps;
  const next = new Map(items.map((item) => [item, new Set()]));
  const link = (back, front) => { if (back && front && back !== front && back.part === front.part) next.get(back).add(front); };
  pairs.forEach((pair) => {
    const a = settledItems[pair.a];
    const b = settledItems[pair.b];
    if (pair.front[0].area >= least && pair.front[1].area < least) link(b, a);
    if (pair.front[1].area >= least && pair.front[0].area < least) link(a, b);
  });
  const byName = new Map(items.map((item) => [item.name, item]));
  AFTER.forEach(([back, front]) => link(byName.get(back), byName.get(front)));
  const ordered = [];
  parts.slice().sort((x, y) => rank.get(x) - rank.get(y)).forEach((p) => {
    const group = items.filter((item) => item.part === p);
    const indeg = new Map(group.map((item) => [item, 0]));
    group.forEach((item) => next.get(item).forEach((to) => indeg.set(to, indeg.get(to) + 1)));
    const ready = group.filter((item) => indeg.get(item) === 0);
    const out = [];
    while (ready.length) {
      ready.sort((x, y) => x.key - y.key);
      const item = ready.shift();
      out.push(item);
      next.get(item).forEach((to) => {
        indeg.set(to, indeg.get(to) - 1);
        if (indeg.get(to) === 0) ready.push(to);
      });
    }
    if (out.length !== group.length) throw new Error(`cycle inside part ${p}`);
    ordered.push(...out);
  });
  items.splice(0, items.length, ...ordered);
}
items.forEach((item, index) => { item.key = index * 0.01; });
if (process.env.WC_ORDER) console.log(items.filter((i) => i.part === process.env.WC_ORDER).map((i) => i.name).join(" < "));

// ---------------------------------------------------------------- assemble the SVG
const sheetClip = (() => {
  // clip the sliding sheet to the half-space in front of the console face (y > C.y1) at chute height
  const a = at([-400, C.y1, CHUTE_Z + 0.6]);
  const b = at([400, C.y1, CHUTE_Z + 0.6]);
  const dir = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(...dir);
  let n = [-dir[1] / len, dir[0] / len];
  const probe = at([0, C.y1 + 10, CHUTE_Z + 0.6]);
  if ((probe[0] - a[0]) * n[0] + (probe[1] - a[1]) * n[1] < 0) n = [-n[0], -n[1]];
  const far = 2000;
  const pts = [a, b, [b[0] + n[0] * far, b[1] + n[1] * far], [a[0] + n[0] * far, a[1] + n[1] * far]];
  return `<clipPath id="wc-sheet-clip"><path d="${k.pathOf(pts, true)}"/></clipPath>`;
})();
const screenOf = (v) => {
  const o = at([0, 0, 0]);
  const p = at(v);
  return [p[0] - o[0], p[1] - o[1]];
};
const sheetPath = [
  [0, -SHEET.y0 + C.y1 - 3, CHUTE_Z - 1.4 - 5 * 0.75],
  [0, -SHEET.y0 + C.y1, CHUTE_Z - 1.4 - 5 * 0.75],
  [0, -5, CHUTE_Z - 1.4 - 5 * 0.75],
  [0, 0, 0],
].map((v) => screenOf(v).map(f2).join(',')).join(' ');
const sheetGroup = `<g clip-path="url(#wc-sheet-clip)"><g id="wc-sheet" data-path="${sheetPath}">${sheetSvg}</g></g>`;

const groups = [];
const outlines = {};
let current = null;
let buffer = [];
const flush = () => {
  if (!current) return;
  const polys = buffer.flatMap((item) => (item.sil ? item.sil : fillsOf(item.svg)));
  outlines[current] = silhouette(polys);
  groups.push(`<g data-part="${current}">${buffer.map((item) => item.svg).join('')}<path class="part-outline" d="${outlines[current]}"/></g>`);
};
for (const item of items) {
  if (item.part !== current) {
    flush();
    current = item.part;
    buffer = [];
  }
  const svg = item.svg === '@SHEET@' ? sheetGroup : item.svg === '@FLAG@' ? flagSvg : item.svg;
  buffer.push({ ...item, svg, sil: item.sil ?? (item.svg === '@SHEET@' ? fillsOf(sheetSvg) : undefined) });
}
flush();

const seen = groups.map((g) => g.match(/data-part="([^"]+)"/)[1]);
const dup = seen.filter((p, i) => seen.indexOf(p) !== i);
if (dup.length) throw new Error(`part groups not contiguous: ${dup.join(', ')}`);
const missing = PARTS.filter((p) => !seen.includes(p));
if (missing.length) throw new Error(`missing parts: ${missing.join(', ')}`);

// a tight viewBox round everything drawn (the halo needs a margin)
const allPolys = Object.values(outlines).flatMap((d) => polygonsOf(d.replace(/Z/g, 'Z ')));
const VX0 = Math.floor(Math.min(...allPolys.flat().map((p) => p[0])) - 8);
const VY0 = Math.floor(Math.min(...allPolys.flat().map((p) => p[1])) - 6);
const VX1 = Math.ceil(Math.max(...allPolys.flat().map((p) => p[0])) + 8);
const VY1 = Math.ceil(Math.max(...allPolys.flat().map((p) => p[1])) + 14);
const defs = `<defs><filter id="wc-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>${sheetClip}</defs>`;
const rawSvg = [
  `<svg xmlns="http://www.w3.org/2000/svg" class="wc-fig" viewBox="${VX0} ${VY0} ${VX1 - VX0} ${VY1 - VY0}" role="img" aria-labelledby="wc-title wc-desc">`,
  `<title id="wc-title">${TITLE}</title><desc id="wc-desc">${DESC}</desc>`,
  `<style>${FIGURE_CSS}</style>`,
  defs,
  `<g class="wc-halos">${halos}</g>`,
  ...groups,
  '</svg>',
].join('');

const svg = compact(rawSvg);
if (process.env.WC_SIZES) console.log(items.map((i) => [i.name, compact(i.svg === "@SHEET@" ? sheetSvg : i.svg === "@FLAG@" ? flagSvg : i.svg).length]).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([n, l]) => `${n} ${(l / 1024).toFixed(1)}`).join("\n"));
// the file must stand alone as XML: every attribute has a value, every tag closes
const bare = svg.match(/<[a-zA-Z][^>]*>/g).find((tag) => /\s[\w:-]+(?=[\s/>])/.test(tag.replace(/"[^"]*"/g, '""')));
if (bare) throw new Error(`attribute without a value: ${bare.slice(0, 80)}`);
const opened = svg.match(/<[a-zA-Z][^>]*>/g).filter((tag) => !tag.endsWith('/>')).length;
const closed = (svg.match(/<\/[a-zA-Z]+>/g) ?? []).length;
if (opened !== closed) throw new Error(`unbalanced tags: ${opened} opened, ${closed} closed`);
const outSvg = join(REPO, 'blocks/attached-workcell/workcell-figure.svg');
writeFileSync(outSvg, `${svg}\n`);

// ---------------------------------------------------------------- preview page for the checks (not committed)
const previewDir = resolve(process.env.WORKCELL_PREVIEW_DIR || join(tmpdir(), 'workcell-figure'));
mkdirSync(previewDir, { recursive: true });
const motion = readFileSync(join(REPO, 'blocks/attached-workcell/workcell-motion.js'), 'utf8').replace('export default function animate', 'function animate');
const active = process.argv.find((a) => a.startsWith('--active='))?.slice(9) ?? '';
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Attached Workcell</title><style>
body{margin:0;background:#e8ff38;font:14px/1.5 system-ui}
.iso-plate{width:min(1100px,100% - 24px);margin:40px auto;--hl:#8dbdff}
.iso-plate svg{display:block;width:100%;height:auto;overflow:visible}
.wc-fig[data-active] .part-outline{transition:stroke .3s}
${PARTS.map((p) => `.wc-fig[data-active="${p}"] [data-part="${p}"] .part-outline{stroke:#11130f;stroke-width:2.2px}`).join('\n')}
</style></head><body><div class="iso-plate">${svg.replace('<svg ', `<svg ${active ? `data-active="${active}" ` : ''}`)}</div><div style="height:2400px" aria-hidden="true"></div>
<script type="module">${motion}
const ctl = new AbortController(); window.__wc = ctl; animate(document.querySelector('.iso-plate svg'), { signal: ctl.signal });</script></body></html>`;
writeFileSync(join(previewDir, 'workcell.html'), page);

const solids = R.solids.filter((s) => s.kind !== 'tube').length;
console.log(`wrote ${outSvg}`);
console.log(`preview ${join(previewDir, 'workcell.html')}`);
console.log(`${(svg.length / 1024).toFixed(1)} KB raw · ${items.length} items · ${solids} solids · ${CABLES.length} cables · parts ${seen.join(' > ')}`);
A.auditOrExit(R, P, {});
