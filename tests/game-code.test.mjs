/** Run with:  node --test   (in-game 366-digit ship codes) */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGameCodec, GameCodeError, CODE_LENGTH } from '../js/model/game-code.js';
import { gameCodec } from '../js/model/game-code.js';
import { parseShipMap, mapOrigin } from '../js/model/ship-loader.js';
import { applyPlacements } from '../js/model/grid.js';
import { BLOCKS } from '../js/blocks.js';
import { TILE_GAME_IDS, BLOCK_GAME_IDS } from '../js/game-ids.js';
import { SHIPS } from '../js/ships.js';
import { createGridForShip, getShipInfo } from '../js/model/ship-loader.js';
import { GAME_CODE_OFFSET } from '../js/config.js';

// ---- Made-up data so the codec can be tested before the real IDs are filled in -------------
const TILE_IDS = { 'Empty Slot': 0, 'Solid Block': 1, 'Ejection Block': 2, 'Projectile Generator': 3 };
const BLOCK_IDS = { Clone: 10, 'Add 1 Damage': 11, 'Input Portal': 12, 'Output Portal': 13, 'Guide Right': 14 };

const map11 = [
  '###########',
  '#....E....#',
  ...Array(7).fill('#.........#'),
  '#....^....#',
  '###########',
];
const map7 = ['#######', '#..E..#', '#.....#', '#.....#', '#.....#', '#..^..#', '#######'];

const FAKE_SHIPS = {
  full: { id: 'full', name: 'Full', gameId: 123, origin: mapOrigin(map11), map: map11 },
  small: { id: 'small', name: 'Small', gameId: 7, origin: mapOrigin(map7), map: map7 },
  nogame: { id: 'nogame', name: 'No ID', gameId: null, origin: { r: 0, c: 0 }, map: map11 },
};
const ships = {
  info: (id) => FAKE_SHIPS[id] ?? null,
  idByGameId: (n) => Object.values(FAKE_SHIPS).find((s) => s.gameId === n)?.id ?? null,
};
const codec = createGameCodec({ tileIds: TILE_IDS, blockIds: BLOCK_IDS, ships });
const gridFor = (shipId) => parseShipMap(FAKE_SHIPS[shipId].map);

/** Build a code by hand: ship + a list of [row, col, id, orientation] over an all-empty 11x11 grid. */
function handCode(shipDigits, items) {
  const tiles = Array(121).fill('000');
  for (const [r, c, id, o] of items) tiles[r * 11 + c] = String(id).padStart(2, '0') + o;
  return shipDigits + tiles.join('');
}

// ---------------------------------------------------------------------------------------------
test('an exported code is 366 digits and starts with the ship ID', () => {
  const code = codec.exportCode(gridFor('full'), 'full');
  assert.equal(code.length, CODE_LENGTH);
  assert.equal(CODE_LENGTH, 366);
  assert.match(code, /^\d+$/);
  assert.equal(code.slice(0, 3), '123');
});

test('digit layout: ship ID, then row-by-row triplets of [2-digit ID][orientation]', () => {
  const grid = gridFor('full');
  grid[5][3].block = 'Clone';
  grid[5][3].rotation = 270; // orientation 3
  const code = codec.exportCode(grid, 'full');
  const start = 3 + (5 * 11 + 3) * 3; // row 5, column 3
  assert.equal(code.slice(start, start + 3), '103');
  assert.equal(code.slice(3, 6), '010'); // top-left corner: a wall (ID 01), orientation 0
  const gen = 3 + (9 * 11 + 5) * 3; // generator facing up
  assert.equal(code.slice(gen, gen + 3), '030');
});

test('export then import gives back the same blocks and rotations', () => {
  const grid = gridFor('full');
  const blocks = [
    [2, 2, 'Clone', 0], [3, 4, 'Add 1 Damage', 90], [5, 5, 'Input Portal', 180], [6, 6, 'Output Portal', 270], [8, 9, 'Guide Right', 90],
  ];
  for (const [r, c, block, rotation] of blocks) {
    grid[r][c].block = block;
    grid[r][c].rotation = rotation;
  }
  const result = codec.importCode(codec.exportCode(grid, 'full'));
  assert.equal(result.shipId, 'full');
  assert.equal(result.unknownItems, 0);
  assert.deepEqual(
    result.placements.map((p) => [p.r, p.c, p.block, p.rotation]).sort(),
    blocks.map((b) => [...b]).sort(),
  );
});

test('the 11x11 code grid is aligned with the top-left of the ship map (offset for smaller maps)', () => {
  // Small ship's map is centred on the board, so its origin is (2, 2).
  const result = codec.importCode(handCode('007', [[0, 0, 10, 1], [3, 4, 11, 2]]));
  assert.equal(result.shipId, 'small');
  assert.deepEqual(result.placements.map((p) => [p.r, p.c, p.block, p.rotation]), [
    [2, 2, 'Clone', 90],
    [5, 6, 'Add 1 Damage', 180],
  ]);
});

test('spaces and line breaks in a pasted code are ignored', () => {
  const code = handCode('123', [[4, 4, 10, 0]]);
  const spaced = code.replace(/(.{30})/g, '$1 \n');
  assert.deepEqual(codec.importCode(spaced), codec.importCode(code));
});

