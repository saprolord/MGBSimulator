/** Run with:  node --test   (guards against typos and missing numbers: NaN results, unknown tuning keys) */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_TUNING } from '../js/tuning.js';
import { Simulation } from '../js/engine/index.js';
import { createGridForShip, AVAILABLE_SHIPS } from '../js/model/ship-loader.js';
import { GAME_DATA } from '../js/loadout/data.js';
import { createLoadout, resolveRules } from '../js/loadout/loadout.js';
import { BLOCKS } from '../js/blocks.js';

const jsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test('every tuning key the code reads exists in tuning.js (a missing key silently becomes NaN)', () => {
  const used = new Map();
  for (const file of walk(jsDir).filter((f) => f.endsWith('.js') && !f.endsWith('tuning.js'))) {
    const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // ignore comments
    const names = [
      ...[...source.matchAll(/tuning\.([A-Za-z_]\w*)/g)].map((m) => m[1]),
      ...[...source.matchAll(/(?:addTuned|multTuned|plusTuned)\(\s*'(\w+)'/g)].map((m) => m[1]),
    ].filter((name) => name !== 'js'); // "tuning.js" in an import path
    for (const name of names) used.set(name, path.basename(file));
  }
  const missing = [...used].filter(([key]) => !(key in DEFAULT_TUNING)).map(([key, file]) => `${key} (read in ${file})`);
  assert.deepEqual(missing, [], 'add these to js/tuning.js');
});

test('every default tuning value is a finite number or a list', () => {
  for (const [key, value] of Object.entries(DEFAULT_TUNING)) {
    assert.ok(Array.isArray(value) || Number.isFinite(value), `${key} = ${value}`);
  }
});

const finite = (result, where) => {
  assert.ok(Number.isFinite(result.ev) && Number.isFinite(result.min) && Number.isFinite(result.max), `${where}: ${JSON.stringify(result).slice(0, 90)}`);
  assert.ok(result.distribution.every((bar) => !bar.label.includes('NaN')), `${where}: NaN in the distribution`);
};

test('every ship, left empty, gives real numbers', () => {
  for (const { id } of AVAILABLE_SHIPS) {
    const sim = new Simulation(createGridForShip(id), { trials: 30 });
    sim.run(30);
    finite(sim.result(), `ship ${id}`);
  }
});

test('with EVERY perk unlocked, ships (with a few blocks on them) still give real numbers', () => {
  const loadout = createLoadout();
  loadout.perks = new Set(GAME_DATA.perks.map((p) => p.id));
  const rules = resolveRules(loadout, {}, GAME_DATA);
  const names = BLOCKS.filter((b) => b.implemented).map((b) => b.name);
  for (const { id } of AVAILABLE_SHIPS.slice(0, 12)) {
    const grid = createGridForShip(id);
    let placed = 0;
    for (const row of grid) for (const tile of row) if (tile.type === 'Empty Slot' && placed < names.length && Math.random() < 0.15) { tile.block = names[placed++]; }
    const sim = new Simulation(grid, { trials: 40, baseDamage: rules.baseDamage, fireRate: rules.fireRate, tuning: rules.tuning });
    sim.run(40);
    finite(sim.result(), `ship ${id} with all perks`);
  }
});
