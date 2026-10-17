/** Run with:  node --test   (effects, captains, skills, perks, tuning, rectangular grids) */

import test from 'node:test';
import assert from 'node:assert/strict';

import { applyEffects, checkEffect, changedTuning } from '../js/loadout/effects.js';
import { createPerkTree } from '../js/loadout/perk-tree.js';
import { validateData } from '../js/loadout/validate.js';
import { createLoadout, collectEffects, resolveRules, restoreLoadout, serializeLoadout } from '../js/loadout/loadout.js';
import { GAME_DATA, DATA_PROBLEMS } from '../js/loadout/data.js';
import { DEFAULT_TUNING } from '../js/tuning.js';
import { Simulation, traceGrid } from '../js/engine/index.js';
import { TILE } from '../js/config.js';
import { createTile } from '../js/model/grid.js';
import { serializeLayout, applyLayout } from '../js/model/share-code.js';
import { createGridForShip } from '../js/model/ship-loader.js';
import { SHIPS } from '../js/ships.js';

// ---- Small made-up game data so the tests do not depend on the real (example) data -----------
const DATA = {
  damagePerCaptainLevel: 1,
  defaultMaxCaptainLevel: 100,
  maxPerkPoints: 3,
  captains: [
    { id: 'cap-a', name: 'A', maxLevel: 10, skills: [
      { id: 'a-fire', name: 'Fire', effects: [{ stat: 'fireRate', op: 'mul', value: 2 }] },
      { id: 'a-luck', name: 'Luck', effects: [{ stat: 'x2Chance', op: 'add', value: 0.1 }] },
      { id: 'a-paint', name: 'Paint', visualOnly: true },
    ] },
    { id: 'cap-b', name: 'B', skills: [{ id: 'b-dmg', name: 'Dmg', effects: [{ stat: 'baseDamage', op: 'add', value: 5 }] }] },
  ],
  perks: [
    { id: 'p-root', name: 'Root', q: 0, r: 0, requires: [], effects: [{ stat: 'baseDamage', op: 'add', value: 1 }] },
    { id: 'p-left', name: 'Left', q: -1, r: 0, requires: ['p-root'], effects: [] , visualOnly: true },
    { id: 'p-right', name: 'Right', q: 1, r: 0, requires: ['p-root'], effects: [{ stat: 'x10Chance', op: 'add', value: 0.01 }] },
    { id: 'p-far', name: 'Far', q: 2, r: 0, requires: ['p-right'], effects: [{ stat: 'chargeStoreRate', op: 'set', value: 0.5 }] },
    { id: 'p-merge', name: 'Merge', q: 0, r: 1, requires: ['p-left', 'p-right'], effects: [] , visualOnly: true },
    { id: 'p-both', name: 'Both', q: 0, r: -1, requires: ['p-left', 'p-right'], requiresAll: true, effects: [], visualOnly: true },
  ],
};

// ---- Effects -----------------------------------------------------------------------------------
test('effects: add, mul and set combine as ((set ?? base) + adds) x muls, in any order', () => {
  const base = { x: 10 };
  const a = applyEffects(base, [{ stat: 'x', op: 'mul', value: 2 }, { stat: 'x', op: 'add', value: 5 }]);
  const b = applyEffects(base, [{ stat: 'x', op: 'add', value: 5 }, { stat: 'x', op: 'mul', value: 2 }]);
  assert.equal(a.x, 30);
  assert.equal(b.x, 30);
  assert.equal(applyEffects(base, [{ stat: 'x', op: 'set', value: 4 }, { stat: 'x', op: 'add', value: 1 }]).x, 5);
  assert.equal(base.x, 10, 'the input is not modified');
});

test('effects: untouched stats keep their value', () => {
  assert.deepEqual(applyEffects({ a: 1, b: 2 }, [{ stat: 'a', op: 'add', value: 1 }]), { a: 2, b: 2 });
});

