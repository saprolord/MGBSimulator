/**
 * PATH TRACER (UI preview)
 * ========================
 * Follows every possible projectile route from the generator and returns the list of paths, so
 * the canvas can draw the red trajectory lines. No damage is calculated here.
 *
 * It uses the very same `route()` functions as the simulation (see blocks.js), so the preview
 * can never disagree with what the Monte-Carlo run actually does. Random splits show ALL of
 * their branches.
 *
 * Paths are arrays of flat cell indices. Branches share their history through parent links
 * instead of copying the whole path at every step.
 */

import { ENGINE_LIMITS } from '../config.js';
import { KIND } from './ship.js';

/** @returns {number[][]} one array of cell indices per finished path */
export function traceShip(ship) {
  const { emitter, kind, rot, block, next, size } = ship;
  if (!emitter) return [];

  // Node storage (struct-of-arrays). A node = "a projectile standing on `cells[id]`".
  const cells = [emitter.cell];
  const parents = [-1];
  const headings = [emitter.heading];
  const originals = [1];

  const paths = [];
  const visit = { cell: 0, heading: 0, rot: 0, damage: 1, original: 1, turnActive: 0, stamps: null };

  let frontier = [0];
  let nextFrontier = [];
  let spawnParent = -1;
  let spawned = 0;

  const addNode = (cell, parent, heading, original) => {
    cells.push(cell);
    parents.push(parent);
    headings.push(heading);
    originals.push(original);
    return cells.length - 1;
  };

  // Records a finished path: the chain of ancestors of `id`, plus optionally one extra last cell.
  const finish = (id, lastCell = -1) => {
    const path = [];
    for (let n = id; n !== -1; n = parents[n]) path.push(cells[n]);
    path.reverse();
    if (lastCell !== -1) path.push(lastCell);
    paths.push(path);
  };

  // What blocks call to release projectiles (same interface as the simulation).
  const spawn = (heading, original) => {
    nextFrontier.push(addNode(visit.cell, spawnParent, heading, original));
    spawned++;
  };
  const out = {
    emit: (heading) => spawn(heading, visit.original),
    emitCopy: (heading) => spawn(heading, 0),
    emitOneOf: (a, b, c) => {
      spawn(a, visit.original);
      spawn(b, visit.original);
      if (c !== undefined) spawn(c, visit.original);
    },
  };

  for (let step = 0; step < ENGINE_LIMITS.maxTraceSteps; step++) {
    if (frontier.length === 0 || cells.length > ENGINE_LIMITS.maxTraceNodes) break;
    nextFrontier = [];

    for (const id of frontier) {
      const heading = headings[id];
      const cell = next[cells[id] * 4 + heading];

      if (cell < 0) {
        finish(id); // flew off the grid
        continue;
      }

      switch (kind[cell]) {
        case KIND.FREE:
          nextFrontier.push(addNode(cell, id, heading, originals[id]));
          break;

        case KIND.SOLID:
        case KIND.EJECTOR:
          finish(id, cell);
          break;

        case KIND.BLOCK: {
          const def = block[cell];
          if (def === null || (heading !== rot[cell] && !def.acceptsAnyEntry)) {
            finish(id, cell); // wrong way in (or unknown block): path ends on this tile
            break;
          }
          visit.cell = cell;
          visit.heading = heading;
          visit.rot = rot[cell];
          visit.original = originals[id];
          spawnParent = id;
          spawned = 0;
          def.route(visit, out);
          if (spawned === 0) finish(id, cell); // block swallowed it: path ends here
          break;
        }

        default:
          // Generator / inert tiles swallow the projectile and (as in earlier versions)
          // the path is not drawn.
          break;
      }
    }
    frontier = nextFrontier;
  }

  return paths;
}

/** Convert index paths to [{ r, c }, ...] for the UI. */
export function pathsToCoordinates(paths, size) {
  return paths.map((path) => path.map((cell) => ({ r: Math.floor(cell / size), c: cell % size })));
}
