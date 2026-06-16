/**
 * Heuristics + override for "is this product upholstered?".
 *
 * A product is considered upholstered when:
 *   - its `is_upholstered` flag is explicitly true, OR
 *   - the flag is null/undefined AND its category/subcategory matches a known
 *     upholstery keyword.
 *
 * When `is_upholstered` is explicitly false, the product is NOT upholstered
 * regardless of category (admin override).
 */

const UPHOLSTERY_KEYWORDS: string[] = [
  "sofa",
  "armchair",
  "arm chair",
  "lounge chair",
  "bergere",
  "bergère",
  "settee",
  "loveseat",
  "love seat",
  "banquette",
  "bench",
  "ottoman",
  "pouf",
  "pouffe",
  "footstool",
  "stool",
  "daybed",
  "day bed",
  "chaise",
  "headboard",
  "bed",
  "dining chair",
  "side chair",
  "wingback",
  "wing chair",
  "club chair",
  "fauteuil",
  "canape",
  "canapé",
  "fabric",
  "leather",
  "upholster",
];

function matchesUpholsteryKeyword(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return UPHOLSTERY_KEYWORDS.some((kw) => v.includes(kw));
}

export interface UpholsteryHints {
  is_upholstered?: boolean | null;
  category?: string | null;
  subcategory?: string | null;
  materials?: string | null;
  title?: string | null;
  product_name?: string | null;
}

export function isProductUpholstered(p: UpholsteryHints | null | undefined): boolean {
  if (!p) return false;
  if (p.is_upholstered === true) return true;
  if (p.is_upholstered === false) return false;
  return (
    matchesUpholsteryKeyword(p.subcategory) ||
    matchesUpholsteryKeyword(p.category) ||
    matchesUpholsteryKeyword(p.materials) ||
    matchesUpholsteryKeyword(p.title) ||
    matchesUpholsteryKeyword(p.product_name)
  );
}
