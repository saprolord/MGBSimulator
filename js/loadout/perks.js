/**
 * PERK TREE
 * =========
 * The perk map: a hexagonal grid of perks you unlock in order, spending perk points.
 *
 *   {
 *     id, name, description?,
 *     q, r,                  position on the hex map (axial coordinates, see below)
 *     requires: [ids],       empty = a starting perk. Several ids = ANY one of them unlocks this
 *                            (add `requiresAll: true` to need all of them)
 *     effects: [...],        see effects.js
 *     visualOnly?: true,     exists in the game, no effect on damage (leave `effects` out)
 *     cost?: 1,              perk points (default 1)
 *     label?, image?         text shown in the hex (default: initials) or an image in Images/
 *   }
 *
 * HEX COORDINATES (axial, pointy-top hexagons). q goes right, r goes down-right:
 *
 *            (0,-1) (1,-1)
 *        (-1,0)  (0,0)  (1,0)         the six neighbours of (0,0) are
 *            (-1,1) (0,1)             (1,0) (1,-1) (0,-1) (-1,0) (-1,1) (0,1)
 *
 * !! Everything below is EXAMPLE DATA. Replace it with the real tree. !!
 */

export const MAX_PERK_POINTS = 8;

export const PERKS = [
  { id: '+5-dmg', name: '+ 5 Damage', description: '+5 base damage', q: 0, r: 0, requires: [],
    effects: [{ stat: 'baseDamage', op: 'add', value: 5 }] },

  // damage path (right)
  { id: 'example-dmg-1', name: 'Example Damage I', description: '+1 base damage', q: 1, r: 0, requires: ['example-core'],
    effects: [{ stat: 'baseDamage', op: 'add', value: 1 }] },
  { id: 'example-dmg-2', name: 'Example Damage II', description: '+2 base damage', q: 2, r: 0, requires: ['example-dmg-1'],
    effects: [{ stat: 'baseDamage', op: 'add', value: 2 }] },

  // luck path (up-right)
  { id: 'example-luck-1', name: 'Example Luck I', description: 'x2 Damage +5% chance', q: 1, r: -1, requires: ['example-core'],
    effects: [{ stat: 'x2Chance', op: 'add', value: 0.05 }] },
  { id: 'example-luck-2', name: 'Example Luck II', description: 'x10 Damage +1% chance', q: 2, r: -1, requires: ['example-luck-1'],
    effects: [{ stat: 'x10Chance', op: 'add', value: 0.01 }] },

  // fire-rate path (left)
  { id: 'example-rate-1', name: 'Example Rate I', description: '+5% fire rate', q: -1, r: 0, requires: ['example-core'],
    effects: [{ stat: 'fireRate', op: 'mul', value: 1.05 }] },
  { id: 'example-rate-2', name: 'Example Rate II', description: '+5% fire rate', q: -2, r: 0, requires: ['example-rate-1'],
    effects: [{ stat: 'fireRate', op: 'mul', value: 1.05 }] },

  // a perk reachable from two paths, and a visual-only one
  { id: 'example-merge', name: 'Example Crossroads', description: 'Charge stores 25%', q: 2, r: -2, requires: ['example-luck-2', 'example-dmg-2'],
    effects: [{ stat: 'chargeStoreRate', op: 'set', value: 0.25 }] },
  { id: 'example-cosmetic', name: 'Example Cosmetic', description: 'No effect on damage', q: 0, r: 1, requires: ['example-core'],
    visualOnly: true },
];
