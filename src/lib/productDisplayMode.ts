/** Display policy only; never changes account or transaction data. */
export function productDisplayPolicy(presentation: boolean, destinationCurrency: string) {
  return { showTradeTools: !presentation, showNetPrice: !presentation, currency: presentation ? destinationCurrency : "EUR" };
}
