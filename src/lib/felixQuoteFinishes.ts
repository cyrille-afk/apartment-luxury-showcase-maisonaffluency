import { findQuoteFinishSwatch, type QuoteFinishSwatch, type QuoteFinishVariant } from "./quoteFinishSwatches";
import { getBasePlaceholder, getTopPlaceholder, getMaterialPlaceholder, isDimensionAxisLabel, type VariantPlaceholderInput } from "./variantPlaceholders";
export interface FelixQuoteFinish {
  label: string;
  name: string;
  imageUrl?: string | null;
}

export function felixFinishLabel(placeholder: string | null | undefined, fallback: string) {
  return placeholder?.replace(/^select\s+(?:your|the)\s+/i, "").trim() || fallback;
}

export function felixQuoteFinishes(card: { finishes?: FelixQuoteFinish[]; fabricLabel?: string | null; baseLabel?: string | null; topLabel?: string | null }): FelixQuoteFinish[] {
  if (card.finishes) return card.finishes;
  return [
    { label: "Fabric", name: card.fabricLabel },
    { label: "Base", name: card.baseLabel },
    { label: "Top Finish", name: card.topLabel },
  ].filter((finish): finish is { label: string; name: string } => !!finish.name);
}

/** Resolve only the chosen variant, never all available finish alternatives. */
export function resolveFelixCatalogueFinishes(product: VariantPlaceholderInput & { size_variants?: QuoteFinishVariant[] | null }, variant: string | null | undefined, swatches: QuoteFinishSwatch[]): FelixQuoteFinish[] {
  if (!variant?.trim()) return [];
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const selected = normalize(variant);
  const variants = product.size_variants ?? [];
  const combinations = variants.filter(v => [[v.base, v.top, v.label].filter(Boolean).join(" — "), [v.base, v.top].filter(Boolean).join(" / ")].some(value => value && normalize(value) === selected));
  const labels = variants.filter(v => v.label && normalize(v.label) === selected);
  const matches = combinations.length ? combinations : labels;
  if (matches.length > 1) return [];
  const hit = matches[0];
  const result: FelixQuoteFinish[] = [];
  const add = (label: string, name: string | null | undefined) => {
    if (!name?.trim()) return;
    const swatch = findQuoteFinishSwatch([name], swatches);
    // A tier/range may have several colours; don't invent a selected colour.
    const candidates = swatches.filter(s => normalize(s.name) === normalize(name) || normalize(s.name).startsWith(normalize(name).replace(/ range$/, "") + " "));
    const exact = swatches.find(s => normalize(s.name) === normalize(name));
    const matched = exact || (candidates.length > 1 ? null : swatch);
    result.push({ label: felixFinishLabel(label, "Finish"), name: matched?.name || name, imageUrl: matched?.image_url });
  };
  if (hit && (hit.base || hit.top)) {
    if (!isDimensionAxisLabel(product.base_axis_label)) add(getBasePlaceholder(product), hit.base);
    if (!isDimensionAxisLabel(product.top_axis_label)) add(getTopPlaceholder(product), hit.top);
  } else {
    // Named single-axis finishes (including trade-only pieces) remain visible.
    if (!/\d\s*(?:cm|mm|inch|inches|×|x)\b/i.test(variant)) add(getMaterialPlaceholder(product), variant);
  }
  return result;
}