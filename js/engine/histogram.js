/**
 * Turns raw "how many trials produced damage X" counts into the list of bars for the chart.
 *
 * If there are only a few distinct results (splitters, multipliers...) every value gets its own
 * bar. If there are many (Charge produces a near-continuous spread) results are grouped into
 * whole-number ranges so the chart stays readable.
 *
 * Returns an ORDERED array: [{ label: '12' | '10-14', probability: 0..1 }, ...]
 * (An array - not an object - because object keys like "2" and "0.5" do not keep their order.)
 */

import { MAX_CHART_BARS } from '../config.js';

const roundProbability = (count, total) => Number((count / total).toFixed(4));

/**
 * @param {Array<[number, number]>} entries  [damageValue, count] pairs, sorted by value ascending
 * @param {number} total                     total number of trials
 * @param {number} maxBars
 */
export function buildDistribution(entries, total, maxBars = MAX_CHART_BARS) {
  if (entries.length === 0) return [];

  const min = entries[0][0];
  const max = entries[entries.length - 1][0];
  const needsBinning = entries.length > maxBars && max > min;

  if (!needsBinning) {
    return entries.map(([value, count]) => ({ label: String(value), probability: roundProbability(count, total) }));
  }

  // Whole-number bins, at least 1 wide, no more than `maxBars` of them.
  const lowest = Math.floor(min);
  const highest = Math.ceil(max);
  const width = Math.max(1, Math.ceil((highest - lowest + 1) / maxBars));

  const bins = new Map();
  for (const [value, count] of entries) {
    const index = Math.floor((value - lowest) / width);
    bins.set(index, (bins.get(index) ?? 0) + count);
  }

  return [...bins.keys()]
    .sort((a, b) => a - b)
    .map((index) => {
      const start = lowest + index * width;
      const end = start + width - 1;
      return {
        label: start === end ? `${start}` : `${start}-${end}`,
        probability: roundProbability(bins.get(index), total),
      };
    });
}
