// Shared module imported by both page scripts, so the bundler emits a shared chunk.
export function markScriptRan(page: string): void {
  document.documentElement.classList.add('js-ran');
  document.documentElement.dataset.page = page;
}

export function wireToggle(): void {
  const button = document.getElementById('toggle');
  button?.addEventListener('click', () => {
    document.body.classList.toggle('is-on');
  });
}
