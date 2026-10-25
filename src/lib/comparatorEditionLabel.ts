import { getHouseEditionLabel, profileEditionLine } from "./editionLabel";
import type { TradeProduct } from "./tradeProducts";

/** Mixed-maker comparisons use the full house credit, just like the Curator Picks directory. */
export function comparatorEditionLabel(product: Pick<TradeProduct, "brand_name" | "edition" | "tags" | "reedition_by">): string | null {
  return profileEditionLine({ edition: product.edition, tags: product.tags, founder: product.reedition_by })
    || getHouseEditionLabel({ designerName: product.brand_name, reeditionBy: product.reedition_by });
}