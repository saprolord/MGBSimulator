/** Run with:  node --test   (perk-driven behaviour: split chances, clone, path length, random reroll, replace op) */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Simulation, traceGrid } from '../js/engine/index.js';
import { parseShipMap, mapOrigin } from '../js/model/ship-loader.js';
import { applyEffects, checkEffect } from '../js/loadout/effects.js';
import { resolveRules, createLoadout } from '../js/loadout/loadout.js';
import { GAME_DATA, DATA_PROBLEMS } from '../js/loadout/data.js';
import { DEFAULT_TUNING } from '../js/tuning.js';

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Generator at the bottom of column 4 facing up; the block under test sits two tiles above it. */
const SPLIT_MAP = ['#########', '####E####', 'E.......E', '####.####', '####^####', '#########'];
function shipWith(blockName, map = SPLIT_MAP, at = [2, 4]) {
  const grid = parseShipMap(map, 9);
  const origin = mapOrigin(map, 9);
  const tile = grid[origin.r + at[0]][origin.c + at[1]];
  tile.block = blockName;
  tile.rotation = 0;
  return grid;
}
const ev = (grid, tuning = {}, trials = 4000, seed = 1) => {
  const sim = new Simulation(grid, { trials, tuning }, mulberry32(seed));
  sim.run(trials);
  return sim.result().ev;
};

// ---- Random splits: the "split into all paths" chance ------------------------------------------------
test('2-Way Random Split: normally ONE side with x2 damage; with chance 1, BOTH sides', () => {
  const grid = shipWith('2-Way Random Split');
  assert.equal(ev(grid), 2); // one projectile of 2 damage
  assert.equal(ev(grid, { twoWaySplitChance: 1 }), 4); // two projectiles of 2 damage
  assert.equal(ev(grid, { twoWaySplitChance: 1, x2SplitDamage: 3 }), 6);
});

test('2-Way Random Split: a 5% chance gives about 5% more projectiles', () => {
  const average = ev(shipWith('2-Way Random Split'), { twoWaySplitChance: 0.05 }, 200000);
  assert.ok(Math.abs(average - 2.1) < 0.02, `average ${average}`); // 0.95 x 2 + 0.05 x 4
});

test('3-Way Random Split: x3 damage, one path normally, all three with chance 1', () => {
  const grid = shipWith('3-Way Random Split');
  assert.equal(ev(grid), 3);
  assert.equal(ev(grid, { threeWaySplitChance: 1 }), 9);
  assert.equal(ev(grid, { x3SplitDamage: 4 }), 4);
});

test('the path preview shows every branch regardless of the chances', () => {
  assert.equal(traceGrid(shipWith('2-Way Random Split')).length, 2);
  assert.equal(traceGrid(shipWith('3-Way Random Split')).length, 3);
});

// ---- Clone ----------------------------------------------------------------------------------------------
const CORRIDOR = ['#####', '#.E.#', '#...#', '#.^.#', '#####'];
const corridorWith = (block) => shipWith(block, CORRIDOR, [2, 2]);

test('Clone: 2 projectiles normally, 3 when the extra-copy chance is 1', () => {
  const grid = corridorWith('Clone');
  assert.equal(ev(grid), 2);
  assert.equal(ev(grid, { cloneExtraChance: 1 }), 3);
});

test('Clone: a 20% chance gives about 2.2 projectiles on average', () => {
  const average = ev(corridorWith('Clone'), { cloneExtraChance: 0.2 }, 200000);
  assert.ok(Math.abs(average - 2.2) < 0.02, `average ${average}`);
});

// ---- Add 100 Damage: + X per tile travelled ----------------------------------------------------------
test('Add 100 Damage: path length is counted from the generator to the block', () => {
  // Generator at row 10 of the default-style corridor; the block is `distance` tiles away.
  const map = ['#######', '#..E..#', '#.....#', '#.....#', '#.....#', '#.....#', '#..^..#', '#######'];
  for (const distance of [1, 2, 4]) {
    const grid = shipWith('Add 100 Damage', map, [6 - distance, 3]);
    assert.equal(ev(grid), 101, 'no perk: just +100');
    assert.equal(ev(grid, { addLargePerTile: 50 }), 101 + 50 * distance, `${distance} tiles away`);
  }
});

