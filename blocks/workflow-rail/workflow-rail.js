function moveChildren(source, target) {
  while (source?.firstChild) target.append(source.firstChild);
}

function buildStep(row, index) {
  const cells = [...row.children];
  const item = document.createElement('li');
  const marker = document.createElement('span');
  const title = document.createElement('h3');
  const detail = document.createElement('div');
  const result = document.createElement('p');

  item.className = 'workflow-rail-step';
  marker.className = 'workflow-rail-marker';
  marker.textContent = cells[0]?.textContent.trim() || String(index + 1).padStart(2, '0');
  title.textContent = cells[1]?.textContent.trim() || `Step ${index + 1}`;
  detail.className = 'workflow-rail-detail';
  moveChildren(cells[2], detail);
  result.className = 'workflow-rail-result';
  result.textContent = cells[3]?.textContent.trim() || 'Evidence remains visible';

  item.append(marker, title, detail, result);
  return item;
}

/**
 * Turns authored steps into one continuous workflow rail.
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  const list = document.createElement('ol');
  list.className = 'workflow-rail-list';
  list.append(...[...block.children].map(buildStep));
  block.replaceChildren(list);
}
