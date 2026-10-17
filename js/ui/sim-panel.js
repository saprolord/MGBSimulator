/**
 * SIMULATION PANEL
 * ================
 * The inputs above the chart (max tier, fire rate, number of simulations with its logarithmic
 * slider), the Calculate button and the progress bar. Reads and validates the inputs; does not
 * know how the simulation works.
 */

import { SIM_LIMITS } from '../config.js';

const SLIDER_STEPS = 1000; // slider runs 0..1000, mapped logarithmically onto min..max simulations
const RATIO = SIM_LIMITS.max / SIM_LIMITS.min;
const HIDE_DELAY_MS = 400;

export const sliderToTrials = (position) => Math.round(SIM_LIMITS.min * RATIO ** (position / SLIDER_STEPS));
export const trialsToSlider = (trials) => Math.round((Math.log(trials / SIM_LIMITS.min) / Math.log(RATIO)) * SLIDER_STEPS);
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

export class SimPanel {
  /** @param {{ onCalculate: () => void }} handlers */
  constructor({ onCalculate }) {
    const $ = (id) => document.getElementById(id);
    this.trialsSlider = $('trials-slider');
    this.trialsInput = $('trials-input');
    this.maxTierInput = $('maxTierInput');
    this.fireRateInput = $('fireRateInput');
    this.calcButton = $('btn-calc');
    this.progressWrapper = $('progress-wrapper');
    this.progressBar = $('progress-bar');
    this.progressText = $('progress-text');

    this.trialsSlider.addEventListener('input', () => {
      this.trialsInput.value = sliderToTrials(Number(this.trialsSlider.value));
    });
    this.trialsInput.addEventListener('change', () => {
      const trials = this.#readTrials();
      this.trialsInput.value = trials;
      this.trialsSlider.value = trialsToSlider(trials);
    });
    this.calcButton.addEventListener('click', onCalculate);
  }

  /** The line under the inputs: what the simulation will really use after captain, skills and perks. */
  showEffective(text, details = '') {
    const line = document.getElementById('effective-stats');
    line.textContent = text;
    line.title = details;
  }

  /** Put a ship's fire rate in the Fire Rate box (1 -> "1.0", 9.9 -> "9.9"). */
  setFireRate(rate) {
    this.fireRateInput.value = Number.isInteger(rate) ? rate.toFixed(1) : String(rate);
  }

  /** Validated simulation settings (bad or empty inputs fall back to sensible defaults). */
  readParams() {
    const fireRate = parseFloat(this.fireRateInput.value);
    return {
      trials: this.#readTrials(),
      maxTier: Math.max(0, parseInt(this.maxTierInput.value, 10) || 0),
      fireRate: Number.isFinite(fireRate) && fireRate >= 0 ? fireRate : 1,
      baseDamage: 1,
    };
  }

  #readTrials() {
    const typed = parseInt(this.trialsInput.value, 10) || SIM_LIMITS.default;
    return clamp(typed, SIM_LIMITS.min, SIM_LIMITS.max);
  }

  // ---- Progress bar ------------------------------------------------------------------------

  start(total) {
    this.calcButton.disabled = true;
    this.progressWrapper.classList.add('active');
    this.setProgress(0, total);
  }

  setProgress(done, total) {
    const percent = Math.min(100, (done / total) * 100).toFixed(1);
    this.progressBar.style.width = `${percent}%`;
    this.progressText.textContent = `${done.toLocaleString()} / ${total.toLocaleString()} (${percent}%)`;
  }

  finish() {
    this.progressBar.style.width = '100%';
    this.calcButton.disabled = false;
    setTimeout(() => {
      this.progressWrapper.classList.remove('active');
      this.progressBar.style.width = '0%';
      this.progressText.textContent = '';
    }, HIDE_DELAY_MS);
  }
}
