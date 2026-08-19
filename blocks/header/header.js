import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const isDesktop = window.matchMedia('(min-width: 64em)');

function setMenuState(nav, expanded) {
  const button = nav.querySelector('.nav-hamburger button');
  nav.setAttribute('aria-expanded', String(expanded));
  button?.setAttribute('aria-expanded', String(expanded));
  button?.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
  document.body.style.overflowY = expanded && !isDesktop.matches ? 'hidden' : '';
}

function createMenuButton(nav, navSections) {
  const wrapper = document.createElement('div');
  const button = document.createElement('button');
  const icon = document.createElement('span');

  wrapper.className = 'nav-hamburger';
  button.type = 'button';
  button.setAttribute('aria-controls', navSections?.id || 'nav');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Open navigation');
  icon.className = 'nav-hamburger-icon';
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);
  wrapper.append(button);
  button.addEventListener('click', () => setMenuState(nav, nav.getAttribute('aria-expanded') !== 'true'));
  return wrapper;
}

function decorateBrand(nav) {
  const brandLink = nav.querySelector('.nav-brand a');
  if (!brandLink) return;
  const label = document.createElement('span');
  const icon = document.createElement('img');

  label.textContent = brandLink.textContent.trim() || 'FluffyJaws Dev Studio';
  icon.src = '/icons/fluffyjaws-studio.png';
  icon.alt = '';
  icon.width = 40;
  icon.height = 40;
  icon.loading = 'eager';
  brandLink.className = 'nav-brand-link';
  brandLink.replaceChildren(icon, label);
}

/**
 * Loads and decorates the global navigation fragment.
 * @param {HTMLElement} block The header block
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);
  if (!fragment) return;

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main navigation');
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  ['brand', 'sections', 'tools'].forEach((name, index) => {
    nav.children[index]?.classList.add(`nav-${name}`);
  });

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) navSections.id = 'nav-sections';
  decorateBrand(nav);
  nav.prepend(createMenuButton(nav, navSections));
  setMenuState(nav, false);

  nav.querySelectorAll('.nav-sections a').forEach((link) => {
    link.addEventListener('click', () => setMenuState(nav, false));
  });
  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMenuState(nav, false);
      nav.querySelector('.nav-hamburger button')?.focus();
    }
  });
  nav.addEventListener('focusout', (event) => {
    if (!isDesktop.matches && !nav.contains(event.relatedTarget)) setMenuState(nav, false);
  });
  isDesktop.addEventListener('change', () => setMenuState(nav, false));

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.append(nav);
  block.replaceChildren(wrapper);
}
