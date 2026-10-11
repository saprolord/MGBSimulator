/**
 * SHARE CODES
 * ===========
 * A build is stored in the URL hash as `#build=<code>`.
 *
 * Every placed block is exactly 5 hex characters, so no delimiters are needed:
 *
 *     TT BB R
 *     |  |  `-- rotation in quarter-turns (0 = 0deg, 1 = 90deg, 2 = 180deg, 3 = 270deg)
 *     |  `----- block shareId (see blocks.js)
 *     `-------- tile index = row * GRID_SIZE + col
 *
 * This format is a public contract: links people already shared must keep working.
 * Never change a block's shareId and never change this layout without a version prefix.
 *
 * The page URL hash combines the ship and the blocks:
 *     #ship=<shipId>&build=<code>     any ship
 *     #build=<code>                   the default ship (the original, pre-ships link format)
 *     #ship=<shipId>                  a ship with no blocks
 */

import { GRID_SIZE, TILE } from '../config.js';
import { getBlock, getBlockByShareId } from '../blocks.js';
import { fromDegrees, toDegrees } from '../headings.js';
import { DEFAULT_SHIP_ID } from '../ships.js';
import { hasBlock, clearBlocks, applyPlacements } from './grid.js';

const CHUNK = 5;
const hex = (n, width) => n.toString(16).padStart(width, '0');

export function serializeLayout(grid) {
  let code = '';
  grid.forEach((row, r) => {
    row.forEach((tile, c) => {
      if (!hasBlock(tile)) return;
      const block = getBlock(tile.block);
      if (!block) return;
      code += hex(r * GRID_SIZE + c, 2) + hex(block.shareId, 2) + hex(fromDegrees(tile.rotation), 1);
    });
  });
  return code;
}

/**
 * Parse a share code into placements WITHOUT touching the grid.
 * Returns an array of { r, c, block, rotation } or null if the code is malformed.
 */
export function parseLayout(code, size = GRID_SIZE) {
  if (!code || code.length % CHUNK !== 0 || !/^[0-9a-fA-F]+$/.test(code)) return null;

  const placements = [];
  for (let i = 0; i < code.length; i += CHUNK) {
    const tileIndex = parseInt(code.slice(i, i + 2), 16);
    const block = getBlockByShareId(parseInt(code.slice(i + 2, i + 4), 16));
    const quarterTurns = parseInt(code.slice(i + 4, i + 5), 16);
    if (!block) continue;
    placements.push({
      r: Math.floor(tileIndex / size),
      c: tileIndex % size,
      block: block.name,
      rotation: toDegrees(quarterTurns % 4),
    });
  }
  return placements;
}

/**
 * Replace the blocks on `grid` with the build described by `code`.
 * Returns true if at least one block was placed. An invalid code leaves the grid untouched.
 */
export function applyLayout(grid, code) {
  const placements = parseLayout(code, grid.length);
  if (!placements) return false;

  const valid = placements.filter(({ r, c }) => r < grid.length && c < grid.length && grid[r][c].type === TILE.EMPTY);
  if (valid.length === 0) return false;

  clearBlocks(grid);
  applyPlacements(grid, valid);
  return true;
}

// ---- URL hash ------------------------------------------------------------------------------

/** The hash for the current ship + build ('' when there is nothing worth sharing). */
export function buildHash(shipId, code) {
  const parts = [];
  if (shipId !== DEFAULT_SHIP_ID) parts.push(`ship=${shipId}`);
  if (code) parts.push(`build=${code}`);
  return parts.length ? `#${parts.join('&')}` : '';
}

/** Read a URL hash. Returns { shipId, code } or null if it holds neither a ship nor a build. */
export function parseHash(hash) {
  if (!hash.startsWith('#')) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has('ship') && !params.has('build')) return null;
  return { shipId: params.get('ship') ?? DEFAULT_SHIP_ID, code: params.get('build') ?? '' };
}
