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
  { id: 'curveLeft', name: 'Curve Left Damage', description: 'Not Implemented', q: -2, r: 0, requires: ['+5-proj','curveRight'],
    image:'Curve_left.webp', effects: [{ stat: 'curveLeftDamage', op: 'add', value: 0.3 }] },  
  { id: 'curveRight', name: 'Curve Right Damage', description: 'Not Implemented', q: -2, r: -1, requires: ['SideDmg','curveLeft','curveXT','curveFix'],
    image:'Curve_right.webp', effects: [{ stat: 'curveRightDamage', op: 'add', value: 0.3 }]  },
  { id: 'SideDmg', name: 'Side Damage', description: 'Not Implemented', q: -3, r: -1, requires: ['curveRight','UpDmg'],
    image:'Sideways.webp', visualOnly: true },  
  { id: 'UpDmg', name: 'Turn Up Damage', description: 'Not Implemented', q: -4, r: 0, requires: ['SideDmg','BelowUp','UpRep'],
    image:'Forward.webp', visualOnly: true }, 
  { id: 'dmg20', name: '+ 20 Damage', description: '+20 additional damage per item', q: -5, r: 0, requires: ['UpDmg'],
    image:'More_damage.webp', visualOnly: true }, 
  { id: 'UpRep', name: 'Turn Up Repeatdly', description: 'Not Implemented', q: -4, r: -1, requires: ['UpDmg','EmptyDmg'],
    image:'Forward.webp', visualOnly: true },
  { id: 'SideRep', name: 'Turn Sideways Repeatdly', description: 'Not Implemented', q: -3, r: -2, requires: ['SideDmg','EmpyDmg'],
    image:'Sideways.webp',visualOnly: true },  
  { id: 'EmptyDmg', name: 'Empty Slot +70', description: 'Not Implemented', q: -4, r: -2, requires: ['UpRep','SideRep'],
    image:'Empty_slot.webp', visualOnly: true },
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
  { id: 'AOErT', name: 'AoE Rectangle Tall', description: 'Not Implemented', q: -7, r: 4, requires: ['AOErR'],
    image:'Square_aoe.webp', visualOnly: true },
  { id: 'Diff2x', name: 'Different Direction 2x', description: 'Not Implemented', q: -3, r: 1, requires: ['BelowUp','magUp'],
    image:'Bullet_align.webp', visualOnly: true },
  { id: 'Clone20%', name: 'Clone 20% Extra', description: 'Not Implemented', q: -4, r: 2, requires: ['Diff2x'],
    image:'Duplicate_bullet.webp', visualOnly: true },
  { id: 'ZZ1', name: 'ZigZag Reduce', description: 'Not Implemented', q: -2, r: -2, requires: ['curveRight','ZZ2'],
    image:'Zigzag_bullet.webp', visualOnly: true },
  { id: 'ZZ2', name: 'ZigZag 0.1s', description: 'Not Implemented', q: -2, r: -3, requires: ['ZZ1','ZZ4'],
    image:'Zigzag_bullet.webp', visualOnly: true },
  { id: 'ZZ3', name: 'ZigZag 8%', description: 'Not Implemented', q: -2, r: -4, requires: ['ZZ2'],
    image:'Zigzag_bullet.webp', visualOnly: true },
  { id: 'ZZ4', name: 'ZigZag Angle', description: 'Not Implemented', q: -1, r: -3, requires: ['ZZ2','curveXT'],
    image:'Zigzag_bullet.webp', visualOnly: true },
  { id: 'curveXT', name: 'Curve Extreme', description: 'Not Implemented', q: -1, r: -2, requires: ['ZZ4','curveRight','curveDmg'],
    image:'Curve_randomly.webp', visualOnly: true },
  { id: 'curveFix', name: 'Curve Fixed', description: 'Not Implemented', q: -1, r: -1, requires: ['curveDmg','curveRight'],
    image:'Curve_randomly.webp', visualOnly: true },
  { id: 'curveDmg', name: 'Curve 60% Damage', description: 'Not Implemented', q: 0, r: -2, requires: ['curveXT','curveFix','pierce50'],
    image:'Curve_randomly.webp', visualOnly: true },

  // Guiding path
  { id: 'turnLeftDmg', name: 'Turn Left +5 Damage', description: 'Not Implemented', q: 1, r: -1, requires: ['+5-gen','turnRighTDmg'],
    image:'Left_turn.webp', effects: [{ stat: 'turnLeftDamage', op: 'add', value: 5 }] },
  { id: 'turnRightDmg', name: 'Turn Right +5 Damage', description: 'Not Implemented', q: 2, r: -2, requires: ['turnLeftDmg','speedInc'],
    image:'Right_turn.webp',  effects: [{ stat: 'turnRightDamage', op: 'add', value: 5 }] },
  { id: 'speedInc', name: 'Constantly Increase Speed', description: 'Not Implemented', q: 2, r: -1, requires: ['turnRightDmg','speedDec'],
    image:'More_speed.webp', visualOnly: true },
  { id: 'speedDec', name: 'Constantly Decrease Speed', description: 'Not Implemented', q: 3, r: -2, requires: ['speedInc','dmg40','ten20','Random1'],
    image:'Less_speed.webp', visualOnly: true },
  { id: 'dmg40', name: 'Damage 2x 40%', description: 'Increase multiplier chance to 40%', q: 3, r: -3, requires: ['speedDec','pierce20','half'],
    image:'Double_damage.webp', effects: [{ stat: 'x2Chance', op: 'set', value: 0.4 }] },
  { id: 'dmg2.5', name: 'Damage 2.5x', description: 'Increase damage multiplier to 2.5', q: 3, r: -4, requires: ['dmg40'],
    image:'Double_damage.webp', effects: [{ stat: 'x2Multiplier', op: 'set', value: 2.5 }] },
  { id: 'pierce20', name: '20% chance to Pierce', description: 'Not Implemented', q: 2, r: -3, requires: ['dmg40','pierce50'],
    image:'Persistent_damage.webp', visualOnly:true },
  { id: 'pierce30', name: '30% chance to Pierce', description: 'Not Implemented', q: 2, r: -4, requires: ['pierce20'],
    image:'Pierce.webp', visualOnly:true },
  { id: 'pierce50', name: '50% chance to Pierce', description: 'Not Implemented', q: 1, r: -3, requires: ['pierce20','curveDmg','cmbck6'],
    image:'Persistent_damage.webp', visualOnly:true },
  { id: 'cmbck6', name: 'Comeback damage 6x', description: 'Increase damage multiplier to 6x', q: 0, r: -3, requires: ['pierce50','curveXT'],
    image:'Double_size_and_damage.webp', effects: [{ stat: 'comebackMultiplier', op: 'set', value: 6 }]  },    
  { id: '+100', name: 'Additional 100 damage', description: '+100 damage', q: 1, r: -4, requires: ['pierce50'],
    image:'Add_100_damage.webp', effects: [{ stat: 'addDamageLarge', op: 'add', value: 100 }]  },   
  { id: '+50X', name: '50*X the length of path', description: 'Adds 50*X damage, where X is the path length from the projectile generator to itself',
     q: 1, r: -5, requires: ['+100'], image:'Add_100_damage.webp', visualOnly:true  },
  { id: 'half', name: 'Half Lifetime', description: 'Not Implemented', q: 4, r: -4, requires: ['dmg40','ten20'],
    image:'More_damage_at_end_of_lifetime.webp', visualOnly:true },
  { id: '4last', name: '4x Lifetime', description: 'Not Implemented', q: 5, r: -5, requires: ['half'],
    image:'More_damage_at_end_of_lifetime.webp', visualOnly:true },
  { id: 'ten20', name: '20x Damge', description: 'Increase damage multiplier to 20x', q: 4, r: -3, requires: ['half', 'speedDec','bounce+'],
    image:'Tenfold_damage.webp', effects:[{stat:'x10Multiplier', op:'set', value:20}] },
  { id: 'ten30', name: '30x Damge', description: 'Increase damage multiplier to 30x', q: 5, r: -4, requires: ['ten20'],
    image:'Tenfold_damage.webp', effects:[{stat:'x10Multiplier', op:'set', value:30}] },
  { id: 'bounce+', name: '30x Damge', description: 'Not Implemented', q: 5, r: -3, requires: ['ten20'],
    image:'Accumulator.webp', visualOnly:true },
  { id: 'accum', name: '30x Damge', description: 'Not Implemented', q: 6, r: -3, requires: ['bounce+'],
    image:'Accumulator.webp', visualOnly:true },
  { id: 'Random1', name: 'Random Damge +', description: 'The multiplier pool is 0,0,1,1,1,1,2,2,3,3,4', q: 4, r: -2, requires: ['speedDec','bounce+','SpDmg'],
    image:'Gamble_damage.webp', effects:[{stat:'Random_Damage_Table', op:'set', value: ([[2,0],[6,1],[8,2],[10,3],[11,4]]) }] },
  { id: 'Random2', name: 'Reroll 0', description: 'Reroll if 0, but reduces all multipliers by 15%', q: 5, r: -2, requires: ['Random1'],
    image:'Gamble_damage.webp', visualOnly:true },
  { id: 'SpDmg', name: 'Speed Damage Range', description: 'Not Implemented', q: 4, r: -1, requires: ['Random1','SparseDmg'],
    image:'Speed_damage_boost.webp', visualOnly:true },
  { id: 'SparseDmg', name: 'More Sparse Damage', description: 'Not Implemented', q: 3, r: -0, requires: ['SpDmg','bounceDmg'],
    image:'Double_damage_10_bullet_screen.webp', visualOnly:true },

  // Spread path
  { id: 'sprdLeft', name: 'Spread Left Damage', description: 'Not Implemented', q: 0, r: 1, requires: ['+5-gen'],
    image:'Eject_to_the_left.webp', visualOnly:true },
  { id: 'sprdRight', name: 'Spread Right Damage', description: 'Not Implemented', q: 0, r: 2, requires: ['charge','sprdLeft','sprd50','sprdNarrow'],
    image:'Eject_to_the_right.webp', visualOnly:true },
  { id: 'sprd50', name: 'Spread 50% Damage', description: 'Not Implemented', q: -1, r: 2, requires: ['sprdRight','split3x'],
    image:'Eject_randomly.webp', visualOnly:true },
  { id: 'sprdNarrow', name: 'Spread 50% Damage', description: 'Not Implemented', q: -1, r: 3, requires: ['sprdRight','split3x'],
    image:'Eject_narrow.webp', visualOnly:true },
  { id: 'split3x', name: 'Split 2Way 3Xdmg', description: 'Not Implemented', q: -2, r: 3, requires: ['sprdNarrow','sprd50','split4x','dup10%'],
    image:'Random_double.webp', visualOnly:true },
  { id: 'split5%', name: 'SSplit 2Way 5%', description: 'Not Implemented', q: -3, r: 4, requires: ['split3x'],
    image:'Random_double.webp', visualOnly:true },
  { id: 'split4x', name: 'Split 3Way 4x', description: 'Not Implemented', q: -3, r: 3, requires: ['split3x','cross2x'],
    image:'Random_triple.webp', visualOnly:true },
  { id: 'split5%3', name: 'Split 3Way 5%', description: 'Not Implemented', q: -4, r: 4, requires: ['split4x'],
    image:'Random_triple.webp', visualOnly:true },
  { id: 'dup10%', name: 'Duplicate 10%', description: 'Not Implemented', q: -2, r: 2, requires: ['split3x','magUp'],
    image:'Clone_bullet.webp', visualOnly:true },
  { id: 'magUp', name: 'Duplicate 10%', description: 'Not Implemented', q: -2, r: 1, requires: ['dup10%','Diff2x','cross2x'],
    image:'Bullet_magnet.webp', visualOnly:true },
  { id: 'cross2x', name: 'Damage Cross 2x', description: 'Not Implemented', q: -3, r: 2, requires: ['split4x','magUp'],
    image:'Damage_loop.webp', visualOnly:true },
  { id: 'emptyLeg', name: 'Empty Legendary', description: 'Not Implemented', q: -4, r: 3, requires: ['cross2x'],
    image:'Empty_tile_damage_boost.webp', visualOnly:true },
  { id: 'emptyDir', name: 'Empty Directional', description: 'Not Implemented', q: -5, r: 4, requires: ['emptyLeg'],
    image:'Empty_tile_damage_boost.webp', visualOnly:true },
  { id: 'charge', name: 'Charge 30%', description: 'Each projectile adds 30% of its damage to the charger instead', 
    q: 1, r: 1, requires: ['sprdRight','bounceDmg'], image:'Damage_regulator.webp', visualOnly:true },
  { id: 'bounceDmg', name: 'Bounce 17% Damage', description: 'Not Implemented', q: 2, r: 1, requires: ['charge','SparseDmg'],
    image:'Realistic_bounce.webp', visualOnly:true },
  { id: 'bounceMore', name: 'Bounce 25% More', description: 'Not Implemented', q: 2, r: 0, requires: ['bounceDmg'],
    image:'Realistic_bounce.webp', visualOnly:true },
  { id: 'bounceRand1', name: 'Random Bounce 17% Dmg', description: 'Not Implemented', q: 1, r: 2, requires: ['bounceDmg'],
    image:'Bounce_randomly.webp', visualOnly:true },
  { id: 'bounceRand2', name: 'Random Bounce 25% More', description: 'Not Implemented', q: 0, r: 3, requires: ['bounceRand1'],
    image:'Bounce_randomly.webp', visualOnly:true },
  { id: 'bounceRand3', name: 'Random Bounce Curve', description: 'Not Implemented', q: -1, r: 4, requires: ['bounceRand2'],
    image:'Bounce_randomly.webp', visualOnly:true },
  { id: 'bounceBck1', name: 'Bounce 17% Damage', description: 'Not Implemented', q: 2, r: 2, requires: ['bounceDmg'],
    image:'Bounce_back.webp', visualOnly:true },
  { id: 'bounceBck2', name: 'Bounce 25% More', description: 'Not Implemented', q: 1, r: 3, requires: ['bounceBck1'],
    image:'Bounce_back.webp', visualOnly:true },
  { id: 'bounceBck3', name: 'Bounce of ship', description: 'Not Implemented', q: 0, r: 4, requires: ['bounceBck2'],
    image:'Bounce_back.webp', visualOnly:true },
  { id: 'guide', name: 'All Guides Damage', description: 'All projectile guides increase damage', q: 3, r: 1, requires: ['bounceBck1'],
    image:'Turn_damage.webp', visualOnly:true },
  { id: 'ejectDmg', name: '+30 Damage', description: '+30 additional damage for each unused ejection block', q: 3, r: 2, 
    requires: ['bounceBck1'], image:'10_damage_unused_ejector.webp', visualOnly:true },
  { id: 'tier5', name: '+5% Tier Damage', description: 'Adds 5% of the highest cleared tier in the world map as damage', q: 2, r: 3, 
    requires: ['bounceBck1'], image:'Max_tier_damage.webp', visualOnly:true },
  { id: 'tier2', name: '+2 Damage', description: '+2 damage per played hour. Max 400 damage', q: 1, r:4, 
    requires: ['tier5'], image:'Max_tier_damage.webp', visualOnly:true },



  

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
