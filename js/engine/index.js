/** Public API of the simulation engine. The UI should import from here only. */

import { compileShip } from './ship.js';
import { traceShip, pathsToCoordinates } from './trace.js';

export { Simulation } from './simulation.js';
export { runSimulation } from './runner.js';

/** Path preview for the canvas: array of paths, each an array of { r, c }. */
export function traceGrid(grid) {
  const ship = compileShip(grid);
  return pathsToCoordinates(traceShip(ship), ship.cols);
}
