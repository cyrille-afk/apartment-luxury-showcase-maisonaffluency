import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, X, Scale, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import GridDensityToggle from "@/components/GridDensityToggle";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
import { cn } from "@/lib/utils";
import { useCompare } from "@/contexts/CompareContext";
import { useDbCuratorPicks, useMasterCatalogCount, useMasterCatalogRawCount } from "@/hooks/useDbCuratorPicks";
import { useQueryClient } from "@tanstack/react-query";
import { readPendingCategoryFilter } from "@/lib/pendingCategoryFilter";
import { inferSubcategory, normalizeCategory } from "@/lib/productTaxonomy";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { categoryUrl } from "@/lib/categorySlugs";
import { normalizeSubcategory, getParentCategoryFromSubcategory } from "@/lib/categoryNormalization";
import CatalogCardImages from "@/components/product/CatalogCardImages";
import { useCatalogBatches } from "@/hooks/useCatalogBatches";
import { Link, useNavigate } from "react-router-dom";
import { ECART_REEDITION_LABEL, formatCuratorialEditionLine, isEcartReedition, getHouseEditionLabel } from "@/lib/editionLabel";
import { ROOM_LABELS, type RoomSlug } from "@/lib/roomCategories";
import { pickMatchesRoom, pickMatchesFilter } from "@/lib/roomMatching";
import { formatPublicRrpForDestination, usePublicRrpMap } from "@/hooks/usePublicRrp";
import { useShippingDestination } from "@/lib/shippingDestination";
import { prefetchPublicProductPage } from "@/lib/publicProductPageQuery";
import { useWishlist } from "@/contexts/WishlistContext";
import { curateGrid, useImageTones } from "@/lib/curateGrid";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";
import PublicProductLightbox, { type PublicLightboxItem } from "@/components/PublicProductLightbox";
import { getParentCategoryFromSubcategory as parentOfSub } from "@/lib/categoryNormalization";
import RoomCollectionFilters, { type RoomFacet, type RoomFacetValues, type RoomFacetOptions } from "@/components/RoomCollectionFilters";
import { originToCountries } from "@/lib/productOrigin";
import { ROOM_MATERIAL_CATEGORIES, roomMaterialCategories } from "@/lib/roomMaterialCategories";

const EMPTY_ROOM_FACETS: RoomFacetValues = { category: null, designer: null, leadTime: null, craft: null, handmade: null, material: null };
const ROOM_FACET_KEYS: RoomFacet[] = ["category", "designer", "leadTime", "craft", "handmade", "material"];

function roomFacetValues(item: ProductItem): Record<RoomFacet, string[]> {
  const pick = item.pick;
  const category = inferSubcategory(pick.category, pick.subcategory, pick.title);
  return {
    category: category ? [category] : [],
    // Dagmar's founder owns the house; he is not a designer credit on its pieces.
    designer: Array.from(new Set([item.designerName, item.reeditionBy === "Aaron Fitzgerald" ? undefined : item.reeditionBy, item.attributedDesigner].filter(Boolean) as string[])),
    leadTime: pick.lead_time ? [pick.lead_time.trim()] : [],
    craft: Array.from(new Set([
      ...(pick.tags || []).filter((tag) => /marquetry|lacquer|weav|knott|carv|cast|blown|glassblow|ceramic|woodwork|metalwork|upholster|embroid|forg/i.test(tag)),
      ...[
        ["Marquetry", /marquetry/i], ["Lacquerwork", /lacquer/i],
        ["Hand Knotting", /hand[- ]knott/i], ["Hand Weaving", /hand[- ]wov|hand[- ]weav/i],
        ["Glassblowing", /blown glass|glass[- ]blow/i], ["Carving", /carv/i],
        ["Casting", /cast(?:ing| bronze| brass| aluminium)/i],
        ["Ceramics", /ceramic|porcelain|stoneware|earthenware/i],
        ["Upholstery", /upholster/i],
      ].filter(([, pattern]) => (pattern as RegExp).test(pick.materials || "")).map(([label]) => label as string),
    ])),
    handmade: originToCountries(pick.origin),
    material: roomMaterialCategories(pick.materials, pick.title),
  };
}

