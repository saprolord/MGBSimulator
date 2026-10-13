/** Run with:  node --test   (portal blocks) */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createGridForShip } from '../js/model/ship-loader.js';
import { applyPlacements, canPlaceBlock } from '../js/model/grid.js';
import { applyLayout, serializeLayout } from '../js/model/share-code.js';
import { Simulation, traceGrid } from '../js/engine/index.js';

/** Default ship: generator (10,5) facing north, ejector (1,5); corridor = column 5. */
const shipWith = (...placements) => {
  const grid = createGridForShip('default');
  for (const [r, c, block, rotation = 0] of placements) {
    grid[r][c].block = block;
    grid[r][c].rotation = rotation;
  }
  return grid;
};
const ev = (grid) => {
  const sim = new Simulation(grid, { trials: 100 });
  sim.run(100);
  return sim.result().ev;
};

// Input at (8,5) facing north. Output at (6,5) facing SOUTH, so it exits through its back: north.
const PORTAL_IN = [8, 5, 'Portal In', 0];
const PORTAL_OUT = [6, 5, 'Portal Out', 180];

test('input portal teleports the projectile to the output portal', () => {
  // Damage added AFTER the output portal proves the projectile continued from there.
  assert.equal(ev(shipWith(PORTAL_IN, PORTAL_OUT, [4, 5, 'Add 1 Damage'])), 2);
});

test('projectile keeps its damage through the teleport', () => {
  assert.equal(ev(shipWith([9, 5, 'Add 100 Damage'], PORTAL_IN, PORTAL_OUT)), 101);
});

test('teleported projectiles can be sent somewhere the straight path could not reach', () => {
  // Wall off the corridor at (7,5) with a block facing the wrong way; the portal jumps over it.
  const blocked = shipWith([8, 5, 'Add 1 Damage', 180]);
  assert.equal(ev(blocked), 0);
  // Input (9,5) -> output (3,5) facing south => exits north towards the ejector.
  assert.equal(ev(shipWith([9, 5, 'Portal In', 0], [8, 5, 'Add 1 Damage', 180], [3, 5, 'Portal Out', 180])), 1);
});

test('no output portal: the path ends at the input portal', () => {
  assert.equal(ev(shipWith(PORTAL_IN)), 0);
});

test('no input portal: nothing is generated from the output portal', () => {
  assert.equal(ev(shipWith(PORTAL_OUT)), 0); // north-bound projectile meets the output portal and stops
  assert.equal(ev(shipWith([6, 5, 'Portal Out', 0])), 0); // even when it faces the right way
});

test('output portal facing north sends the projectile out of its back = south', () => {
  // Out at (6,5) facing north exits south, heading back down the corridor into a wall of nothing:
  // it runs south past the portal-in (wrong way in) and is stopped.
  assert.equal(ev(shipWith(PORTAL_IN, [6, 5, 'Portal Out', 0])), 0);
});

test('path preview: the path ends at the input and a new one starts at the output', () => {
  const paths = traceGrid(shipWith(PORTAL_IN, PORTAL_OUT));
  assert.equal(paths.length, 2);
  assert.deepEqual(paths[0].at(-1), { r: 8, c: 5 }); // ends on the input portal
  assert.deepEqual(paths[1][0], { r: 6, c: 5 }); // restarts on the output portal
  assert.deepEqual(paths[1].at(-1), { r: 1, c: 5 }); // and reaches the ejector
});

test('portal loops cannot freeze the simulation or the preview', () => {
  // Output exits straight back into the input: an endless loop, capped by the step limits.
  const grid = shipWith([8, 5, 'Portal In', 0], [9, 5, 'Portal Out', 0]);
  assert.equal(ev(grid), 0);
  traceGrid(grid);
});

test('only one of each portal per ship', () => {
  const grid = shipWith(PORTAL_IN);
  assert.equal(canPlaceBlock(grid, 'Portal In'), false);
  assert.equal(canPlaceBlock(grid, 'Portal Out'), true);
  assert.equal(canPlaceBlock(grid, 'Clone'), true);

  const placed = applyPlacements(createGridForShip('default'), [
    { r: 8, c: 5, block: 'Portal In', rotation: 0 },
    { r: 7, c: 5, block: 'Portal In', rotation: 0 },
  ]);
  assert.equal(placed, 1);
});

test('portals survive share links, and a link cannot smuggle in a second one', () => {
  const code = serializeLayout(shipWith(PORTAL_IN, PORTAL_OUT));
  const restored = createGridForShip('default');
  assert.ok(applyLayout(restored, code));
  assert.equal(restored[8][5].block, 'Portal In');
  assert.equal(restored[6][5].block, 'Portal Out');
  assert.equal(restored[6][5].rotation, 180);

  const doubled = code + serializeLayout(shipWith([7, 4, 'Portal In', 0]));
  const loaded = createGridForShip('default');
  applyLayout(loaded, doubled);
  assert.equal(loaded.flat().filter((t) => t.block === 'Portal In').length, 1);
});