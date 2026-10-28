import { categoryFromSlug, subcategoryFromSlugs } from "./categorySlugs";
import { buildPageHead } from "./pageHead";
import { seoDescription, seoTitle } from "./seoText";

export function categoryHeadData(category: string, subcategory: string | null, path: string) {
  const label = subcategory || category;
  return {
    title: seoTitle(label),
    description: seoDescription(null, subcategory
      ? `Explore curated ${subcategory.toLowerCase()} from designers and ateliers in Maison Affluency's collectible ${category.toLowerCase()} collection.`
      : `Discover collectible ${category.toLowerCase()} from world-renowned designers and ateliers at Maison Affluency.`),
    path,
  };
}

export function buildCategoryHead(categorySlug: string, subcategorySlug?: string) {
  const category = categoryFromSlug(categorySlug);
  const sub = subcategorySlug ? subcategoryFromSlugs(categorySlug, subcategorySlug) : null;
  if (!category || (subcategorySlug && !sub)) {
    return { meta: [{ title: "Collection not found — Maison Affluency" }, { name: "robots", content: "noindex, nofollow" }] };
  }
  const path = `/products-category/${categorySlug}${subcategorySlug ? `/${subcategorySlug}` : ""}`;
  return buildPageHead(categoryHeadData(category, sub?.subcategory || null, path));
}