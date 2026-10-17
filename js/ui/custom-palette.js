/**
 * CUSTOM BLOCK PALETTE
 * ====================
 * The picker for custom ship blocks (shown only on the Custom Ship tab). Each button draws the
 * block's 3x3 pattern. Click to select, click again to deselect. Built from custom-blocks.js, so a
 * new block appears automatically.
 */

const CELL_CLASS = { '#': 'wall', '.': 'empty', E: 'ejector' };

export class CustomPalette {
  #selected = null;

  /**
   * @param {HTMLElement} container
   * @param {{ id: string, name: string, pattern: string[] }[]} blocks
   * @param {{ onSelect?: (blockId: string | null) => void }} [options]
   */
  constructor(container, blocks, { onSelect } = {}) {
    this.container = container;
    container.replaceChildren(...blocks.map((block) => this.#button(block)));
    container.addEventListener('click', (event) => {
      const button = event.target.closest('.palette-btn');
      if (!button) return;
      this.select(button.dataset.custom === this.#selected ? null : button.dataset.custom);
      onSelect?.(this.#selected);
    });
  }

  /** Id of the selected custom block, or null. */
  get selected() {
    return this.#selected;
  }

  select(blockId) {
    this.#selected = blockId;
    for (const button of this.container.children) button.classList.toggle('active', button.dataset.custom === blockId);
  }

  #button(block) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'palette-btn custom-btn';
    button.dataset.custom = block.id;
    button.title = block.name;
    button.setAttribute('aria-label', block.name);

    const pattern = document.createElement('span');
    pattern.className = 'pattern';
    for (const char of block.pattern.join('')) {
      const cell = document.createElement('i');
      cell.className = CELL_CLASS[char];
      pattern.append(cell);
    }
    button.append(pattern);
    return button;
  }
}
