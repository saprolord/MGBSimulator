/**
 * The ship grid: a plain 2-D array `grid[row][col]` of tiles.
 *
 *   tile = { type, block, rotation }
 *     type      one of TILE.* (config.js)
 *     block     name of the modifier block on an EMPTY tile (or null)
 *     rotation  degrees: 0 | 90 | 180 | 270
 *
 * It is deliberately plain data (no classes) so it can be sent to the simulation worker as-is.
 */

import { GRID_SIZE, TILE } from '../config.js';

export const createTile = (type = TILE.EMPTY, block = null, rotation = 0) => ({ type, block, rotation });

/** The starting layout: walled-in ship, generator at the bottom, ejector at the top. */
export function createDefaultGrid(size = GRID_SIZE) {
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => createTile()));
  const last = size - 1;

  for (let r = 0; r < size; r++) {
    grid[r][0] = createTile(TILE.SOLID);
    grid[r][last - 1] = createTile(TILE.SOLID); // the ship is one column narrower than the
    grid[r][last] = createTile(TILE.SOLID); //     board: two wall columns on the right
  }
  for (let c = 0; c < size; c++) {
    grid[0][c] = createTile(TILE.SOLID);
    grid[last][c] = createTile(TILE.SOLID);
  }

  const middle = Math.floor(size / 2) - 1;
  grid[size - 2][middle] = createTile(TILE.GENERATOR);
  grid[1][middle] = createTile(TILE.EJECTOR);
  return grid;
}

export const inBounds = (grid, r, c) => r >= 0 && r < grid.length && c >= 0 && c < grid.length;

export const hasBlock = (tile) => tile.type === TILE.EMPTY && tile.block !== null;

/** Remove the block from a tile (no-op for non-empty tiles). */
export function removeBlock(tile) {
  tile.block = null;
  tile.rotation = 0;
}

/**
 * Remove every placed block, except those for which `keep(blockName)` is true.
 * Used by "Clear Entire Grid" (keep nothing) and "Clear Path" (keep directional blocks).
 */
export function clearBlocks(grid, keep = () => false) {
  for (const row of grid) {
    for (const tile of row) {
      if (hasBlock(tile) && !keep(tile.block)) removeBlock(tile);
    }
  }
}

// ---- Moving blocks between grids (used when switching ship) -----------------------------------

/** All placed blocks as [{ r, c, block, rotation }]. */
export function collectPlacements(grid) {
  const placements = [];
  grid.forEach((row, r) =>
    row.forEach((tile, c) => {
      if (hasBlock(tile)) placements.push({ r, c, block: tile.block, rotation: tile.rotation });
    }),
  );
  return placements;
}

/** Place blocks wherever the tile is an empty slot. Returns how many were placed. */
export function applyPlacements(grid, placements) {
  let placed = 0;
  for (const { r, c, block, rotation } of placements) {
    if (!inBounds(grid, r, c) || grid[r][c].type !== TILE.EMPTY) continue;
    grid[r][c].block = block;
    grid[r][c].rotation = rotation;
    placed++;
  }
  return placed;
}

/** Swap the contents of `grid` for `next`, keeping the same array object (views hold a reference). */
export function replaceGrid(grid, next) {
  grid.splice(0, grid.length, ...next);
}
