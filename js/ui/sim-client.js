/**
 * SIMULATION CLIENT
 * =================
 * The UI's only door to the simulation. Runs it in a Web Worker so the page never freezes; if
 * workers are unavailable (very old browser, blocked by the environment) it silently falls back
 * to time-sliced execution on the main thread.
 *
 * The grid is copied to the worker when a job starts, so editing the board while a simulation is
 * running cannot corrupt that run.
 */

import { runSimulation } from '../engine/index.js';

const WORKER_URL = new URL('../engine/worker.js', import.meta.url);

export class SimulationClient {
  #worker = null;
  #nextJobId = 0;

  constructor() {
    try {
      this.#worker = new Worker(WORKER_URL, { type: 'module' });
    } catch {
      this.#worker = null;
    }
  }

  /**
   * @param {object[][]} grid
   * @param {import('../engine/simulation.js').SimulationParams} params
   * @param {(done: number, total: number) => void} [onProgress]
   * @returns {Promise<{ ev: number, min: number, max: number, distribution: {label: string, probability: number}[] }>}
   */
  run(grid, params, onProgress) {
    const fallback = () => runSimulation(grid, params, { onProgress, sliceMs: 12 });
    const worker = this.#worker;
    if (!worker) return fallback();

    return new Promise((resolve, reject) => {
      const id = ++this.#nextJobId;

      const cleanup = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      };
      const onMessage = ({ data }) => {
        if (data.id !== id) return;
        if (data.type === 'progress') {
          onProgress?.(data.done, data.total);
        } else if (data.type === 'result') {
          cleanup();
          resolve(data.result);
        } else if (data.type === 'error') {
          cleanup();
          reject(new Error(data.message));
        }
      };
      const onError = (event) => {
        // The worker could not start (e.g. page opened from file://). Use the main thread.
        console.warn('Simulation worker unavailable, using main thread instead.', event.message ?? '');
        cleanup();
        worker.terminate();
        if (this.#worker === worker) this.#worker = null;
        fallback().then(resolve, reject);
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ id, grid, params });
    });
  }
}
