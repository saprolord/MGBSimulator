/**
 * Headings
 * --------
 * Inside the engine a direction is a "heading": a number of clockwise quarter-turns from North.
 *
 *   0 = North (up)   1 = East (right)   2 = South (down)   3 = West (left)
 *
 * Tiles store their rotation in degrees (0/90/180/270) because that is what the canvas and the
 * share-link format use. Convert at the boundary with fromDegrees() / toDegrees().
 *
 * Working in quarter-turns turns "rotate left" into `(h + 3) & 3` and removes all the
 * `((x % 360) + 360) % 360` bookkeeping from the hot loop.
 */

export const NORTH = 0;
export const EAST = 1;
export const SOUTH = 2;
export const WEST = 3;

export const left = (h) => (h + 3) & 3;
export const right = (h) => (h + 1) & 3;
export const opposite = (h) => (h + 2) & 3;

export const fromDegrees = (deg) => ((Math.round(deg / 90) % 4) + 4) % 4;
export const toDegrees = (h) => h * 90;

/** Row / column delta for one step in each heading (index = heading). */
export const ROW_STEP = Object.freeze([-1, 0, 1, 0]);
export const COL_STEP = Object.freeze([0, 1, 0, -1]);

/** Heading of a single step between two adjacent cells, or -1 if they are not adjacent. */
export function headingBetween(fromR, fromC, toR, toC) {
  const dr = toR - fromR;
  const dc = toC - fromC;
  for (let h = 0; h < 4; h++) {
    if (ROW_STEP[h] === dr && COL_STEP[h] === dc) return h;
  }
  return -1;
}
