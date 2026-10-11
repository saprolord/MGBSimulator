/**
 * TRIAL RUNNER
 * ============
 * Simulates one "trial": every projectile fired by the generator (one shot, or a burst of
 * several), moving one tile per step, until all projectiles have stopped. Returns the total
 * damage that reached ejectors.
 *
 * Projectiles are processed in strict FIFO order, one tile per turn. That ordering is part of
 * the maths: stateful blocks (Charge, Damage Comeback, Combine 10, Damage Cross) see projectiles
 * in the order they arrive, so do not "optimise" it into depth-first or multi-tile jumps.
 *
 * PERFORMANCE NOTES
 *  - The projectile queue is a set of pre-allocated typed arrays. Each shot pops at most
 *    `maxProjectileSteps` entries and every pop pushes at most `maxEmitsPerVisit` new ones, so
 *    the arrays can never overflow and there is no per-step allocation.
 *  - A "head" index replaces Array.shift() (which is O(n)).
 *  - Per-tile memory (charge, comeback, accumulator) lives in typed arrays indexed by cell.
 *
 * PERSISTENT STATE
 *  Charge / Damage Comeback / Combine 10 keep their memory from one trial to the next - this is
 *  intentional ("the gun has been firing for a while"). Damage Cross tickets, however, only live
 *  for one shot, so they are cleared after each shot to keep memory flat.
 */

import { ENGINE_LIMITS } from '../config.js';
import { ABSORB } from '../blocks.js';
import { KIND } from './ship.js';

const QUEUE_CAPACITY = ENGINE_LIMITS.maxProjectileSteps * ENGINE_LIMITS.maxEmitsPerVisit + 1;
const { FREE, BLOCK, EJECTOR } = KIND;

export class TrialRunner {
  /**
   * @param {object} ship    result of compileShip()
   * @param {object} params  { baseDamage, burstCount, burstDamageMult, maxTier,
   *                           unusedEjectors, unusedDamageBonus }
   * @param {() => number} rng  returns a float in [0, 1)
   */
  constructor(ship, params, rng) {
    this.ship = ship;
    this.rng = rng;

    this.baseDamage = params.baseDamage;
    this.burstCount = params.burstCount;
    this.burstDamageMult = params.burstDamageMult;
    this.maxTier = params.maxTier;
    this.unusedEjectors = params.unusedEjectors;
    this.ejectionMultiplier = 1 + params.unusedDamageBonus;

    // Per-tile memory that persists across trials (indexed by cell).
    const n = ship.cellCount;
    this.charge = new Float64Array(n);
    this.lastDamage = new Float64Array(n).fill(-1);
    this.accCount = new Int32Array(n);
    this.accDamage = new Float64Array(n);

    // Damage Cross tickets (cleared after every shot).
    this.crossRecords = new Map();
    this.crossCounter = 0;

    // Projectile queue (struct-of-arrays).
    this.qCell = new Int32Array(QUEUE_CAPACITY);
    this.qHeading = new Uint8Array(QUEUE_CAPACITY);
    this.qDamage = new Float64Array(QUEUE_CAPACITY);
    this.qOriginal = new Uint8Array(QUEUE_CAPACITY);
    this.qTurn = new Uint8Array(QUEUE_CAPACITY);
    this.qStamps = new Array(QUEUE_CAPACITY).fill(null);
    this.tail = 0;

    // The projectile currently entering a block; reused for every visit (see blocks.js).
    this.visit = { cell: 0, heading: 0, rot: 0, damage: 0, original: 1, turnActive: 0, stamps: null };
  }

  // ---- `out` interface used by blocks' route() -------------------------------------------

  /** Release a projectile from the current block. Keeps "original" status. */
  emit(heading) {
    this.#push(heading, this.visit.original);
  }

  /** Release a non-original copy. */
  emitCopy(heading) {
    this.#push(heading, 0);
  }

  /** Release exactly one projectile, heading chosen uniformly from the given headings. */
  emitOneOf(a, b, c) {
    const roll = this.rng();
    if (c === undefined) {
      this.emit(roll < 0.5 ? a : b);
    } else {
      this.emit(roll < 1 / 3 ? a : roll > 2 / 3 ? c : b);
    }
  }

  #push(heading, original) {
    const t = this.tail;
    if (t >= QUEUE_CAPACITY) return; // unreachable while blocks respect maxEmitsPerVisit
    const v = this.visit;
    this.qCell[t] = v.cell;
    this.qHeading[t] = heading;
    this.qDamage[t] = v.damage;
    this.qOriginal[t] = original;
    this.qTurn[t] = v.turnActive;
    this.qStamps[t] = v.stamps;
    this.tail = t + 1;
  }

  // ---- Simulation --------------------------------------------------------------------------

  /** One full trial: the first shot plus `burstCount` follow-up shots. Returns total damage. */
  runTrial() {
    let total = this.runShot(this.baseDamage);
    for (let shot = 1; shot <= this.burstCount; shot++) {
      total += this.runShot(this.baseDamage * this.burstDamageMult);
    }
    return total;
  }

  /** Fire one projectile from the generator and follow everything it spawns. */
  runShot(startDamage) {
    const { kind, rot, block, next, emitter } = this.ship;
    const { qCell, qHeading, qDamage, qOriginal, qTurn, qStamps, visit } = this;
    const maxSteps = ENGINE_LIMITS.maxProjectileSteps;

    this.crossRecords.clear();
    qCell[0] = emitter.cell;
    qHeading[0] = emitter.heading;
    qDamage[0] = startDamage;
    qOriginal[0] = 1;
    qTurn[0] = 0;
    qStamps[0] = null;
    this.tail = 1;

    let head = 0;
    let steps = 0;
    let ejected = 0;

    while (head < this.tail && steps < maxSteps) {
      steps++;
      const i = head++;
      const heading = qHeading[i];
      const cell = next[qCell[i] * 4 + heading];
      if (cell < 0) continue; // flew off the grid

      const cellKind = kind[cell];

      if (cellKind === FREE) {
        // Move one tile forward and re-queue (keeps strict one-tile-per-turn ordering).
        const t = this.tail++;
        qCell[t] = cell;
        qHeading[t] = heading;
        qDamage[t] = qDamage[i];
        qOriginal[t] = qOriginal[i];
        qTurn[t] = qTurn[i];
        qStamps[t] = qStamps[i];
      } else if (cellKind === EJECTOR) {
        ejected += qDamage[i] * this.ejectionMultiplier;
      } else if (cellKind === BLOCK) {
        const def = block[cell];
        if (def === null) continue;
        if (heading !== rot[cell] && !def.acceptsAnyEntry) continue; // wrong way in: stops

        visit.cell = cell;
        visit.heading = heading;
        visit.rot = rot[cell];
        visit.damage = qDamage[i];
        visit.original = qOriginal[i];
        visit.turnActive = qTurn[i];
        visit.stamps = qStamps[i];

        if (def.effect !== null) {
          const damage = def.effect(visit, this);
          if (damage === ABSORB) continue;
          visit.damage = damage;
        }
        def.route(visit, this);
      }
      // SOLID and INERT cells: the projectile simply stops.
    }

    return ejected;
  }
}