const toRoomLightboxItem = (item: ProductItem): PublicLightboxItem => {
  const p = item.pick;
  const sub = inferSubcategory(p.category, p.subcategory, `${p.title} ${p.subtitle || ""} ${(p.tags || []).join(" ")}`) || p.subcategory || null;
  return {
    id: p.id || `${item.designerId}-${p.title}`,
    title: p.title,
    subtitle: p.subtitle ?? null,
    image_url: p.image || "",
    hover_image_url: p.hoverImage ?? null,
    brand_name: item.designerName,
    materials: p.materials ?? null,
    materials_description: p.materials_description ?? null,
    dimensions: p.dimensions ?? null,
    lead_time: p.lead_time ?? null,
    origin: p.origin ?? null,
    description: p.description ?? null,
    category: p.category ?? null,
    subcategory: sub,
    designer_slug: designerSlugify(item.designerId || item.designerName),
    size_variants: p.size_variants ?? null,
    variant_placeholder: p.variant_placeholder ?? null,
    base_axis_label: p.base_axis_label ?? null,
    top_axis_label: p.top_axis_label ?? null,
    gallery_images: p.gallery_images ?? null,
    variant_image_map: p.variant_image_map ?? null,
  };
};


const designerSlugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const productHref = (pick: CuratorPick) =>
  `/products/${pick.slug || designerSlugify(pick.title + (pick.subtitle ? `-${pick.subtitle}` : ""))}`;


type ProductItem = {
  pick: CuratorPick;
  designerName: string;
  designerId: string;
  section: "designers" | "collectibles" | "ateliers";
  reeditionBy?: string;
  attributedDesigner?: string;
};

// Import atelierOnlyPicks directly (it's now exported)
import { atelierOnlyPicks } from "@/components/BrandsAteliers";

function buildProductList(atelierPicks: Record<string, { name: string; curatorPicks: CuratorPick[] }>): ProductItem[] {
  const items: ProductItem[] = [];

  // Featured Designers
  for (const d of featuredDesigners) {
    for (const pick of d.curatorPicks) {
      if (pick.image) {
        items.push({ pick, designerName: d.name, designerId: d.id || d.name, section: "designers", reeditionBy: (d as any).founder || undefined });
      }
    }
  }

  // Collectible Designers
  for (const d of collectibleDesigners) {
    for (const pick of d.curatorPicks) {
      if (pick.image) {
        items.push({ pick, designerName: d.name, designerId: d.id || d.name, section: "collectibles", reeditionBy: (d as any).founder || undefined });
      }
    }
  }

  // Atelier-only picks — extract designer name from subtitle when available
  for (const [id, data] of Object.entries(atelierPicks)) {
    for (const pick of data.curatorPicks) {
      if (pick.image) {
        // If subtitle contains "Designer by Brand", use the designer name
        let displayName = data.name;
        const sub = (pick as any).subtitle as string | undefined;
        if (sub) {
          const byMatch = sub.match(/^(.+?)\s+by\s+/i);
          if (byMatch) {
            displayName = byMatch[1].trim();
          }
        }
        items.push({ pick, designerName: displayName, designerId: id, section: "ateliers", reeditionBy: data.name });
      }
    }
  }

  return items;
}

const SECTION_LABELS: Record<string, string> = {
  designers: "Designers & Makers",
  collectibles: "Collectible Design",
  ateliers: "Ateliers & Partners",
};

/** Map filterSource values to sectionScope values */
const SOURCE_TO_SCOPE: Record<string, string> = {
  designers: "designers",
  collectibles: "collectibles",
  brands: "ateliers",
};

