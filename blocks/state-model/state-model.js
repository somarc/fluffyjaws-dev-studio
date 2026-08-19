function moveChildren(source, target) {
  while (source?.firstChild) target.append(source.firstChild);
}

function ownerKey(value) {
  return /git/i.test(value) ? 'git' : 'studio';
}

function buildState(row) {
  const cells = [...row.children];
  const owner = cells[0]?.textContent.trim() || 'App-managed Studio state';
  const item = document.createElement('li');
  const title = document.createElement('h4');
  const detail = document.createElement('div');
  const status = document.createElement('p');

  item.className = 'state-model-item';
  title.textContent = cells[1]?.textContent.trim() || 'Workspace state';
  detail.className = 'state-model-detail';
  moveChildren(cells[2], detail);
  status.className = 'state-model-status';
  status.textContent = cells[3]?.textContent.trim() || 'Owner declared';
  item.append(title, detail, status);
  return { owner, key: ownerKey(owner), item };
}

function buildLayer(key, owner, items) {
  const layer = document.createElement('section');
  const heading = document.createElement('h3');
  const list = document.createElement('ul');

  layer.className = 'state-model-layer';
  layer.dataset.owner = key;
  heading.textContent = owner;
  list.append(...items);
  layer.append(heading, list);
  return layer;
}

/**
 * Splits authored state rows into the Git truth plane and Studio state layer.
 * @param {HTMLElement} block The block element
 */
export default function decorate(block) {
  const states = [...block.children].map(buildState);
  const groups = new Map();

  states.forEach(({ owner, key, item }) => {
    if (!groups.has(key)) groups.set(key, { owner, items: [] });
    groups.get(key).items.push(item);
  });

  const layers = document.createElement('div');
  layers.className = 'state-model-layers';
  ['git', 'studio'].forEach((key) => {
    const group = groups.get(key);
    if (group) layers.append(buildLayer(key, group.owner, group.items));
  });
  block.replaceChildren(layers);
}
