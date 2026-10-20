// Software list: search and filters hide rows of the table itself (catalogue-site, Software list).
// Search ignores case and looks only at the shown cells; each filter must equal its cell's text.
const table = document.querySelector<HTMLTableElement>('[data-software]');
const tools = document.querySelector<HTMLElement>('[data-list-tools]');
const search = document.querySelector<HTMLInputElement>('[data-search]');
const filters = [...document.querySelectorAll<HTMLSelectElement>('[data-filter]')];
const count = document.querySelector<HTMLElement>('[data-count]');
const noMatch = document.querySelector<HTMLElement>('[data-no-match]');

function cellText(row: HTMLTableRowElement, column: string): string {
  return row.querySelector(`[data-column="${column}"]`)?.textContent?.trim() ?? '';
}

function apply(): void {
  if (!table) return;
  const query = (search?.value ?? '').trim().toLowerCase();
  const rows = [...table.tBodies[0]!.rows];
  let shown = 0;
  for (const row of rows) {
    const matchesQuery = !query || [...row.cells].some((cell) => (cell.textContent ?? '').toLowerCase().includes(query));
    const matchesFilters = filters.every((filter) => !filter.value || cellText(row, filter.dataset.filter ?? '') === filter.value);
    row.hidden = !(matchesQuery && matchesFilters);
    if (!row.hidden) shown++;
  }
  if (noMatch) noMatch.hidden = shown > 0;
  if (count) count.textContent = shown === rows.length ? '' : `${shown} of ${rows.length} items shown.`;
}

if (tools) tools.hidden = false;
search?.addEventListener('input', apply);
for (const filter of filters) filter.addEventListener('change', apply);
apply();
