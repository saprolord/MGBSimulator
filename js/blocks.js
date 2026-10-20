/**
 * BLOCK REGISTRY
 * ==============
 * Single source of truth for every modifier block. The palette, the canvas, the share-link
 * format, the path preview and the Monte-Carlo engine are all driven from this list.
 *
 * TO ADD A NEW BLOCK
 *   1. Drop its image in Images/.
 *   2. Add one entry below. Give it the next unused `shareId` (never reuse or change an existing
 *      one - that would break old share links). The array order is the palette order.
 *   3. Done. If it only needs to pass projectiles through, use `visualOnly(...)`.
 *
 * ANATOMY OF AN ENTRY
 *   name            Unique display name (also stored in the grid).
 *   image           File name inside Images/.
 *   shareId         Permanent number used in share links (0-255).
 *   directional     true => kept by the "Clear Path" button.
 *   implemented     false => drawn greyed-out in the UI ("visual only").
 *   maxPerShip      (optional) most copies allowed on one ship. Enforced when placing / loading.
 *   portal          (optional) 'in' | 'out'. Marks the teleporter pair (see engine/ship.js).
 *   acceptsAnyEntry false => projectiles are only accepted when travelling in the block's facing
 *                   direction; anything else stops. (Only Damage Cross is more permissive.)
 *   route(v, out)   WHERE does the projectile go? Called by BOTH the path preview and the
 *                   simulation, so they can never disagree. Call out.emit(heading) once per
 *                   projectile leaving the block. Emit nothing to swallow the projectile.
 *   effect(v, sim)  (optional) WHAT happens to its damage? Simulation only. Return the new damage,
 *                   or ABSORB to swallow the projectile. May mutate `v.turnActive` / `v.stamps`.
 *
 * THE `v` ("visit") OBJECT - the projectile currently entering the block
 *   v.cell        flat tile index (row * GRID_SIZE + col)
 *   v.heading     direction the projectile is travelling (see headings.js)
 *   v.rot         the block's own facing direction
 *   v.damage      damage carried on arrival
 *   v.original    1 if this is the "original" projectile (not made by Add Projectile / Clone)
 *   v.turnActive  1 once the projectile passed a Guided Damage block
 *   v.stamps      Damage Cross bookkeeping (see below)
 *   v.ship        the compiled ship (engine/ship.js), e.g. v.ship.portalOut

 *
 * THE `out` OBJECT - how a block releases projectiles
 *   out.emit(heading)         projectile continues (keeps its "original" status)
 *   out.emitCopy(heading)     projectile continues as a non-original copy
 *   out.emitAt(cell, heading) teleport: release the projectile from another tile

 *   out.emitOneOf(a, b[, c])  simulation: pick ONE heading at random; path preview: show them all
 *
 * THE `sim` OBJECT - simulation state (see engine/trial.js)
 *   sim.rng(), sim.tuning.<key> (rule numbers, see tuning.js), sim.maxTier, sim.unusedEjectors, and per-tile memory that persists across trials:
 *   sim.charge[], sim.lastDamage[], sim.accCount[], sim.accDamage[], sim.crossRecords.
 */

import { left, right, opposite } from './headings.js';

/** Returned from effect() to swallow the projectile. */
export const ABSORB = -1;

// ---------------------------------------------------------------------------
// Tuning numbers (the game's rules). Change them here, nowhere else.
// ---------------------------------------------------------------------------
// The rule numbers (chances, multipliers, rates) live in tuning.js and are read as `sim.tuning.<key>`,
// so that skills and perks can change them.


// ---------------------------------------------------------------------------
// Reusable routing / effect building blocks
// ---------------------------------------------------------------------------
const forward = (v, out) => out.emit(v.heading);

const guidedBoost = (v, sim) => (v.turnActive ? (v.damage * sim.tuning.guidedTurnBonus) : (v.damage));
const turnLeftBoost = (v, sim) => (v.turnActive ? (v.damage * sim.tuning.guidedTurnBonus + sim.tuning.turnLeftDamage) : 
(v.damage+sim.tuning.turnLeftDamage));
const turnRightBoost = (v, sim) => (v.turnActive ? (v.damage * sim.tuning.guidedTurnBonus + sim.tuning.turnRightDamage) : 
(v.damage+sim.tuning.turnRightDamage));
/** Effect that adds the tuning value `key` to the damage. */
const addTuned = (key) => (v, sim) => v.damage + sim.tuning[key];
const multTuned = (key) => (v, sim) => v.damage * sim.tuning[key];

function define(spec) {
  return Object.freeze({
    directional: false,
    implemented: true,
    acceptsAnyEntry: false,
    effect: null,
    ...spec,
  });
}

