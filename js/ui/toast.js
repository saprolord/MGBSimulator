/** A small self-dismissing message at the bottom of the screen. */

const DURATION_MS = 2200;
let timer = 0;

export function showToast(element, message) {
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(timer); // a second toast restarts the countdown instead of being cut short
  timer = setTimeout(() => element.classList.remove('show'), DURATION_MS);
}
