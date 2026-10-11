/**
 * SHIP LOADER
 * ===========
 * Turns the text maps in js/ships.js into ready-to-use grids, validating each one. A broken map is
 * reported (SHIP_PROBLEMS) and left out of the dropdown instead of breaking the whole app.
 */

import { GRID_SIZE, TILE } from '../config.js';
import { SHIPS } from '../ships.js';
import { createTile } from './grid.js';

const generator = (rotation) => () => createTile(TILE.GENERATOR, null, rotation);
const LEGEND = {
  '#': () => createTile(TILE.SOLID),
  '.': () => createTile(),
  E: () => createTile(TILE.EJECTOR),
  '^': generator(0),
  '>': generator(90),
  v: generator(180),
  '<': generator(270),
};

const ID_PATTERN = /^[a-z0-9_-]+$/;

/**
 * Convert a text map into a size x size grid (centred, padded with walls). Throws a readable
 * Error if the map breaks the rules.
 */
export function parseShipMap(map, size = GRID_SIZE) {
  if (!Array.isArray(map) || map.length === 0) throw new Error('map must be a non-empty array of strings');
  if (!map.every((row) => typeof row === 'string')) throw new Error('every map row must be a string');

  const height = map.length;
  const width = map[0].length;
  if (map.some((row) => row.length !== width)) throw new Error('all map rows must have the same length');
  if (height > size || width > size) throw new Error(`map is ${width}x${height}, the board is ${size}x${size}`);

  const top = Math.floor((size - height) / 2);
  const leftPad = Math.floor((size - width) / 2);
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => createTile(TILE.SOLID)));

  let generators = 0;
  let ejectors = 0;
  map.forEach((row, r) => {
    [...row].forEach((char, c) => {
      const make = LEGEND[char];
      if (!make) throw new Error(`unknown character "${char}" (row ${r + 1}, column ${c + 1})`);
      const tile = make();
      if (tile.type === TILE.GENERATOR) generators++;
      if (tile.type === TILE.EJECTOR) ejectors++;
      grid[top + r][leftPad + c] = tile;
    });
  });

  if (generators !== 1) throw new Error(`needs exactly 1 generator, found ${generators}`);
  if (ejectors < 1) throw new Error('needs at least 1 ejector');
  return grid;
}

// ---- Registry: validate every ship once, at load time ------------------------------------------
const templates = new Map(); // id -> { name, grid }
export const SHIP_PROBLEMS = [];

for (const ship of SHIPS) {
  try {
    if (!ID_PATTERN.test(ship.id ?? '')) throw new Error('id must be lowercase letters, digits, - or _');
    if (templates.has(ship.id)) throw new Error('duplicate id');
    templates.set(ship.id, { name: ship.name, grid: parseShipMap(ship.map) });
  } catch (error) {
    SHIP_PROBLEMS.push(`Ship "${ship?.id ?? '?'}": ${error.message}`);
  }
}

/** [{ id, name }] for the dropdown, in file order (valid ships only). */
export const AVAILABLE_SHIPS = [...templates].map(([id, { name }]) => ({ id, name }));

export const hasShip = (id) => templates.has(id);

/** A fresh, independent grid for the ship (safe to edit). */
export function createGridForShip(id) {
  return templates.get(id).grid.map((row) => row.map((tile) => ({ ...tile })));
}
