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
  x2SplitDamage: 2, // Damagemultiplier for 2 way random split
  x3SplitDamage: 3, // Damagemultiplier for 2 way random split
  
  //Random Damage table
  Random_Damage_Table: [[1,0],[10,1],[11,2],[12,3],[13,4]],

  // ---- Special damage blocks
  chargeBonusRate: 0.1, // Charge: bonus damage = this share of the stored charge
  chargeDecayRate: 0.1, //         this share of the stored charge is spent
  chargeStoreRate: 0.2, //         this share of the outgoing damage is stored
  tierDamageRate: 0.1, // Tier Damage: + this x max tier
  ejectorDamageEach: 10, // Ejector Damage: + this per unused ejector
  combineCount: 10, // Combine 10: releases every Nth projectile...
  combineMultiplier: 2, //          ...carrying the sum of all of them times this
  stockpileRate: 0.1, // Damage Stockpile: + this share of damage per empty tile
  comebackMultiplier: 4, //Multiply damage by 4 if it is less than the previous projectile
  damageCrossMultiplier: 1, //Muliply the damage recorded

  // ---- Perk-driven extras (all "off" by default, so they change nothing until a perk turns them on)
  cloneExtraChance: 0, // Clone: chance of one more copy (3 projectiles instead of 2)
  addLargePerTile: 0, // Add 100 Damage: + this x (tiles travelled from the generator to the block)
  randomRerollZero: 0, // Random Damage: 1 = a roll of x0 is rerolled once
  randomMultiplierScale: 1, // Random Damage: every multiplier is multiplied by this (0.85 = -15 %)
  twoWaySplitChance: 0, //Chance of splitting the path in two with full damage
  threeWaySplitChance: 0, //Chance of splitting the path in three with full damage
  duplicateChance: 0, //Chance of duplicate a copied bullet
  addSmallPerBlock: 0, // Add 1 Damage: + this x (number of Add 1 Damage blocks on the whole ship, itself included)
  guidedAllGuides: 0, // Guided Damage: 1 = the splitters boost damage too (not only the turn blocks)
  accumulatorUsesHigher: 0, // Combine 10: 1 = each projectile counts as the higher of its damage and the previous one's
  emptySlotDamage: 0, // + this flat damage for every empty slot a projectile crosses on its way

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
