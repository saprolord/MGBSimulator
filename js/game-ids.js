/**
 * IN-GAME ITEM IDs
 * ================
 * Each tile of the 366-digit game code is 3 digits: a 2-digit ID (00-99) + 1 orientation digit.
 * This file maps those IDs to our tiles and blocks. FILL IN THE NUMBERS (replace each null).
 *
 *   - IDs are whole numbers 0-99 and must be unique across BOTH tables (one shared ID space).
 *   - A null means "not known yet": importing skips that item, exporting refuses (and names it).
 *   - Add a line here whenever you add a block in blocks.js (names must match exactly).
 *   - `node --test` checks for duplicates, out-of-range numbers and (once you start filling in)
 *     blocks that are still missing.
 */

import { TILE } from './config.js';

/** The ship itself. Generator orientation = the way it fires; the others use orientation 0. */
export const TILE_GAME_IDS = {
  [TILE.EMPTY]:     0,
  [TILE.SOLID]:     1,
  [TILE.EJECTOR]:   3,
  [TILE.GENERATOR]: 2,
};

/** Modifier blocks (orientation: 0 = up, 1 = right, 2 = down, 3 = left). */
export const BLOCK_GAME_IDS = {
  'Guide Right':            5,
  'Guide Left':             4,
  '2-Way Split':            14,
  '3-way Split':            17,
  'Add 1 Damage':           6,
  'Add Projectile':         16,
  'x2 Damage':              20,
  'x10 Damage':             21,
  'Random Damage':          39,
  'Charge':                 36,
  'Damage Cross':           30,
  '2-Way Random Split':     22,
  '3-Way Random Split':     23,
  'Tier Damage':            48,
  'Damage Comeback':        41,
  'Damage Stockpile':       43,
  'Combine 10':             45,
  'Guided Damage':          47,
  'Add 100 Damage':         40,
  'Ejector Damage':         49,
  'Clone':                  51,
  'Input Portal':              64,
  'Output Portal':             65,
  'Thermite Round':         56,
  'Charged Round':          55,
  'Plutonium Round':        57,
  'Speed Up':               15,   // visual only
  'Slow Down':              31,   // visual only
  'Spread Left':            9,   // visual only
  'Spread Right':           10,   // visual only
  'Large Spread':           8,   // visual only
  'Small Spread':           7,   // visual only
  'Curve Left':             12,   // visual only
  'Curve Right':            13,   // visual only
  'Random Curve':           11,   // visual only
  'Return Bounce':          26,   // visual only
  'Random Bounce':          25,   // visual only
  'Ricochet':               34,   // visual only
  'Double Lifetime':        28,   // visual only
  'Death Pierce':           18,   // visual only
  'Pierce':                 19,   // visual only
  'Circle AoE':             24,   // visual only
  'Rectangle AoE':          38,   // visual only
  'Magnet':                 32,   // visual only
  'Align Direction':        33,   // visual only
  'Line Magnet':            35,   // visual only
  'Shoot Upward':           27,   // visual only
  'Sideways':               37,   // visual only
  'Money Cross':            29,   // visual only
  'Evolved Damage':         46,   // visual only
  'Slow Burn':              44,   // visual only
  'Crisscross':             42,   // visual only
  'Sparse Damage':          50,   // visual only
  'Shield Piercing':        52,     // visual only
  'Armor Piercing':         53,     // visual only
  'Double Piercing':        54,     // visual only
  'Protonic':               58,     // visual only
  'Incendiary':             59,     // visual only
  'Void Innoculation':      62,     // visual only
  'Energy Siphon':          60,     // visual only
  'Energy Disrupt':         61,     // visual only
  'Void Resistance':        63,     // visual only
}
