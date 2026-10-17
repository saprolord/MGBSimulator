/**
 * TABS
 * ====
 * Switches between the page sections (Normal Ships / Custom Ship / Perks / Skills).
 * Buttons carry `data-tab="<name>"`, panels carry `data-panel="<name>"`. Supports the arrow keys
 * (a tab bar is a single tab stop; Left/Right/Home/End move between tabs).
 *
 * To add a tab: add a button and a panel in index.html with the same name. Nothing to change here.
 */

export class Tabs {
  /** @param {{ onChange?: (name: string) => void }} [options] */
  constructor({ onChange } = {}) {
    this.onChange = onChange;
    this.buttons = [...document.querySelectorAll('[data-tab]')];
    this.panels = [...document.querySelectorAll('[data-panel]')];
    this.active = this.buttons.find((b) => b.classList.contains('active'))?.dataset.tab ?? this.buttons[0].dataset.tab;

    for (const button of this.buttons) {
      button.addEventListener('click', () => this.show(button.dataset.tab));
      button.addEventListener('keydown', (event) => this.#onKey(event));
    }
  }

  show(name) {
    if (!this.buttons.some((b) => b.dataset.tab === name)) return;
    this.active = name;
    for (const button of this.buttons) {
      const isActive = button.dataset.tab === name;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    }
    for (const panel of this.panels) panel.hidden = panel.dataset.panel !== name;
    this.onChange?.(name);
  }

  #onKey(event) {
    const names = this.buttons.map((b) => b.dataset.tab);
    const index = names.indexOf(this.active);
    const target =
      event.key === 'ArrowRight' ? (index + 1) % names.length
      : event.key === 'ArrowLeft' ? (index - 1 + names.length) % names.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? names.length - 1
      : -1;
    if (target === -1) return;
    event.preventDefault();
    this.show(names[target]);
    this.buttons[target].focus();
  }
}
