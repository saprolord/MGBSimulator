/**
 * SIMULATION
 * ==========
 * Runs many trials and aggregates them into { ev, min, max, distribution }.
 *
 * It is written as a resumable object (call run() repeatedly) so the caller decides how to
 * schedule the work: in a Web Worker, in time-sliced chunks on the main thread, or all at once
 * in a unit test. See runner.js.
 */

import { DAMAGE_PRECISION } from '../config.js';
import { compileShip, unusedDamageBonus } from './ship.js';
import { traceShip } from './trace.js';
import { TrialRunner } from './trial.js';
import { buildDistribution } from './histogram.js';

/**
 * @typedef {object} SimulationParams
 * @property {number} trials               how many trials to run
 * @property {number} [fireRate=1]         multiplies every trial's damage (shots per second)
 * @property {number} [baseDamage=1]       damage of a freshly fired projectile
 * @property {number} [maxTier=0]          player's max tier (used by Tier Damage)
 * @property {number} [burstCount=0]       extra shots fired per trial
 * @property {number} [burstDamageMult=1]  damage multiplier for those extra shots
 */

export class Simulation {
  /**
   * @param {object[][]} grid  the ship grid (see model/grid.js)
   * @param {SimulationParams} params
   * @param {() => number} [rng]  random source; pass a seeded one for reproducible tests
   */
  constructor(grid, params, rng = Math.random) {
    const { trials, fireRate = 1, baseDamage = 1, maxTier = 0, burstCount = 0, burstDamageMult = 1 } = params;

    this.total = trials;
    this.completed = 0;
    this.fireRate = fireRate;

    // Results are tallied as integers in units of 1/DAMAGE_PRECISION (tenths) - cheaper and
    // exact compared with using floats as Map keys.
    this.counts = new Map();
    this.sum = 0;
    this.min = Infinity;
    this.max = -Infinity;

    const ship = compileShip(grid);
    if (ship.emitter === null) {
      this.runner = null; // nothing to simulate
      this.completed = trials;
      return;
    }

    // "Unused" ejectors = ejectors no projectile path ends on (used by Ejector Damage).
    const reached = new Set(traceShip(ship).map((path) => path[path.length - 1]));
    const unusedEjectors = ship.ejectors.filter((cell) => !reached.has(cell)).length;

    this.runner = new TrialRunner(
      ship,
      { baseDamage, burstCount, burstDamageMult, maxTier, unusedEjectors, unusedDamageBonus: unusedDamageBonus(ship) },
      rng,
    );
  }

  get done() {
    return this.completed >= this.total;
  }

  /** Run up to `batchSize` more trials. */
  run(batchSize) {
    if (this.done) return;
    const { runner, fireRate, counts } = this;
    const end = Math.min(this.completed + batchSize, this.total);

    let { sum, min, max } = this;
    for (let i = this.completed; i < end; i++) {
      const key = Math.round(fireRate * runner.runTrial() * DAMAGE_PRECISION);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      sum += key;
      if (key < min) min = key;
      if (key > max) max = key;
    }

    this.sum = sum;
    this.min = min;
    this.max = max;
    this.completed = end;
  }

  /** Final statistics. Call once the simulation is done. */
  result() {
    if (this.runner === null) {
      return { ev: 0, min: 0, max: 0, distribution: [{ label: '0', probability: 1 }] };
    }
    const entries = [...this.counts]
      .sort((a, b) => a[0] - b[0])
      .map(([key, count]) => [key / DAMAGE_PRECISION, count]);

    return {
      ev: Number((this.sum / DAMAGE_PRECISION / this.total).toFixed(2)),
      min: this.min / DAMAGE_PRECISION,
      max: this.max / DAMAGE_PRECISION,
      distribution: buildDistribution(entries, this.total),
    };
  }
}
