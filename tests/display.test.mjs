/** Run with:  node --test   (number formatting, chart tail trimming, per-ship fire rate) */

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatNumber, formatLabel, formatLabels } from '../js/ui/format.js';
import { buildChartDistribution, buildDistribution } from '../js/engine/histogram.js';
import { Simulation } from '../js/engine/index.js';
import { SHIPS } from '../js/ships.js';
import { getShipInfo, AVAILABLE_SHIPS, createGridForShip } from '../js/model/ship-loader.js';

test('numbers up to 9999 are untouched', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(1.5), '1.5');
  assert.equal(formatNumber(1234.56), '1234.56');
  assert.equal(formatNumber(9999), '9999');
});

test('numbers above 9999 use scientific notation with one decimal', () => {
  assert.equal(formatNumber(987567), '9.9e5');
  assert.equal(formatNumber(10000), '1.0e4');
  assert.equal(formatNumber(12345), '1.2e4');
  assert.equal(formatNumber(1500000), '1.5e6');
});

test('chart labels: every number inside a label is formatted', () => {
  assert.equal(formatLabel('12'), '12');
  assert.equal(formatLabel('0.5'), '0.5');
  assert.equal(formatLabel('9000-9999'), '9000-9999');
  assert.equal(formatLabel('120000-129999'), '1.2e5-1.3e5');
});

test('chart labels get extra digits only when two bars would otherwise look identical', () => {
  assert.deepEqual(formatLabels(['5', '10000-10099', '10100-10199']), ['5', '1.00e4-1.01e4', '1.01e4-1.02e4']);
  assert.deepEqual(formatLabels(['100', '200']), ['100', '200']);
  assert.deepEqual(formatLabels(['120000', '250000']), ['1.2e5', '2.5e5']);
});

/** A cluster of 100 values (100..199, 99.4 % of results) plus four rare huge outliers (0.15 % each). */
const clusterWithOutliers = () => {
  const entries = Array.from({ length: 100 }, (_, i) => [100 + i, 99]);
  for (const outlier of [100000, 200000, 300000, 400000]) entries.push([outlier, 15]);
  return { entries, total: 9900 + 4 * 15 };
};

test('chart: the thin tail is cut and the survivors are re-spread over many bars', () => {
  const { entries, total } = clusterWithOutliers();

  // Plain binning squeezes the whole cluster into ONE wide bar because the range reaches 400000...
  const plain = buildDistribution(entries, total);
  assert.equal(plain[0].probability > 0.99, true);

  // ...the chart version cuts the outliers, then bins only 100..199 across many bars.
  const chart = buildChartDistribution(entries, total);
  assert.ok(chart.length >= 20, `only ${chart.length} bars`);
  assert.ok(chart.length <= 30);
  assert.equal(chart[0].label.startsWith('100'), true);
  const shown = chart.reduce((sum, bar) => sum + bar.probability, 0);
  assert.ok(Math.abs(shown - 9900 / total) < 0.01, 'hidden tail is missing from the total, nothing else is');
});

test('chart: nothing is cut when every bar is above the cut-off', () => {
  const entries = Array.from({ length: 60 }, (_, i) => [i, 10]);
  assert.deepEqual(buildChartDistribution(entries, 600), buildDistribution(entries, 600));
});

test('chart: few distinct values keep one bar each, tail bars below 0.2% are dropped', () => {
  const entries = [[1, 9990], [2, 9], [50, 1]]; // 99.9 %, 0.09 %, 0.01 %
  assert.deepEqual(buildChartDistribution(entries, 10000).map((bar) => bar.label), ['1']);
  // exactly 0.2% is kept
  assert.equal(buildChartDistribution([[1, 998], [2, 2]], 1000).length, 2);
});

test('chart: always keeps at least one bar, and never cuts the middle', () => {
  assert.equal(buildChartDistribution([[5, 1]], 100000).length, 1);
  assert.deepEqual(buildChartDistribution([], 10), []);
  const gap = buildChartDistribution([[1, 500], [2, 1], [3, 499]], 1000); // rare bar in the middle stays
  assert.deepEqual(gap.map((bar) => bar.label), ['1', '2', '3']);
});

test('a Simulation result carries both the full and the chart distribution; min / max are untouched', () => {
  const grid = createGridForShip(SHIPS[0].id);
  const sim = new Simulation(grid, { trials: 2000 }, () => 0.5);
  sim.run(2000);
  const result = sim.result();
  assert.ok(Array.isArray(result.distribution) && Array.isArray(result.chartDistribution));
  assert.ok(result.max >= result.min);
});

test('every ship has a fire rate (default 1) that is a valid number', () => {
  for (const { id } of AVAILABLE_SHIPS) {
    const rate = getShipInfo(id).fireRate;
    assert.ok(Number.isFinite(rate) && rate >= 0, `${id}: ${rate}`);
  }
  const ship = SHIPS.find((s) => s.fireRate === undefined);
  if (ship) assert.equal(getShipInfo(ship.id).fireRate, 1);
});

test('the default ship keeps fire rate 1', () => {
  assert.equal(getShipInfo('default')?.fireRate ?? getShipInfo(SHIPS[0].id).fireRate, 1);
});
