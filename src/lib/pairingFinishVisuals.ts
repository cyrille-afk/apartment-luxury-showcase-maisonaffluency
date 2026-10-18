import { buildProductFinishMap, resolveVariantImageIndex } from "./variantImageMap";
import { pairingSelectionComplete, type PairingSelection, type PairingVariant } from "./curatedPairingConfiguration";

export type PairingSwatch = { name: string; image_url: string | null };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function pairingSwatchFor(name: string, swatches: PairingSwatch[]) {
  const key = normalize(name);
  if (!key) return undefined;
  const exact = swatches.filter((swatch) => normalize(swatch.name.replace(/\s*\[[^\]]*\]\s*/g, "")) === key);
  if (exact.length === 1) return exact[0];
  const suffix = swatches.filter((swatch) => normalize(swatch.name).endsWith(key));
  return suffix.length === 1 ? suffix[0] : undefined;
}

export function pairingVisualOptions(options: string[], swatches: PairingSwatch[]) {
  return options.flatMap((value) => {
    const family = swatches.filter((swatch) => normalize(swatch.name.split(/\s+-\s+/)[0]) === normalize(value));
    return family.length ? family.map((swatch) => ({ value, name: swatch.name })) : [{ value, name: pairingSwatchFor(value, swatches)?.name || value }];
  });
}

export function pairingFinishImage(rawMap: unknown, images: string[], rows: PairingVariant[], selection: PairingSelection, customFinish?: string) {
  if (!customFinish && (!rows.length || !pairingSelectionComplete(rows, selection))) return undefined;
  const index = resolveVariantImageIndex(buildProductFinishMap(rawMap), customFinish ? { label: customFinish, variants: [], imageCount: images.length, requireCompletePair: false } : { ...selection, size: selection.label, variants: rows, imageCount: images.length });
  return index === undefined ? undefined : images[index];
}