/** Run with:  node --test   (custom ship: slots, patterns, share code, simulation) */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD, GRID_ROWS, GRID_COLS, CUSTOM_PROBLEMS, createCustomGrid, createCustomLayout, stampSlot, slotOf,
  rotatePattern, serializeCustomLayout, parseCustomLayout, validateCustomBlocks, getCustomBlock,
} from '../js/custom/custom-ship.js';
import { CUSTOM_BLOCKS, CUSTOM_SETTINGS } from '../js/custom/custom-blocks.js';
import { Simulation, traceGrid } from '../js/engine/index.js';
import { buildHash, parseHash } from '../js/model/share-code.js';
import { TILE } from '../js/config.js';

const OPEN = 'example-open';
const EXIT = 'example-exit';
const PIPE = 'example-pipe';
const ev = (grid, params = {}) => {
  const sim = new Simulation(grid, { trials: 20, ...params });
  sim.run(20);
  return sim.result().ev;
};
const count = (grid, type) => grid.flat().filter((tile) => tile.type === type).length;

/** A ship whose column of slots above the generator is open, with an exit at the top. */
function workingShip() {
  const layout = createCustomLayout();
  const grid = createCustomGrid(layout);
  const slotCol = Math.floor(CUSTOM_SETTINGS.generatorCol / 3);
  for (const slotRow of [3, 2, 1]) stampSlot(grid, layout, slotRow, slotCol, OPEN);
  stampSlot(grid, layout, 0, slotCol, EXIT);
  return { layout, grid };
}

test('the custom block data has no mistakes', () => {
  assert.deepEqual(CUSTOM_PROBLEMS, []);
});

test('the validator catches typical mistakes', () => {
  const bad = (blocks) => validateCustomBlocks(blocks, CUSTOM_SETTINGS).join();
  const solid = CUSTOM_BLOCKS[0];
  assert.match(bad([solid, { id: 'a', shareId: 9, pattern: ['##', '##'] }]), /3 strings of 3/);
  assert.match(bad([solid, { id: 'a', shareId: 9, pattern: ['#x#', '###', '###'] }]), /only use/);
  assert.match(bad([solid, { id: 'a', shareId: 0, pattern: ['###', '###', '###'] }]), /Duplicate custom block shareId/);
  assert.match(bad([solid, { ...solid, shareId: 7 }]), /Duplicate custom block id/);
  assert.match(bad([{ id: 'a', shareId: 1, pattern: ['...', '...', '...'] }]), /required/);
  assert.match(bad([{ ...solid, pattern: ['###', '#.#', '###'] }]), /all walls/);
  assert.match(validateCustomBlocks(CUSTOM_BLOCKS, { ...CUSTOM_SETTINGS, generatorCol: 40 }).join(), /generatorCol/);
});

test('a fresh custom ship is 13 x 12, all walls, with the generator in the extra row', () => {
  const grid = createCustomGrid();
  assert.equal(grid.length, GRID_ROWS);
  assert.equal(grid[0].length, GRID_COLS);
  assert.equal(GRID_ROWS, 13);
  assert.equal(count(grid, TILE.GENERATOR), 1);
  assert.equal(grid[BOARD][CUSTOM_SETTINGS.generatorCol].type, TILE.GENERATOR);
  assert.equal(count(grid, TILE.EMPTY), 0);
  assert.equal(count(grid, TILE.EJECTOR), 0);
});

test('slots: tiles map to the right 3x3 slot, the generator row to none', () => {
  assert.deepEqual(slotOf(0, 0), { slotRow: 0, slotCol: 0 });
  assert.deepEqual(slotOf(2, 2), { slotRow: 0, slotCol: 0 });
  assert.deepEqual(slotOf(3, 5), { slotRow: 1, slotCol: 1 });
  assert.deepEqual(slotOf(11, 11), { slotRow: 3, slotCol: 3 });
  assert.equal(slotOf(12, 5), null);
});

test('stamping a block rewrites exactly its 9 tiles', () => {
  const grid = createCustomGrid();
  stampSlot(grid, null, 1, 2, OPEN);
  const emptyTiles = [];
  grid.forEach((row, r) => row.forEach((tile, c) => { if (tile.type === TILE.EMPTY) emptyTiles.push([r, c]); }));
  assert.equal(emptyTiles.length, 9);
  assert.ok(emptyTiles.every(([r, c]) => r >= 3 && r <= 5 && c >= 6 && c <= 8));
});

