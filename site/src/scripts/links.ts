// Shared by the map and diagram scripts: turn SVG groups with data-ref into keyboard-usable links.
// Pages are at root + 'software/<name>/', 'licences/<name>/' and 'journeys/<name>/', and the Skills
// pages at 'skills/<file>/', 'playbooks/<file>/' and 'agents/<file>/' (the ref already holds the
// page file name, lowercase ASCII, so nothing is encoded here); the root
// ('../' per folder level) comes from the body's data-root, written by the layout.

const ROOT = document.body.dataset.root ?? '';

/** The page of a catalogue reference; only components, licences and lines carry data-ref links. */
export function pageOf(ref: string): string | undefined {
  const [kind, name] = ref.split(':');
  if (!name) return undefined;
  const folder = kind === 'component' ? 'software' : kind === 'resource' ? 'licences' : kind === 'line' ? 'journeys' : undefined;
  if (folder) return `${ROOT}${folder}/${name.toLowerCase()}/`;
  const skills = kind === 'skill' ? 'skills' : kind === 'playbook' ? 'playbooks' : kind === 'agent' ? 'agents' : undefined;
  return skills && /^[a-z0-9_-]+$/.test(name) ? `${ROOT}${skills}/${name}/` : undefined;
}

/** Make an SVG group focusable as a link: click, or Enter while focused, opens `url`. */
export function makeLink(element: SVGElement, url: string, allowClick: () => boolean = () => true): void {
  const title = element.querySelector('title')?.textContent ?? '';
  element.setAttribute('tabindex', '0');
  element.setAttribute('role', 'link');
  if (title) element.setAttribute('aria-label', title);
  element.addEventListener('click', () => {
    if (allowClick()) window.location.assign(url);
  });
  element.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') window.location.assign(url);
  });
}
