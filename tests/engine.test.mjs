/**
 * Run with:  node --test
 * (Node 18+. No dependencies.)
 *
 * The expected numbers are simple enough to verify by hand. Default layout used throughout:
 * generator at row 10 / col 5 facing North, ejector at row 1 / col 5, so the straight corridor
 * is column 5, rows 2..9.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultGrid, clearBlocks } from '../js/model/grid.js';
import { serializeLayout, applyLayout, parseLayout } from '../js/model/share-code.js';
import { BLOCKS, getBlock, getBlockByShareId } from '../js/blocks.js';
import { Simulation, traceGrid } from '../js/engine/index.js';
import { buildDistribution } from '../js/engine/histogram.js';
import { pickYMax, pickStepSize } from '../js/ui/results-view.js';

/** Tiny seeded random generator so "random" tests are reproducible. */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gridWith = (...placements) => {
  const grid = createDefaultGrid();
  for (const [r, c, block, rotation = 0] of placements) {
    grid[r][c].block = block;
    grid[r][c].rotation = rotation;
  }
  return grid;
};

function simulate(grid, params = {}, seed = 1) {
  const sim = new Simulation(grid, { trials: 20_000, ...params }, seeded(seed));
  sim.run(sim.total);
  return sim.result();
}

// ---------------------------------------------------------------------------------------------
test('block registry has unique names and share IDs', () => {
  assert.equal(new Set(BLOCKS.map((b) => b.name)).size, BLOCKS.length);
  assert.equal(new Set(BLOCKS.map((b) => b.shareId)).size, BLOCKS.length);
});

test('share IDs of existing blocks never change (old links must keep working)', () => {
  const expected = {
    'Guide Right': 0x00, 'Guide Left': 0x01, '2-Way Split': 0x02, 'Add 1 Damage': 0x03,
    'Add Projectile': 0x04, 'x2 Damage': 0x05, '3-way Split': 0x06, '2-Way Random Split': 0x07,
    '3-Way Random Split': 0x08, 'x10 Damage': 0x09, 'Random Damage': 0x0a, 'Add 100 Damage': 0x0b,
    Clone: 0x0c, Charge: 0x0d, 'Damage Stockpile': 0x0e, 'Ejector Damage': 0x0f, 'Combine 10': 0x10,
    'Damage Comeback': 0x11, 'Tier Damage': 0x12, 'Guided Damage': 0x13, 'Damage Cross': 0x14,
    'Sparse Damage': 0x2f,
  };
  for (const [name, id] of Object.entries(expected)) assert.equal(getBlock(name).shareId, id, name);
  assert.equal(getBlockByShareId(0x03).name, 'Add 1 Damage');
});

// ---------------------------------------------------------------------------------------------
test('share code round-trips every block at every rotation', () => {
  const grid = createDefaultGrid();
  let r = 2, c = 1;
  BLOCKS.forEach((block, i) => {
    grid[r][c].block = block.name;
    grid[r][c].rotation = (i % 4) * 90;
    if (++c > 8) { c = 1; r++; }
  });
  const code = serializeLayout(grid);
  assert.equal(code.length, BLOCKS.length * 5);

  const restored = createDefaultGrid();
  assert.ok(applyLayout(restored, code));
  assert.deepEqual(restored, grid);
});

test('"Add 1 Damage" survives a share link (it used to be silently dropped)', () => {
  const grid = gridWith([5, 5, 'Add 1 Damage', 90]);
  const restored = createDefaultGrid();
  applyLayout(restored, serializeLayout(grid));
  assert.equal(restored[5][5].block, 'Add 1 Damage');
  assert.equal(restored[5][5].rotation, 90);
});

test('invalid share codes are rejected and leave the grid untouched', () => {
  const grid = gridWith([5, 5, 'Clone']);
  assert.equal(applyLayout(grid, 'zzzzz'), false);
  assert.equal(applyLayout(grid, '1234'), false); // not a multiple of 5 characters
  assert.equal(parseLayout('', 12), null);
  assert.equal(grid[5][5].block, 'Clone');
});

// ---------------------------------------------------------------------------------------------
test('path preview: empty ship has one straight path generator -> ejector', () => {
  const paths = traceGrid(createDefaultGrid());
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0][0], { r: 10, c: 5 });
  assert.deepEqual(paths[0].at(-1), { r: 1, c: 5 });
  assert.equal(paths[0].length, 10);
});

test('path preview: a splitter creates two branches', () => {
  const paths = traceGrid(gridWith([5, 5, '2-Way Split']));
  assert.equal(paths.length, 2);
});

test('path preview: a block facing the wrong way ends the path on that tile', () => {
  const paths = traceGrid(gridWith([5, 5, 'Add 1 Damage', 180]));
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0].at(-1), { r: 5, c: 5 });
});

test('path preview: a Clone loop cannot freeze the page', () => {
  // Projectiles circle a 2x2 loop while a clone block doubles them every lap.
  const grid = gridWith([5, 5, 'Guide Right', 0], [5, 6, 'Clone', 90], [6, 6, 'Guide Right', 90]);
  const started = Date.now();
  traceGrid(grid);
  assert.ok(Date.now() - started < 2000);
});

