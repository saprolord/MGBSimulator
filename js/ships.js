/**
 * SHIP PRESETS
 * ============
 * Every ship in the game, drawn as a small text map. Add a ship = add one entry.
 *
 *   #   solid wall            .   empty slot (blocks can go here)
 *   E   ejector               ^ > v <   the generator, facing up / right / down / left
 *
 * RULES
 *   - Exactly ONE generator, at least one ejector, every row the same length.
 *   - Maps can be anything up to 12x12. Smaller maps are centred on the board and padded with walls.
 *   - `id` is permanent: it is stored in share links (#ship=<id>). Lowercase letters, digits, - and _.
 *     You can rename `name` freely, but never change or reuse an `id` once it has been published.
 *   - Array order = dropdown order.
 */

export const DEFAULT_SHIP_ID = 'default';

export const SHIPS = [
  {
    id: DEFAULT_SHIP_ID, // the original layout; links without a ship in them use this one
    name: 'Default Ship',
    map: [
      '############',
      '#....E....##',
      '#.........##',
      '#.........##',
      '#.........##',
      '#.........##',
      '#.........##',
      '#.........##',
      '#.........##',
      '#.........##',
      '#....^....##',
      '############',
    ],
    fireRate: 1, // default fire rate for this ship
  },

  // ---- Ships from game - ID number is the export number form Game -----------------------
  {
    id: '000',
    name: 'Rider-used',
    map: [
      '###########',
      '###########',
      '###########',
      '###########',
      '#####E#####',
      '#####.#####',
      '#####^#####',
      '###########',
      '###########',
      '###########',
      '###########',
    ],
    fireRate: 1,
  },
  {
    id: '001',
    name: 'Rider',
    map: [
      '###########',
      '###########',
      '###########',
      '###########',
      '#####E#####',
      '#####.#####',
      '#####.#####',
      '#####^#####',
      '###########',
      '###########',
      '###########',
    ],
    fireRate: 1.5,
  },
  {
    id: '002',
    name: 'Transporter',
    map: [
      '###########',
      '###########',
      '###########',
      '####EEE####',
      '####...####',
      '####...####',
      '####...####',
      '#####^#####',
      '###########',
      '###########',
      '###########',
    ],
    fireRate: 1.4,
  },
  {
    id: '003',
    name: 'Rocket',
    map: [
      '###########',
      '###########',
      '#####E#####',
      '#####.#####',
      '#####.#####',
      '#####.#####',
      '#####.#####',
      '#####^#####',
      '###########',
      '###########',
      '###########',
    ],
    fireRate: 2.7,
  },
  {
    id: '004',
    name: 'Alien Seeker',
    map: [
      '###########',
      '###########',
      '###########',
      '#####E#####',
      '#####.#####',
      '#####.#####',
      '#####.#####',
      '#####^#####',
      '###########',
      '###########',
      '###########',
    ],
    fireRate: 4.9,
  },  
  {
    id: '005',
    name: 'Bus',
    map: [
      '###########',
      '###########',
      '###########',
      '####E#E####',
      '####...####',
      '####...####',
      '####...####',
      '####...####',
      '#####^#####',
      '###########',
      '###########',
    ],
    fireRate: 1.4,
  },
  {
    id: '006',
    name: 'Fighter',
    map: [
      '###########',
      '###########',
      '###########',
      '######E####',
      '###..#.####',
      '###..#.####',
      '###....####',
      '###^#######',
      '###########',
      '###########',
      '###########',
    ],
    fireRate: 1.4,
  },
];
