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

function createExtraRegion(cells) {
  const extras = cells.slice(4).filter((cell) => cell.hasChildNodes());
  if (!extras.length) return null;

  const region = document.createElement('div');
  region.className = 'state-model-extra';
  extras.forEach((cell) => moveChildren(cell, region));
  return region;
}

function ownerKey(value) {
  return /git/i.test(value) ? 'git' : 'studio';
}

function buildState(row, preserveFields) {
  const cells = [...row.children];
  const owner = cells[0]?.textContent.trim() || 'App-managed Studio state';
  const item = document.createElement('li');
  let ownerField;
  let title;
  let detail;
  let status;

  item.className = 'state-model-item';
  if (preserveFields) {
    item.classList.add('is-canvas-editable');
    ownerField = createEditableRegion(cells[0], 'state-model-owner', owner);
    title = createEditableRegion(cells[1], 'state-model-title', 'Workspace state');
    detail = createEditableRegion(cells[2], 'state-model-detail', 'State description');
    status = createEditableRegion(cells[3], 'state-model-status', 'Owner declared');
    item.append(ownerField, title, detail, status);

    const extras = createExtraRegion(cells);
    if (extras) item.append(extras);
  } else {
    title = document.createElement('h4');
    detail = document.createElement('div');
    status = document.createElement('p');

    title.className = 'state-model-title';
    title.textContent = cells[1]?.textContent.trim() || 'Workspace state';
    detail.className = 'state-model-detail';
    moveChildren(cells[2], detail);
    status.className = 'state-model-status';
    status.textContent = cells[3]?.textContent.trim() || 'Owner declared';
    item.append(title, detail, status);
  }
  return { owner, key: ownerKey(owner), item };
}

function buildLayer(key, owner, items, preserveFields) {
  const layer = document.createElement('section');
  const list = document.createElement('ul');

  layer.className = 'state-model-layer';
  layer.dataset.owner = key;
  list.append(...items);
  if (preserveFields) {
    layer.classList.add('is-canvas-editable');
    layer.append(list);
  } else {
    const heading = document.createElement('h3');
    heading.textContent = owner;
    layer.append(heading, list);
  }
  return layer;
}

/**
 * Splits authored state rows into the Git truth plane and Studio state layer.
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  const preserveFields = isCanvasView(block);
  const states = [...block.children].map((row) => buildState(row, preserveFields));
  const groups = new Map();

  states.forEach(({ owner, key, item }) => {
    if (!groups.has(key)) groups.set(key, { owner, items: [] });
    groups.get(key).items.push(item);
  });

  const layers = document.createElement('div');
  layers.className = 'state-model-layers';
  ['git', 'studio'].forEach((key) => {
    const group = groups.get(key);
    if (group) layers.append(buildLayer(key, group.owner, group.items, preserveFields));
  });
  block.replaceChildren(layers);
}
