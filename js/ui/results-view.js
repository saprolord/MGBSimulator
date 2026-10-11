/**
 * RESULTS VIEW
 * ============
 * Shows the KPI cards and the probability histogram. The chart is created once and updated in
 * place afterwards (cheaper than destroying and rebuilding it for every calculation).
 *
 * Requires Chart.js to be loaded as a global (see the <script> tag in index.html).
 */

const COLORS = { bar: '#007acc', barBorder: '#0094f0', axisTitle: '#888888', tick: '#cccccc', grid: '#333333' };

/** Top of the Y axis (in %): a tidy number just above the tallest bar. */
export function pickYMax(maxPercent) {
  if (maxPercent < 10) return Math.max(1, Math.ceil(maxPercent));
  return Math.min(100, Math.ceil(maxPercent / 10) * 10 || 10);
}

/** Spacing between Y-axis gridlines for a given axis maximum. */
export function pickStepSize(yMax) {
  if (yMax <= 5 || (yMax <= 10 && yMax % 2 !== 0)) return 1;
  if (yMax <= 20) return 2;
  if (yMax <= 50) return 5;
  return 10;
}

export class ResultsView {
  #chart = null;

  /** @param {{ evElement: HTMLElement, rangeElement: HTMLElement, chartCanvas: HTMLCanvasElement }} elements */
  constructor({ evElement, rangeElement, chartCanvas }) {
    this.evElement = evElement;
    this.rangeElement = rangeElement;
    this.chartCanvas = chartCanvas;
  }

  /** @param {{ ev: number, min: number, max: number, distribution: {label: string, probability: number}[] }} result */
  show(result) {
    this.evElement.textContent = String(result.ev);
    this.rangeElement.textContent = `${result.min} / ${result.max}`;
    this.#showChart(result.distribution);
  }

  #showChart(distribution) {
    const labels = distribution.map((bar) => `${bar.label} Dmg`);
    const percents = distribution.map((bar) => Math.round(bar.probability * 1000) / 10);
    const yMax = pickYMax(Math.max(...percents, 0));
    const stepSize = pickStepSize(yMax);

    if (this.#chart) {
      const chart = this.#chart;
      chart.data.labels = labels;
      chart.data.datasets[0].data = percents;
      chart.options.scales.y.max = yMax;
      chart.options.scales.y.ticks.stepSize = stepSize;
      chart.update();
      return;
    }

    if (typeof Chart === 'undefined') {
      console.error('Chart.js failed to load - results chart unavailable.');
      return;
    }

    this.#chart = new Chart(this.chartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Probability (%)',
          data: percents,
          backgroundColor: COLORS.bar,
          borderColor: COLORS.barBorder,
          borderWidth: 1,
          maxBarThickness: 30,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (item) => `Chance: ${item.parsed.y}%` } },
        },
        scales: {
          x: {
            title: { display: true, text: 'Damage per Second', color: COLORS.axisTitle, font: { size: 11 } },
            ticks: { color: COLORS.tick },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            max: yMax,
            title: { display: true, text: 'Chance (%)', color: COLORS.axisTitle, font: { size: 11 } },
            ticks: { color: COLORS.tick, stepSize, callback: (value) => `${value}%` },
            grid: { color: COLORS.grid },
          },
        },
      },
    });
  }
}
