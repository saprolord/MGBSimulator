/**
 * CUSTOM SHIP: BLOCKS AND SETTINGS
 * ================================
 * A custom ship is a 12x12 board that starts full of walls and is divided into 4x4 SLOTS of 3x3
 * tiles. Each slot holds one custom block; the block's pattern is stamped onto the slot's tiles.
 * Normal items (Add Damage, splitters, portals...) are then placed on the empty tiles as usual.
 *
 * Edit this file to add the real custom blocks.
 *
 *   {
 *     id, name,
 *     shareId,           permanent number (0-255) stored in share links. Never change or reuse.
 *     pattern,           3 strings of 3 characters:  #  wall    .  empty space    E  ejector
 *     rotatable?,        default false: the player can't turn it in quarter turns.
 *                        Set true if the block cannot be rotated in the game.
 *   }
 *
 * The first block, 'solid', is what every slot starts as; do not remove it.
 *
 * !! The blocks after 'solid' are EXAMPLES. Replace them with the real ones. !!
 */

export const CUSTOM_SETTINGS = Object.freeze({
  slots: 4, // slots per side (4 x 4)
  blockSize: 3, // tiles per slot side (3 x 3)  ->  the board is 12 x 12
  // The generator sits in an extra row just BELOW the 12 x 12 board and fires upward.
  generatorCol: 10, // which column (0-11, counted from the left) it sits under
  generatorFacing: 0, // degrees: 0 = up
  fireRate: 1, // the Fire Rate box is set to this when you open the custom ship tab
});

export const CUSTOM_BLOCKS = [
  { id: 'solid', name: 'Solid', shareId: 0, pattern: ['###', '###', '###'] },

  // ---- EXAMPLES -------------------------------------------------------------------------
  { id: 'example-open', name: 'Example Open', shareId: 1, pattern: ['...', '...', '...'] },
  { id: 'example-exit', name: 'Example Exit', shareId: 2, pattern: ['..E', '...', '...']  },
  { id: 'example-pipe', name: 'Example Pipe', shareId: 3, pattern: ['#.#', '#.#', '#.#'] },
  { id: 'example-corner', name: 'Example Corner', shareId: 4, pattern: ['#..', '#..', '###'] },
];
