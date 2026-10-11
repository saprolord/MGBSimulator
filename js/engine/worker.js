/**
 * Web Worker entry point: runs simulations off the main thread so the page never freezes.
 *
 * Messages in : { id, grid, params }
 * Messages out: { id, type: 'progress', done, total }
 *               { id, type: 'result', result }
 *               { id, type: 'error', message }
 */

import { runSimulation } from './runner.js';

self.onmessage = async ({ data: { id, grid, params } }) => {
  try {
    const result = await runSimulation(grid, params, {
      sliceMs: 40,
      onProgress: (done, total) => self.postMessage({ id, type: 'progress', done, total }),
    });
    self.postMessage({ id, type: 'result', result });
  } catch (error) {
    self.postMessage({ id, type: 'error', message: String(error?.message ?? error) });
  }
};
