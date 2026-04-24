// Centralised registry of guide slug -> dynamic import.
// Used by both TradeGuideDetail (lazy route) and TradeGuides (prefetch on hover/in-view).

export const GUIDE_LOADERS: Record<string, () => Promise<unknown>> = {
  "multi-user-studio-shared-filters": () => import("../TradeGuideSharedFilters"),
  "ffe-schedule": () => import("../TradeGuideFFE"),
  "tearsheets": () => import("../TradeGuideTearsheets"),
};

// Legacy slug -> canonical slug. Keeps old links/bookmarks working.
export const GUIDE_SLUG_ALIASES: Record<string, string> = {
  "shared-filters": "multi-user-studio-shared-filters",
};

const prefetched = new Set<string>();

export function prefetchGuide(slug: string) {
  const canonical = GUIDE_SLUG_ALIASES[slug] ?? slug;
  if (prefetched.has(canonical)) return;
  const loader = GUIDE_LOADERS[canonical];
  if (!loader) return;
  prefetched.add(canonical);
  // Fire and forget; swallow errors so prefetch never breaks UX.
  loader().catch(() => {
    prefetched.delete(canonical);
  });
}
