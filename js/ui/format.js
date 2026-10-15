/**
 * Number formatting for what the user reads.
 *
 * Numbers above 9999 are shown in scientific notation: 987567 -> "9.9e5", 12345 -> "1.2e4".
 * Everything up to 9999 is left exactly as it is (1234.56 stays "1234.56").
 */

export const SCIENTIFIC_ABOVE = 9999;

/** @param {number} digits decimals in the mantissa (1 -> "9.9e5") */
export function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value) || Math.abs(value) <= SCIENTIFIC_ABOVE) return String(value);
  return value.toExponential(digits).replace('e+', 'e');
}

/** Format every number inside a chart label: "10000-10499" -> "1.00e4-1.05e4". */
export const formatLabel = (label, digits = 1) =>
  label.replace(/\d+(?:\.\d+)?/g, (match) => formatNumber(Number(match), digits));

/**
 * Format a whole set of chart labels. Uses as few decimals as possible, but adds more if
 * two different bars would otherwise end up with the same label (e.g. "1.0e4-1.0e4" twice).
 */
export function formatLabels(labels) {
  let formatted = labels;
  for (let digits = 1; digits <= 4; digits++) {
    formatted = labels.map((label) => formatLabel(label, digits));
    if (new Set(formatted).size === formatted.length) break;
  }
  return formatted;
}
