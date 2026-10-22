import { findQuoteFinishSwatch, type QuoteFinishSwatch, type QuoteFinishVariant } from "./quoteFinishSwatches";

export type ProductFinishCombination = {
  base: string;
  top: string;
  baseTextureUrl: string;
  topTextureUrl: string;
};

/** Only recorded pairs with real samples can become instant 3D presets. */
export function productFinishCombinations(variants: QuoteFinishVariant[], swatches: QuoteFinishSwatch[], size: string | null = null): ProductFinishCombination[] {
  const seen = new Set<string>();
  return variants.flatMap((variant) => {
    const base = variant.base?.trim();
    const top = variant.top?.trim();
    if (!base || !top || (size && variant.label?.trim() !== size)) return [];
    const key = JSON.stringify([base, top]);
    if (seen.has(key)) return [];
    const baseSwatch = findQuoteFinishSwatch([base], swatches);
    const topSwatch = findQuoteFinishSwatch([top], swatches);
    if (!baseSwatch?.image_url || !topSwatch?.image_url) return [];
    seen.add(key);
    return [{ base, top, baseTextureUrl: baseSwatch.image_url, topTextureUrl: topSwatch.image_url }];
  });
}