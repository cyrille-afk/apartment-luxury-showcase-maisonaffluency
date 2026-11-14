import { resolveDimensions, type ProductDimensions } from "@/lib/productDimensions";
import { has3dAsset, visualiserPlacements, type VisualiserCatalogItem } from "@/lib/visualiserCatalog";

export type VisualiserAlternativeProduct = VisualiserCatalogItem & {
  source_pick_id?: string | null;
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  dimensions?: string | null;
  size_variants?: Array<{ label?: string | null; base?: string | null; top?: string | null }> | null;
};

const identity = (item: Pick<VisualiserAlternativeProduct, "id" | "source_pick_id">) => item.source_pick_id || item.id;
const GENERIC_CATEGORY = "Other";

/** Same explicit functional placement; a shared broad room such as "Tables" is not enough. */
export function sameFunctionalCategory(active: VisualiserCatalogItem, candidate: VisualiserCatalogItem): boolean {
  const a = visualiserPlacements(active);
  const b = visualiserPlacements(candidate);
  const subcategories = a.subcategories.filter(value => b.subcategories.includes(value));
  if (subcategories.length) return true;
  if (a.subcategories.length || b.subcategories.length) return false;
  return a.categories.some(value => value !== GENERIC_CATEGORY && b.categories.includes(value));
}

/** Unknown dimensions are not declared incompatible; every recorded axis must stay within 0.5×–2×. */
export function compatibleProportions(active: VisualiserAlternativeProduct, candidate: VisualiserAlternativeProduct): boolean {
  const a = resolveDimensions(active);
  const b = resolveDimensions(candidate);
  if (!a || !b) return true;
  return (["w", "d", "h"] as const).every(axis => {
    const ratio = b[axis] / a[axis];
    return Number.isFinite(ratio) && ratio >= 0.5 && ratio <= 2;
  });
}

function proportionDistance(a: ProductDimensions | null, b: ProductDimensions | null): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return (["w", "d", "h"] as const).reduce((sum, axis) => sum + Math.abs(Math.log(b[axis] / a[axis])), 0);
}

/** 3D-ready, functionally equivalent alternatives, excluding catalogue/source-pick mirrors of the active piece. */
export function curatedVisualiserAlternatives<T extends VisualiserAlternativeProduct>(active: T, products: T[]): T[] {
  const activeIdentity = identity(active);
  const activeDimensions = resolveDimensions(active);
  return products
    .filter(candidate => candidate.id !== active.id && identity(candidate) !== activeIdentity)
    .filter((candidate, index, candidates) => candidates.findIndex(other => identity(other) === identity(candidate)) === index)
    .filter(has3dAsset)
    .filter(candidate => sameFunctionalCategory(active, candidate))
    .filter(candidate => compatibleProportions(active, candidate))
    .sort((a, b) => {
      const distance = proportionDistance(activeDimensions, resolveDimensions(a)) - proportionDistance(activeDimensions, resolveDimensions(b));
      if (Number.isFinite(distance) && distance !== 0) return distance;
      return `${a.brand_name} ${a.product_name}`.localeCompare(`${b.brand_name} ${b.product_name}`);
    });
}
