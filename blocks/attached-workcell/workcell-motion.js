/*
 * Motion for the inlined Attached Workcell figure (workcell-figure.svg).
 * The flywheel turns slowly, now and then a sheet slides from the console chute into the
 * artifact tray, and the inbox flag rises and lowers. Time-based, eased, paused offscreen,
 * stopped when `signal` aborts, and absent under prefers-reduced-motion.
 */

const FLYWHEEL_DEG_PER_S = 36; // one turn in ten seconds
const SHEET_PERIOD = 11;
const SHEET_START = 3; // the poster shows the sheet at rest, so start inside the rest phase
const FLAG_PERIOD = 14;

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const easeOut = (t) => 1 - (1 - clamp01(t)) ** 3;
const easeIn = (t) => clamp01(t) ** 2;
const mix = (a, b, t) => a + (b - a) * t;

function parsePath(text) {
  return (text || '')
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number))
    .filter((point) => point.length === 2 && point.every(Number.isFinite));
}

// sheet: [pre, chute, edge, rest] screen offsets; returns [x, y, opacity]
function sheetAt(time, path) {
  if (path.length < 4) return [0, 0, 1];
  const [pre, chute, edge, rest] = path;
  const t = ((time % SHEET_PERIOD) + SHEET_PERIOD) % SHEET_PERIOD;
  const lerp = (a, b, s) => [mix(a[0], b[0], s), mix(a[1], b[1], s)];
  if (t < 0.7) return [...lerp(pre, chute, easeOut(t / 0.7)), smooth(t / 0.5)];
  if (t < 2.5) return [...lerp(chute, edge, smooth((t - 0.7) / 1.8)), 1];
  if (t < 3) return [...lerp(edge, rest, easeIn((t - 2.5) / 0.5)), 1];
  if (t < 9.6) return [...rest, 1];
  if (t < 10.4) return [...rest, 1 - smooth((t - 9.6) / 0.8)];
  return [...rest, 0];
}

function flagAt(time, rest, raised) {
  const t = ((time % FLAG_PERIOD) + FLAG_PERIOD) % FLAG_PERIOD;
  let up = 0;
  if (t >= 6 && t < 7.4) up = smooth((t - 6) / 1.4);
  else if (t >= 7.4 && t < 10.5) up = 1;
  else if (t >= 10.5 && t < 12.1) up = 1 - smooth((t - 10.5) / 1.6);
  return mix(rest, raised, up);
}

export default function animate(svgRoot, { signal } = {}) {
  if (!svgRoot || typeof window === 'undefined') return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;
  const flywheel = svgRoot.querySelector('#wc-flywheel');
  const sheet = svgRoot.querySelector('#wc-sheet');
  const flag = svgRoot.querySelector('#wc-flag');
  const path = parsePath(sheet && sheet.getAttribute('data-path'));
  const flagRest = Number(flag && flag.getAttribute('data-rest')) || 0;
  const flagRaised = Number(flag && flag.getAttribute('data-raised')) || -90;

  let clock = 0;
  let last = 0;
  let frame = 0;
  let visible = false;

  const draw = () => {
    if (flywheel) flywheel.setAttribute('transform', `rotate(${((clock * FLYWHEEL_DEG_PER_S) % 360).toFixed(2)})`);
    if (sheet) {
      const [x, y, opacity] = sheetAt(clock + SHEET_START, path);
      sheet.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      sheet.setAttribute('opacity', opacity.toFixed(3));
    }
    if (flag) flag.setAttribute('transform', `rotate(${flagAt(clock, flagRest, flagRaised).toFixed(2)})`);
  };

  const reset = () => {
    if (flywheel) flywheel.removeAttribute('transform');
    if (sheet) {
      sheet.removeAttribute('transform');
      sheet.removeAttribute('opacity');
    }
    if (flag) flag.removeAttribute('transform');
  };

  const tick = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    clock += dt;
    draw();
    frame = visible ? window.requestAnimationFrame(tick) : 0;
  };

  const run = () => {
    if (frame || !visible || reduce.matches || (signal && signal.aborted)) return;
    last = 0;
    frame = window.requestAnimationFrame(tick);
  };

  const halt = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
  };

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) run();
      else halt();
    }, { rootMargin: '120px 0px' })
    : null;

  const onPreference = () => {
    if (reduce.matches) {
      halt();
      reset();
    } else run();
  };

  const stop = () => {
    halt();
    if (observer) observer.disconnect();
    reduce.removeEventListener('change', onPreference);
    reset();
  };

  if ((signal && signal.aborted) || reduce.matches) return;
  reduce.addEventListener('change', onPreference);
  if (signal) signal.addEventListener('abort', stop, { once: true });
  if (observer) observer.observe(svgRoot);
  else {
    visible = true;
    run();
  }
}