test('Add 100 Damage: the path length keeps counting through turns', () => {
  // up 2, turn right, along 2 more tiles, then into the block: 5 tiles from the generator.
  const map = ['#########', '#.......#', '#.......E', '#.......#', '#...^...#', '#########'];
  const grid = parseShipMap(map, 9);
  const o = mapOrigin(map, 9);
  const put = (r, c, block, rotation) => { const t = grid[o.r + r][o.c + c]; t.block = block; t.rotation = rotation; };
  put(2, 4, 'Guide Right', 0); // generator (4,4) -> (3,4) -> (2,4): turns east
  put(2, 7, 'Add 100 Damage', 90); // (2,5) (2,6) (2,7)
  const distance = 2 + 3; // 2 tiles up (including the turn tile) + 3 tiles east
  assert.equal(ev(grid, { addLargePerTile: 10 }), 1 + 100 + 10 * distance);
});

// ---- Random Damage: reroll 0 and scale ---------------------------------------------------------------
const HALF_ZERO = { Random_Damage_Table: [[1, 0], [2, 5]] }; // 50 % x0, 50 % x5
test('Random Damage: reroll zero + scale give the exact expected averages', () => {
  const grid = corridorWith('Random Damage');
  const base = ev(grid, HALF_ZERO, 200000);
  const reroll = ev(grid, { ...HALF_ZERO, randomRerollZero: 1 }, 200000);
  const both = ev(grid, { ...HALF_ZERO, randomRerollZero: 1, randomMultiplierScale: 0.85 }, 200000);
  assert.ok(Math.abs(base - 2.5) < 0.05, `no reroll ${base}`); // 0.5 x 5
  assert.ok(Math.abs(reroll - 3.75) < 0.05, `reroll ${reroll}`); // 0.75 x 5
  assert.ok(Math.abs(both - 3.1875) < 0.05, `reroll + 15% less ${both}`); // 3.75 x 0.85
});

// ---- The 'replace' op (lists) --------------------------------------------------------------------------
test('replace: swaps a list, refuses numbers, and the default is never modified', () => {
  const table = [[2, 0], [6, 1], [8, 2], [10, 3], [11, 4]];
  const effect = { stat: 'Random_Damage_Table', op: 'replace', value: table };
  assert.equal(checkEffect(effect), null);
  assert.match(checkEffect({ ...effect, op: 'set' }), /only op 'replace'/);
  assert.match(checkEffect({ stat: 'x2Chance', op: 'replace', value: 1 }), /is a number/);
  assert.match(checkEffect({ ...effect, value: 5 }), /same kind/);

  const before = JSON.stringify(DEFAULT_TUNING.Random_Damage_Table);
  const result = applyEffects({ ...DEFAULT_TUNING }, [effect]);
  assert.deepEqual(result.Random_Damage_Table, table);
  assert.equal(JSON.stringify(DEFAULT_TUNING.Random_Damage_Table), before);
});

test('replace: the perk pool 0,0,1,1,1,1,2,2,3,3,4 averages 1.636', () => {
  const perk = GAME_DATA.perks.find((p) => p.id === 'Random1');
  const table = perk.effects[0].value;
  assert.ok(Math.abs(ev(corridorWith('Random Damage'), { Random_Damage_Table: table }, 200000) - 18 / 11) < 0.03);
});

// ---- The real perk data -----------------------------------------------------------------------------------
test('the real perk data has no problems (no unknown stats, broken links or bad ids)', () => {
  assert.deepEqual(DATA_PROBLEMS, []);
});

