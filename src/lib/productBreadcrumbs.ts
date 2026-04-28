/**
 * Shared breadcrumb builder for product pages (Public + Trade).
 *
 * Guarantees:
 *  1. Order is always: [root] → Category → Subcategory → Title.
 *  2. The Category crumb is ALWAYS included whenever we can resolve one,
 *     even if `product.category` is empty (we derive it from the
 *     subcategory's parent in the taxonomy).
 *  3. Crumb labels are normalized to the canonical taxonomy spelling
 *     (e.g. "decor" → "Décor", "cabinets" → "Cabinets") so that the
 *     visible label and the URL slug never disagree.
 *  4. The Subcategory crumb is only emitted when its parent Category
 *     crumb is also present, so we never render an orphan deep crumb.
 */
import { normalizeCategory } from "./productTaxonomy";
import {
  normalizeSubcategory,
  getParentCategoryFromSubcategory,
} from "./categoryNormalization";
import { categoryUrl } from "./categorySlugs";
import type { Crumb } from "@/components/Breadcrumbs";

export interface ProductBreadcrumbInput {
  /** Root crumb (e.g. { label: "Home", to: "/" } or { label: "Trade", to: "/trade/showroom" }). */
  root: Crumb;
  /** Raw category from the product row (may be empty / non-canonical). */
  category?: string | null;
  /** Raw subcategory from the product row (may be empty / non-canonical). */
  subcategory?: string | null;
  /** Product title — rendered as the final, non-linked crumb. */
  title: string;
  /**
   * Optional URL builder for the Category and Subcategory crumbs.
   * Defaults to the public CategoryRoute (`/products-category/...`).
   * Trade pages override this so users return to the Trade Gallery
   * grid pre-filtered to the same category/subcategory instead of
   * being booted out to the public site.
   */
  buildCategoryHref?: (category: string, subcategory: string | null) => string;
}

export function buildProductBreadcrumbs({
  root,
  category,
  subcategory,
  title,
  buildCategoryHref = categoryUrl,
}: ProductBreadcrumbInput): Crumb[] {
  const rawSub = subcategory?.trim() || null;
  const canonicalSub = normalizeSubcategory(rawSub); // canonical-cased label or null

  // Resolve the canonical category. Try in order:
  //   1. taxonomy normalization of product.category (with subcategory hint)
  //   2. parent category derived from the subcategory
  const canonicalCat =
    normalizeCategory(category?.trim() || undefined, rawSub || undefined) ||
    getParentCategoryFromSubcategory(rawSub) ||
    null;

  const crumbs: Crumb[] = [root];

  if (canonicalCat) {
    crumbs.push({
      label: canonicalCat,
      to: categoryUrl(canonicalCat, null),
    });

    // Subcategory only makes sense when nested under its category.
    if (canonicalSub) {
      crumbs.push({
        label: canonicalSub,
        to: categoryUrl(canonicalCat, canonicalSub),
      });
    }
  }

  crumbs.push({ label: title });
  return crumbs;
}