test('effects: typos are caught', () => {
  assert.match(checkEffect({ stat: 'x2Chnace', op: 'add', value: 1 }), /unknown stat/);
  assert.match(checkEffect({ stat: 'x2Chance', op: 'plus', value: 1 }), /unknown op/);
  assert.match(checkEffect({ stat: 'x2Chance', op: 'add', value: '5' }), /number/);
  assert.equal(checkEffect({ stat: 'fireRate', op: 'mul', value: 1.1 }), null);
  assert.equal(checkEffect({ stat: 'baseDamage', op: 'add', value: 1 }), null);
});

// ---- Loadout -> rules --------------------------------------------------------------------------
test('rules: an empty loadout changes nothing', () => {
  const rules = resolveRules(createLoadout(), { fireRate: 1.4 }, DATA);
  assert.equal(rules.baseDamage, 1);
  assert.equal(rules.fireRate, 1.4);
  assert.deepEqual(rules.tuning, { ...DEFAULT_TUNING });
  assert.deepEqual(changedTuning(rules.tuning), []);
});

test('rules: captain level adds base damage; skills only count for the active captain', () => {
  const loadout = createLoadout();
  loadout.captainId = 'cap-a';
  loadout.captainLevel = 7;
  loadout.skills = new Set(['a-fire', 'a-luck', 'b-dmg']); // b-dmg belongs to the other captain
  const rules = resolveRules(loadout, { fireRate: 1.5 }, DATA);
  assert.equal(rules.baseDamage, 1 + 7);
  assert.equal(rules.fireRate, 3);
  assert.equal(rules.tuning.x2Chance, DEFAULT_TUNING.x2Chance + 0.1);
});

test('rules: no captain means no level bonus and no skills', () => {
  const loadout = createLoadout();
  loadout.captainLevel = 20;
  loadout.skills = new Set(['a-fire']);
  assert.equal(resolveRules(loadout, {}, DATA).baseDamage, 1);
});

test('rules: perks apply to every ship; visual-only ones change nothing', () => {
  const loadout = createLoadout();
  loadout.perks = new Set(['p-root', 'p-left', 'p-right', 'p-far']);
  const rules = resolveRules(loadout, {}, DATA);
  assert.equal(rules.baseDamage, 2);
  assert.equal(rules.tuning.x10Chance, DEFAULT_TUNING.x10Chance + 0.01);
  assert.equal(rules.tuning.chargeStoreRate, 0.5);
  assert.equal(collectEffects(loadout, DATA).length, 3); // root, right, far - not the visual-only left
});

test('rules: a visual-only skill is ticked but has no effect', () => {
  const loadout = createLoadout();
  loadout.captainId = 'cap-a';
  loadout.skills = new Set(['a-paint']);
  assert.deepEqual(resolveRules(loadout, {}, DATA).tuning, { ...DEFAULT_TUNING });
});

// ---- The simulation really uses the rules ---------------------------------------------------------
const corridorShip = () => createGridForShip(SHIPS[0].id);
const withBlock = (name) => {
  const grid = corridorShip();
  let row, col;
  grid.forEach((cells, r) => cells.forEach((t, c) => { if (t.type === TILE.GENERATOR) { row = r; col = c; } }));
  grid[row - 1][col].block = name;
  grid[row - 1][col].rotation = 0;
  return grid;
};
const ev = (grid, params) => {
  const sim = new Simulation(grid, { trials: 20, ...params });
  sim.run(20);
  return sim.result().ev;
};

test('simulation: base damage and tuning overrides reach the blocks', () => {
  assert.equal(ev(withBlock('Add 1 Damage'), {}), 2);
  assert.equal(ev(withBlock('Add 1 Damage'), { baseDamage: 4 }), 5);
  assert.equal(ev(withBlock('Add 1 Damage'), { tuning: { addDamageSmall: 10 } }), 11);
  assert.equal(ev(withBlock('Add 100 Damage'), { tuning: { addDamageLarge: 7 } }), 8);
});

