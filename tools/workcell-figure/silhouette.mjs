// Outer silhouette of a set of filled SVG polygons, as one path string.
// Rasterises the polygons, fills enclosed holes, traces the outer boundary with
// marching squares and simplifies it. Stdlib only; used to give every data-part a
// single `.part-outline` element the page can stroke for its highlight state.

const NUMBER = /[MLZmlz]|-?\d*\.?\d+(?:e-?\d+)?/g;

export function polygonsOf(d) {
  const tokens = d.match(NUMBER) ?? [];
  if (/[^MLZmlz\d\s.,e-]/.test(d)) throw new Error(`silhouette: unsupported path command in ${d.slice(0, 60)}`);
  const polys = [];
  let current = null;
  let command = 'M';
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i];
    if (/[MLZmlz]/.test(token)) {
      command = token.toUpperCase();
      i += 1;
      if (command === 'Z') {
        if (current && current.length > 2) polys.push(current);
        current = null;
      }
    } else {
      const point = [Number(tokens[i]), Number(tokens[i + 1])];
      i += 2;
      if (command === 'M') {
        if (current && current.length > 2) polys.push(current);
        current = [point];
        command = 'L';
      } else current.push(point);
    }
  }
  if (current && current.length > 2) polys.push(current);
  return polys;
}

const FILL = /class="(?:iso-fill|tb-body|wc-sil)"[^>]*?\sd="([^"]+)"/g;

export function fillsOf(svg) {
  const out = [];
  for (const match of svg.matchAll(FILL)) out.push(...polygonsOf(match[1]));
  return out;
}

function simplify(points, epsilon) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const length = Math.hypot(bx - ax, by - ay) || 1e-9;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i];
      const distance = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (distance > worst) {
        worst = distance;
        at = i;
      }
    }
    if (worst > epsilon) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function silhouette(polys, { cell = 0.25, grow = 0.35, epsilon = 0.3 } = {}) {
  if (!polys.length) return '';
  const xs = polys.flat().map((p) => p[0]);
  const ys = polys.flat().map((p) => p[1]);
  const x0 = Math.min(...xs) - 3;
  const y0 = Math.min(...ys) - 3;
  const W = Math.ceil((Math.max(...xs) + 3 - x0) / cell);
  const H = Math.ceil((Math.max(...ys) + 3 - y0) / cell);
  const grid = new Uint8Array(W * H);
  for (const poly of polys) {
    const minY = Math.max(0, Math.floor((Math.min(...poly.map((p) => p[1])) - y0) / cell));
    const maxY = Math.min(H - 1, Math.ceil((Math.max(...poly.map((p) => p[1])) - y0) / cell));
    for (let row = minY; row <= maxY; row += 1) {
      const y = y0 + (row + 0.5) * cell;
      const hits = [];
      for (let i = 0; i < poly.length; i += 1) {
        const [ax, ay] = poly[i];
        const [bx, by] = poly[(i + 1) % poly.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) hits.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        const c0 = Math.max(0, Math.ceil((hits[i] - x0) / cell - 0.5));
        const c1 = Math.min(W - 1, Math.floor((hits[i + 1] - x0) / cell - 0.5));
        for (let c = c0; c <= c1; c += 1) grid[row * W + c] = 1;
      }
    }
  }
  // grow by a fraction of a unit so hairline gaps between touching parts close
  const reach = Math.max(1, Math.round(grow / cell));
  let solid = grid;
  for (let pass = 0; pass < reach; pass += 1) {
    const next = solid.slice();
    for (let r = 1; r < H - 1; r += 1) {
      for (let c = 1; c < W - 1; c += 1) {
        const i = r * W + c;
        if (!solid[i] && (solid[i - 1] || solid[i + 1] || solid[i - W] || solid[i + W])) next[i] = 1;
      }
    }
    solid = next;
  }
  // fill holes: flood the outside from the border
  const outside = new Uint8Array(W * H);
  const queue = [];
  for (let c = 0; c < W; c += 1) queue.push(c, (H - 1) * W + c);
  for (let r = 0; r < H; r += 1) queue.push(r * W, r * W + W - 1);
  while (queue.length) {
    const i = queue.pop();
    if (outside[i] || solid[i]) continue;
    outside[i] = 1;
    const r = Math.floor(i / W);
    const c = i % W;
    if (c > 0) queue.push(i - 1);
    if (c < W - 1) queue.push(i + 1);
    if (r > 0) queue.push(i - W);
    if (r < H - 1) queue.push(i + W);
  }
  const inside = (r, c) => (r >= 0 && c >= 0 && r < H && c < W ? !outside[r * W + c] : false);
  // marching squares on cell centres; segments chained through an undirected adjacency map
  const segs = [];
  const near = new Map();
  const key = (p) => `${p[0]},${p[1]}`;
  const link = (p, index) => {
    const k = key(p);
    if (!near.has(k)) near.set(k, []);
    near.get(k).push(index);
  };
  for (let r = -1; r < H; r += 1) {
    for (let c = -1; c < W; c += 1) {
      const tl = inside(r, c);
      const tr = inside(r, c + 1);
      const br = inside(r + 1, c + 1);
      const bl = inside(r + 1, c);
      const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (code !== 0 && code !== 15) {
        const top = [2 * c + 1, 2 * r];
        const right = [2 * c + 2, 2 * r + 1];
        const bottom = [2 * c + 1, 2 * r + 2];
        const left = [2 * c, 2 * r + 1];
        const table = {
          1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[right, top]],
          5: [[left, top], [right, bottom]], 6: [[bottom, top]], 7: [[left, top]], 8: [[top, left]],
          9: [[top, bottom]], 10: [[top, right], [bottom, left]], 11: [[top, right]], 12: [[right, left]],
          13: [[right, bottom]], 14: [[bottom, left]],
        };
        for (const [a, b] of table[code]) {
          link(a, segs.length);
          link(b, segs.length);
          segs.push([a, b]);
        }
      }
    }
  }
  const used = new Uint8Array(segs.length);
  const loops = [];
  for (let s0 = 0; s0 < segs.length; s0 += 1) {
    if (used[s0]) continue;
    used[s0] = 1;
    const loop = [segs[s0][0]];
    let at = segs[s0][1];
    for (;;) {
      loop.push(at);
      const next = (near.get(key(at)) ?? []).find((index) => !used[index]);
      if (next === undefined) break;
      used[next] = 1;
      const [a, b] = segs[next];
      at = key(a) === key(at) ? b : a;
    }
    if (loop.length > 6) loops.push(loop);
  }
  // lattice point (2c+1, 2r) is the midpoint between cell centres (r, c) and (r, c + 1)
  const toWorld = ([u, v]) => [x0 + (u / 2 + 0.5) * cell, y0 + (v / 2 + 0.5) * cell];
  const area = (pts) => pts.reduce((sum, [ax, ay], i) => {
    const [bx, by] = pts[(i + 1) % pts.length];
    return sum + ax * by - bx * ay;
  }, 0) / 2;
  return loops
    .map((loop) => loop.map(toWorld))
    .filter((pts) => Math.abs(area(pts)) > 6)
    .map((pts) => {
      let far = 0;
      pts.forEach(([x, y], i) => {
        if (Math.hypot(x - pts[0][0], y - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
      });
      const closed = [...simplify(pts.slice(0, far + 1), epsilon).slice(0, -1), ...simplify([...pts.slice(far), pts[0]], epsilon).slice(0, -1)];
      return `M${closed.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
    })
    .join('');
}
