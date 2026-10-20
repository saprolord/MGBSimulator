/**
 * TUNING: every number that defines how the blocks behave.
 * =========================================================
 * The blocks in blocks.js read these through `sim.tuning.<key>` instead of hard-coding them, which
 * is what lets captains, skills and perks change them (see loadout/effects.js). Each key here is
 * also a valid `stat` for an effect.
 *
 * TO ADD A TUNABLE NUMBER: add it here with its normal value, then read it in the block as
 * `sim.tuning.myKey`. That's all - perks and skills can target it straight away.
 */

export const DEFAULT_TUNING = Object.freeze({
  // ---- Direction blocks
  guidedTurnBonus: 1.1, // Guided Damage: every turn block afterwards multiplies damage by this

  // ---- Plain damage blocks
  addDamageSmall: 1, // "Add 1 Damage"
  addDamageLarge: 100, // "Add 100 Damage"
  x2Chance: 0.33, // "x2 Damage": chance to multiply...
  x2Multiplier: 2, //              ...by this
  x10Chance: 0.04, // "x10 Damage": chance to multiply...
  x10Multiplier: 10, //             ...by this

  // ---- Special damage blocks
  chargeBonusRate: 0.1, // Charge: bonus damage = this share of the stored charge
  chargeDecayRate: 0.1, //         this share of the stored charge is spent
  chargeStoreRate: 0.2, //         this share of the outgoing damage is stored
  tierDamageRate: 0.1, // Tier Damage: + this x max tier
  ejectorDamageEach: 10, // Ejector Damage: + this per unused ejector
  combineCount: 10, // Combine 10: releases every Nth projectile...
  combineMultiplier: 2, //          ...carrying the sum of all of them times this
  stockpileRate: 0.1, // Damage Stockpile: + this share of damage per empty tile

  // ---- Faction rounds (Thermite / Charged / Plutonium)
  factionChance: 0.45,
  factionMultiplier: 2.6,

  // ---- Non damage block (upgradable through perks and skils)
  turnRightDamage: 0,   // damage addition
  turnLeftDamage: 0,    // damage addition
  curveRightDamage: 1,  // damage multiplication
  curveLeftDamage: 1,   // damage multiplication
});

export const isTuningKey = (key) => Object.hasOwn(DEFAULT_TUNING, key);
