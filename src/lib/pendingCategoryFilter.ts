// Shared "pending" category filter so late-mounting (lazy/Suspense) homepage
// sections can pick up the active filter from URL navigation even if they
// missed the one-shot `syncCategoryFilter` event.
import { categoryFromSlug, subcategoryFromSlugs } from "./categorySlugs";

export type PendingCategoryFilter = {
  category: string | null;
  subcategory: string | null;
} | null;

const KEY = "__activeCategoryFilter" as const;

declare global {
  interface Window {
    __activeCategoryFilter?: PendingCategoryFilter;
  }
}

export function setPendingCategoryFilter(value: PendingCategoryFilter) {
  if (typeof window === "undefined") return;
  window[KEY] = value;
}

export function clearPendingCategoryFilter() {
  if (typeof window === "undefined") return;
  window[KEY] = null;
}

/**
 * Read the active filter. Falls back to parsing the current URL
 * (/products-category/:cat/:sub?) if no in-memory value is set yet.
 */
export function readPendingCategoryFilter(): PendingCategoryFilter {
  if (typeof window === "undefined") return null;
  const stored = window[KEY];
  if (stored && (stored.category || stored.subcategory)) return stored;

  try {
    const path = window.location.pathname;
    const m = path.match(/^\/products-category\/([^/]+)(?:\/([^/]+))?\/?$/);
    if (!m) return null;
    const cat = categoryFromSlug(m[1]);
    if (!cat) return null;
    if (m[2]) {
      const sub = subcategoryFromSlugs(m[1], m[2]);
      return { category: cat, subcategory: sub?.subcategory ?? null };
    }
    return { category: cat, subcategory: null };
  } catch {
    return null;
  }
}
