import { normalizeCategory, normalizeSubcategory } from "@/lib/productTaxonomy";

export interface FilterablePick {
  category?: string | null;
  subcategory?: string | null;
  tags?: string[] | null;
}

/**
 * Decide whether a curator pick belongs in the currently selected
 * category / subcategory filter.
 *
 * Critical rule: when the pick already has a resolvable primary category
 * (e.g. Seating), generic tags like "Limited Edition" / "Sculpture" must
 * NOT pull it into Décor via the tag-fallback path. Tag fallback only
 * applies when the pick has no resolvable category of its own.
 */
export function pickMatchesCategoryFilter(
  pick: FilterablePick,
  selectedCategory: string | null | undefined,
  selectedSubcategory: string | null | undefined,
): boolean {
  if (!selectedCategory && !selectedSubcategory) return true;

  if (selectedSubcategory) {
    const normSub = normalizeSubcategory(selectedSubcategory);
    const pickSub =
      normalizeSubcategory(pick.subcategory || undefined) ||
      normalizeSubcategory(pick.category || undefined);
    if (pickSub === normSub) return true;
    // Same guard as the category branch: don't let generic tags
    // ("Limited Edition", "Sculpture", …) drag a Seating/Tables/Lighting
    // pick into Décor → Decorative Objects via the tag fallback.
    if (pickSub) return false;
    return !!(pick.tags && pick.tags.some((t) => normalizeSubcategory(t) === normSub));
  }

  const normCat = normalizeCategory(selectedCategory!);
  const pickCat = normalizeCategory(
    pick.category || undefined,
    pick.subcategory || undefined,
  );
  if (pickCat === normCat) return true;
  if (pickCat) return false;
  return !!(pick.tags && pick.tags.some((t) => normalizeCategory(t) === normCat));
}
