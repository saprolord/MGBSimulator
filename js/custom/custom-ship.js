/**
 * CUSTOM SHIP MODEL
 * =================
 * Pure logic (no DOM) for the custom ship builder.
 *
 *   layout  = { slots: [ { block: 'solid', rotation: 0 }, ... 16 of them, row by row ] }
 *             the player's choice of custom block (and its rotation) for each 3x3 slot
 *   grid    = the ordinary tile grid the engine runs on: 13 rows x 12 columns. Rows 0-11 are the
 *             12x12 board; row 12 is the extra row holding the generator. Normal items live on this
 *             grid like on any ship; the layout only decides the walls / empty space / ejectors.
 *
 * Changing a slot rewrites its 9 tiles. Items already placed on tiles that stay empty are kept;
 * items on tiles that turn into walls or ejectors are removed.
 */

import { TILE } from '../config.js';
import { createTile } from '../model/grid.js';
import { toDegrees } from '../headings.js';
import { CUSTOM_BLOCKS, CUSTOM_SETTINGS } from './custom-blocks.js';

const { slots: SLOTS, blockSize: SIZE } = CUSTOM_SETTINGS;
export const BOARD = SLOTS * SIZE; // 12
export const GRID_ROWS = BOARD + 1; // + the generator row
export const GRID_COLS = BOARD;
export const SLOT_COUNT = SLOTS * SLOTS;
export const SOLID_ID = 'solid';

const blocksById = new Map(CUSTOM_BLOCKS.map((block) => [block.id, block]));
const blocksByShareId = new Map(CUSTOM_BLOCKS.map((block) => [block.shareId, block]));

export const getCustomBlock = (id) => blocksById.get(id) ?? null;
export const isRotatable = (block) => block.rotatable === true;

const LEGEND = { '#': TILE.SOLID, '.': TILE.EMPTY, E: TILE.EJECTOR };

// ---- Validation (run once at load; problems are logged and tested) --------------------------------
export function validateCustomBlocks(blocks = CUSTOM_BLOCKS, settings = CUSTOM_SETTINGS) {
  const problems = [];
  const ids = new Set();
  const shareIds = new Set();
  for (const block of blocks) {
    if (!/^[a-z0-9_-]+$/.test(block.id ?? '')) problems.push(`Custom block "${block.id}": id must be lowercase letters, digits, - or _`);
    if (ids.has(block.id)) problems.push(`Duplicate custom block id "${block.id}"`);
    ids.add(block.id);
    if (!Number.isInteger(block.shareId) || block.shareId < 0 || block.shareId > 255) problems.push(`Custom block "${block.id}": shareId must be a whole number 0-255`);
    if (shareIds.has(block.shareId)) problems.push(`Duplicate custom block shareId ${block.shareId} ("${block.id}")`);
    shareIds.add(block.shareId);
    const { pattern } = block;
    const size = settings.blockSize;
    if (!Array.isArray(pattern) || pattern.length !== size || pattern.some((row) => typeof row !== 'string' || row.length !== size)) {
      problems.push(`Custom block "${block.id}": pattern must be ${size} strings of ${size} characters`);
    } else if (pattern.some((row) => [...row].some((ch) => !(ch in LEGEND)))) {
      problems.push(`Custom block "${block.id}": pattern may only use # . E`);
    }
  }
  const solid = blocks.find((block) => block.id === SOLID_ID);
  if (!solid) problems.push(`The "${SOLID_ID}" custom block is required (it is what every slot starts as)`);
  else if (solid.pattern.some((row) => /[^#]/.test(row))) problems.push(`The "${SOLID_ID}" block must be all walls`);
  if (!Number.isInteger(settings.generatorCol) || settings.generatorCol < 0 || settings.generatorCol >= settings.slots * settings.blockSize) {
    problems.push('generatorCol must be a whole number inside the board');
  }
  return problems;
}
export const CUSTOM_PROBLEMS = validateCustomBlocks();

// ---- Patterns ----------------------------------------------------------------------------------
/** Rotate a square pattern clockwise by `quarterTurns` quarter turns. */
export function rotatePattern(pattern, quarterTurns) {
  let rows = pattern.map((row) => [...row]);
  for (let turn = 0; turn < ((quarterTurns % 4) + 4) % 4; turn++) {
    rows = rows[0].map((_, c) => rows.map((row) => row[c]).reverse());
  }
  return rows.map((row) => row.join(''));
}

// ---- Layout and grid ---------------------------------------------------------------------------
export const createCustomLayout = () => ({
  slots: Array.from({ length: SLOT_COUNT }, () => ({ block: SOLID_ID, rotation: 0 })),
});

export const slotIndex = (slotRow, slotCol) => slotRow * SLOTS + slotCol;

/** Which slot a tile belongs to, or null for the generator row. */
export function slotOf(row, col) {
  if (row < 0 || row >= BOARD || col < 0 || col >= BOARD) return null;
  return { slotRow: Math.floor(row / SIZE), slotCol: Math.floor(col / SIZE) };
}

/** A grid for the layout: all slots stamped, plus the generator row. Items are not included. */
export function createCustomGrid(layout = createCustomLayout()) {
  const grid = Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => createTile(TILE.SOLID)));
  grid[BOARD][CUSTOM_SETTINGS.generatorCol] = createTile(TILE.GENERATOR, null, CUSTOM_SETTINGS.generatorFacing);
  layout.slots.forEach((slot, index) => stampSlot(grid, null, Math.floor(index / SLOTS), index % SLOTS, slot.block, slot.rotation));
  return grid;
}

/**
 * Put a custom block into a slot: rewrites the slot's tiles (and records the choice in `layout`
 * when one is given). Returns false if the block does not exist.
 */
export function stampSlot(grid, layout, slotRow, slotCol, blockId, rotation = 0) {
  const block = getCustomBlock(blockId);
  if (!block) return false;
  const turns = isRotatable(block) ? Math.round(rotation / 90) % 4 : 0;
  const pattern = rotatePattern(block.pattern, turns);

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const tile = grid[slotRow * SIZE + r][slotCol * SIZE + c];
      const type = LEGEND[pattern[r][c]];
      if (type === TILE.EMPTY && tile.type === TILE.EMPTY) continue; // stays empty: keep its item
      tile.type = type;
      tile.block = null;
      tile.rotation = 0;
    }
  }
  if (layout) layout.slots[slotIndex(slotRow, slotCol)] = { block: block.id, rotation: toDegrees(turns) };
  return true;
}

// ---- Share code ----------------------------------------------------------------------------------
/** 16 slots x 3 hex characters: [block shareId, 2 digits][rotation in quarter turns, 1 digit]. 48 characters. */
export function serializeCustomLayout(layout) {
  return layout.slots
    .map(({ block, rotation }) => getCustomBlock(block).shareId.toString(16).padStart(2, '0') + ((rotation / 90) % 4).toString(16))
    .join('');
}

/** Read a custom layout code. Returns a layout, or null if the code is not valid. */
export function parseCustomLayout(code) {
  if (typeof code !== 'string' || code.length !== SLOT_COUNT * 3 || !/^[0-9a-fA-F]+$/.test(code)) return null;
  const layout = createCustomLayout();
  for (let i = 0; i < SLOT_COUNT; i++) {
    const block = blocksByShareId.get(parseInt(code.slice(i * 3, i * 3 + 2), 16));
    if (!block) return null;
    const turns = parseInt(code[i * 3 + 2], 16) % 4;
    layout.slots[i] = { block: block.id, rotation: isRotatable(block) ? toDegrees(turns) : 0 };
  }
  return layout;
}
