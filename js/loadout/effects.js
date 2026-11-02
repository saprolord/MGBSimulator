/**
 * EFFECTS
 * =======
 * Captain levels, skills and perks all do the same thing: change a named number. An effect is:
 *
 *     { stat: 'x2Chance', op: 'add', value: 0.05 }
 *
 *   stat   what to change. Either
 *            'baseDamage'  damage of a freshly fired projectile (default 1)
 *            'fireRate'    shots per second (the ship's fire rate)
 *          or any key of DEFAULT_TUNING in tuning.js (x2Chance, chargeStoreRate, ...)
 *   op     'add'  add `value`          'mul'  multiply by `value`          'set'  force the value
 *          'replace'  swap in a whole new non-number value (a list such as Random_Damage_Table)
 *   value  a number (for 'replace': a value of the same kind as the default in tuning.js)
 *
 * HOW SEVERAL EFFECTS ON THE SAME STAT COMBINE (so the order never matters):
 *     result = ( (set ?? starting value) + all the 'add's ) x all the 'mul's
 * The one exception is 'replace': if several perks replace the same list, the last one wins.
 *
 * This file is pure maths: no DOM, no game data.
 */

import { DEFAULT_TUNING, isTuningKey } from '../tuning.js';

export const BASE_STATS = Object.freeze(['baseDamage', 'fireRate']);
export const OPS = Object.freeze(['add', 'mul', 'set', 'replace']);

/** Numbers can be added / multiplied / set; anything else (a list...) can only be replaced. */
const isNumericStat = (stat) => BASE_STATS.includes(stat) || typeof DEFAULT_TUNING[stat] === 'number';

export const isKnownStat = (stat) => BASE_STATS.includes(stat) || isTuningKey(stat);

/** Returns a readable problem description, or null if the effect is fine. */
export function checkEffect(effect) {
  if (effect === null || typeof effect !== 'object') return 'effect must be an object';
  if (!isKnownStat(effect.stat)) return `unknown stat "${effect.stat}" (see tuning.js)`;
  if (!OPS.includes(effect.op)) return `unknown op "${effect.op}" (use add, mul, set or replace)`;

  if (effect.op === 'replace') {
    if (isNumericStat(effect.stat)) return `"${effect.stat}" is a number: use op 'set' ('replace' is for lists and other non-numbers)`;
    const original = DEFAULT_TUNING[effect.stat];
    if (Array.isArray(original) !== Array.isArray(effect.value) || typeof original !== typeof effect.value) {
      return `"${effect.stat}": the replacement must be the same kind of value as the default (${Array.isArray(original) ? 'a list' : typeof original})`;
    }
    return null;
  }
  if (!isNumericStat(effect.stat)) return `"${effect.stat}" is not a number: only op 'replace' works on it`;
  if (!Number.isFinite(effect.value)) return `value must be a number (stat "${effect.stat}")`;
  return null;
}

/**
 * @param {Record<string, number>} base     starting values, e.g. { baseDamage: 1, fireRate: 1.4, ...DEFAULT_TUNING }
 * @param {{stat: string, op: string, value: number}[]} effects
 * @returns {Record<string, number>} a new object with the same keys
 */
export function applyEffects(base, effects) {
  const groups = new Map();
  for (const { stat, op, value } of effects) {
    const group = groups.get(stat) ?? { set: undefined, add: 0, mul: 1, replace: undefined };
    if (op === 'replace') group.replace = value; // the last replace wins
    else if (op === 'set') group.set = value;
    else if (op === 'add') group.add += value;
    else group.mul *= value;
    groups.set(stat, group);
  }

  const result = { ...base };
  for (const [stat, { set, add, mul, replace }] of groups) {
    if (replace !== undefined) {
      result[stat] = replace;
      continue;
    }
    result[stat] = ((set ?? result[stat] ?? 0) + add) * mul;
  }
  return result;
}

/** Tuning values that differ from the defaults: [{ key, from, to }]. */
export function changedTuning(tuning) {
  return Object.keys(DEFAULT_TUNING)
    .filter((key) => tuning[key] !== DEFAULT_TUNING[key])
    .map((key) => ({ key, from: DEFAULT_TUNING[key], to: tuning[key] }));
}
