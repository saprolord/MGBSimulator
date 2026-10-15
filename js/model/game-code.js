 /**
 * IN-GAME SHIP CODE
 * =================
 * The game lets players copy / paste a ship as a 366-digit number:
 *
 *     SSS  TTO TTO TTO ...            (3  121 x 3 = 366 digits, no separators)
 *     |    |||
 *     |    ||`-- O  orientation: 0 = up, 1 = right, 2 = down, 3 = left
 *     |    ``--- TT item / tile ID (00-99), see js/game-ids.js
 *     `--------- SSS ship ID (see `gameId` in js/ships.js)
 *
 * The 121 triplets are the ship's 11 x 11 tiles, row by row from the top-left corner.
 *
 * HOW IT MAPS ONTO OUR BOARD
 *  - The ship ID selects one of our ship presets, which supplies the walls, ejectors and generator.
 *    Only the BLOCKS in the code are imported; terrain tiles in the code are not re-read.
 *  - The 11 x 11 code grid is aligned with the top-left corner of the ship's text map
 *    (which is why ships should be authored as the game's full 11 x 11 grid).
 *
 * This module has no DOM and no side effects. createGameCodec() takes its data as arguments so it
 * can be unit-tested with made-up IDs; the ready-made `gameCodec` at the bottom uses the real data.
 */

import { TILE } from '../config.js';
import { getBlock } from '../blocks.js';
import { TILE_GAME_IDS, BLOCK_GAME_IDS } from '../game-ids.js';
import { getShipInfo, findShipIdByGameId } from './ship-loader.js';

export const CODE_GRID = 11; // tiles per side in the game's code
export const CODE_LENGTH = 3 + CODE_GRID * CODE_GRID * 3; // 366

/** An error whose message is meant to be shown to the user as-is. */
export class GameCodeError extends Error {}

/**
 * @param {object} data
 * @param {Record<string, number|null>} data.tileIds    tile type name  -> game ID
 * @param {Record<string, number|null>} data.blockIds   block name      -> game ID
 * @param {{ info(shipId): object|null, idByGameId(n): string|null }} data.ships
 */
export function createGameCodec({ tileIds, blockIds, ships }) {
  const problems = [];
  const idByName = new Map(); // name -> id        (for export)
  const entryById = new Map(); // id -> { kind, name } (for import)

  const register = (kind, table) => {
    for (const [name, id] of Object.entries(table)) {
      if (id === null || id === undefined) continue;
      if (!Number.isInteger(id) || id < 0 || id > 99) {
        problems.push(`Game ID for "${name}" must be a whole number 0-99 (got ${id}).`);
      } else if (entryById.has(id)) {
        problems.push(`Game ID ${id} is used by both "${entryById.get(id).name}" and "${name}".`);
      } else {
        idByName.set(name, id);
        entryById.set(id, { kind, name });
      }
    }
  };
  register('tile', tileIds);
  register('block', blockIds);

  // ---------------------------------------------------------------------------------------------
  /**
   * Read a pasted code. Does NOT touch any grid.
   * @returns {{ shipId: string, placements: {r,c,block,rotation}[], unknownItems: number, badOrientations: number }}
   * @throws {GameCodeError} if the code is not usable at all
   */
  function importCode(text) {
    const digits = String(text ?? '').replace(/\s+/g, '');
    if (digits === '') throw new GameCodeError('Paste a game ship code first.');
    if (!/^\d+$/.test(digits)) throw new GameCodeError('A game code contains digits only.');
    if (digits.length !== CODE_LENGTH) {
      throw new GameCodeError(`A game code has ${CODE_LENGTH} digits (this one has ${digits.length}).`);
    }


    const gameShipId = Number(digits.slice(0, 3));
    const shipId = ships.idByGameId(gameShipId);
    if (shipId === null) throw new GameCodeError(`Unknown ship ID ${digits.slice(0, 3)}: no matching ship in the simulator yet.`);
    const { origin } = ships.info(shipId);

    const placements = [];
    let unknownItems = 0;
    let badOrientations = 0;

    for (let i = 0; i < CODE_GRID * CODE_GRID; i++) {
      const start = 3 + i * 3;
      const id = Number(digits.slice(start, start + 2));
      const orientation = Number(digits[start + 2]);
      const entry = entryById.get(id);

      if (!entry) {
        unknownItems++;
        continue;
      }
      if (entry.kind !== 'block') continue; // terrain comes from the ship preset
      if (orientation > 3) {
        badOrientations++;
        continue;
      }
      if (!getBlock(entry.name)) continue; // listed in game-ids.js but not defined in blocks.js

      placements.push({
        r: origin.r + Math.floor(i / CODE_GRID),
        c: origin.c + (i % CODE_GRID),
        block: entry.name,
        rotation: orientation * 90,
      });
    }
    return { shipId, placements, unknownItems, badOrientations };
  }

  // ---------------------------------------------------------------------------------------------
  /**
   * Write the build as a game code.
   * @param {object[][]} grid
   * @param {string} shipId  the ship the grid is based on
   * @throws {GameCodeError} if the ship has no game ID or a needed item ID is not filled in
   */
  function exportCode(grid, shipId) {
    const info = ships.info(shipId);
    if (!info) throw new GameCodeError('Unknown ship.');
    if (info.gameId === null) {
      throw new GameCodeError(`"${info.name}" has no game ID yet. Add gameId to its entry in js/ships.js.`);
    }

    const missing = new Set();
    const idOf = (name) => {
      const id = idByName.get(name);
      if (id === undefined) missing.add(name);
      return id ?? 0;
    };

    let code = String(info.gameId).padStart(3, '0');
    for (let r = 0; r < CODE_GRID; r++) {
      for (let c = 0; c < CODE_GRID; c++) {
        const tile = grid[info.origin.r + r]?.[info.origin.c + c] ?? { type: TILE.SOLID, block: null, rotation: 0 };

        let name = tile.type;
        let quarterTurns = 0;
        if (tile.type === TILE.EMPTY && tile.block !== null) {
          name = tile.block;
          quarterTurns = Math.round(tile.rotation / 90) % 4;
        } else if (tile.type === TILE.GENERATOR) {
          quarterTurns = Math.round(tile.rotation / 90) % 4;
        }
        code += String(idOf(name)).padStart(2, '0') + quarterTurns;
      }
    }

    if (missing.size > 0) {
      throw new GameCodeError(`Cannot export yet: no game ID for ${[...missing].join(', ')} (see js/game-ids.js).`);
    }
    return code;
  }

  return { importCode, exportCode, problems };
}

// ---- The real thing ---------------------------------------------------------------------------
export const gameCodec = createGameCodec({
  tileIds: TILE_GAME_IDS,
  blockIds: BLOCK_GAME_IDS,
  ships: { info: getShipInfo, idByGameId: findShipIdByGameId },
});