// ---------------------------------------------------------------------------------------------
test('no generator -> zero damage', () => {
  const grid = createDefaultGrid();
  grid[10][5].type = 'Empty Slot';
  const result = simulate(grid, { trials: 10 });
  const only = [{ label: '0', probability: 1 }];
  assert.deepEqual(result, { ev: 0, min: 0, max: 0, distribution: only, chartDistribution: only });
});

test('plain ship deals 1 damage; fire rate scales it', () => {
  assert.equal(simulate(createDefaultGrid()).ev, 1);
  assert.equal(simulate(createDefaultGrid(), { fireRate: 2.5 }).ev, 2.5);
});

test('Add 1 Damage / Add 100 Damage are additive', () => {
  assert.equal(simulate(gridWith([5, 5, 'Add 1 Damage'])).ev, 2);
  assert.equal(simulate(gridWith([5, 5, 'Add 100 Damage'], [4, 5, 'Add 1 Damage'])).ev, 102);
});

test('Add Projectile and Clone each double an un-split projectile', () => {
  assert.equal(simulate(gridWith([5, 5, 'Add Projectile'])).ev, 2);
  assert.equal(simulate(gridWith([5, 5, 'Clone'])).ev, 2);
  // Only the ORIGINAL projectile is duplicated: after two blocks that is original x2 + 1 copy = 3.
  assert.equal(simulate(gridWith([5, 5, 'Add Projectile'], [4, 5, 'Add Projectile'])).ev, 3);
});

test('walls swallow projectiles that wander off the corridor', () => {
  assert.equal(simulate(gridWith([5, 5, '2-Way Split'])).ev, 0);
});

test('x2 Damage doubles about 33% of the time', () => {
  const { ev, distribution } = simulate(gridWith([5, 5, 'x2 Damage']), { trials: 100_000 });
  assert.ok(Math.abs(ev - 1.33) < 0.02, `ev ${ev}`);
  assert.deepEqual(distribution.map((d) => d.label), ['1', '2']);
});

test('Damage Stockpile adds +10% per empty tile', () => {
  const grid = gridWith([5, 5, 'Damage Stockpile']);
  const empty = grid.flat().filter((t) => t.type === 'Empty Slot' && !t.block).length;
  assert.equal(simulate(grid).ev, Number((1 + empty * 0.1).toFixed(2)));
});

test('Tier Damage adds 10% of max tier', () => {
  assert.equal(simulate(gridWith([5, 5, 'Tier Damage']), { maxTier: 700 }).ev, 71);
});

test('Combine 10 releases one projectile per 10, carrying the doubled sum', () => {
  // 10 projectiles of 1 damage -> one of 20 every 10 trials => average 2 per trial.
  const { ev } = simulate(gridWith([5, 5, 'Combine 10']), { trials: 10_000 });
  assert.equal(ev, 2);
});

test('same seed -> identical results; different seed -> different results', () => {
  const grid = gridWith([5, 5, 'Random Damage'], [4, 5, 'x10 Damage']);
  assert.deepEqual(simulate(grid, {}, 7), simulate(grid, {}, 7));
  assert.notDeepEqual(simulate(grid, {}, 7), simulate(grid, {}, 8));
});

test('Simulation can be run in several slices with the same result as in one go', () => {
  const grid = gridWith([5, 5, 'Charge'], [4, 5, 'x2 Damage']);
  const whole = new Simulation(grid, { trials: 5000 }, seeded(3));
  whole.run(5000);
  const sliced = new Simulation(grid, { trials: 5000 }, seeded(3));
  while (!sliced.done) sliced.run(777);
  assert.deepEqual(sliced.result(), whole.result());
});

// ---------------------------------------------------------------------------------------------
test('histogram: few values keep their own bar, in numeric order', () => {
  const bars = buildDistribution([[0.5, 10], [2, 90]], 100);
  assert.deepEqual(bars, [{ label: '0.5', probability: 0.1 }, { label: '2', probability: 0.9 }]);
});

test('histogram: many values are grouped into at most 30 whole-number ranges', () => {
  const entries = Array.from({ length: 200 }, (_, i) => [i, 1]);
  const bars = buildDistribution(entries, 200);
  assert.ok(bars.length <= 30);
  assert.ok(Math.abs(bars.reduce((sum, b) => sum + b.probability, 0) - 1) < 0.01);
});

test('chart axis helpers pick tidy numbers', () => {
  assert.equal(pickYMax(3.2), 4);
  assert.equal(pickYMax(42), 50);
  assert.equal(pickYMax(100), 100);
  assert.equal(pickStepSize(4), 1);
  assert.equal(pickStepSize(20), 2);
  assert.equal(pickStepSize(100), 10);
});

test('clearBlocks keeps blocks the predicate asks for', () => {
  const grid = gridWith([5, 5, 'Guide Left'], [6, 5, 'Add 1 Damage']);
  clearBlocks(grid, (name) => name === 'Guide Left');
  assert.equal(grid[5][5].block, 'Guide Left');
  assert.equal(grid[6][5].block, null);
});
