/**
 * Global constants shared by the UI and the simulation engine.
 * Anything you might want to tweak lives here rather than being scattered as magic numbers.
 */

export const GRID_SIZE = 12;
export const TILE_SIZE = 50; // canvas pixels per tile
export const IMAGE_DIR = 'Images/';

/** The four non-modifier tile types a grid cell can have. */
export const TILE = Object.freeze({
  EMPTY: 'Empty Slot', // free cell; may hold a modifier block
  SOLID: 'Solid Block', // wall: projectiles stop
  EJECTOR: 'Ejection Block', // projectiles that arrive here deal their damage
  GENERATOR: 'Projectile Generator', // where projectiles are born
});

/** Number-of-simulations limits for the "Simulations" control. */
export const SIM_LIMITS = Object.freeze({ min: 1, max: 5_000_000, default: 1_000_000 });

/** Safety limits. They exist to stop runaway layouts (e.g. clone loops) from freezing the page. */
export const ENGINE_LIMITS = Object.freeze({
  maxTraceSteps: 1000, // path preview: max tile-steps per projectile
  maxTraceNodes: 50_000, // path preview: max total branches (NEW: stops exponential blow-up)
  maxProjectileSteps: 5000, // simulation: max queue pops per shot
  maxEmitsPerVisit: 3, // simulation: most projectiles one block may spawn (3-way split)
});

/** Chart: results with more distinct values than this are grouped into ranges. */
export const MAX_CHART_BARS = 30;

/** Per-trial damage is rounded to 1/DAMAGE_PRECISION (10 => one decimal place). */
export const DAMAGE_PRECISION = 10;
