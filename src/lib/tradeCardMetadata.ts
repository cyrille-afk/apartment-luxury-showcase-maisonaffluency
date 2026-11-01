import type { TradeProduct } from "./tradeProducts";

/** Missing catalogue specifications stay unknown, never substituted. */
export function tradeCardMetadata(product: Pick<TradeProduct, "lead_time" | "dimensions">) {
  return {
    leadTime: product.lead_time?.trim() || null,
    dimensions: product.dimensions?.trim() || null,
  };
}