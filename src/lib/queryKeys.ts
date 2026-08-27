/**
 * Shared React Query key factories.
 *
 * Using these constants (instead of ad-hoc string arrays inside each hook)
 * guarantees that `/`, `/designers`, and category pages hit the SAME cache
 * entry for the same data — so navigating between them no longer refetches.
 *
 * Pair with the global `staleTime` / `gcTime` defaults set on the
 * QueryClient in `src/App.tsx`.
 */

export const queryKeys = {
  // ── Designers ────────────────────────────────────────────────────────────
  designersAll: (includeTradeOnly = false) =>
    ["designers-all", includeTradeOnly] as const,
  /** Slim column set for the A–Z directory list (avoids shipping biographies). */
  designersAllLite: () => ["designers-all-lite"] as const,

  designersNewIn: () => ["designers-new-in"] as const,
  designer: (slug: string | undefined, includeTradeOnly = false) =>
    ["designer", slug, includeTradeOnly] as const,
  designerByName: (name: string | undefined, includeTradeOnly = false) =>
    ["designer-by-name", name, includeTradeOnly] as const,
  designersRelated: (currentSlug: string | undefined, source: string | undefined) =>
    ["designers-related", currentSlug, source] as const,

  // ── Curator picks ────────────────────────────────────────────────────────
  /** Slim listing used by Index / category / ProductGrid. */
  curatorPicksGrid: () => ["db-curator-picks-for-grid"] as const,
  /** Full curator picks used by the A–Z directory. */
  curatorPicksDirectory: () => ["full-curator-picks-directory"] as const,
  /** Curator picks payload used by the homepage Gallery hotspot → lightbox mapping. */
  curatorPicksLightbox: () => ["curator-picks-lightbox"] as const,
  /** Minimal designers lookup (id / name / slug). Shared across Home + Gallery. */
  designersBasic: () => ["designers-basic"] as const,
  curatorPickDetail: (pickId: string | undefined) =>
    ["curator-pick-detail", pickId] as const,
  designerPicks: (designerId: string | undefined, publicOnly = false) =>
    ["designer-picks", designerId, publicOnly] as const,
  designerGroupedPicks: (
    designerId: string | undefined,
    designerName: string | undefined,
    publicOnly = false,
  ) => ["designer-grouped-picks", designerId, designerName, publicOnly] as const,

  // ── Directory support data ───────────────────────────────────────────────
  designerCategoryMap: () => ["designer-category-map"] as const,
  designerFirstPickImage: () => ["designer-first-pick-image"] as const,
  designerHotspotFallbacks: () => ["designer-hotspot-fallbacks"] as const,
  designersWithIgPosts: () => ["designers-with-ig-posts"] as const,

  // ── Hero (featured designers) ────────────────────────────────────────────
  designersHeroFeatured: (slugs: readonly string[]) =>
    ["designers-hero-featured-v4", slugs] as const,
  designersAllFirstPickImages: () =>
    ["designers-all-first-pick-images-v1"] as const,

  // ── Product detail pages ─────────────────────────────────────────────────
  publicProductPage: (designerSlug: string | undefined, productSlug: string | undefined) =>
    ["public-product-page", designerSlug, productSlug] as const,
  tradeProductPage: (
    tradeProductIdParam: string | undefined,
    designerSlug: string | undefined,
    productSlug: string | undefined,
  ) => ["trade-product-page", tradeProductIdParam, designerSlug, productSlug] as const,
} as const;
