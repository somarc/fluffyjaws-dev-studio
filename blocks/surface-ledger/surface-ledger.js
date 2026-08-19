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
  region.className = 'surface-ledger-extra';
  extras.forEach((cell) => moveChildren(cell, region));
  return region;
}

function createItem(row, index, preserveFields) {
  const cells = [...row.children];
  const item = document.createElement('li');
  const article = document.createElement('article');
  let number;
  let title;
  let detail;
  let meta;

  item.className = 'surface-ledger-item';
  article.className = 'surface-ledger-entry';
  if (preserveFields) {
    article.classList.add('is-canvas-editable');
    number = createEditableRegion(
      cells[0],
      'surface-ledger-number',
      String(index + 1).padStart(2, '0'),
    );
    title = createEditableRegion(cells[1], 'surface-ledger-title', `Surface ${index + 1}`);
    detail = createEditableRegion(cells[2], 'surface-ledger-detail', 'Workspace surface');
    meta = createEditableRegion(cells[3], 'surface-ledger-meta', 'Studio surface');
  } else {
    number = document.createElement('span');
    title = document.createElement('h3');
    detail = document.createElement('div');
    meta = document.createElement('p');

    number.className = 'surface-ledger-number';
    title.className = 'surface-ledger-title';
    detail.className = 'surface-ledger-detail';
    meta.className = 'surface-ledger-meta';

    number.textContent = cells[0]?.textContent.trim() || String(index + 1).padStart(2, '0');
    title.textContent = cells[1]?.textContent.trim() || `Surface ${index + 1}`;
    moveChildren(cells[2], detail);
    meta.textContent = cells[3]?.textContent.trim() || 'Studio surface';
  }

  article.append(number, title, detail, meta);
  if (preserveFields) {
    const extras = createExtraRegion(cells);
    if (extras) article.append(extras);
  }
  item.append(article);
  return item;
}

/**
 * Renders an authored inventory as a numbered operating ledger.
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  const preserveFields = isCanvasView(block);
  const list = document.createElement('ol');
  list.className = 'surface-ledger-list';
  list.append(...[...block.children].map(
    (row, index) => createItem(row, index, preserveFields),
  ));
  block.replaceChildren(list);
}
