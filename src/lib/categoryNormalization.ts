import { SUBCATEGORY_MAP } from "./productTaxonomy";

/**
 * Shared canonical normalization for product category/subcategory strings.
 *
 * - `normalizeSubcategory`: converts a raw db value (e.g. "cabinets") into the
 *   canonical-cased label from the taxonomy (e.g. "Cabinets"). If no match is
 *   found, the trimmed raw value is returned. Returns null when input is empty.
 * - `getParentCategoryFromSubcategory`: looks up the parent category whose
 *   subcategory list contains the given raw subcategory (e.g. "cabinets" →
 *   "Storage"). Returns null when no parent is found.
 * - `normalizeCategoryContext`: convenience helper that returns both values
 *   plus the trimmed raw subcategory in one call.
 */

export function normalizeSubcategory(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const match = Object.values(SUBCATEGORY_MAP)
    .flat()
    .find((s) => s.toLowerCase() === trimmed.toLowerCase());
  return match || trimmed;
}

export function getParentCategoryFromSubcategory(raw?: string | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const entry = Object.entries(SUBCATEGORY_MAP).find(([, values]) =>
    values.some((value) => value.toLowerCase() === trimmed.toLowerCase())
  );
  return entry?.[0] || null;
}

export interface CategoryContext {
  rawSubcategory: string | null;
  normalizedSubcategory: string | null;
  normalizedParentCategory: string | null;
}

export function normalizeCategoryContext(raw?: string | null): CategoryContext {
  const rawSubcategory = raw?.trim() || null;
  return {
    rawSubcategory,
    normalizedSubcategory: normalizeSubcategory(rawSubcategory),
    normalizedParentCategory: getParentCategoryFromSubcategory(rawSubcategory),
  };
}
