function moveChildren(source, target) {
  while (source?.firstChild) target.append(source.firstChild);
}

function createItem(row, index) {
  const cells = [...row.children];
  const item = document.createElement('li');
  const article = document.createElement('article');
  const number = document.createElement('span');
  const title = document.createElement('h3');
  const detail = document.createElement('div');
  const meta = document.createElement('p');

  item.className = 'surface-ledger-item';
  article.className = 'surface-ledger-entry';
  number.className = 'surface-ledger-number';
  title.className = 'surface-ledger-title';
  detail.className = 'surface-ledger-detail';
  meta.className = 'surface-ledger-meta';

  number.textContent = cells[0]?.textContent.trim() || String(index + 1).padStart(2, '0');
  title.textContent = cells[1]?.textContent.trim() || `Surface ${index + 1}`;
  moveChildren(cells[2], detail);
  meta.textContent = cells[3]?.textContent.trim() || 'Studio surface';

  article.append(number, title, detail, meta);
  item.append(article);
  return item;
}

/**
 * Renders an authored inventory as a numbered operating ledger.
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  const list = document.createElement('ol');
  list.className = 'surface-ledger-list';
  list.append(...[...block.children].map(createItem));
  block.replaceChildren(list);
}
