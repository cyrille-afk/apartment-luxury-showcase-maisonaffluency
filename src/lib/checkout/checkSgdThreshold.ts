/**
 * Singapore low-value goods threshold check for USD-priced orders.
 *
 * Singapore's GST low-value goods (LVG) scheme treats consignments with a
 * value of S$400 or less as taxable at checkout; consignments above S$400
 * are treated as normal imports and GST is collected by the courier at
 * customs clearance instead.
 */
export interface SgdThresholdResult {
  /** True when the SGD equivalent is S$400 or less. */
  isLowValueGoods: boolean;
  /** The calculated SGD equivalent, rounded to 2 decimals. */
  sgdEquivalent: number;
}

/**
 * Determines whether a USD amount falls within Singapore's low-value goods
 * threshold after conversion to SGD.
 *
 * @param usdAmount - Amount in United States Dollars.
 * @param usdToSgdRate - Conversion rate; defaults to 1.35 when not supplied.
 * @returns Threshold result including the SGD equivalent.
 */
export function checkSgdThreshold(
  usdAmount: number,
  usdToSgdRate = 1.35,
): SgdThresholdResult {
  const sgdEquivalent = Number((usdAmount * usdToSgdRate).toFixed(2));
  return {
    isLowValueGoods: sgdEquivalent <= 400,
    sgdEquivalent,
  };
}