/** A block that exists in the game but does not change the damage maths (yet). */
const visualOnly = (name, shareId, image) =>
  define({ name, shareId, image, implemented: false, route: forward });

// ---------------------------------------------------------------------------
// THE BLOCKS (array order = palette order)
// ---------------------------------------------------------------------------
export const BLOCKS = Object.freeze([
  // ---- Direction blocks ---------------------------------------------------
  define({
    name: 'Guide Right', shareId: 0x00, image: 'Right_turn.webp', directional: true,
    effect: turnRightBoost,
    route: (v, out) => out.emit(right(v.rot)),
  }),
  define({
    name: 'Guide Left', shareId: 0x01, image: 'Left_turn.webp', directional: true,
    effect: turnLeftBoost,
    route: (v, out) => out.emit(left(v.rot)),
  }),
  define({
    name: '2-Way Split', shareId: 0x02, image: 'Split_sides.webp', directional: true,
    route: (v, out) => {
      out.emit(left(v.rot));
      out.emit(right(v.rot));
    },
  }),
  define({
    name: '3-way Split', shareId: 0x06, image: 'Split_all.webp', directional: true,
    route: (v, out) => {
      out.emit(left(v.rot));
      out.emit(v.rot);
      out.emit(right(v.rot));
    },
  }),

  // ---- Damage / projectile modifiers --------------------------------------
  define({
    name: 'Add 1 Damage', shareId: 0x03, image: 'More_damage.webp',
    effect: addTuned('addDamageSmall'),
    route: forward,
  }),
  define({
    name: 'Add Projectile', shareId: 0x04, image: 'Clone_bullet.webp',
    // The original projectile is duplicated; duplicates pass through untouched.
    route: (v, out) => {
      out.emit(v.heading);
      if (v.original) out.emitCopy(v.heading);
    },
  }),
  define({
    name: 'x2 Damage', shareId: 0x05, image: 'Double_damage.webp',
    effect: (v, sim) => (sim.rng() < sim.tuning.x2Chance ? v.damage * sim.tuning.x2Multiplier : v.damage),
    route: forward,
  }),
  define({
    name: 'x10 Damage', shareId: 0x09, image: 'Tenfold_damage.webp',
    effect: (v, sim) => (sim.rng() < sim.tuning.x10Chance ? v.damage * sim.tuning.x10Multiplier : v.damage),
    route: forward,
  }),
  define({
    name: 'Random Damage', shareId: 0x0a, image: 'Gamble_damage.webp',
    effect: (v, sim) => {
      const roll = sim.rng() * 13;
      for (const [limit, multiplier] of sim.tuning.Random_Damage_Table) {
        if (roll < limit) return v.damage * multiplier;
      }
      return v.damage * RANDOM_DAMAGE_TABLE[RANDOM_DAMAGE_TABLE.length - 1][1];
    },
    route: forward,
  }),
  define({
    // Remembers a charge between projectiles (and between trials).
    name: 'Charge', shareId: 0x0d, image: 'Damage_regulator.webp',
    effect: (v, sim) => {
      const stored = sim.charge[v.cell];
      const damage = v.damage + stored * sim.tuning.chargeBonusRate;
      sim.charge[v.cell] = stored - stored * sim.tuning.chargeDecayRate + damage * sim.tuning.chargeStoreRate;
      return damage;
    },
    route: forward,
  }),
  define({
    /**
     * Damage Cross. Projectiles may enter from any side except the front (the side it faces).
     *  - Entering from the side ("aux" entries): the projectile's damage is RECORDED and the
     *    projectile is stamped with a ticket for this cross; it leaves straight on.
     *  - Entering from behind (the main entry): the recorded damage of the projectile's ticket
     *    is ADDED to it; it leaves straight on.
     */
    name: 'Damage Cross', shareId: 0x14, image: 'Damage_loop.webp', directional: true, acceptsAnyEntry: true,
    effect: (v, sim) => {
      if (v.heading === v.rot) {
        const ticket = v.stamps !== null ? v.stamps[v.cell] : undefined;
        const recorded = ticket !== undefined ? sim.crossRecords.get(ticket) : undefined;
        return recorded !== undefined ? v.damage + recorded : v.damage;
      }
      if (v.heading === opposite(v.rot)) return ABSORB; // entering through the exit is blocked
      const ticket = ++sim.crossCounter;
      sim.crossRecords.set(ticket, v.damage);
      // Copy-on-write: stamps objects are shared between clones, so never mutate in place.
      v.stamps = { ...v.stamps, [v.cell]: ticket };
      return v.damage;
    },
    route: (v, out) => {
      if (v.heading !== opposite(v.rot)) out.emit(v.heading);
    },
  }),
  define({
    name: '2-Way Random Split', shareId: 0x07, image: 'Random_double.webp', directional: true,
    effect: (v) => v.damage * 2,
    route: (v, out) => out.emitOneOf(left(v.rot), right(v.rot)),
  }),
  define({
    name: '3-Way Random Split', shareId: 0x08, image: 'Random_triple.webp', directional: true,
    effect: (v) => v.damage * 3,
    route: (v, out) => out.emitOneOf(left(v.rot), v.rot, right(v.rot)),
  }),
  define({
    name: 'Tier Damage', shareId: 0x12, image: 'Max_tier_damage.webp', maxPerShip: 1,
    effect: (v, sim) => v.damage + sim.maxTier * sim.tuning.tierDamageRate,
    route: forward,
  }),
  define({
    // x4 damage when this projectile carries less than the previous one that passed through.
    name: 'Damage Comeback', shareId: 0x11, image: 'Double_size_and_damage.webp', maxPerShip: 1,
    effect: (v, sim) => {
      const previous = sim.lastDamage[v.cell]; // -1 = nothing has passed yet
      sim.lastDamage[v.cell] = v.damage;
      return previous >= 0 && v.damage < previous ? v.damage * 4 : v.damage;
    },
    route: forward,
  }),
  define({
    // Pure marker: its effect (+10 % per empty tile) is applied globally at the ejector.
    name: 'Damage Stockpile', shareId: 0x0e, image: 'Empty_tile_damage_boost.webp', maxPerShip: 1,
    route: forward,
  }),
  define({
    // Swallows projectiles; every 10th one leaves carrying the doubled sum of the last 10.
    name: 'Combine 10', shareId: 0x10, image: 'Accumulator.webp', maxPerShip: 1,
    effect: (v, sim) => {
      const i = v.cell;
      sim.accCount[i]++;
      sim.accDamage[i] += v.damage;
      if (sim.accCount[i] < sim.tuning.combineCount) return ABSORB;
      const combined = sim.accDamage[i] * sim.tuning.combineMultiplier;
      sim.accCount[i] = 0;
      sim.accDamage[i] = 0;
      return combined;
    },
    route: forward,
  }),
  define({
    // After this block every turn block boosts the projectile (see guidedBoost).
    name: 'Guided Damage', shareId: 0x13, image: 'Turn_damage.webp', maxPerShip: 1,
    effect: (v) => {
      v.turnActive = 1;
      return v.damage;
    },
    route: forward,
  }),
  define({
    name: 'Add 100 Damage', shareId: 0x0b, image: 'Add_100_damage.webp', maxPerShip: 1,
    effect: addTuned('addDamageLarge'),
    route: forward,
  }),
  define({
    name: 'Ejector Damage', shareId: 0x0f, image: '10_damage_unused_ejector.webp', maxPerShip: 1,
    effect: (v, sim) => v.damage + sim.unusedEjectors * sim.tuning.ejectorDamageEach,
    route: forward,
  }),
  define({
    name: 'Clone', shareId: 0x0c, image: 'Duplicate_bullet.webp', maxPerShip: 1,
    route: (v, out) => {
      out.emit(v.heading);
      out.emitCopy(v.heading);
    },
  }),
  define({
    name: 'Thermite Round', shareId: 0x30, image: 'Thermite Round.png',
    effect: (v, sim) => (sim.rng() < sim.tuning.factionChance ? v.damage * sim.tuning.factionMultiplier : v.damage),
    route: forward,
  }),
  define({
    name: 'Charged Round', shareId: 0x31, image: 'Charged Round.png',
    effect: (v, sim) => (sim.rng() < sim.tuning.factionChance ? v.damage * sim.tuning.factionMultiplier : v.damage),
    route: forward,
  }),
  define({
    name: 'Plutonium Round', shareId: 0x32, image: 'Plutonium Round.png',
    effect: (v, sim) => (sim.rng() < sim.tuning.factionChance ? v.damage * sim.tuning.factionMultiplier : v.damage),
    route: forward,
  }),
  define({
    // A projectile entering from the front does not continue: it reappears at the output portal.
    // With no output portal on the ship it simply ends here.
    name: 'Input Portal', shareId: 0x33, image: 'Input Portal.jpg', directional: true, maxPerShip: 1, portal: 'in',
    route: (v, out) => {
      const exit = v.ship.portalOut;
      if (exit !== null) out.emitAt(exit.cell, opposite(exit.heading));
    },
  }),
  define({
    // Only the exit of the teleporter: it leaves through the side that normally receives
    // projectiles (the back). Projectiles that run into it directly are swallowed.
    name: 'Output Portal', shareId: 0x34, image: 'Output Portal.jpg',directional: true, maxPerShip: 1, portal: 'out',
    route: () => {},
  }),  
  define({
    name: 'Curve Right', shareId: 0x1c, image: 'Curve_right.webp',
    effect: multTuned('curveRightDamage'),     
    route: forward,
  }), 
  define({
    name: 'Curve Left', shareId: 0x1b, image: 'Curve_left.webp',     
    route: forward,
    effect: multTuned('curveLeftDamage'),
  }),


  // ---- Visual-only blocks (kept for completeness and for copy/pasting ships) -------------
  visualOnly('Speed Up', 0x15, 'More_speed.webp'),
  visualOnly('Slow Down', 0x16, 'Less_speed.webp'),
  visualOnly('Spread Left', 0x17, 'Eject_to_the_left.webp'),
  visualOnly('Spread Right', 0x18, 'Eject_to_the_right.webp'),
  visualOnly('Large Spread', 0x19, 'Eject_randomly.webp'),
  visualOnly('Small Spread', 0x1a, 'Eject_narrow.webp'),
  //visualOnly('Curve Left', 0x1b, 'Curve_left.webp'),
  //visualOnly('Curve Right', 0x1c, 'Curve_right.webp'),
  visualOnly('Random Curve', 0x1d, 'Curve_randomly.webp'),
  visualOnly('Return Bounce', 0x1e, 'Bounce_back.webp'),
  visualOnly('Random Bounce', 0x1f, 'Bounce_randomly.webp'),
  visualOnly('Ricochet', 0x20, 'Realistic_bounce.webp'),
  visualOnly('Double Lifetime', 0x21, 'More_projectile_lifetime.webp'),
  visualOnly('Death Pierce', 0x22, 'Persistent_damage.webp'),
  visualOnly('Pierce', 0x23, 'Pierce.webp'),
  visualOnly('Circle AoE', 0x24, 'Aoe.webp'),
  visualOnly('Rectangle AoE', 0x25, 'Square_aoe.webp'),
  visualOnly('Magnet', 0x26, 'Bullet_magnet.webp'),
  visualOnly('Align Direction', 0x27, 'Bullet_align.webp'),
  visualOnly('Line Magnet', 0x28, 'Ship_line_bullet_magnet.webp'),
  visualOnly('Shoot Upward', 0x29, 'Forward.webp'),
  visualOnly('Sideways', 0x2a, 'Sideways.webp'),
  visualOnly('Money Cross', 0x2b, 'Money_loop.webp'),
  visualOnly('Evolved Damage', 0x2c, 'More_damage_at_end_of_lifetime.webp'),
  visualOnly('Slow Burn', 0x2d, 'Speed_damage_boost.webp'),
  visualOnly('Crisscross', 0x2e, 'Zigzag_bullet.webp'),
  visualOnly('Sparse Damage', 0x2f, 'Double_damage_10_bullet_screen.webp'),
  visualOnly('Armor Piercing', 0x35, 'Armor Piercing.png'),
  visualOnly('Energy Siphon', 0x36, 'Energy Siphon.png'),
  visualOnly('Incendiary', 0x37, 'Incendary.png'),
  visualOnly('Shield Piercing', 0x38, 'Shield Piercing.png'),
  visualOnly('Energy Disrupt', 0x39, 'Energy Disrupt.png'),
  visualOnly('Protonic', 0x3a, 'Protonic.png'),
  visualOnly('Void Resistance', 0x3b, 'Void Resistance.png'),
  visualOnly('Double Piercing', 0x3c, 'Double Piercing.png'),
  visualOnly('Void Innoculation', 0x3d, 'Void Innoculation.png'),

]);

// ---------------------------------------------------------------------------
// Lookups + registry validation (fails loudly at load time if two blocks collide)
// ---------------------------------------------------------------------------
const byName = new Map();
const byShareId = new Map();
for (const block of BLOCKS) {
  if (byName.has(block.name)) throw new Error(`Duplicate block name: ${block.name}`);
  if (byShareId.has(block.shareId)) throw new Error(`Duplicate shareId 0x${block.shareId.toString(16)}: ${block.name}`);
  if (block.shareId < 0 || block.shareId > 0xff) throw new Error(`shareId out of range: ${block.name}`);
  byName.set(block.name, block);
  byShareId.set(block.shareId, block);
}

export const getBlock = (name) => byName.get(name) ?? null;
export const getBlockByShareId = (id) => byShareId.get(id) ?? null;
export const isDirectionalBlock = (name) => byName.get(name)?.directional === true;
