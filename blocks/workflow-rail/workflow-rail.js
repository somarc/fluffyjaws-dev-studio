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
  region.className = 'workflow-rail-extra';
  extras.forEach((cell) => moveChildren(cell, region));
  return region;
}

function buildStep(row, index, preserveFields) {
  const cells = [...row.children];
  const item = document.createElement('li');
  let marker;
  let title;
  let detail;
  let result;

  item.className = 'workflow-rail-step';
  if (preserveFields) {
    item.classList.add('is-canvas-editable');
    marker = createEditableRegion(
      cells[0],
      'workflow-rail-marker',
      String(index + 1).padStart(2, '0'),
    );
    title = createEditableRegion(cells[1], 'workflow-rail-title', `Step ${index + 1}`);
    detail = createEditableRegion(cells[2], 'workflow-rail-detail', 'Workflow detail');
    result = createEditableRegion(
      cells[3],
      'workflow-rail-result',
      'Evidence remains visible',
    );
  } else {
    marker = document.createElement('span');
    title = document.createElement('h3');
    detail = document.createElement('div');
    result = document.createElement('p');

    marker.className = 'workflow-rail-marker';
    marker.textContent = cells[0]?.textContent.trim() || String(index + 1).padStart(2, '0');
    title.className = 'workflow-rail-title';
    title.textContent = cells[1]?.textContent.trim() || `Step ${index + 1}`;
    detail.className = 'workflow-rail-detail';
    moveChildren(cells[2], detail);
    result.className = 'workflow-rail-result';
    result.textContent = cells[3]?.textContent.trim() || 'Evidence remains visible';
  }

  item.append(marker, title, detail, result);
  if (preserveFields) {
    const extras = createExtraRegion(cells);
    if (extras) item.append(extras);
  }
  return item;
}

/**
 * Turns authored steps into one continuous workflow rail.
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  const preserveFields = isCanvasView(block);
  const list = document.createElement('ol');
  list.className = 'workflow-rail-list';
  list.append(...[...block.children].map(
    (row, index) => buildStep(row, index, preserveFields),
  ));
  block.replaceChildren(list);
}
