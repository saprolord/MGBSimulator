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

import { CHART_TAIL_CUTOFF, MAX_CHART_BARS } from '../config.js';

const roundProbability = (count, total) => Number((count / total).toFixed(4));

/**
 * Group sorted [value, count] entries into bars.
 * Each bar also remembers `lastIndex`: the index of the last entry it contains.
 */
function binEntries(entries, maxBars) {
  if (entries.length === 0) return [];

  const min = entries[0][0];
  const max = entries[entries.length - 1][0];
  const needsBinning = entries.length > maxBars && max > min;

  if (!needsBinning) {
    return entries.map(([value, count], index) => ({ label: String(value), count, lastIndex: index }));
  }

  // Whole-number bins, at least 1 wide, no more than `maxBars` of them.
  const lowest = Math.floor(min);
  const highest = Math.ceil(max);
  const width = Math.max(1, Math.ceil((highest - lowest + 1) / maxBars));

  const bins = new Map(); // bin index -> { count, lastIndex }
  entries.forEach(([value, count], entryIndex) => {
    const index = Math.floor((value - lowest) / width);
    const bin = bins.get(index) ?? { count: 0, lastIndex: entryIndex };
    bin.count += count;
    bin.lastIndex = entryIndex;
    bins.set(index, bin);
  });

  return [...bins.keys()]
    .sort((a, b) => a - b)
    .map((index) => {
      const start = lowest + index * width;
      const end = start + width - 1;
      const { count, lastIndex } = bins.get(index);
      return { label: start === end ? `${start}` : `${start}-${end}`, count, lastIndex };
    });
}

/**
 * @param {Array<[number, number]>} entries  [damageValue, count] pairs, sorted by value ascending
 * @param {number} total                     total number of trials
 * @param {number} maxBars
 */
export function buildDistribution(entries, total, maxBars = MAX_CHART_BARS) {
  return binEntries(entries, maxBars).map(({ label, count }) => ({
    label,
    probability: roundProbability(count, total),
  }));
}

/**
 * The distribution as the CHART shows it:
 *   1. Bin everything as usual, then find the thin tail: the bars at the HIGH end whose probability
 *      is below `cutoff` (rare, huge results). Bars in the middle are never cut.
 *   2. Throw that tail away and bin what is LEFT again, over only the remaining range, so the
 *      surviving results are spread over up to `maxBars` bars instead of being squeezed into one
 *      wide bar that was sized for the rare outliers.
 *
 * Probabilities stay relative to ALL trials, so the bars add up to slightly less than 100 %
 * (the missing amount is the hidden tail). min / max are not affected: they come from the full result.
 */
export function buildChartDistribution(entries, total, maxBars = MAX_CHART_BARS, cutoff = CHART_TAIL_CUTOFF) {
  const bars = binEntries(entries, maxBars);
  if (bars.length === 0) return [];

  let last = bars.length - 1;
  while (last > 0 && bars[last].count / total < cutoff) last--;

  return buildDistribution(entries.slice(0, bars[last].lastIndex + 1), total, maxBars);
}
