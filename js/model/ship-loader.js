/**
 * SHIP LOADER
 * ===========
 * Turns the text maps in js/ships.js into ready-to-use grids, validating each one. A broken map is
 * reported (SHIP_PROBLEMS) and left out of the dropdown instead of breaking the whole app.
 */

import { GAME_CODE_OFFSET, GRID_SIZE, TILE } from '../config.js';
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

/** Where the top-left corner of a text map lands on the board (maps are centred). */
export function mapOrigin(map, size = GRID_SIZE) {
  return { r: Math.floor((size - map.length) / 2), c: Math.floor((size - map[0].length) / 2) };
}

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

  const { r: top, c: leftPad } = mapOrigin(map, size);
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
const templates = new Map(); // id -> { name, grid, gameId, origin, width, height }
const gameIds = new Map(); // in-game ship ID -> our ship id

export const SHIP_PROBLEMS = [];

for (const ship of SHIPS) {
  try {
    if (!ID_PATTERN.test(ship.id ?? '')) throw new Error('id must be lowercase letters, digits, - or _');
    if (templates.has(ship.id)) throw new Error('duplicate id');
    const grid = parseShipMap(ship.map);
    // The in-game ship number: given explicitly, or taken from the id when it is a 3-digit number (e.g. '031').
    const gameId = ship.gameId ?? (/^\d{3}$/.test(ship.id) ? Number(ship.id) : null);
    if (gameId !== null) {
      if (!Number.isInteger(gameId) || gameId < 0 || gameId > 999) throw new Error('gameId must be a whole number 0-999');
      if (gameIds.has(gameId)) throw new Error(`gameId ${gameId} is already used by "${gameIds.get(gameId)}"`);
    }
    const fireRate = ship.fireRate ?? 1; // shown in the Fire Rate box whenever this ship is selected
    if (!Number.isFinite(fireRate) || fireRate < 0) throw new Error('fireRate must be a number, 0 or more');

    templates.set(ship.id, {
      name: ship.name,
      grid,
      gameId,
      fireRate,
      origin: mapOrigin(ship.map),
      width: ship.map[0].length,
      height: ship.map.length,
    });
    if (gameId !== null) gameIds.set(gameId, ship.id);

  } catch (error) {
    SHIP_PROBLEMS.push(`Ship "${ship?.id ?? '?'}": ${error.message}`);
  }
}

/** [{ id, name }] for the dropdown, in file order (valid ships only). */
export const AVAILABLE_SHIPS = [...templates].map(([id, { name }]) => ({ id, name }));

export const hasShip = (id) => templates.has(id);

/** { id, name, gameId (or null), fireRate, origin: { r, c }, width, height } for a ship, or null. */
export function getShipInfo(id) {
  const t = templates.get(id);
  if (!t) return null;
  // `origin` = board position of game-code tile (0,0): the map's corner plus the code offset.
  const origin = { r: t.origin.r + GAME_CODE_OFFSET.r, c: t.origin.c + GAME_CODE_OFFSET.c };
  return { id, name: t.name, gameId: t.gameId, fireRate: t.fireRate, origin, width: t.width, height: t.height };
}

/** Our ship id for an in-game ship number, or null. */
export const findShipIdByGameId = (gameId) => gameIds.get(gameId) ?? null;

/** A fresh, independent grid for the ship (safe to edit). */
export function createGridForShip(id) {
  return templates.get(id).grid.map((row) => row.map((tile) => ({ ...tile })));
}