test('simulation: chances can be forced through tuning', () => {
  assert.equal(ev(withBlock('x2 Damage'), { tuning: { x2Chance: 1 } }), 2);
  assert.equal(ev(withBlock('x2 Damage'), { tuning: { x2Chance: 1, x2Multiplier: 3 } }), 3);
  assert.equal(ev(withBlock('x2 Damage'), { tuning: { x2Chance: 0 } }), 1);
});

test('simulation: a partial tuning object keeps every other default', () => {
  assert.equal(ev(withBlock('Add 100 Damage'), { tuning: { x2Chance: 1 } }), 101);
});

// ---- Perk tree --------------------------------------------------------------------------------
const tree = createPerkTree(DATA.perks, DATA.maxPerkPoints);
const set = (...ids) => new Set(ids);

test('perk tree: roots are available, others need a connected perk', () => {
  assert.equal(tree.isAvailable(set(), 'p-root'), true);
  assert.equal(tree.isAvailable(set(), 'p-right'), false);
  assert.equal(tree.isAvailable(set('p-root'), 'p-right'), true);
  assert.match(tree.whyNotUnlock(set(), 'p-far'), /connected/);
});

test('perk tree: several routes = any one is enough; requiresAll needs every one', () => {
  const roomy = createPerkTree(DATA.perks, 10); // enough points that only the routes matter
  assert.equal(roomy.isAvailable(set('p-root', 'p-right'), 'p-merge'), true);
  assert.equal(roomy.isAvailable(set('p-root', 'p-right'), 'p-both'), false);
  assert.equal(roomy.isAvailable(set('p-root', 'p-right', 'p-left'), 'p-both'), true);
});

test('perk tree: points are limited', () => {
  let unlocked = set();
  for (const id of ['p-root', 'p-right', 'p-far']) unlocked = tree.unlock(unlocked, id);
  assert.equal(tree.pointsUsed(unlocked), 3);
  assert.equal(tree.pointsLeft(unlocked), 0);
  assert.equal(tree.unlock(unlocked, 'p-left'), null);
  assert.match(tree.whyNotUnlock(unlocked, 'p-left'), /No perk points/);
});

test('perk tree: unlock and refund never modify the set they are given', () => {
  const before = set('p-root');
  const after = tree.unlock(before, 'p-right');
  assert.equal(before.size, 1);
  assert.equal(after.size, 2);
});

test('perk tree: you cannot refund the middle of a path, but you can refund the end', () => {
  const unlocked = set('p-root', 'p-right', 'p-far');
  assert.equal(tree.refund(unlocked, 'p-right'), null);
  assert.match(tree.whyNotRefund(unlocked, 'p-root'), /depend/);
  assert.deepEqual([...tree.refund(unlocked, 'p-far')].sort(), ['p-right', 'p-root']);
});

test('perk tree: a perk with two routes can be refunded when the other route remains', () => {
  const unlocked = set('p-root', 'p-left', 'p-right', 'p-merge');
  assert.ok(tree.refund(unlocked, 'p-left'));
});

test('perk tree: sanitize drops unknown, unreachable and over-budget perks', () => {
  assert.deepEqual([...tree.sanitize(['p-far', 'ghost'])], []); // far needs right and root first
  assert.deepEqual([...tree.sanitize(['p-far', 'p-right', 'p-root'])].sort(), ['p-far', 'p-right', 'p-root']);
  assert.equal(tree.sanitize(['p-root', 'p-left', 'p-right', 'p-far']).size, 3); // 4 asked, 3 points
});

// ---- Saving ------------------------------------------------------------------------------------
test('saved loadouts round-trip and survive removed or corrupt data', () => {
  const loadout = createLoadout();
  loadout.captainId = 'cap-a';
  loadout.captainLevel = 4;
  loadout.skills = set('a-fire');
  loadout.perks = set('p-root', 'p-right');
  const restored = restoreLoadout(JSON.parse(JSON.stringify(serializeLoadout(loadout))), DATA);
  assert.deepEqual(serializeLoadout(restored), serializeLoadout(loadout));

  const messy = restoreLoadout({ captainId: 'deleted', captainLevel: 'x', skills: ['nope', 'a-fire'], perks: ['ghost', 'p-far'] }, DATA);
  assert.equal(messy.captainId, null);
  assert.deepEqual([...messy.perks], []);
  assert.equal(restoreLoadout(null, DATA).captainId, null);
  assert.equal(restoreLoadout({ captainId: 'cap-a', captainLevel: 999 }, DATA).captainLevel, 10); // clamped to maxLevel
});

