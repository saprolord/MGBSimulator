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
 * HEX COORDINATES (axial, pointy-side hexagons). q goes down, r goes down-right:
 *
 *                 (-1,0) 
 *         (-1,-1)        ( -1,1)
 *                 ( 0,0)  
 *         ( 1,-1)         ( 1,1)         the six neighbours of (0,0) are
 *                 ( 1,0)             (1,0) (1,-1) (-1,-1) (-1,0) (-1,1) (-1,1)
 *
 * !! Everything below is EXAMPLE DATA. Replace it with the real tree. !!
 */

export const MAX_PERK_POINTS = 80;

export const PERKS = [
  { id: '+5-gen', name: '+ 5 Damage', description: '+5 base damage from generator', q: 0, r: 0, requires: [], 
    image:'Projectile_generator.webp', effects: [{ stat: 'baseDamage', op: 'add', value: 5 }] },

  // damage path (top)
  { id: '+5-proj', name: '+ 5 Projectile', description: '+5 damage from +1 projectiles', q: -1, r: 0, requires: ['+5-gen'],
    image:'More_damage.webp', effects: [{ stat: 'addDamageSmall', op: 'add', value: 5 }] },
  { id: 'curveLeft', name: 'Curve Left Damage', description: 'Not Implemented', q: -2, r: 0, requires: ['+5-proj'],
    image:'Curve_left.webp', effects: [{ stat: 'curveLeftDamage', op: 'add', value: 0.3 }] },  
  { id: 'curveRight', name: 'Curve Right Damage', description: 'Not Implemented', q: -2, r: -1, requires: ['curveLeft'],
    image:'Curve_right.webp', effects: [{ stat: 'curveRightDamage', op: 'add', value: 0.3 }]  },
  { id: 'SideDmg', name: 'Side Damage', description: 'Not Implemented', q: -3, r: -1, requires: ['curveRight','UpDmg'],
    image:'Sideways.webp', visualOnly: true },  
  { id: 'UpDmg', name: 'Turn Up Damage', description: 'Not Implemented', q: -4, r: 0, requires: ['SideDmg','BelowUp','UpRep'],
    image:'Forward.webp', visualOnly: true }, 
  { id: 'UpRep', name: 'Turn Up Repeatdly', description: 'Not Implemented', q: -4, r: -1, requires: ['UpDmg','EmptyDmg'],
    image:'Forward.webp', visualOnly: true },
  { id: 'SideRep', name: 'Turn Sideways Repeatdly', description: 'Not Implemented', q: -3, r: -2, requires: ['SideDmg','EmpyDmg'],
    image:'Sideways.webp',visualOnly: true },  
  { id: 'EmptyDmg', name: 'Empty Slot +70', description: 'Not Implemented', q: -4, r: -2, requires: ['UpRep','SideRep'],
    image:'Empty_slot.webp', visualOnly: false },
  { id: 'BelowUp', name: 'Below Up', description: 'Not Implemented', q: -4, r: 1, requires: ['UpDmg','Diff2x'],
    image:'Ship_line_bullet_magnet.webp', visualOnly: true },
  { id: 'AOEc3', name: 'AoE Cricular 3%', description: 'Not Implemented', q: -5, r: 1, requires: ['BelowUp'],
    image:'AoE.webp', visualOnly: true },
  { id: 'AOEcR', name: 'AoE Circular +', description: 'Not Implemented', q: -6, r: 2, requires: ['AOEc3'],
    image:'AoE.webp', visualOnly: true },
  { id: 'AOEr3', name: 'AoE Rectangle 3%', description: 'Not Implemented', q: -5, r: 2, requires: ['BelowUp'],
    image:'Square_aoe.webp', visualOnly: true },
  { id: 'AOErR', name: 'AoE Rectangle +', description: 'Not Implemented', q: -6, r: 3, requires: ['AOEr3'],
    image:'Square_aoe.webp', visualOnly: true },
  { id: 'AOErT', name: 'AoE Rectangle Tall', description: 'Not Implemented', q: -7, r: 4, requires: ['AOEr3'],
    image:'Square_aoe.webp', visualOnly: true },
  { id: 'Diff2x', name: 'Different Direction 2x', description: 'Not Implemented', q: -3, r: 1, requires: ['BelowUp'],
    image:'Bullet_align.webp', visualOnly: true },
  { id: 'Clone20%', name: 'Clone 20% Extra', description: 'Not Implemented', q: -4, r: 2, requires: ['Diff2x'],
    image:'Duplicate_bullet.webp', visualOnly: true },
  { id: 'ZZ1', name: 'ZigZag Reduce', description: 'Not Implemented', q: -2, r: -2, requires: ['curveRight'],
    image:'Zigzag_bullet.webp', visualOnly: true },
  { id: 'ZZ2', name: 'ZigZag 0.1s', description: 'Not Implemented', q: -2, r: -3, requires: ['ZZ1','ZZ4'],
    image:'Zigzag_bullet.webp', visualOnly: true },
  { id: 'ZZ3', name: 'ZigZag 8%', description: 'Not Implemented', q: -2, r: -4, requires: ['ZZ2'],
    image:'Zigzag_bullet.webp', visualOnly: true },
  { id: 'ZZ4', name: 'ZigZag Angle', description: 'Not Implemented', q: -1, r: -3, requires: ['ZZ2','curveXT'],
    image:'Zigzag_bullet.webp', visualOnly: true },
  { id: 'curveXT', name: 'Curve Extreme', description: 'Not Implemented', q: -1, r: -2, requires: ['ZZ4','curveRight'],
    image:'Curve_randomly.webp', visualOnly: true },
  { id: 'curveFix', name: 'Curve Fixed', description: 'Not Implemented', q: -1, r: -1, requires: ['curveDmg','curveRight'],
    image:'Curve_randomly.webp', visualOnly: true },
  { id: 'curveDmg', name: 'Curve 60% Damage', description: 'Not Implemented', q: 0, r: -2, requires: ['curveXT','curveFix'],
    image:'Curve_randomly.webp', visualOnly: true },

  // Guiding path
  { id: 'turnLeftDmg', name: 'Turn Left +5 Damage', description: 'Not Implemented', q: 1, r: -1, requires: ['+5-gen'],
    image:'Left_turn.webp', effects: [{ stat: 'turnLeftDamage', op: 'add', value: 5 }] },
  { id: 'turnRightDmg', name: 'Turn Right +5 Damage', description: 'Not Implemented', q: 2, r: -2, requires: ['turnLeftDmg'],
    image:'Right_turn.webp',  effects: [{ stat: 'turnRightDamage', op: 'add', value: 5 }] },
  { id: 'speedInc', name: 'Constantly Increase Speed', description: 'Not Implemented', q: 2, r: -1, requires: ['turnRightDmg'],
    image:'More_speed.webp', visualOnly: true },
  { id: 'speedDec', name: 'Constantly Decrease Speed', description: 'Not Implemented', q: 3, r: -2, requires: ['speedInc'],
    image:'Less_speed.webp', visualOnly: true },
  { id: 'dmg40', name: 'Damage 2x 40%', description: 'Increase multiplier chance to 40%', q: 3, r: -3, requires: ['speedDec'],
    image:'Double_damage.webp', effects: [{ stat: 'x2Chance', op: 'set', value: 0.4 }] },
  { id: 'dmg2.5', name: 'Damage 2.5x', description: 'Increase damage multiplier to 2.5', q: 3, r: -4, requires: ['dmg40'],
    image:'Double_damage.webp', effects: [{ stat: 'x2Multiplier', op: 'set', value: 2.5 }] },



  

  /*// luck path (up-right)
  { id: 'example-luck-1', name: 'Example Luck I', description: 'x2 Damage +5% chance', q: 1, r: -1, requires: ['example-core'],
    effects: [{ stat: 'x2Chance', op: 'add', value: 0.05 }] },
  { id: 'example-luck-2', name: 'Example Luck II', description: 'x10 Damage +1% chance', q: 2, r: -1, requires: ['example-luck-1'],
    effects: [{ stat: 'x10Chance', op: 'add', value: 0.01 }] },

  // fire-rate path (left)
  { id: 'example-rate-1', name: 'Example Rate I', description: '+5% fire rate', q: -3, r: 0, requires: ['example-core'],
    effects: [{ stat: 'fireRate', op: 'mul', value: 1.05 }] },
  { id: 'example-rate-2', name: 'Example Rate II', description: '+5% fire rate', q: -2, r: 0, requires: ['example-rate-1'],
    effects: [{ stat: 'fireRate', op: 'mul', value: 1.05 }] },

  // a perk reachable from two paths, and a visual-only one
  { id: 'example-merge', name: 'Example Crossroads', description: 'Charge stores 25%', q: 2, r: -2, requires: ['example-luck-2', 'example-dmg-2'],
    effects: [{ stat: 'chargeStoreRate', op: 'set', value: 0.25 }] },
  { id: 'example-cosmetic', name: 'Example Cosmetic', description: 'No effect on damage', q: 0, r: 1, requires: ['example-core'],
    visualOnly: true },*/
];