test('real perks: the ones just implemented change the numbers they should', () => {
  const rulesWith = (...ids) => { const l = createLoadout(); l.perks = new Set(ids); return resolveRules(l, {}, { ...GAME_DATA, maxPerkPoints: 999 }).tuning; };
  assert.equal(rulesWith('dmg20').addSmallPerBlock, 20);
  assert.equal(rulesWith('EmptyDmg').emptySlotDamage, 70);
  assert.equal(rulesWith('accum+').accumulatorUsesHigher, 1);
  assert.equal(rulesWith('Clone20%').cloneExtraChance, 0.2);
  assert.equal(rulesWith('+50X').addLargePerTile, 50);
  const reroll = rulesWith('Random2');
  assert.equal(reroll.randomRerollZero, 1);
  assert.equal(reroll.randomMultiplierScale, 0.85);
  assert.equal(rulesWith('split3x').x2SplitDamage, 3);
  assert.equal(rulesWith('split4x').x3SplitDamage, 4);
  assert.equal(rulesWith('split5%').twoWaySplitChance, 0.05);
  assert.equal(rulesWith('split5%3').threeWaySplitChance, 0.05);
  assert.equal(rulesWith('ejectDmg').ejectorDamageEach, DEFAULT_TUNING.ejectorDamageEach + 30);
  assert.equal(rulesWith('charge').chargeStoreRate, 0.3);
  assert.equal(rulesWith('dup10%').duplicateChance, 0.1);
  assert.equal(rulesWith('cross2x').damageCrossMultiplier, 2);
  assert.equal(rulesWith('guide').guidedAllGuides, 1);
});

// ---- dmg20: +20 for EVERY "Add 1 Damage" block on the ship ----------------------------------------------
/** A tall corridor (generator at the bottom, ejector at the top) plus a side room that is off the path. */
const ROOM_MAP = ['###########', '#...E.....#', '#.........#', '#.........#', '#.........#', '#...^.....#', '###########'];
function roomWith(onPath, offPath) {
  const grid = parseShipMap(ROOM_MAP, 11);
  const o = mapOrigin(ROOM_MAP, 11);
  onPath.forEach((row) => { grid[o.r + row][o.c + 4].block = 'Add 1 Damage'; grid[o.r + row][o.c + 4].rotation = 0; });
  offPath.forEach(([r, c]) => { grid[o.r + r][o.c + c].block = 'Add 1 Damage'; grid[o.r + r][o.c + c].rotation = 0; });
  return grid;
}

test('dmg20: with the perk off, Add 1 Damage blocks just add 1 each', () => {
  assert.equal(ev(roomWith([2, 3, 4], [])), 1 + 3);
});

test('dmg20: each block adds +20 per Add 1 Damage block on the ship, itself included', () => {
  // 3 blocks on the path: each gives 1 + 20 x 3 = 61
  assert.equal(ev(roomWith([2, 3, 4], []), { addSmallPerBlock: 20 }), 1 + 3 * 61);
  // a single block: 1 + 20 x 1 = 21
  assert.equal(ev(roomWith([3], []), { addSmallPerBlock: 20 }), 1 + 21);
});

test('dmg20: blocks that are NOT on the path still count', () => {
  // 3 on the path + 2 elsewhere = 5 blocks on the ship: each on-path block gives 1 + 20 x 5 = 101
  assert.equal(ev(roomWith([2, 3, 4], [[1, 8], [4, 9]]), { addSmallPerBlock: 20 }), 1 + 3 * 101);
});

test('dmg20: it works together with a bigger plain bonus (+5 from the other perk)', () => {
  assert.equal(ev(roomWith([3], []), { addSmallPerBlock: 20, addDamageSmall: 6 }), 1 + 6 + 20);
});

