// Negative control: a dynamic import and an import.meta.url asset reference.
const logo = new URL('../fonts/heebo-latin-400-normal.woff2', import.meta.url);
document.title = logo.href;
document.getElementById('toggle')?.addEventListener('click', async () => {
  const lazy = await import('./lazy.ts');
  lazy.run();
});
