/** Discovery is not trade availability: only this published house is opted in. */
export function isPublicTradeDiscoveryEligible(designer: {
  slug?: string | null;
  is_published?: boolean | null;
  trade_only?: boolean | null;
}, tradeHidden: boolean): boolean {
  return tradeHidden && designer.slug === "collection-particuliere"
    && designer.is_published === true && designer.trade_only === false;
}