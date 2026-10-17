/** Run with:  node --test   (covers ship presets and the ship-aware share links) */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SHIPS, DEFAULT_SHIP_ID } from '../js/ships.js';
import { parseShipMap, createGridForShip, hasShip, AVAILABLE_SHIPS, SHIP_PROBLEMS } from '../js/model/ship-loader.js';
import { createDefaultGrid, collectPlacements, applyPlacements, replaceGrid } from '../js/model/grid.js';
import { buildHash, parseHash, serializeLayout } from '../js/model/share-code.js';
import { Simulation, traceGrid } from '../js/engine/index.js';

const count = (grid, type) => grid.flat().filter((tile) => tile.type === type).length;

test('every ship in js/ships.js is valid (a failure here names the broken ship)', () => {
  assert.deepEqual(SHIP_PROBLEMS, []);
  assert.equal(AVAILABLE_SHIPS.length, SHIPS.length);
});

test('every ship has exactly one generator, at least one ejector, and fits 12x12', () => {
  for (const { id } of SHIPS) {
    const grid = createGridForShip(id);
    assert.equal(grid.length, 12, id);
    assert.equal(count(grid, 'Projectile Generator'), 1, `${id}: generators`);
    assert.ok(count(grid, 'Ejection Block') >= 1, `${id}: ejectors`);
  }
});

test('the default ship is identical to the original hard-coded layout', () => {
  assert.deepEqual(createGridForShip(DEFAULT_SHIP_ID), createDefaultGrid());
});

test('smaller maps are centred and padded with walls', () => {
  const grid = parseShipMap(['#####', '#.E.#', '#.^.#', '#####']);
  assert.equal(grid.length, 12);
  assert.equal(grid[4][4].type, 'Solid Block'); // top-left corner of the map
  assert.equal(grid[5][4].type, 'Empty Slot'); // map row 2, column 2
  assert.equal(grid[5][5].type, 'Ejection Block');
  assert.equal(grid[0][0].type, 'Solid Block'); // padding
});

test('bad maps are rejected with a useful message', () => {
  assert.throws(() => parseShipMap(['#E#', '#.#']), /generator/);
  assert.throws(() => parseShipMap(['#^#', '#.#']), /ejector/);
  assert.throws(() => parseShipMap(['#^^E#']), /found 2/);
  assert.throws(() => parseShipMap(['#^E', '##']), /same length/);
  assert.throws(() => parseShipMap(['#^E?#']), /unknown character "\?"/);
  assert.throws(() => parseShipMap(Array(13).fill('#'.repeat(5))), /board is 12x12/);
});

test('generator direction is read from the map and the engine fires that way', () => {
  const grid = parseShipMap(['#######', '>.....E', '#######']);
  const paths = traceGrid(grid);
  assert.equal(paths.length, 1);
  const sim = new Simulation(grid, { trials: 10 });
  sim.run(10);
  assert.equal(sim.result().ev, 1);
});

test('several ejectors: each reachable one pays out; unused ones count for Ejector Damage', () => {
  const grid = parseShipMap(['##########', '#.......E#', '#........#', '#>......E#', '#........#', '#........#', '##########']); // generator faces east, 2 ejectors
  const sim = new Simulation(grid, { trials: 10 });
  sim.run(10);
  assert.equal(sim.result().ev, 1);
  assert.equal(sim.runner.unusedEjectors, 1); // only the ejector in the generator's row is reached
});

test('ship share links: build/parse round-trip', () => {
  assert.equal(buildHash(DEFAULT_SHIP_ID, ''), '');
  assert.equal(buildHash(DEFAULT_SHIP_ID, '41030'), '#build=41030'); // identical to pre-ships links
  assert.equal(buildHash('example-compact', '41030'), '#ship=example-compact&build=41030');
  assert.equal(buildHash('example-compact', ''), '#ship=example-compact');

  assert.deepEqual(parseHash('#build=41030'), { shipId: DEFAULT_SHIP_ID, code: '41030', custom: null }); // old links
  assert.deepEqual(parseHash('#ship=example-compact&build=41030'), { shipId: 'example-compact', code: '41030', custom: null });
  assert.deepEqual(parseHash('#ship=example-compact'), { shipId: 'example-compact', code: '', custom: null });
  assert.equal(parseHash(''), null);
  assert.equal(parseHash('#something-else'), null);
});

test('switching ship keeps blocks that still fit and drops those that do not', () => {
  const grid = createGridForShip(DEFAULT_SHIP_ID);
  grid[5][5].block = 'Clone'; // fits on the compact ship
  grid[9][9].block = 'Add 1 Damage'; // lands on a wall in the compact ship
  const carried = collectPlacements(grid);

  replaceGrid(grid, parseShipMap(['#######', '#..E..#', '#.....#', '#.....#', '#.....#', '#..^..#', '#######']));
  const kept = applyPlacements(grid, carried);

  assert.equal(kept, 1);
  assert.equal(grid[5][5].block, 'Clone');
  assert.equal(serializeLayout(grid).length, 5);
});

test('unknown ship ids are not available', () => {
  assert.equal(hasShip('nope'), false);
  assert.equal(hasShip(DEFAULT_SHIP_ID), true);
});
