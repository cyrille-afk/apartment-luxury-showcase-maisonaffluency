import type { TradeProduct } from "./tradeProducts";
import { normalizeBrandToParent } from "./brandNormalization";

/** Suppress only the repeated maker, never a different collaborator credit. */
export function suppressTradeCardBrand(brand: string, activeBrand: string | null, search: string): boolean {
  const key = (value: string) => normalizeBrandToParent(value).normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const maker = key(brand);
  return Boolean(maker && ((activeBrand && key(activeBrand) === maker) || key(search) === maker));
}

type CardProduct = Pick<TradeProduct, "lead_time" | "dimensions" | "size_variants">;

/** First recorded size from the variant list; variants repeat per finish, so dedupe labels. */
function dimensionsFromVariants(variants: CardProduct["size_variants"]): string | null {
  if (!variants?.length) return null;
  const seen = new Set<string>();
  const distinct: string[] = [];
  for (const variant of variants) {
    const label = variant?.label?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(label);
  }
  if (!distinct.length) return null;
  return distinct.length > 1 ? `${distinct[0]} · ${distinct.length} sizes` : distinct[0];
}

/** Missing catalogue specifications stay unknown, never substituted. */
export function tradeCardMetadata(product: CardProduct) {
  return {
    leadTime: product.lead_time?.trim() || null,
    dimensions: product.dimensions?.trim() || dimensionsFromVariants(product.size_variants),
  };
}
