/**
 * RUNNER
 * ======
 * Drives a Simulation to completion in time slices, reporting progress and yielding to the event
 * loop between slices. The same function is used inside the Web Worker (long slices, the UI
 * thread is not involved) and as the main-thread fallback (short slices, so the page stays
 * responsive).
 */

import { Simulation } from './simulation.js';

const BATCH = 2500; // trials between clock checks
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * @param {object[][]} grid
 * @param {import('./simulation.js').SimulationParams} params
 * @param {{ onProgress?: (done: number, total: number) => void, sliceMs?: number, rng?: () => number }} [options]
 */
export async function runSimulation(grid, params, { onProgress, sliceMs = 12, rng } = {}) {
  const simulation = new Simulation(grid, params, rng);

  while (!simulation.done) {
    const sliceStart = now();
    do {
      simulation.run(BATCH);
    } while (!simulation.done && now() - sliceStart < sliceMs);

    onProgress?.(simulation.completed, simulation.total);
    if (!simulation.done) await yieldToEventLoop();
  }

  // Also covers "no generator on the grid": there was nothing to run, but report completion.
  if (simulation.total === 0 || simulation.runner === null) onProgress?.(simulation.total, simulation.total);

  return simulation.result();
}