test('rotation turns the pattern clockwise, and four turns come back', () => {
  assert.deepEqual(rotatePattern(['#..', '#..', '###'], 1), ['###', '#..', '#..']);
  assert.deepEqual(rotatePattern(['#..', '#..', '###'], 4), ['#..', '#..', '###']);
  assert.deepEqual(rotatePattern(['..E', '...', '...'], 1), ['...', '...', '..E']);
});

test('stamping with a rotation is remembered in the layout', () => {
  const layout = createCustomLayout();
  const grid = createCustomGrid(layout);
  stampSlot(grid, layout, 0, 0, EXIT, 90);
  assert.deepEqual(layout.slots[0], { block: EXIT, rotation: 90 });
  assert.equal(grid[2][2].type, TILE.EJECTOR); // the ejector moved from the top-right to the bottom-right
  assert.equal(grid[0][2].type, TILE.EMPTY);
});

test('items on tiles that stay empty are kept; items on tiles that become walls are removed', () => {
  const layout = createCustomLayout();
  const grid = createCustomGrid(layout);
  stampSlot(grid, layout, 1, 1, OPEN);
  grid[3][3].block = 'Clone'; // slot (1,1) top-left tile
  grid[4][4].block = 'Add 1 Damage'; // centre tile

  stampSlot(grid, layout, 1, 1, PIPE); // pipe keeps only the middle column empty
  assert.equal(grid[3][3].block, null, 'left column became a wall');
  assert.equal(grid[3][3].type, TILE.SOLID);
  assert.equal(grid[4][4].block, 'Add 1 Damage', 'centre tile is still empty, item kept');

  stampSlot(grid, layout, 1, 1, 'solid');
  assert.equal(grid[4][4].block, null);
});

test('an unknown custom block is refused', () => {
  assert.equal(stampSlot(createCustomGrid(), null, 0, 0, 'nope'), false);
});

test('share code: 48 characters, round-trips every slot and rotation', () => {
  const { layout } = workingShip();
  layout.slots[5] = { block: EXIT, rotation: 270 };
  const code = serializeCustomLayout(layout);
  assert.equal(code.length, 48);
  assert.deepEqual(parseCustomLayout(code), layout);
  assert.deepEqual(createCustomGrid(parseCustomLayout(code)).map((row) => row.map((t) => t.type)),
                   createCustomGrid(layout).map((row) => row.map((t) => t.type)));
});

test('share code: bad codes are rejected', () => {
  assert.equal(parseCustomLayout('abc'), null);
  assert.equal(parseCustomLayout('z'.repeat(48)), null);
  assert.equal(parseCustomLayout('ff0'.repeat(16)), null); // block shareId 255 does not exist
  assert.equal(parseCustomLayout(null), null);
});

test('url: custom ships use #custom=...&build=...', () => {
  assert.equal(buildHash(null, '41030', 'AB'.repeat(24)), `#custom=${'AB'.repeat(24)}&build=41030`);
  assert.equal(buildHash(null, '', 'AB'.repeat(24)), `#custom=${'AB'.repeat(24)}`);
  assert.deepEqual(parseHash('#custom=abc&build=41030'), { shipId: 'default', code: '41030', custom: 'abc' });
  assert.equal(parseHash('#build=41030').custom, null);
  assert.equal(parseHash('#ship=000').custom, null);
});

test('a custom ship works end to end: path preview and damage', () => {
  const { grid } = workingShip();
  const paths = traceGrid(grid);
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0][0], { r: 12, c: CUSTOM_SETTINGS.generatorCol }); // starts in the generator row
  assert.equal(paths[0].at(-1).r, 0); // ends at the ejector in the top row
  assert.equal(ev(grid), 1);

  grid[7][CUSTOM_SETTINGS.generatorCol].block = 'Add 1 Damage'; // an item inside the open slots
  assert.equal(ev(grid), 2);
});

test('a wall in the way stops the projectile; a custom ship with no open slots deals nothing', () => {
  assert.equal(ev(createCustomGrid()), 0);
  const { layout, grid } = workingShip();
  stampSlot(grid, layout, 2, Math.floor(CUSTOM_SETTINGS.generatorCol / 3), 'solid');
  assert.equal(ev(grid), 0);
});

test('perks and skills (tuning) apply to custom ships too', () => {
  const { grid } = workingShip();
  grid[7][CUSTOM_SETTINGS.generatorCol].block = 'Add 100 Damage';
  assert.equal(ev(grid, { baseDamage: 3, tuning: { addDamageLarge: 10 } }), 13);
});

test('every example block is reachable by shareId', () => {
  for (const block of CUSTOM_BLOCKS) assert.equal(getCustomBlock(block.id), block);
});
