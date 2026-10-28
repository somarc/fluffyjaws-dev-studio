const FIGURE = 'workcell-figure.svg';
const MOTION = 'workcell-motion.js';

/* Authored surface names → the figure's data-part keys. */
const PART_ALIASES = {
  conversations: 'conversation',
  'sub-agents': 'agents',
  subagents: 'agents',
  'child-agents': 'agents',
  'inbox-actions': 'inbox',
  'background-commands': 'commands',
  'worktree-git': 'worktree',
  worktrees: 'worktree',
  'managed-worktrees': 'worktree',
  vaults: 'vault',
};

/* Drawing parts without their own legend row select the row they belong to. */
const FIGURE_ALIASES = { git: 'worktree' };

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function partKey(title) {
  const slug = slugify(title);
  return PART_ALIASES[slug] || slug;
}

function moveChildren(source, target) {
  while (source?.firstChild) target.append(source.firstChild);
}

function isCanvasView(block) {
  return document.documentElement.hasAttribute('quick-edit')
    || new URLSearchParams(window.location.search).has('quick-edit')
    || Boolean(block.querySelector('[data-prose-index], [data-image-index]'));
}

/* Published path: move the authored text into a span, never copy it. */
function fillFrom(cell, target, fallback) {
  if (!cell?.textContent.trim()) {
    target.textContent = fallback;
    return;
  }
  const lone = cell.querySelector(':scope > p:only-child');
  moveChildren(lone && lone.textContent.trim() === cell.textContent.trim() ? lone : cell, target);
}

/* Canvas path: keep the authored nodes (and their editor identity) intact. */
function editableRegion(cell, className, fallback) {
  const region = document.createElement('div');
  region.className = className;
  if (cell?.hasChildNodes()) {
    moveChildren(cell, region);
  } else {
    const field = document.createElement('p');
    field.textContent = fallback;
    region.append(field);
  }
  return region;
}

function buildIntro(introRow, preserveFields) {
  const intro = document.createElement('div');
  intro.className = 'attached-workcell-intro';
  let headingSeen = false;
  let summarySeen = false;

  [...(introRow?.children || [])].forEach((cell) => {
    [...cell.children].forEach((field) => {
      let role = 'supporting';
      if (field.matches('h1') || field.querySelector('h1')) {
        role = 'heading';
        headingSeen = true;
      } else if (field.querySelector('a[href]')) {
        role = 'action';
      } else if (!headingSeen) {
        role = 'eyebrow';
      } else if (!summarySeen) {
        role = 'summary';
        summarySeen = true;
      }
      field.classList.add('attached-workcell-intro-field', `is-${role}`);
      intro.append(field);
    });
  });

  if (!preserveFields) {
    /* Group the CTA paragraphs so they sit on one line. */
    const actions = [...intro.querySelectorAll(':scope > .is-action')];
    if (actions.length > 1) {
      const group = document.createElement('div');
      group.className = 'attached-workcell-actions';
      actions[0].before(group);
      group.append(...actions);
    }
  }
  return intro;
}

