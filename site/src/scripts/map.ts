// Map page (catalogue-site, Map page and Map interaction): zoom and pan by changing the SVG viewBox,
// line highlight and zone filter by toggling a class on elements with data-line and data-zone (from
// the map engine), and stations as links. Both themed copies of the map change together.
import { makeLink, pageOf } from './links.ts';

const frame = document.querySelector<HTMLElement>('[data-map]');
const svgs = [...document.querySelectorAll<SVGSVGElement>('[data-map] svg')];
const DIMMED = 'is-dimmed';
const ZOOM_STEP = 1.25;
const DRAG_THRESHOLD = 4;

interface Box { x: number; y: number; w: number; h: number }

const initial: Box | undefined = (() => {
  const values = svgs[0]?.getAttribute('viewBox')?.split(' ').map(Number);
  return values?.length === 4 ? { x: values[0]!, y: values[1]!, w: values[2]!, h: values[3]! } : undefined;
})();
let view: Box | undefined = initial && { ...initial };

function setView(next: Box): void {
  view = next;
  for (const svg of svgs) svg.setAttribute('viewBox', `${next.x} ${next.y} ${next.w} ${next.h}`);
}

function zoom(factor: number): void {
  if (!view || !initial) return;
  const w = Math.min(initial.w * 2, Math.max(initial.w / 8, view.w / factor));
  const h = w * (initial.h / initial.w);
  setView({ x: view.x + (view.w - w) / 2, y: view.y + (view.h - h) / 2, w, h });
}

// Drag to pan; a drag longer than a few pixels does not count as a click on a station.
let dragged = false;
let start: { x: number; y: number; view: Box } | undefined;
frame?.addEventListener('pointerdown', (event) => {
  if (!view || event.button !== 0) return;
  start = { x: event.clientX, y: event.clientY, view: { ...view } };
  dragged = false;
});
frame?.addEventListener('pointermove', (event) => {
  if (!start) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (!dragged && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  if (!dragged) frame.setPointerCapture(event.pointerId);
  dragged = true;
  const svg = svgs.find((item) => item.getBoundingClientRect().width > 0);
  const scale = svg ? start.view.w / svg.getBoundingClientRect().width : 1;
  setView({ ...start.view, x: start.view.x - dx * scale, y: start.view.y - dy * scale });
});
const endDrag = () => {
  start = undefined;
};
frame?.addEventListener('pointerup', endDrag);
frame?.addEventListener('pointercancel', endDrag);

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-zoom]')) {
  button.addEventListener('click', () => {
    const action = button.dataset.zoom;
    if (action === 'in') zoom(ZOOM_STEP);
    else if (action === 'out') zoom(1 / ZOOM_STEP);
    else if (initial) setView({ ...initial });
  });
}

// Highlight and zone filter: one at a time; choosing the same line again restores the map.
const lineButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-map-lines] [data-line]')];
const zoneSelect = document.querySelector<HTMLSelectElement>('[data-zone-filter]');
const marked = svgs.flatMap((svg) => [...svg.querySelectorAll<SVGElement>('[data-line]')]);
const isStationLike = (element: Element) => element.tagName.toLowerCase() === 'text' || (element.getAttribute('data-ref') ?? '').startsWith('component:');
const linesOf = (element: Element) => (element.getAttribute('data-line') ?? '').split(' ').filter(Boolean);
let highlighted: string | undefined;

function clearDimming(): void {
  for (const element of marked) element.classList.remove(DIMMED);
}

function highlight(line: string | undefined): void {
  highlighted = line;
  clearDimming();
  if (zoneSelect) zoneSelect.value = '';
  for (const button of lineButtons) button.setAttribute('aria-pressed', String(button.dataset.line === line));
  if (!line) return;
  for (const element of marked) if (!linesOf(element).includes(line)) element.classList.add(DIMMED);
}

function filterZone(zone: string): void {
  highlight(undefined);
  if (zoneSelect) zoneSelect.value = zone;
  if (!zone) return;
  const inZone = marked.filter((element) => isStationLike(element) && element.getAttribute('data-zone') === zone);
  const zoneLines = new Set(inZone.flatMap(linesOf));
  for (const element of marked) {
    const keep = isStationLike(element) ? element.getAttribute('data-zone') === zone : linesOf(element).some((line) => zoneLines.has(line));
    if (!keep) element.classList.add(DIMMED);
  }
}

for (const button of lineButtons) {
  button.addEventListener('click', () => highlight(highlighted === button.dataset.line ? undefined : button.dataset.line));
}
zoneSelect?.addEventListener('change', () => filterZone(zoneSelect.value));

// Strokes, badges and legend entries choose their line; stations open their page.
for (const element of marked) {
  if (isStationLike(element)) continue;
  const [line] = linesOf(element);
  element.classList.add('is-choosable');
  element.addEventListener('click', () => {
    if (!dragged && line) highlight(highlighted === line ? undefined : line);
  });
}
for (const svg of svgs) {
  for (const station of svg.querySelectorAll<SVGElement>('[data-ref^="component:"]')) {
    const url = pageOf(station.getAttribute('data-ref') ?? '');
    if (url) makeLink(station, url, () => !dragged);
  }
}

for (const selector of ['[data-map-tools]', '[data-map-lines]']) {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.hidden = false;
}
frame?.classList.add('is-interactive');
