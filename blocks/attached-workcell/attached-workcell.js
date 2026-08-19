function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function moveChildren(source, target) {
  while (source?.firstChild) target.append(source.firstChild);
}

function isCanvasView(block) {
  const params = new URL(window.location.href).searchParams;
  return params.has('quick-edit')
    || Boolean(block.querySelector('[data-prose-index], [data-image-index]'));
}

function createEditableRegion(cell, className, fallback) {
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

function appendExtraFields(cells, surface) {
  const extras = cells.slice(3).filter((cell) => cell.hasChildNodes());
  if (!extras.length) return;

  const region = document.createElement('div');
  region.className = 'attached-workcell-extra';
  extras.forEach((cell) => moveChildren(cell, region));
  surface.append(region);
}

function buildSurface(row, index, preserveFields) {
  const cells = [...row.children];
  const title = cells[0]?.textContent.trim() || `Surface ${index + 1}`;
  const detail = cells[1]?.textContent.trim() || 'Workspace surface';
  const ownership = cells[2]?.textContent.trim() || 'Studio-managed';
  const surface = document.createElement(preserveFields ? 'div' : 'button');
  const surfaceName = slugify(title);

  surface.className = 'attached-workcell-bay';
  surface.dataset.surface = surfaceName;
  surface.dataset.position = String(index + 1);
  if (preserveFields) {
    surface.classList.add('is-canvas-editable');
  } else {
    surface.type = 'button';
    surface.setAttribute('aria-pressed', 'false');
  }

  const indexLabel = document.createElement('span');
  indexLabel.className = 'attached-workcell-index';
  indexLabel.textContent = String(index + 1).padStart(2, '0');

  let titleLabel;
  let detailLabel;
  let ownerLabel;
  if (preserveFields) {
    titleLabel = createEditableRegion(cells[0], 'attached-workcell-name', title);
    detailLabel = createEditableRegion(cells[1], 'attached-workcell-detail', detail);
    ownerLabel = createEditableRegion(cells[2], 'attached-workcell-owner', ownership);
  } else {
    titleLabel = document.createElement('strong');
    titleLabel.className = 'attached-workcell-name';
    titleLabel.textContent = title;

    detailLabel = document.createElement('span');
    detailLabel.className = 'attached-workcell-detail';
    detailLabel.textContent = detail;

    ownerLabel = document.createElement('span');
    ownerLabel.className = 'attached-workcell-owner';
    ownerLabel.textContent = ownership;
  }

  surface.append(indexLabel, titleLabel, detailLabel, ownerLabel);
  if (preserveFields) appendExtraFields(cells, surface);
  return {
    surface, title, detail, ownership,
  };
}

function appendEditableIntro(introRow, intro) {
  let headingSeen = false;
  let summarySeen = false;

  [...(introRow?.children || [])].forEach((cell) => {
    [...cell.children].forEach((field) => {
      const semantic = field.matches('h1, h2, h3, h4, h5, h6, p, ol, ul, pre, blockquote')
        ? field
        : field.querySelector('h1, h2, h3, h4, h5, h6, p, ol, ul, pre, blockquote');
      let role = 'supporting';

      if (semantic?.matches('h1')) {
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

      const owner = field.classList.contains('button-field')
        ? field
        : document.createElement('div');
      owner.classList.add('attached-workcell-intro-field', `is-${role}`);
      if (owner !== field) owner.append(field);
      intro.append(owner);
    });
  });
}

/**
 * Decorates the authored surface list as one explorable Attached Workcell.
 * The first authored row remains the hero's semantic intro; every later row is
 * a real Studio surface with a title, explanation, and state owner.
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  const preserveFields = isCanvasView(block);
  const rows = [...block.children];
  const introRow = rows.shift();
  const intro = document.createElement('div');
  intro.className = 'attached-workcell-intro';
  if (preserveFields) {
    appendEditableIntro(introRow, intro);
  } else {
    [...(introRow?.children || [])].forEach((cell) => moveChildren(cell, intro));
  }

  const stage = document.createElement('div');
  stage.className = 'attached-workcell-stage';
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', 'FluffyJaws Dev Studio workspace surfaces');

  const stageLabel = document.createElement('p');
  stageLabel.className = 'attached-workcell-stage-label';
  stageLabel.textContent = 'Workcell assembly / state attachment study';

  const frame = document.createElement('div');
  frame.className = 'attached-workcell-frame';

  const axis = document.createElement('span');
  axis.className = 'attached-workcell-axis';
  axis.setAttribute('aria-hidden', 'true');

  const readout = document.createElement('p');
  readout.className = 'attached-workcell-readout';
  readout.setAttribute('aria-live', 'polite');

  const gitPlane = document.createElement('p');
  const gitLabel = document.createElement('strong');
  const gitDetail = document.createElement('span');
  gitPlane.className = 'attached-workcell-git-plane';
  gitLabel.textContent = 'Git';
  gitDetail.textContent = 'Durable project truth once committed';
  gitPlane.append(gitLabel, gitDetail);

  const tether = document.createElement('span');
  tether.className = 'attached-workcell-tether';
  tether.setAttribute('aria-hidden', 'true');

  const surfaces = rows.map((row, index) => buildSurface(row, index, preserveFields));
  surfaces.slice(0, 8).forEach(({ surface }) => frame.append(surface));
  frame.append(tether, gitPlane);
  stage.append(stageLabel, axis, frame, readout);

  const overflow = document.createElement('div');
  overflow.className = 'attached-workcell-overflow';
  const overflowLabel = document.createElement('p');
  overflowLabel.className = 'attached-workcell-overflow-label';
  overflowLabel.textContent = 'Additional authored surfaces';
  overflow.append(overflowLabel, ...surfaces.slice(8).map(({ surface }) => surface));

  const setActive = (selected) => {
    surfaces.forEach(({
      surface, title, detail, ownership,
    }) => {
      const active = surface === selected;
      surface.setAttribute('aria-pressed', String(active));
      if (active) {
        stage.dataset.active = surface.dataset.surface;
        readout.textContent = `${title} — ${detail} · ${ownership}`;
      }
    });
  };

  if (preserveFields) {
    stage.dataset.canvas = 'true';
    readout.textContent = 'Canvas editing view / surface fields remain directly editable';
  } else {
    surfaces.forEach(({ surface }) => {
      surface.addEventListener('click', () => setActive(surface));
    });
    if (surfaces[0]) setActive(surfaces[0].surface);
  }
  block.replaceChildren(intro, stage);
  if (surfaces.length > 8) block.append(overflow);
}
