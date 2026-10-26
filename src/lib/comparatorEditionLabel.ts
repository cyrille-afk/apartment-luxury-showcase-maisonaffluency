import { getHouseEditionLabel, isEcartReedition, profileEditionLine } from "./editionLabel";
import type { TradeProduct } from "./tradeProducts";

/**
 * Comparator chips match the product page: only a recorded edition, or the
 * Ecart REEDITION house credit. Parent houses (e.g. Pouenat for Gilles &
 * Boissier) never generate a generic "<House> Edition" chip here.
 */
export function comparatorEditionLabel(product: Pick<TradeProduct, "brand_name" | "edition" | "tags" | "reedition_by">): string | null {
  const line = profileEditionLine({ edition: product.edition, tags: product.tags, founder: product.reedition_by });
  if (line) return line;
  if (isEcartReedition({ designerName: product.brand_name, reeditionBy: product.reedition_by })) {
    return getHouseEditionLabel({ designerName: product.brand_name, reeditionBy: product.reedition_by });
  }
  return null;
}
