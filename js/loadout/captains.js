/**
 * CAPTAINS AND SKILLS
 * ===================
 * Edit this file to add captains and their skills. Only ONE captain is active at a time; the
 * player ticks which of that captain's skills they have.
 *
 *   captain:  { id, name, maxLevel?, skills: [...] }
 *   skill:    { id, name, description?, effects: [...], visualOnly?: true }
 *
 * - ids are permanent, lowercase, unique across ALL captains and skills (they are saved in the
 *   player's browser).
 * - `effects` are described in effects.js, e.g. { stat: 'fireRate', op: 'mul', value: 1.1 }.
 * - Skills that do not touch damage, item effects or fire rate: set `visualOnly: true` and leave
 *   `effects` out. They still show in the list so the page matches the game.
 * - A captain's LEVEL adds DAMAGE_PER_CAPTAIN_LEVEL base damage to every ship.
 *
 * !! Everything below is EXAMPLE DATA. Replace it with the real captains and skills. !!
 */

export const DAMAGE_PER_CAPTAIN_LEVEL = 1;
export const DEFAULT_MAX_CAPTAIN_LEVEL = 100;

export const CAPTAINS = [
  {
    id: 'example-gunner',
    name: 'Example Gunner',
    maxLevel: 50,
    skills: [
      {
        id: 'example-gunner-rapid-fire',
        name: 'Rapid Fire',
        description: '+10% fire rate',
        effects: [{ stat: 'fireRate', op: 'mul', value: 1.1 }],
      },
      {
        id: 'example-gunner-lucky-shots',
        name: 'Lucky Shots',
        description: 'x2 Damage blocks trigger 5% more often',
        effects: [{ stat: 'x2Chance', op: 'add', value: 0.05 }],
      },
      {
        id: 'example-gunner-heavy-ammo',
        name: 'Heavy Ammo',
        description: '+1 base damage',
        effects: [{ stat: 'baseDamage', op: 'add', value: 1 }],
      },
      {
        id: 'example-gunner-shiny',
        name: 'Shiny Paint',
        description: 'Looks cool, no effect on damage',
        visualOnly: true,
      },
    ],
  },
  {
    id: 'example-engineer',
    name: 'Example Engineer',
    skills: [
      {
        id: 'example-engineer-better-charge',
        name: 'Better Charge',
        description: 'Charge blocks store 30% instead of 20%',
        effects: [{ stat: 'chargeStoreRate', op: 'set', value: 0.3 }],
      },
    ],
  },
];
