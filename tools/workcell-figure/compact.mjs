// Size passes over the finished SVG string: merge the per-facet tone quads the kit emits
// into one polygon per run, drop class tokens no rule reads, and shorten path data.
import { polygonsOf } from './silhouette.mjs';

const fmt = (v) => {
  const text = (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return text === '-0' ? '0' : text;
};

// polygons that share an edge (in opposite directions) are spliced into one
export function mergePolygons(input) {
  const polys = input.map((p) => p.map(([x, y]) => `${fmt(x)} ${fmt(y)}`));
  let merged = true;
  while (merged) {
    merged = false;
    const edges = new Map();
    polys.forEach((poly, index) => {
      if (!poly) return;
      poly.forEach((a, i) => edges.set(`${a}>${poly[(i + 1) % poly.length]}`, [index, i]));
    });
    for (let index = 0; index < polys.length && !merged; index += 1) {
      const poly = polys[index];
      if (poly) {
        for (let i = 0; i < poly.length && !merged; i += 1) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          const hit = edges.get(`${b}>${a}`);
          if (hit && hit[0] !== index) {
            const [other, j] = hit;
            const q = polys[other];
            // q has edge b -> a at j: walk q from a (j + 1) round to b (j)
            const run = [];
            for (let s = 1; s < q.length; s += 1) run.push(q[(j + 1 + s) % q.length]);
            run.pop();
            const out = [...poly.slice(0, i + 1), ...run, ...poly.slice(i + 1)];
            // drop spikes (x, y, x)
            const clean = out.filter((p, n) => out[(n + out.length - 1) % out.length] !== p);
            polys[index] = clean;
            polys[other] = null;
            merged = true;
          }
        }
      }
    }
  }
  return polys.filter(Boolean).map((p) => `M${p.join('L')}Z`).join('');
}

export function compact(svg) {
  let out = svg.replace(/<path class="iso-shade" data-shade="(\d)" d="([^"]+)"\/>/g, (whole, shade, d) => {
    if (!/^[MLZ\d\s.-]*$/.test(d)) return whole;
    return `<path class="iso-shade" data-shade="${shade}" d="${mergePolygons(polygonsOf(d))}"/>`;
  });
  out = out
    .replace(/<g class="iso-solid">/g, '<g>')
    .replace(/<g class="iso-solid ([^"]+)"/g, '<g class="$1"');
  return out.replace(/ d="([^"]*)"/g, (whole, d) => (/^[MLZ\d\s.-]*$/.test(d) ? ` d="${relative(d)}"` : whole));
}

// Ramer-Douglas-Peucker on one polyline (tolerance in viewBox units)
function thin(points, tolerance) {
  if (points.length < 3 || tolerance <= 0) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const length = Math.hypot(bx - ax, by - ay);
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i];
      const distance = length < 1e-9 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (distance > worst) {
        worst = distance;
        at = i;
      }
    }
    if (worst > tolerance) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const num = (v) => {
  const text = fmt(v);
  return text.replace(/^(-?)0\./, '$1.');
};
function join(values) {
  let out = '';
  let prev = '';
  values.forEach((value) => {
    const text = num(value);
    if (!prev || text.startsWith('-') || (text.startsWith('.') && prev.includes('.'))) out += text;
    else out += ` ${text}`;
    prev = text;
  });
  return out;
}

// absolute M/L/Z path data to relative m/l/z with rounded deltas (no drift: deltas of rounded points)
export function relative(d, tolerance = 0.12) {
  const tokens = d.match(/[MLZ]|-?\d*\.?\d+/g) ?? [];
  const subpaths = [];
  let current = null;
  let command = 'M';
  for (let i = 0; i < tokens.length;) {
    const token = tokens[i];
    if (/[MLZ]/.test(token)) {
      command = token;
      i += 1;
      if (command === 'Z' && current) current.closed = true;
    } else {
      const point = [Math.round(Number(tokens[i]) * 10), Math.round(Number(tokens[i + 1]) * 10)];
      i += 2;
      if (command === 'M') {
        current = { points: [point], closed: false };
        subpaths.push(current);
        command = 'L';
      } else current.points.push(point);
    }
  }
  let pen = [0, 0];
  let text = '';
  subpaths.forEach(({ points, closed }) => {
    const pts = thin(points, tolerance * 10);
    const [sx, sy] = pts[0];
    text += `m${join([(sx - pen[0]) / 10, (sy - pen[1]) / 10])}`;
    const deltas = [];
    for (let i = 1; i < pts.length; i += 1) deltas.push((pts[i][0] - pts[i - 1][0]) / 10, (pts[i][1] - pts[i - 1][1]) / 10);
    if (deltas.length) text += `l${join(deltas)}`;
    if (closed) {
      text += 'z';
      pen = [sx, sy];
    } else pen = pts[pts.length - 1];
  });
  return text;
}