// ---- EmptyDmg: +70 for each empty slot on the way -----------------------------------------------------
const TALL_MAP = ['#######', '#..E..#', '#.....#', '#.....#', '#.....#', '#.....#', '#..^..#', '#######'];
const tall = (blocks = []) => {
  const grid = parseShipMap(TALL_MAP, 8);
  const o = mapOrigin(TALL_MAP, 8);
  for (const [r, name] of blocks) { grid[o.r + r][o.c + 3].block = name; grid[o.r + r][o.c + 3].rotation = 0; }
  return grid;
};

test('EmptyDmg: +70 for each empty slot crossed between the generator and the ejector', () => {
  assert.equal(ev(tall()), 1);
  assert.equal(ev(tall(), { emptySlotDamage: 70 }), 1 + 4 * 70); // rows 5, 4, 3, 2 are empty
});

test('EmptyDmg: tiles holding a block are not empty slots', () => {
  // block on row 3: only rows 5, 4 and 2 are empty -> 3 x 70
  assert.equal(ev(tall([[3, 'Add 1 Damage']]), { emptySlotDamage: 70 }), 1 + 3 * 70 + 1);
});

test('EmptyDmg: the order matters, the bonus is added where the projectile is when it crosses the slot', () => {
  // two empty slots (+140) come BEFORE the x2 block (forced with chance 1), one (+70) after: (1 + 140) x 2 + 70
  const grid = tall([[3, 'x2 Damage']]);
  assert.equal(ev(grid, { emptySlotDamage: 70, x2Chance: 1 }), 352);
});

test('EmptyDmg: a path that never reaches the ejector still pays nothing', () => {
  const grid = tall([[3, '2-Way Random Split']]);
  assert.equal(ev(grid, { emptySlotDamage: 70 }), 0);
});

// ---- accum+: Combine counts the higher of the current and the previous projectile -----------------------
const accumulate = (tuning, mult = 0.5) => {
  const grid = tall([[3, 'Combine 10']]);
  const sim = new Simulation(grid, { trials: 50, burstCount: 1, burstDamageMult: mult, tuning: { combineCount: 2, ...tuning } }, mulberry32(1));
  sim.run(50);
  return sim.result().ev;
};

test('accum+: without the perk Combine adds up the real damages', () => {
  // each trial fires a projectile of 1 then one of 0.5: (1 + 0.5) x 2 = 3
  assert.equal(accumulate({}), 3);
});

test('accum+: with the perk each projectile counts as the higher of itself and the one before', () => {
  // 1 stays 1 (previous was 0.5, lower); 0.5 becomes 1 (previous was 1): (1 + 1) x 2 = 4
  assert.equal(accumulate({ accumulatorUsesHigher: 1 }), 4);
});

test('accum+: the previous projectile is remembered from one trial to the next', () => {
  // projectiles are 1 then 3 in every trial. Trial 1: nothing came before the first, so (1 + 3) x 2 = 8.
  // Trial 2: the first (1) follows a 3 and counts as 3, the second (3) follows a 1 and stays 3: (3 + 3) x 2 = 12.
  const run = (trials, tuning) => {
    const sim = new Simulation(tall([[3, 'Combine 10']]), { trials, burstCount: 1, burstDamageMult: 3, tuning: { combineCount: 2, ...tuning } }, mulberry32(1));
    sim.run(trials);
    return sim.result().ev;
  };
  assert.equal(run(1, { accumulatorUsesHigher: 1 }), 8);
  assert.equal(run(2, { accumulatorUsesHigher: 1 }), 10); // (8 + 12) / 2
  assert.equal(run(2, {}), 8); // without the perk: 8 every time
});

// ---- Add Projectile: "Duplicate 10%" duplicates COPIES, never gives an original a third projectile -------------
const twoAdds = () => shipWith('Add Projectile', ['#####', '#.E.#', '#...#', '#...#', '#...#', '#.^.#', '#####'], [3, 2]);
function twoAddProjectiles() {
  const map = ['#####', '#.E.#', '#...#', '#...#', '#...#', '#.^.#', '#####'];
  const grid = parseShipMap(map, 7);
  const o = mapOrigin(map, 7);
  for (const row of [4, 2]) { grid[o.r + row][o.c + 2].block = 'Add Projectile'; grid[o.r + row][o.c + 2].rotation = 0; }
  return grid;
}