// ---- Data validation ---------------------------------------------------------------------------
test('the real captain / skill / perk data has no mistakes', () => {
  assert.deepEqual(DATA_PROBLEMS, []);
});

test('validator catches typical mistakes', () => {
  const problems = (patch) => validateData({ ...DATA, ...patch });
  assert.deepEqual(problems({}), []);
  assert.match(problems({ perks: [...DATA.perks, { id: 'p-root', q: 9, r: 9, requires: [] }] }).join(), /Duplicate perk id/);
  assert.match(problems({ perks: [...DATA.perks, { id: 'p-x', q: 0, r: 0, requires: ['p-root'] }] }).join(), /same hex/);
  assert.match(problems({ perks: [...DATA.perks, { id: 'p-x', q: 9, r: 9, requires: ['nope'] }] }).join(), /unknown perk "nope"/);
  assert.match(problems({ perks: [{ id: 'p-a', q: 0, r: 0, requires: ['p-b'] }, { id: 'p-b', q: 1, r: 0, requires: ['p-a'] }] }).join(), /No starting perk/);
  assert.match(problems({ perks: [...DATA.perks, { id: 'p-x', q: 9, r: 9, requires: ['p-y'] }, { id: 'p-y', q: 8, r: 9, requires: ['p-x'] }] }).join(), /can never be unlocked/);
  assert.match(problems({ perks: [{ id: 'p-a', q: 0, r: 0, requires: [], effects: [{ stat: 'x2Chnace', op: 'add', value: 1 }] }] }).join(), /unknown stat/);
  assert.match(problems({ perks: [{ id: 'p-a', q: 0, r: 0, requires: [], visualOnly: true, effects: [{ stat: 'baseDamage', op: 'add', value: 1 }] }] }).join(), /visualOnly/);
  const dupSkill = { ...DATA.captains[1], skills: [{ id: 'a-fire', name: 'dup', visualOnly: true }] };
  assert.match(problems({ captains: [DATA.captains[0], dupSkill] }).join(), /Duplicate id "a-fire"/);
});

// ---- Rectangular grids (groundwork for the 12x13 custom ship) -----------------------------------
function rectangularShip(rows, cols) {
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => createTile(TILE.SOLID)));
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) grid[r][c] = createTile();
  grid[1][3] = createTile(TILE.EJECTOR);
  grid[rows - 2][3] = createTile(TILE.GENERATOR); // facing up
  return grid;
}

test('rectangular grid: engine, path preview and damage work on a 13x12 board', () => {
  const grid = rectangularShip(13, 12);
  const paths = traceGrid(grid);
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0][0], { r: 11, c: 3 });
  assert.deepEqual(paths[0].at(-1), { r: 1, c: 3 });
  assert.equal(ev(grid, {}), 1);

  grid[6][3].block = 'Add 1 Damage';
  assert.equal(ev(grid, {}), 2);
});

test('rectangular grid: a wide board indexes columns correctly', () => {
  const grid = rectangularShip(8, 15);
  grid[4][9].block = 'Add 100 Damage';
  assert.equal(traceGrid(grid)[0].length > 0, true);
  const paths = traceGrid(grid);
  assert.deepEqual(paths[0].at(-1), { r: 1, c: 3 });
});

test('rectangular grid: share codes use the real number of tiles per row', () => {
  const grid = rectangularShip(13, 12);
  grid[5][4].block = 'Clone';
  const code = serializeLayout(grid);
  assert.equal(code.slice(0, 2), (5 * 12 + 4).toString(16).padStart(2, '0'));
  const other = rectangularShip(13, 12);
  assert.ok(applyLayout(other, code));
  assert.equal(other[5][4].block, 'Clone');
});
