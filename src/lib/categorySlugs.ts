// Bidirectional slug ↔ taxonomy label mapping for /products-category/* URLs.
// Slugs are lowercase, hyphenated, ASCII (no diacritics).
import { CATEGORY_ORDER, SUBCATEGORY_MAP } from "./productTaxonomy";

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function toSlug(label: string): string {
  return stripDiacritics(label)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Build reverse maps once.
const categoryBySlug: Record<string, string> = {};
const subcategoryBySlug: Record<string, { category: string; subcategory: string }> = {};

for (const cat of CATEGORY_ORDER) {
  categoryBySlug[toSlug(cat)] = cat;
  for (const sub of SUBCATEGORY_MAP[cat] || []) {
    subcategoryBySlug[`${toSlug(cat)}/${toSlug(sub)}`] = { category: cat, subcategory: sub };
  }
}

export function categoryFromSlug(slug?: string): string | null {
  if (!slug) return null;
  return categoryBySlug[slug.toLowerCase()] ?? null;
}

export function subcategoryFromSlugs(catSlug?: string, subSlug?: string): { category: string; subcategory: string } | null {
  if (!catSlug || !subSlug) return null;
  return subcategoryBySlug[`${catSlug.toLowerCase()}/${subSlug.toLowerCase()}`] ?? null;
}

export function categoryUrl(category: string | null, subcategory: string | null): string {
  if (!category) return "/";
  const catSlug = toSlug(category);
  if (subcategory) return `/products-category/${catSlug}/${toSlug(subcategory)}`;
  return `/products-category/${catSlug}`;
}