test('Add Projectile: an original is duplicated once; a copy only passes through', () => {
  // block 1: original -> original + copy. block 2: original -> 2, the copy from block 1 passes -> 3 in total
  assert.equal(ev(twoAddProjectiles()), 3);
});

test('Add Projectile: with duplicateChance 1 the copy from the first block is duplicated, the originals are not', () => {
  assert.equal(ev(twoAddProjectiles(), { duplicateChance: 1 }), 4);
});

test('Add Projectile: duplicateChance 0.1 adds about 10% of one projectile', () => {
  const average = ev(twoAddProjectiles(), { duplicateChance: 0.1 }, 200000);
  assert.ok(Math.abs(average - 3.1) < 0.02, `average ${average}`);
});

test('Add Projectile: a single block is not affected by the duplicate chance (the original always duplicates)', () => {
  const grid = corridorWith('Add Projectile');
  assert.equal(ev(grid), 2);
  assert.equal(ev(grid, { duplicateChance: 1 }), 2);
});

// ---- Damage Cross: the multiplier applies to the RECORDED damage -----------------------------------------------
import { getBlock } from '../js/blocks.js';
test('Damage Cross: the main entry adds the recorded damage times damageCrossMultiplier, not the projectile damage', () => {
  const cross = getBlock('Damage Cross');
  const entry = (multiplier) => {
    const sim = { crossRecords: new Map([[7, 10]]), crossCounter: 7, tuning: { damageCrossMultiplier: multiplier } };
    const v = { heading: 0, rot: 0, cell: 3, damage: 5, stamps: { 3: 7 }, tuning: sim.tuning };
    return cross.effect(v, sim);
  };
  assert.equal(entry(1), 5 + 10); // default: unchanged
  assert.equal(entry(2), 5 + 20); // perk: the recorded 10 counts double; the projectile's own 5 does not
});

// ---- All Guides Damage ---------------------------------------------------------------------------------------------
function guidedSplit(splitter) {
  const grid = shipWith('Guided Damage', SPLIT_MAP, [3, 4]);
  const o = mapOrigin(SPLIT_MAP, 9);
  grid[o.r + 2][o.c + 4].block = splitter;
  grid[o.r + 2][o.c + 4].rotation = 0;
  return grid;
}

test('All Guides Damage: without the perk the splitters ignore Guided Damage', () => {
  assert.equal(ev(guidedSplit('2-Way Random Split')), 2);
  assert.equal(ev(guidedSplit('3-Way Random Split')), 3);
});

test('All Guides Damage: with the perk the splitters get the Guided Damage boost too', () => {
  assert.equal(ev(guidedSplit('2-Way Random Split'), { guidedAllGuides: 1 }), 2.2); // 1 x 1.1 x 2
  assert.equal(ev(guidedSplit('3-Way Random Split'), { guidedAllGuides: 1 }), 3.3); // 1 x 1.1 x 3
  assert.equal(ev(guidedSplit('2-Way Random Split'), { guidedAllGuides: 1, guidedTurnBonus: 2 }), 4);
});

test('All Guides Damage: the plain splitters (no damage change of their own) are boosted as well', () => {
  assert.equal(ev(guidedSplit('3-way Split')), 3); // 3 projectiles of 1
  assert.equal(ev(guidedSplit('3-way Split'), { guidedAllGuides: 1 }), 3.3); // 3 projectiles of 1.1
  assert.equal(ev(guidedSplit('2-Way Split'), { guidedAllGuides: 1 }), 2.2); // 2 projectiles of 1.1
});

test('All Guides Damage: without Guided Damage on the ship the perk does nothing', () => {
  assert.equal(ev(shipWith('2-Way Random Split'), { guidedAllGuides: 1 }), 2);
});