function buildPart(row, index, preserveFields) {
  const cells = [...row.children];
  const title = cells[0]?.textContent.trim() || `Surface ${index + 1}`;
  const key = partKey(title);
  const item = document.createElement('li');
  item.className = 'attached-workcell-part';
  item.dataset.part = key;

  const number = document.createElement('span');
  number.className = 'attached-workcell-index';
  number.setAttribute('aria-hidden', 'true');
  number.textContent = String(index + 1).padStart(2, '0');

  if (preserveFields) {
    item.classList.add('is-canvas-editable');
    item.append(
      number,
      editableRegion(cells[0], 'attached-workcell-name', title),
      editableRegion(cells[1], 'attached-workcell-detail', 'Workspace surface'),
      editableRegion(cells[2], 'attached-workcell-owner', 'Studio-managed'),
    );
    cells.slice(3).filter((cell) => cell.hasChildNodes()).forEach((cell) => {
      item.append(editableRegion(cell, 'attached-workcell-extra', ''));
    });
    return { item, key };
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'attached-workcell-trigger';
  button.setAttribute('aria-pressed', 'false');
  const name = document.createElement('span');
  const detail = document.createElement('span');
  const owner = document.createElement('span');
  name.className = 'attached-workcell-name';
  detail.className = 'attached-workcell-detail';
  owner.className = 'attached-workcell-owner';
  fillFrom(cells[0], name, title);
  fillFrom(cells[1], detail, 'Workspace surface');
  fillFrom(cells[2], owner, 'Studio-managed');
  button.append(number, name, detail, owner);
  item.append(button);
  return { item, key, button };
}

async function loadFigure(drawing) {
  const base = `${window.hlx?.codeBasePath || ''}/blocks/attached-workcell`;
  const response = await fetch(`${base}/${FIGURE}`);
  if (!response.ok) throw new Error(`figure ${response.status}`);
  const parsed = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.nodeName.toLowerCase() !== 'svg') throw new Error('figure is not an svg');
  svg.querySelectorAll('script, foreignObject').forEach((node) => node.remove());
  const figureSvg = document.importNode(svg, true);
  drawing.append(figureSvg);
  return { svg: figureSvg, base };
}

/**
 * The Attached Workcell: the authored intro, the product drawn as one machine,
 * and the authored surface list as the drawing's legend. Selecting a legend
 * row (or a part of the drawing) marks that part and reads it out.
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  const preserveFields = isCanvasView(block);
  const rows = [...block.children];
  const intro = buildIntro(rows.shift(), preserveFields);

  const figure = document.createElement('figure');
  figure.className = 'attached-workcell-figure';
  const drawing = document.createElement('div');
  drawing.className = 'attached-workcell-drawing';
  const readout = document.createElement('figcaption');
  readout.className = 'attached-workcell-readout';
  readout.setAttribute('aria-live', 'polite');
  figure.append(drawing, readout);

  const legend = document.createElement('ol');
  legend.className = 'attached-workcell-legend';
  legend.setAttribute('aria-label', 'Studio surfaces in the drawing');
  const parts = rows.map((row, index) => buildPart(row, index, preserveFields));
  legend.append(...parts.map(({ item }) => item));

  block.replaceChildren(intro, figure, legend);

  let svg = null;
  const select = (key) => {
    parts.forEach(({ item, key: itemKey, button }) => {
      const active = itemKey === key;
      item.classList.toggle('is-active', active);
      button?.setAttribute('aria-pressed', String(active));
      if (active) {
        const text = (selector) => item.querySelector(selector)?.textContent.trim() || '';
        readout.textContent = `${text('.attached-workcell-name')} — ${text('.attached-workcell-detail')} · ${text('.attached-workcell-owner')}`;
      }
    });
    if (!svg) return;
    svg.dataset.active = key;
    /* Redraw the outline on top so parts painted later never hide it. */
    svg.querySelector(':scope > .part-outline-top')?.remove();
    const outline = svg.querySelector(`[data-part="${key}"] .part-outline`);
    if (outline) {
      const top = outline.cloneNode(false);
      top.setAttribute('class', 'part-outline-top');
      top.setAttribute('aria-hidden', 'true');
      svg.append(top);
    }
  };

  if (preserveFields) {
    readout.textContent = 'Canvas editing view: the legend fields stay directly editable';
  } else {
    readout.textContent = 'Pick a surface below to find it on the bench.';
    parts.forEach(({ key, button }) => {
      button.addEventListener('click', () => select(key));
    });
  }

  loadFigure(drawing).then(async ({ svg: loaded, base }) => {
    svg = loaded;
    figure.classList.add('is-loaded');
    if (preserveFields) return;
    svg.addEventListener('click', (event) => {
      const part = event.target.closest?.('[data-part]')?.dataset.part;
      const key = FIGURE_ALIASES[part] || part;
      if (key && parts.some((item) => item.key === key)) select(key);
    });
    const motion = new AbortController();
    const { default: animate } = await import(`${base}/${MOTION}`);
    animate(svg, { signal: motion.signal });
  }).catch(() => {
    figure.classList.add('is-unavailable');
  });
}
