/**
 * SHIP COMPILER
 * =============
 * Converts the editable grid (array of tile objects) into flat typed arrays that the path tracer
 * and the simulation can read without any string comparisons, object lookups or bounds maths.
 *
 * Cells are addressed by a flat index:  cell = row * size + col
 */

import { TILE } from '../config.js';
import { getBlock } from '../blocks.js';
import { fromDegrees, ROW_STEP, COL_STEP } from '../headings.js';

/** What a projectile meets when it enters a cell. */
export const KIND = Object.freeze({
  FREE: 0, // empty slot, no block: projectile flies straight through
  BLOCK: 1, // empty slot holding a modifier block
  SOLID: 2, // wall: projectile stops
  EJECTOR: 3, // projectile is ejected and deals its damage
  INERT: 4, // generator (or anything unknown): projectile is swallowed
});

export function compileShip(grid) {
  const size = grid.length;
  const cellCount = size * size;

  const kind = new Uint8Array(cellCount); // KIND.*
  const rot = new Uint8Array(cellCount); // block facing, as a heading
  const block = new Array(cellCount).fill(null); // block definition per cell (or null)
  const next = new Int32Array(cellCount * 4).fill(-1); // next[cell * 4 + heading] -> cell, or -1 = off-grid

  let emitter = null;
  const ejectors = [];
  let emptyCount = 0;
  let hasStockpile = false;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = r * size + c;
      const tile = grid[r][c];

      switch (tile.type) {
        case TILE.EMPTY:
          if (tile.block) {
            kind[cell] = KIND.BLOCK;
            block[cell] = getBlock(tile.block); // null for unknown names -> acts as a wall
            rot[cell] = fromDegrees(tile.rotation);
            if (tile.block === 'Damage Stockpile') hasStockpile = true;
          } else {
            kind[cell] = KIND.FREE;
            emptyCount++;
          }
          break;
        case TILE.SOLID:
          kind[cell] = KIND.SOLID;
          break;
        case TILE.EJECTOR:
          kind[cell] = KIND.EJECTOR;
          ejectors.push(cell);
          break;
        case TILE.GENERATOR:
          kind[cell] = KIND.INERT;
          if (emitter === null) emitter = { cell, heading: fromDegrees(tile.rotation) };
          break;
        default:
          kind[cell] = KIND.INERT;
      }

      for (let h = 0; h < 4; h++) {
        const nr = r + ROW_STEP[h];
        const nc = c + COL_STEP[h];
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) next[cell * 4 + h] = nr * size + nc;
      }
    }
  }

  return { size, cellCount, kind, rot, block, next, emitter, ejectors, emptyCount, hasStockpile };
}

/** Damage Stockpile: +10 % damage for every empty tile, applied when the projectile is ejected. */
export const unusedDamageBonus = (ship) => (ship.hasStockpile ? ship.emptyCount * 0.1 : 0);