const normalizeSearchText = (value?: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

// Build once at module level — inputs are static, no need for per-instance useMemo
const _sharedProductList = buildProductList(atelierOnlyPicks);

/** Merge hardcoded + DB picks, deduplicating by designerId + title */
function mergeWithDbPicks(hardcoded: ProductItem[], dbPicks: ProductItem[]): ProductItem[] {
  const merged = new Map<string, ProductItem>();
  const mergeKey = (item: ProductItem) =>
    `${item.designerId}::${normalizeSearchText(`${item.pick.title} ${item.pick.subtitle || ""}`)}`;

  for (const item of hardcoded) {
    const key = mergeKey(item);
    merged.set(key, item);
  }

  for (const item of dbPicks) {
    const key = mergeKey(item);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, item);
      continue;
    }

    merged.set(key, {
      ...existing,
      pick: {
        ...existing.pick,
        // Database identity is authoritative for public pricing and canonical routing.
        id: item.pick.id || existing.pick.id,
        slug: item.pick.slug || existing.pick.slug,
        image: existing.pick.image || item.pick.image,
        hoverImage: existing.pick.hoverImage || item.pick.hoverImage,
        subtitle: existing.pick.subtitle || item.pick.subtitle,
        category: existing.pick.category || item.pick.category,
        subcategory: existing.pick.subcategory || item.pick.subcategory,
        tags: existing.pick.tags?.length ? existing.pick.tags : item.pick.tags,
        materials: existing.pick.materials || item.pick.materials,
        dimensions: existing.pick.dimensions || item.pick.dimensions,
        description: existing.pick.description || item.pick.description,
        photoCredit: existing.pick.photoCredit || item.pick.photoCredit,
        edition: existing.pick.edition || item.pick.edition,
        pdfUrl: existing.pick.pdfUrl || item.pick.pdfUrl,
        pdfFilename: existing.pick.pdfFilename || item.pick.pdfFilename,
        pdfUrls: existing.pick.pdfUrls || item.pick.pdfUrls,
      },
    });
  }

  return Array.from(merged.values());
}

