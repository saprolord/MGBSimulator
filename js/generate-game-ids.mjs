/**
 * Prints a fresh js/game-ids.js template listing every tile and every block currently in
 * js/blocks.js, with all IDs set to null.
 *
 *   node tools/generate-game-ids.mjs > js/game-ids.template.js
 *
 * Do NOT redirect straight over js/game-ids.js once you have filled it in. Generate to a separate
 * file and copy over only the new lines.
 */

import { BLOCKS } from '../js/blocks.js';
import { TILE } from '../js/config.js';

const pad = (text, width) => text + ' '.repeat(Math.max(1, width - text.length));
const quote = (name) => `'${name.replace(/'/g, "\\'")}'`;

let out = `/**
 * IN-GAME ITEM IDs
 * ================
 * Each tile of the 366-digit game code is 3 digits: a 2-digit ID (00-99) + 1 orientation digit.
 * This file maps those IDs to our tiles and blocks. FILL IN THE NUMBERS (replace each null).
 *
 *   - IDs are whole numbers 0-99 and must be unique across BOTH tables (one shared ID space).
 *   - A null means "not known yet": importing skips that item, exporting refuses (and names it).
 *   - Add a line here whenever you add a block in blocks.js (names must match exactly).
 *   - \`node --test\` checks for duplicates, out-of-range numbers and (once you start filling in)
 *     blocks that are still missing.
 */

import { TILE } from './config.js';


/** The ship itself. Generator orientation = the way it fires; the others use orientation 0. */
export const TILE_GAME_IDS = {
${Object.values(TILE).map((t) => `  ${pad(`[TILE.${Object.keys(TILE).find((k) => TILE[k] === t)}]:`, 18)}null,`).join('\n')}
};

/** Modifier blocks (orientation: 0 = up, 1 = right, 2 = down, 3 = left). */
export const BLOCK_GAME_IDS = {
`;
for (const block of BLOCKS) {
  out += `  ${pad(`${quote(block.name)}:`, 26)}null,${block.implemented ? '' : '   // visual only'}\n`;
}
out += '};\n';
process.stdout.write(out);