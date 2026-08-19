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

function buildSurface(row, index) {
  const cells = [...row.children];
  const title = cells[0]?.textContent.trim() || `Surface ${index + 1}`;
  const detail = cells[1]?.textContent.trim() || 'Workspace surface';
  const ownership = cells[2]?.textContent.trim() || 'Studio-managed';
  const surface = document.createElement('button');
  const surfaceName = slugify(title);

  surface.type = 'button';
  surface.className = 'attached-workcell-bay';
  surface.dataset.surface = surfaceName;
  surface.setAttribute('aria-pressed', 'false');

  const indexLabel = document.createElement('span');
  indexLabel.className = 'attached-workcell-index';
  indexLabel.textContent = String(index + 1).padStart(2, '0');

  const titleLabel = document.createElement('strong');
  titleLabel.className = 'attached-workcell-name';
  titleLabel.textContent = title;

  const detailLabel = document.createElement('span');
  detailLabel.className = 'attached-workcell-detail';
  detailLabel.textContent = detail;

  const ownerLabel = document.createElement('span');
  ownerLabel.className = 'attached-workcell-owner';
  ownerLabel.textContent = ownership;

  surface.append(indexLabel, titleLabel, detailLabel, ownerLabel);
  return {
    surface, title, detail, ownership,
  };
}

/**
 * Decorates the authored surface list as one explorable Attached Workcell.
 * The first authored row remains the hero's semantic intro; every later row is
 * a real Studio surface with a title, explanation, and state owner.
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  const introRow = rows.shift();
  const intro = document.createElement('div');
  intro.className = 'attached-workcell-intro';
  [...(introRow?.children || [])].forEach((cell) => moveChildren(cell, intro));

  const stage = document.createElement('div');
  stage.className = 'attached-workcell-stage';
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

  const surfaces = rows.map(buildSurface);
  surfaces.forEach(({ surface }) => frame.append(surface));
  frame.append(tether, gitPlane);
  stage.append(stageLabel, axis, frame, readout);

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

  surfaces.forEach(({ surface }) => {
    surface.addEventListener('click', () => setActive(surface));
    surface.addEventListener('focus', () => setActive(surface));
  });

  if (surfaces[0]) setActive(surfaces[0].surface);
  block.replaceChildren(intro, stage);
}
