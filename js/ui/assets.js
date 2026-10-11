/**
 * Image loading. Sprites are loaded once; visual-only blocks get a pre-filtered grey copy so the
 * canvas does not have to apply `ctx.filter` for every tile on every redraw.
 */

import { IMAGE_DIR, TILE, TILE_SIZE } from '../config.js';
import { BLOCKS } from '../blocks.js';

const TILE_IMAGE_FILES = Object.freeze({
  [TILE.GENERATOR]: 'Projectile_generator.webp',
  [TILE.EJECTOR]: 'Ejection_block.webp',
  [TILE.SOLID]: 'Solid_block.webp',
  [TILE.EMPTY]: 'Empty_slot.webp',
});

export const imageUrl = (file) => `${IMAGE_DIR}${file}`;

/** Greyed-out, semi-transparent copy used for blocks that have no effect on the maths yet. */
function makeDimmedSprite(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || TILE_SIZE;
  canvas.height = image.naturalHeight || TILE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.filter = 'grayscale(100%) opacity(0.55)';
  ctx.drawImage(image, 0, 0);
  return canvas;
}

export class SpriteCache {
  #sprites = new Map(); // name -> drawable, present once loaded

  /** @param {() => void} onChange called whenever a new sprite becomes available */
  constructor(onChange) {
    this.onChange = onChange;
    for (const [name, file] of Object.entries(TILE_IMAGE_FILES)) this.#load(name, file, false);
    for (const block of BLOCKS) this.#load(block.name, block.image, !block.implemented);
  }

  #load(name, file, dimmed) {
    const image = new Image();
    image.onload = () => {
      this.#sprites.set(name, dimmed ? makeDimmedSprite(image) : image);
      this.onChange();
    };
    image.src = imageUrl(file);
  }

  /** The drawable for a tile type or block name, or null if it has not loaded (yet). */
  get(name) {
    return this.#sprites.get(name) ?? null;
  }
}