test('importing only reads blocks; terrain comes from the ship preset', () => {
  const result = codec.importCode(handCode('123', [[0, 0, 1, 0], [1, 5, 2, 0], [9, 5, 3, 0], [4, 4, 10, 0]]));
  assert.equal(result.placements.length, 1);
});

test('unknown item IDs and bad orientations are counted and skipped, not fatal', () => {
  const result = codec.importCode(handCode('123', [[4, 4, 99, 0], [4, 5, 10, 7], [4, 6, 10, 0]]));
  assert.equal(result.unknownItems, 1);
  assert.equal(result.badOrientations, 1);
  assert.equal(result.placements.length, 1);
});

test('unusable codes are rejected with a readable message', () => {
  const ok = handCode('123', []);
  assert.throws(() => codec.importCode(''), GameCodeError);
  assert.throws(() => codec.importCode(ok + '0'), /366 digits \(this one has 367\)/);
  assert.throws(() => codec.importCode('12a' + ok.slice(3)), /digits only/);
  assert.throws(() => codec.importCode(handCode('999', [])), /Unknown ship ID 999/);
});

test('export explains what is missing instead of writing a wrong code', () => {
  assert.throws(() => codec.exportCode(gridFor('nogame'), 'nogame'), /no game ID yet/);

  const grid = gridFor('full');
  grid[4][4].block = 'Charge'; // has no ID in the made-up table
  assert.throws(() => codec.exportCode(grid, 'full'), /no game ID for Charge/);
});

test('imported placements respect the one-portal-per-ship rule when applied', () => {
  const result = codec.importCode(handCode('123', [[3, 3, 12, 0], [4, 4, 12, 0]]));
  assert.equal(applyPlacements(gridFor('full'), result.placements), 1);
});

test('duplicate or out-of-range IDs are reported', () => {
  const bad = createGameCodec({ tileIds: { 'Solid Block': 5 }, blockIds: { Clone: 5, 'Add 1 Damage': 100 }, ships });
  assert.equal(bad.problems.length, 2);
});

// ---- The real tables --------------------------------------------------------------------------
test('real game-ids.js: no duplicates or out-of-range numbers', () => {
  assert.deepEqual(gameCodec.problems, []);
});

test('real game-ids.js: every block in blocks.js has an ID (checked once you start filling it in)', (t) => {
  const filled = [...Object.values(TILE_GAME_IDS), ...Object.values(BLOCK_GAME_IDS)].some((id) => id !== null);
  if (!filled) return t.skip('game-ids.js is still empty');

  const missing = [
    ...Object.keys(TILE_GAME_IDS).filter((name) => TILE_GAME_IDS[name] === null),
    ...BLOCKS.map((b) => b.name).filter((name) => BLOCK_GAME_IDS[name] == null),
  ];
  assert.deepEqual(missing, [], 'these still need a game ID in js/game-ids.js');
  const unknown = Object.keys(BLOCK_GAME_IDS).filter((name) => !BLOCKS.some((b) => b.name === name));
  assert.deepEqual(unknown, [], 'these names in game-ids.js do not exist in blocks.js');
});

test('real ships: if any ship has a gameId, all of them should (checked once you start filling it in)', (t) => {
  const withId = SHIPS.filter((s) => s.gameId != null);
  if (withId.length === 0) return t.skip('no ship has a gameId yet');
  const without = SHIPS.filter((s) => s.gameId == null && !s.id.startsWith('example') && s.id !== 'default').map((s) => s.id);
  assert.deepEqual(without, [], 'these ships still need a gameId in js/ships.js');
});

test('real ships: exported codes put the generator and ejectors where the map says (alignment check)', (t) => {
  const filled = Object.values(TILE_GAME_IDS).every((id) => id !== null);
  if (!filled) return t.skip('tile IDs are not filled in yet');

  const generatorId = TILE_GAME_IDS['Projectile Generator'];
  const ejectorId = TILE_GAME_IDS['Ejection Block'];
  const idAt = (code, tile) => Number(code.slice(3 + tile * 3, 5 + tile * 3));

  for (const ship of SHIPS) {
    const info = getShipInfo(ship.id);
    if (!info || info.gameId === null) continue;
    const code = gameCodec.exportCode(createGridForShip(ship.id), ship.id);

    // Count generator / ejector characters of the text map that fall inside the 11x11 code window.
    let mapGenerators = 0, mapEjectors = 0;
    ship.map.forEach((row, r) => [...row].forEach((ch, c) => {
      const inside = r >= GAME_CODE_OFFSET.r && r < GAME_CODE_OFFSET.r + 11 && c >= GAME_CODE_OFFSET.c && c < GAME_CODE_OFFSET.c + 11;
      if (!inside) return;
      if ('^>v<'.includes(ch)) mapGenerators++;
      if (ch === 'E') mapEjectors++;
    }));
    const tiles = Array.from({ length: 121 }, (_, i) => idAt(code, i));
    assert.equal(tiles.filter((id) => id === generatorId).length, mapGenerators, `${ship.id}: generators`);
    assert.equal(tiles.filter((id) => id === ejectorId).length, mapEjectors, `${ship.id}: ejectors`);
  }
});
