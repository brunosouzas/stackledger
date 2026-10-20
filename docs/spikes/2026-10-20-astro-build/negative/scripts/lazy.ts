// Negative control: loaded only through a dynamic import.
export function run(): void {
  document.body.classList.add('lazy');
}
