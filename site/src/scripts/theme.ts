// Theme switch (catalogue-site, Layout): follow prefers-color-scheme until the reader chooses,
// then remember light or dark in localStorage for every page of this site.
const KEY = 'stackledger-theme';
type Theme = 'light' | 'dark';

const root = document.documentElement;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function stored(): Theme | undefined {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : undefined;
  } catch {
    // Storage can be unavailable (private mode, blocked); the switch still works on this page.
    return undefined;
  }
}

function current(): Theme {
  return (root.dataset.theme as Theme | undefined) ?? (systemDark.matches ? 'dark' : 'light');
}

function syncSwitches(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-switch]')) {
    button.hidden = false;
    button.setAttribute('aria-checked', String(current() === 'dark'));
  }
}

function choose(theme: Theme): void {
  root.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not remembered across pages, but applied here.
  }
  syncSwitches();
}

const saved = stored();
if (saved) root.dataset.theme = saved;

function wire(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-switch]')) {
    button.addEventListener('click', () => choose(current() === 'dark' ? 'light' : 'dark'));
  }
  systemDark.addEventListener('change', syncSwitches);
  syncSwitches();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
else wire();
