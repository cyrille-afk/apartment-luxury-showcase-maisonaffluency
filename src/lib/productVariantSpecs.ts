import { looksLikeDimension } from "@/lib/rugPricing";

export interface VariantSpecLike {
  label?: string;
  base?: string;
  top?: string;
  price_cents?: number;
}

export function firstPublicVariantDimensionLabel(
  variants: VariantSpecLike[] | null | undefined,
): string | null {
  for (const variant of variants || []) {
    const label = (variant?.label || "").trim();
    if (label && looksLikeDimension(label)) return label;
  }
  return null;
}