const ProductGrid = ({ sectionScope, roomSlug, roomCategory, roomSubcategory, compactTop, showAll }: { sectionScope?: "designers" | "collectibles" | "ateliers"; roomSlug?: RoomSlug; roomCategory?: string | null; roomSubcategory?: string | null; compactTop?: boolean; showAll?: boolean }) => {
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { data: dbPicks, isLoading: dbPicksLoading } = useDbCuratorPicks();
  const { data: masterCatalogCount } = useMasterCatalogCount();
  const { data: rawCatalogCount } = useMasterCatalogRawCount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const destination = useShippingDestination();
  const { isFavorited, toggleWishlist } = useWishlist();
  const { requireAuth, gateOpen, gateAction, closeGate } = useAuthGate();

  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [textQuery, setTextQuery] = useState<string | null>(null);
  // The database-backed public catalogue is authoritative. Never merge the
  // legacy hardcoded roster here: it can contain drafts or trade-only makers.
  const allProducts: ProductItem[] = useMemo(() => dbPicks || [], [dbPicks]);
  const [gridCols, setGridCols] = useState<3 | 4>(() => roomSlug ? 3 : 4);
  const [roomFiltersOpen, setRoomFiltersOpen] = useState(() => !showAll);
  const toggleCatalogueFilters = () => {
    const nextOpen = !roomFiltersOpen;
    setRoomFiltersOpen(nextOpen);
    setGridCols(nextOpen ? 3 : 4);
  };
  const [roomFacets, setRoomFacets] = useState<RoomFacetValues>(EMPTY_ROOM_FACETS);
  const gridRef = useRef<HTMLElement>(null);
  // Shop by Room: open the category-discovery lightbox variant instead of navigating.
  const [roomLightbox, setRoomLightbox] = useState<PublicLightboxItem | null>(null);
  const roomLightboxPool = useMemo(
    () => (roomSlug ? allProducts.filter((i) => i.pick.image).map(toRoomLightboxItem) : []),
    [roomSlug, allProducts],
  );
  const roomDiscovery = useMemo(() => roomSlug ? {
    heading: (it: PublicLightboxItem) => {
      const parent = parentOfSub(it.subcategory) || it.category;
      if (parent === "Seating") return "In Dialogue: Curated Seating";
      if (roomSlug === "living-room") return "In Dialogue: Alternative Centerpieces";
      return "In Dialogue: Alternative Curations";
    },
  } : undefined, [roomSlug]);
  const openItem = (item: ProductItem) => {
    if (roomSlug) setRoomLightbox(toRoomLightboxItem(item));
    else navigate(productHref(item.pick));
  };

/** Singularize a subcategory label: "Daybeds & Benches" → "Daybed & Bench" */
function singularizeSub(s: string): string {
  return s.replace(/\b\w+/g, (word) => {
    if (/ches$/i.test(word)) return word.slice(0, -2);
    if (/shes$/i.test(word)) return word.slice(0, -2);
    if (/sses$/i.test(word)) return word.slice(0, -2);
    if (/ies$/i.test(word)) return word.slice(0, -3) + 'y';
    if (/s$/i.test(word) && !/ss$/i.test(word)) return word.slice(0, -1);
    return word;
  });
}
  // Listen for global filter events from all sections
  useEffect(() => {
    // Hydrate from pending filter on mount (handles late mount via Suspense).
    const pending = readPendingCategoryFilter();
    if (pending && (pending.category || pending.subcategory)) {
      setCategory(pending.category);
      setSubcategory(pending.subcategory);
      setFilterSource('designers');
      setTextQuery(null);
      if (pending.subcategory) setGridCols(3);
    }

    const handleSetCategory = (e: CustomEvent) => {
      const { category: cat, subcategory: sub } = e.detail || {};
      setCategory(cat || null);
      setSubcategory(sub || null);
      setFilterSource('designers');
      setTextQuery(null);
      if (sub) setGridCols(3);
    };
    window.addEventListener('setDesignerCategory', handleSetCategory as EventListener);

    // Listen for sync events from all sources
    const handleSync = (e: CustomEvent) => {
      const { category: cat, subcategory: sub, source } = e.detail || {};
      setCategory(cat || null);
      setSubcategory(sub || null);
      setFilterSource(source || 'designers');
      setTextQuery(null);
      if (sub) setGridCols(3);
    };
    window.addEventListener('syncCategoryFilter', handleSync as EventListener);

    const handleSearchSync = (e: CustomEvent) => {
      const { query, source } = e.detail || {};
      const normalizedQuery = typeof query === 'string' ? query.trim() : '';

      if (normalizedQuery) {
        setCategory(null);
        setSubcategory(null);
        if (source) setFilterSource(source);
        setTextQuery(normalizedQuery);
        setGridCols(3);
        return;
      }

      setTextQuery(null);
    };
    window.addEventListener('syncProductSearch', handleSearchSync as EventListener);

    return () => {
      window.removeEventListener('setDesignerCategory', handleSetCategory as EventListener);
      window.removeEventListener('syncCategoryFilter', handleSync as EventListener);
      window.removeEventListener('syncProductSearch', handleSearchSync as EventListener);
    };
  }, []);

  const rawFiltered = useMemo(() => {
    if (!category && !subcategory && !textQuery && !roomSlug && !showAll) return [];

    // Scope results based on which section triggered the filter
    const sectionFilter = filterSource === 'collectibles' ? 'collectibles'
      : filterSource === 'brands' ? 'ateliers'
      : null; // 'designers' or mega-menu → show all

    const pool = sectionFilter ? allProducts.filter(item => item.section === sectionFilter) : allProducts;
    const normalizedQuery = normalizeSearchText(textQuery || undefined);

    const matched = pool.filter(item => {
      if (roomSlug && !pickMatchesRoom(item.pick, roomSlug)) return false;
      if (!pickMatchesFilter(item.pick, roomSlug ? roomCategory ?? null : category, roomSlug ? roomSubcategory ?? null : subcategory)) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        item.designerName,
        item.pick.title,
        item.pick.subtitle,
        item.pick.category,
        item.pick.subcategory,
        ...(item.pick.tags || []),
      ].map(value => normalizeSearchText(String(value || "")));

      return haystack.some(value => value.includes(normalizedQuery));
    });

    // Deduplicate: keep only the first image per product title per designer
    const seen = new Set<string>();
    return matched.filter(item => {
      const key = `${item.designerId}::${item.pick.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allProducts, category, subcategory, filterSource, textQuery, roomSlug, roomCategory, roomSubcategory, showAll]);

  const roomOptions = useMemo(() => {
    const options = {} as RoomFacetOptions;
    for (const key of ROOM_FACET_KEYS) {
      if (key === "material") {
        options.material = [...ROOM_MATERIAL_CATEGORIES];
        continue;
      }
      const values = new Set<string>();
      for (const item of rawFiltered) {
        const facets = roomFacetValues(item);
        if (ROOM_FACET_KEYS.some((other) => other !== key && roomFacets[other] && !facets[other].includes(roomFacets[other]))) continue;
        for (const value of facets[key]) values.add(value);
      }
      options[key] = [...values].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true }));
    }
    return options;
  }, [rawFiltered, roomFacets]);
  const availableRoomMaterials = useMemo(() => new Set(rawFiltered.flatMap((item) => roomMaterialCategories(item.pick.materials, item.pick.title))), [rawFiltered]);
  const catalogMaterials = useMemo(() => new Set(allProducts.flatMap((item) => roomMaterialCategories(item.pick.materials, item.pick.title))), [allProducts]);
  const facetFiltered = useMemo(() => roomSlug || showAll ? rawFiltered.filter((item) => {
    const facets = roomFacetValues(item);
    return ROOM_FACET_KEYS.every((key) => !roomFacets[key] || facets[key].includes(roomFacets[key]));
  }) : rawFiltered, [rawFiltered, roomSlug, showAll, roomFacets]);

  // Avoid eager tonal-analysis downloads for hundreds of off-batch photos.
  const itemTones = useImageTones(facetFiltered.map((i) => i.pick.image), { cachedOnly: true });
  const filtered = useMemo(
    () => curateGrid(facetFiltered, (i) => i.designerId, (i) => itemTones[i.pick.image]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facetFiltered, itemTones, Object.keys(itemTones).length],
  );
  const batchKey = JSON.stringify([roomSlug, roomCategory, roomSubcategory, category, subcategory, textQuery, filterSource, roomFacets, filtered.map((item) => item.pick.id || `${item.designerId}:${item.pick.title}`)]);
  const { renderedItems, hasMore, sentinelRef } = useCatalogBatches(filtered, batchKey);
  const { data: publicRrpMap = {} } = usePublicRrpMap(renderedItems.map((item) => item.pick.id));
  const isActive = Boolean(category || subcategory || textQuery || roomSlug);

  const handleClearFilter = useCallback(() => {
    setCategory(null);
    setSubcategory(null);
    setTextQuery(null);
    window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: null, subcategory: null } }));
    window.dispatchEvent(new CustomEvent('syncProductSearch', { detail: { query: null, source: filterSource } }));
  }, [filterSource]);


  // If scoped, only render when the filter source matches this instance
  const activeScope = filterSource ? (SOURCE_TO_SCOPE[filterSource] || "designers") : null;
  if (!roomSlug && sectionScope && activeScope !== sectionScope) return null;

  // Suppress the standalone designers ProductGrid — DesignersDirectory renders
  // its own filtered grid inline, so showing both creates a duplicate.
  if (!roomSlug && sectionScope === "designers" && activeScope === "designers") return null;

  if (!isActive && !showAll) return null;

  const filterLabel = roomSlug ? `${ROOM_LABELS[roomSlug]}${roomSubcategory || roomCategory ? ` — ${roomSubcategory || roomCategory}` : ""}` : showAll ? "Full Catalogue" : subcategory || category || (textQuery ? `Search: “${textQuery}”` : "");

  // Build breadcrumbs (Home → Category → Subcategory) when a category filter is active.
  const crumbs: Crumb[] = (() => {
    const rawSub = subcategory?.trim() || null;
    const canonicalSub = normalizeSubcategory(rawSub);
    const canonicalCat =
      normalizeCategory(category?.trim() || undefined, rawSub || undefined) ||
      getParentCategoryFromSubcategory(rawSub) ||
      null;
    const items: Crumb[] = [{ label: "Home", to: "/" }];
    if (canonicalCat) {
      if (canonicalSub) {
        items.push({ label: canonicalCat, to: categoryUrl(canonicalCat, null) });
        items.push({ label: canonicalSub });
      } else {
        items.push({ label: canonicalCat });
      }
    } else if (textQuery) {
      items.push({ label: `Search: “${textQuery}”` });
    }
    return items;
  })();

  return (
    <>
    <section ref={gridRef} id="product-grid" className={`bg-background scroll-header-offset ${compactTop ? "pt-4 pb-12 md:pb-16" : "py-12 md:py-16"}`}>
      <div className={`${roomSlug ? "max-w-7xl" : "max-w-[1500px]"} mx-auto px-4 md:px-8`}>
        {/* Breadcrumbs */}
        {crumbs.length > 1 && <Breadcrumbs items={crumbs} className="mb-4" />}
        {/* Header */}
        <div className={`flex items-center justify-between ${compactTop ? "mb-4" : "mb-8"}`}>
          <div>
            <h2 className="font-display text-2xl md:text-3xl text-foreground">
              {filterLabel}
            </h2>
            {dbPicksLoading && !dbPicks ? (
              <span
                className="inline-flex items-center gap-2 mt-1 w-64 align-middle"
                aria-label="Loading pieces count"
              >
                <span className="block h-3 w-56 rounded bg-muted animate-pulse" />
              </span>
            ) : (
              <p className="font-body text-sm text-[hsl(var(--accent))] mt-1">
                {roomSlug || showAll ? (
                  <>
                    Showing {filtered.length} curated {filtered.length === 1 ? "piece" : "pieces"} out of{" "}
                    {masterCatalogCount || allProducts.length} published pieces currently browseable
                    {rawCatalogCount ? ` from ${rawCatalogCount} total` : ""} in the master catalogue
                  </>
                ) : (
                  <>
                    {filtered.length} {filtered.length === 1 ? "piece" : "pieces"} across{" "}
                    {filterSource === 'collectibles' ? 'Collectible Design'
                      : filterSource === 'brands' ? 'all Ateliers'
                      : filterSource === 'designers' ? 'all Designers'
                      : 'all collections'}
                  </>
                )}
              </p>
            )}

          </div>
          <div className="flex items-center gap-3">
            {/* Grid columns toggle — desktop only */}
            {!roomSlug && !showAll && <div className="hidden md:block">
              <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setGridCols(gridCols === 3 ? 4 : 3)}
                    className="flex items-center p-1.5 rounded transition-all hover:opacity-70"
                    aria-label={`Switch to ${gridCols === 3 ? 4 : 3} column grid`}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      {gridCols === 3 ? (
                        <>
                          <rect x="2" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                          <rect x="8.5" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                          <rect x="15" y="3" width="4.5" height="18" rx="1" fill="currentColor" />
                          <rect x="21.5" y="3" width="1" height="18" rx="0.5" fill="currentColor" opacity="0.25" />
                        </>
                      ) : (
                        <>
                          <rect x="4" y="3" width="4" height="18" rx="1" fill="currentColor" />
                          <rect x="10" y="3" width="4" height="18" rx="1" fill="currentColor" />
                          <rect x="16" y="3" width="4" height="18" rx="1" fill="currentColor" />
                        </>
                      )}
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {gridCols === 3 ? "Display 4" : "Display 3"}
                </TooltipContent>
              </Tooltip>
              </TooltipProvider>
            </div>}
            {roomSlug || showAll ? (
              <GridDensityToggle value={showAll && roomFiltersOpen ? 3 : gridCols} onChange={(next) => { setGridCols(next); if (showAll && next === 4) setRoomFiltersOpen(false); }} />
            ) : showAll && !isActive ? null : (
            <button
              onClick={handleClearFilter}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-[hsl(var(--gold))] bg-white shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] font-body text-xs uppercase tracking-[0.15em] text-foreground transition-all duration-300"
            >
              <X className="h-3.5 w-3.5" />
              Clear Filter
            </button>
            )}
          </div>
        </div>

        {showAll && <Button variant="outline" size="icon-sm" className="mb-5 hidden md:inline-flex" aria-label={roomFiltersOpen ? "Hide catalogue filters" : "Show catalogue filters"} title={roomFiltersOpen ? "Hide catalogue filters" : "Show catalogue filters"} aria-expanded={roomFiltersOpen} aria-controls="catalogue-filters" onClick={toggleCatalogueFilters}><SlidersHorizontal className="size-4" /></Button>}
        <div className={roomSlug || showAll ? `md:flex md:items-start transition-[gap] duration-300 motion-reduce:transition-none ${roomSlug || roomFiltersOpen ? "md:gap-6 lg:gap-8" : "md:gap-0"}` : ""}>
        {(roomSlug || showAll) && <RoomCollectionFilters
          fullCatalogue={showAll}
          options={roomOptions}
          availableMaterials={availableRoomMaterials}
          catalogMaterials={catalogMaterials}
          values={roomFacets}
          onChange={(key, value) => setRoomFacets((current) => ({ ...current, [key]: value }))}
          onClear={() => setRoomFacets(EMPTY_ROOM_FACETS)}
          open={roomFiltersOpen}
          onOpenChange={setRoomFiltersOpen}
        />}
        {/* Product Grid */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`grid min-w-0 flex-1 grid-cols-2 ${roomSlug ? (gridCols === 4 ? 'md:grid-cols-3 lg:grid-cols-4' : 'lg:grid-cols-3') : showAll && roomFiltersOpen ? 'md:grid-cols-3' : gridCols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 md:gap-6 transition-all duration-300 motion-reduce:transition-none`}
        >
          {renderedItems.map((item) => (
            <div
              key={item.pick.id || `${item.designerId}-${item.pick.title}`}
              data-catalog-card
               className={`group flex h-full cursor-pointer flex-col [contain:layout_style] ${roomSlug ? "" : "justify-between"}`}
              tabIndex={0}
              role="link"
              aria-label={`View ${item.pick.title} product details`}
              onClick={() => openItem(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openItem(item);
              }}
              onMouseEnter={() => { prefetchPublicProductPage(queryClient, undefined, item.pick.slug || designerSlugify(item.pick.title)); }}
              onFocus={() => { prefetchPublicProductPage(queryClient, undefined, item.pick.slug || designerSlugify(item.pick.title)); }}
              onTouchStart={() => prefetchPublicProductPage(queryClient, undefined, item.pick.slug || designerSlugify(item.pick.title))}
            >
              <div className="relative w-full aspect-square overflow-hidden bg-[hsl(var(--product-canvas))]">
                <CatalogCardImages
                  primary={item.pick.image}
                  alternate={item.pick.hoverImage}
                  alt={`${item.pick.title} by ${item.designerName} — collectible design furniture`}
                  sizes={`(max-width: 768px) 50vw, ${roomSlug ? '27vw' : gridCols === 4 ? '25vw' : '33vw'}`}
                  room={Boolean(roomSlug)}
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    const favoriteId = item.pick.id;
                    if (!favoriteId) return;
                    requireAuth(() => {
                      toggleWishlist(favoriteId, {
                        title: item.pick.title,
                        designer: item.designerName,
                        imageUrl: item.pick.image,
                      });
                    }, "save pieces to your favorites");
                  }}
                  className={cn(
                    "absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-background",
                    item.pick.id && isFavorited(item.pick.id)
                      ? "text-destructive"
                      : "text-foreground/75 hover:text-foreground",
                  )}
                  aria-label={item.pick.id && isFavorited(item.pick.id) ? `Remove ${item.pick.title} from favorites` : `Add ${item.pick.title} to favorites`}
                  title={item.pick.id && isFavorited(item.pick.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart
                    className={cn("h-4 w-4", item.pick.id && isFavorited(item.pick.id) && "fill-current")}
                    strokeWidth={1.5}
                  />
                </button>
                {/* Compare pin button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin({ pick: item.pick, designerName: item.designerName, designerId: item.designerId, section: item.section });
                  }}
                  className={cn(
                    "absolute bottom-2 left-2 z-10 p-1.5 rounded-full transition-all duration-300 backdrop-blur-sm",
                    isPinned(item.pick.title, item.designerId)
                      ? "bg-[hsl(var(--gold))] text-foreground shadow-md"
                      : "bg-black/40 text-white/70 md:opacity-0 md:group-hover:opacity-100 hover:bg-black/60",
                    compareItems.length >= 3 && !isPinned(item.pick.title, item.designerId) && "pointer-events-none"
                  )}
                  aria-label={isPinned(item.pick.title, item.designerId) ? "Remove from comparison" : "Add to comparison"}
                >
                  <Scale size={14} />
                </button>
                {(formatCuratorialEditionLine(item.pick) || getHouseEditionLabel({ designerName: item.designerName, reeditionBy: item.reeditionBy })) && (
                  <p className="absolute left-3 top-3 z-10 max-w-[70%] rounded-sm bg-background/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--edition-foreground))] antialiased backdrop-blur-sm">
                    {formatCuratorialEditionLine(item.pick) || getHouseEditionLabel({ designerName: item.designerName, reeditionBy: item.reeditionBy })}
                  </p>
                )}
              </div>
               <div className={`flex w-full justify-between px-1 ${roomSlug ? "mt-3 items-baseline gap-1.5 md:gap-4" : "mt-3 h-12 items-start gap-4"}`}>
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <Link
                    to={`/designers/${designerSlugify(item.designerId || item.designerName)}`}
                    onClick={(e) => e.stopPropagation()}
                     className={`group/designer block w-full font-body font-semibold uppercase text-foreground antialiased transition-colors duration-300 ease-in-out hover:text-foreground/70 ${roomSlug ? "break-words text-[9px] leading-tight tracking-normal md:text-[10px] md:tracking-wider" : "truncate whitespace-nowrap text-[10px] tracking-wider"}`}
                   >
                     <span className="relative inline-block max-w-full pb-1 align-bottom">
                       {item.designerName.includes(' - ') ? item.designerName.split(' - ')[0].trim() : item.designerName}
                       <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-current transition-transform duration-300 ease-in-out group-hover/designer:scale-x-100 motion-reduce:transition-none" />
                     </span>
                   </Link>
                   <h3 className={`mt-0.5 font-body font-medium leading-snug text-muted-foreground antialiased ${roomSlug ? "line-clamp-2 text-[11px] md:text-xs" : "line-clamp-1 text-xs"}`}>
                    {subcategory === "Dining Tables" && !item.pick.title.toLowerCase().includes("table")
                      ? `${item.pick.title} Table`
                      : item.pick.title}
                  </h3>
                </div>
                 <div className={`shrink-0 text-right ${roomSlug ? "max-w-[46%]" : "whitespace-nowrap"}`}>
                   <p className={`font-body font-semibold text-foreground antialiased ${roomSlug ? "text-[9px] leading-tight md:text-xs" : "whitespace-nowrap text-xs"}`}>
                     {formatPublicRrpForDestination(publicRrpMap[item.pick.id || ""], destination.currency) || "Price upon Request"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
        </div>
        {hasMore && <div ref={sentinelRef} data-catalog-sentinel aria-hidden="true" className="h-1 w-full" />}
        {!dbPicksLoading && filtered.length === 0 && (
          <p className="py-20 text-center font-body text-sm text-muted-foreground">
            No pieces are currently available for this room.
          </p>
        )}
      </div>

    </section>
    <AuthGateDialog open={gateOpen} onClose={closeGate} action={gateAction} />
    {roomSlug && (
      <PublicProductLightbox
        product={roomLightbox}
        allPicks={roomLightboxPool}
        onClose={() => setRoomLightbox(null)}
        onSelectRelated={(it) => setRoomLightbox(it)}
        categoryDiscovery={roomDiscovery}
      />
    )}
    </>
  );
};

export default ProductGrid;
