/**
 * PALETTE
 * =======
 * The block picker on the left. Builds its buttons from the block registry, so a new block shows
 * up automatically. Click a block to select it, click it again to deselect.
 */

import { BLOCKS } from '../blocks.js';
import { imageUrl } from './assets.js';

export class Palette {
  #selected = null;

  /**
   * @param {HTMLElement} container
   * @param {{ onSelect?: (blockName: string | null) => void }} [options]  called after the user picks or un-picks a block
   */
  constructor(container, { onSelect } = {}) {
    this.container = container;
    this.#build();
    container.addEventListener('click', (event) => {
      const button = event.target.closest('.palette-btn');
      if (!button) return;
      this.select(button.dataset.block === this.#selected ? null : button.dataset.block);
      onSelect?.(this.#selected);
    });
  }

  /** Name of the selected block, or null. */
  get selected() {
    return this.#selected;
  }

  select(blockName) {
    this.#selected = blockName;
    for (const button of this.container.children) {
      button.classList.toggle('active', button.dataset.block === blockName);
    }
  }

  #build() {
    const buttons = BLOCKS.map((block) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'palette-btn' + (block.implemented ? '' : ' unimplemented');
      button.dataset.block = block.name;
      button.title = block.implemented ? block.name : `${block.name} (Visual only - No effect yet)`;

      const image = document.createElement('img');
      image.className = 'palette-btn__img';
      image.src = imageUrl(block.image);
      image.alt = block.name;
      button.append(image);
      return button;
    });
    this.container.replaceChildren(...buttons);
  }
}
