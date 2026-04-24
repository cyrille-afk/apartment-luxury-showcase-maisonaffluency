// Centralised registry of guide slug -> dynamic import.
// Used by both TradeGuideDetail (lazy route) and TradeGuides (prefetch on hover/in-view).

export const GUIDE_LOADERS: Record<string, () => Promise<unknown>> = {
  "shared-filters": () => import("../TradeGuideSharedFilters"),
  "ffe-schedule": () => import("../TradeGuideFFE"),
  "tearsheets": () => import("../TradeGuideTearsheets"),
};

const prefetched = new Set<string>();

export function prefetchGuide(slug: string) {
  if (prefetched.has(slug)) return;
  const loader = GUIDE_LOADERS[slug];
  if (!loader) return;
  prefetched.add(slug);
  // Fire and forget; swallow errors so prefetch never breaks UX.
  loader().catch(() => {
    prefetched.delete(slug);
  });
}
