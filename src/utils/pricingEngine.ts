/**
 * Checkout pricing engine — multi-currency subtotal, Singapore GST threshold logic,
 * and final order total including delivery deposits.
 */

export type SupportedCurrency = "USD" | "EUR" | "SGD" | string;

export interface CartLineInput {
  id: string;
  /** Unit price expressed in `currency` major units (not cents). */
  price: number;
  currency: SupportedCurrency;
  quantity: number;
}

export interface ExchangeRates {
  /** How many USD one EUR buys. */
  EUR_TO_USD: number;
  /** How many SGD one USD buys. */
  USD_TO_SGD: number;
}

export type TaxStatus = "DEFERRED_BORDER_CUSTOMS" | "NOT_APPLICABLE";

export interface CartTotalResult {
  subtotalUSD: number;
  subtotalSGD: number;
  shippingUSD: number;
  orderTotalUSD: number;
  taxStatus: TaxStatus;
  displayTaxLabel: string;
  /** True when the SGD equivalent is at or below the S$400 low-value goods threshold. */
  isLowValueGoods: boolean;
}

export const SGD_LOW_VALUE_THRESHOLD = 400;

const DEFAULT_RATES: ExchangeRates = { EUR_TO_USD: 1.12, USD_TO_SGD: 1.35 };

/** Round to 2 decimals, avoiding binary float drift on sums. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Convert a single line's total into USD. */
function lineTotalUSD(line: CartLineInput, rates: ExchangeRates): number {
  const qty = Number.isFinite(line.quantity) ? Math.max(0, line.quantity) : 0;
  const price = Number.isFinite(line.price) ? line.price : 0;
  const gross = price * qty;
  switch ((line.currency || "USD").toUpperCase()) {
    case "EUR":
      return gross * rates.EUR_TO_USD;
    case "SGD":
      return rates.USD_TO_SGD > 0 ? gross / rates.USD_TO_SGD : gross;
    default:
      return gross;
  }
}

/**
 * Calculate a uniform USD subtotal, the SGD equivalent, the Singapore tax posture,
 * and the final order total including any delivery deposit.
 */
export function calculateCartTotal(
  basket: CartLineInput[],
  destinationCountry: string = "SG",
  rates: ExchangeRates = DEFAULT_RATES,
  shippingDepositUSD: number = 0,
): CartTotalResult {
  const safeRates: ExchangeRates = {
    EUR_TO_USD: rates?.EUR_TO_USD > 0 ? rates.EUR_TO_USD : DEFAULT_RATES.EUR_TO_USD,
    USD_TO_SGD: rates?.USD_TO_SGD > 0 ? rates.USD_TO_SGD : DEFAULT_RATES.USD_TO_SGD,
  };

  const subtotalUSD = round2(
    (basket ?? []).reduce((sum, line) => sum + lineTotalUSD(line, safeRates), 0),
  );
  const subtotalSGD = round2(subtotalUSD * safeRates.USD_TO_SGD);
  const shippingUSD = round2(Number.isFinite(shippingDepositUSD) ? shippingDepositUSD : 0);
  const orderTotalUSD = round2(subtotalUSD + shippingUSD);

  const isSingapore = (destinationCountry || "").toUpperCase() === "SG";
  const isLowValueGoods = subtotalSGD <= SGD_LOW_VALUE_THRESHOLD;
  const deferred = isSingapore && !isLowValueGoods;

  return {
    subtotalUSD,
    subtotalSGD,
    shippingUSD,
    orderTotalUSD,
    taxStatus: deferred ? "DEFERRED_BORDER_CUSTOMS" : "NOT_APPLICABLE",
    displayTaxLabel: deferred
      ? "Tax (Import GST): Handled at Border Customs (Value exceeds S$400 threshold)"
      : "Tax: Calculated at checkout where applicable",
    isLowValueGoods,
  };
}

export default calculateCartTotal;
