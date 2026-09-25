import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, X, Scale } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
import { cn } from "@/lib/utils";
import { useCompare } from "@/contexts/CompareContext";
import { useDbCuratorPicks } from "@/hooks/useDbCuratorPicks";
import { useQueryClient } from "@tanstack/react-query";
import { readPendingCategoryFilter } from "@/lib/pendingCategoryFilter";
import { inferSubcategory, normalizeCategory } from "@/lib/productTaxonomy";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { categoryUrl } from "@/lib/categorySlugs";
import { normalizeSubcategory, getParentCategoryFromSubcategory } from "@/lib/categoryNormalization";
import { cldResponsiveImg } from "@/lib/cloudinary";
import { Link, useNavigate } from "react-router-dom";
import { ECART_REEDITION_LABEL, formatCuratorialEditionLine, isEcartReedition } from "@/lib/editionLabel";
import { ROOM_LABELS, ROOM_MAP, type RoomSlug } from "@/lib/roomCategories";
import { formatPublicRrpForDestination, usePublicRrpMap } from "@/hooks/usePublicRrp";
import { useShippingDestination } from "@/lib/shippingDestination";
import { prefetchPublicProductPage } from "@/lib/publicProductPageQuery";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";

const designerSlugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const productHref = (pick: CuratorPick) =>
  `/products/${pick.slug || designerSlugify(pick.title + (pick.subtitle ? `-${pick.subtitle}` : ""))}`;

// ─── SUB_TAGS mapping (same as FeaturedDesigners) ────────────────────────
const SUB_TAGS: Record<string, string[]> = {
  "Sofas": ["Sofa"], "Armchairs": ["Armchair", "Armchairs"], "Chairs": ["Chair"],
  "Daybeds & Benches": ["Daybed", "Bench"], "Ottomans & Stools": ["Ottoman", "Stool"],
  "Bar Stools": ["Bar Stool"], "Consoles": ["Console"], "Coffee Tables": ["Coffee Table"],
  "Desks": ["Desk"], "Dining Tables": ["Dining Table"], "Side Tables": ["Side Table"],
  "Wall Lights": ["Wall Light", "Wall Lamp", "Sconce"], "Ceiling Lights": ["Ceiling Light", "Chandelier", "Pendant", "Suspension"],
  "Floor Lights": ["Floor Light", "Floor Lamp"], "Table Lights": ["Table Light", "Table Lamp", "Lantern"],
  "Bookcases": ["Bookcase"], "Cabinets": ["Cabinet"],
  "Hand-Knotted Rugs": ["Hand-Knotted Rug", "Textile"], "Hand-Tufted Rugs": ["Hand-Tufted Rug"],
  "Hand-Woven Rugs": ["Hand-Woven Rug"], "Vases & Vessels": ["Vase", "Vessel"],
  "Mirrors": ["Mirror"], "Books": ["Book"], "Candle Holders": ["Candle Holder"],
  "Decorative Objects": ["Decorative Object", "Object", "Sculpture"],
  "Centre Tables": ["Centre Table"],
};

type ProductItem = {
  pick: CuratorPick;
  designerName: string;
  designerId: string;
  section: "designers" | "collectibles" | "ateliers";
  reeditionBy?: string;
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

function normalizeLabel(value?: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(\w+?)s\b/g, "$1");
}

function labelsMatch(a?: string, b?: string): boolean {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Stricter match for top-level categories — requires full-word boundary match
 *  to prevent "Table Lamp" from matching the "Tables" category. */
function categoryMatch(pickValue?: string, category?: string): boolean {
  const na = normalizeLabel(pickValue);
  const nb = normalizeLabel(category);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Check word-boundary match: "table" should match "table" but not "table lamp"
  const regex = new RegExp(`(^|\\s)${nb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
  return regex.test(na);
}

/** Map top-level categories to the set of subcategory tags they contain,
 *  so "Tables" only matches Table-related subs, not "Table Lamp". */
const CATEGORY_SUBCATS: Record<string, string[]> = {
  "Seating": ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools"],
  "Tables": ["Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables", "Centre Tables"],
  "Storage": ["Bookcases", "Bars", "Buffets, Cabinets And Sideboards"],
  "Bedroom": ["Bedding", "Beds", "Bedside Tables", "Sofa-Beds"],
  "Lighting": ["Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights"],
  "Rugs": ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"],
  "Décor": ["Vases & Vessels", "Mirrors", "Books", "Boxes", "Candle Holders", "Cushions & Throws", "Decorative Objects", "Desk Accessories", "Tableware & Linens", "Wall Décor"],
};


function pickMatchesFilter(pick: CuratorPick, category: string | null, subcategory: string | null): boolean {
  if (!category && !subcategory) return true;

  // Resolve effective subcategory using title-based inference as fallback,
  // so picks with only a top-level category (e.g. "Tables") still match
  // specific subcategory filters (e.g. "Coffee Tables") via their title.
  const inferenceText = [pick.title, pick.subtitle].filter(Boolean).join(" ");
  const effectiveSub = inferSubcategory(pick.category, pick.subcategory, inferenceText);

  if (subcategory) {
    const tags = SUB_TAGS[subcategory] || [subcategory];
    return tags.some(tag =>
      categoryMatch(pick.subcategory, tag) ||
      categoryMatch(pick.subcategory, subcategory) ||
      categoryMatch(pick.category, tag) ||
      (pick.tags && pick.tags.some(t => categoryMatch(t, tag))) ||
      categoryMatch(effectiveSub, tag) ||
      categoryMatch(effectiveSub, subcategory)
    );
  }
  // Top-level category: match against all its subcategory tags to avoid false positives
  const subs = CATEGORY_SUBCATS[category!];
  if (subs) {
    return subs.some(sub => {
      const tags = SUB_TAGS[sub] || [sub];
      return tags.some(tag =>
        categoryMatch(pick.subcategory, tag) ||
        categoryMatch(pick.subcategory, sub) ||
        categoryMatch(pick.category, tag) ||
        (pick.tags && pick.tags.some(t => categoryMatch(t, tag))) ||
        categoryMatch(effectiveSub, tag) ||
        categoryMatch(effectiveSub, sub)
      );
    });
  }
  // Fallback: exact category match only (no tag matching to prevent cross-category leaks)
  return categoryMatch(pick.category, category || undefined) || false;
}

const ROOM_CATEGORY_ALIASES: Record<string, string[]> = {
  sofas: ["Sofas"],
  armchairs: ["Armchairs"],
  daybeds: ["Daybeds & Benches", "Daybed"],
  benches: ["Daybeds & Benches", "Bench"],
  "coffee-tables": ["Coffee Tables"],
  "side-tables": ["Side Tables"],
  credenzas: ["Buffets, Cabinets And Sideboards", "Credenza", "Sideboard"],
  rugs: ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs", "Rug"],
  "floor-lights": ["Floor Lights"],
  "dining-tables": ["Dining Tables"],
  chairs: ["Chairs"],
  "bar-stools": ["Ottomans & Stools", "Bar Stool"],
  "ceiling-lights": ["Ceiling Lights"],
  beds: ["Beds"],
  nightstands: ["Bedside Tables", "Nightstand"],
  dressers: ["Dresser"],
  wardrobes: ["Wardrobe"],
  "table-lights": ["Table Lights"],
  desks: ["Desks"],
  "office-chairs": ["Office Chair", "Desk Chair"],
  bookcases: ["Bookcases"],
};

function pickMatchesRoom(pick: CuratorPick, room: RoomSlug): boolean {
  const inferenceText = [pick.title, pick.subtitle].filter(Boolean).join(" ");
  const effectiveSub = inferSubcategory(pick.category, pick.subcategory, inferenceText);
  const values = [pick.category, pick.subcategory, effectiveSub, pick.title, ...(pick.tags || [])];

  return ROOM_MAP[room].some((roomCategory) =>
    (ROOM_CATEGORY_ALIASES[roomCategory] || [roomCategory]).some((alias) =>
      values.some((value) => categoryMatch(value, alias)),
    ),
  );
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

const ProductGrid = ({ sectionScope, roomSlug }: { sectionScope?: "designers" | "collectibles" | "ateliers"; roomSlug?: RoomSlug }) => {
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { data: dbPicks, isLoading: dbPicksLoading } = useDbCuratorPicks();
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
  const gridRef = useRef<HTMLElement>(null);

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

  const filtered = useMemo(() => {
    if (!category && !subcategory && !textQuery && !roomSlug) return [];

    // Scope results based on which section triggered the filter
    const sectionFilter = filterSource === 'collectibles' ? 'collectibles'
      : filterSource === 'brands' ? 'ateliers'
      : null; // 'designers' or mega-menu → show all

    const pool = sectionFilter ? allProducts.filter(item => item.section === sectionFilter) : allProducts;
    const normalizedQuery = normalizeSearchText(textQuery || undefined);

    const matched = pool.filter(item => {
      if (roomSlug && !pickMatchesRoom(item.pick, roomSlug)) return false;
      if (!pickMatchesFilter(item.pick, category, subcategory)) return false;
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
  }, [allProducts, category, subcategory, filterSource, textQuery, roomSlug]);

  const { data: publicRrpMap = {} } = usePublicRrpMap(filtered.map((item) => item.pick.id));
  const isActive = Boolean(category || subcategory || textQuery || roomSlug);

  // Hover images are fetched only when the shopper shows intent.
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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

  if (!isActive) return null;

  const filterLabel = roomSlug ? ROOM_LABELS[roomSlug] : subcategory || category || (textQuery ? `Search: “${textQuery}”` : "");

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
    <section ref={gridRef} id="product-grid" className="py-12 md:py-16 bg-background scroll-header-offset">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Breadcrumbs */}
        {crumbs.length > 1 && <Breadcrumbs items={crumbs} className="mb-4" />}
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
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
                {filtered.length} {filtered.length === 1 ? "piece" : "pieces"} across {
                  roomSlug ? 'the collection'
                  :
                  filterSource === 'collectibles' ? 'Collectible Design'
                  : filterSource === 'brands' ? 'all Ateliers'
                  : filterSource === 'designers' ? 'all Designers'
                  : 'all collections'
                }
              </p>
            )}

          </div>
          <div className="flex items-center gap-3">
            {/* Grid columns toggle — desktop only */}
            <div className="hidden md:block">
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
            </div>
            <button
              onClick={roomSlug ? () => { window.location.href = "/designers"; } : handleClearFilter}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-[hsl(var(--gold))] bg-white shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] font-body text-xs uppercase tracking-[0.15em] text-foreground transition-all duration-300"
            >
              <X className="h-3.5 w-3.5" />
              {roomSlug ? "All Designers" : "Clear Filter"}
            </button>
          </div>
        </div>

        {/* Product Grid */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`grid grid-cols-2 ${gridCols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 md:gap-6 transition-all duration-300`}
        >
          {filtered.map((item, idx) => (
            <motion.div
              key={`${item.designerId}-${item.pick.title}-${idx}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
              className="group flex h-full cursor-pointer flex-col justify-between"
              tabIndex={0}
              role="link"
              aria-label={`View ${item.pick.title} product details`}
              onClick={() => navigate(productHref(item.pick))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") navigate(productHref(item.pick));
              }}
              onMouseEnter={() => { prefetchPublicProductPage(queryClient, undefined, item.pick.slug || designerSlugify(item.pick.title)); setHoveredIdx(idx); }}
              onMouseLeave={() => setHoveredIdx((cur) => (cur === idx ? null : cur))}
              onFocus={() => { prefetchPublicProductPage(queryClient, undefined, item.pick.slug || designerSlugify(item.pick.title)); setHoveredIdx(idx); }}
              onTouchStart={() => prefetchPublicProductPage(queryClient, undefined, item.pick.slug || designerSlugify(item.pick.title))}
            >
              <div className="relative w-full aspect-square overflow-hidden bg-[hsl(var(--collection-card-canvas))]">
                <img
                  {...cldResponsiveImg(item.pick.image, {
                    widths: [300, 400, 600, 800],
                    sizes: `(max-width: 768px) 50vw, ${gridCols === 4 ? '25vw' : '33vw'}`,
                  })}
                  alt={`${item.pick.title} by ${item.designerName} — collectible design furniture`}
                  className={`absolute inset-0 m-auto max-w-[80%] max-h-[80%] object-contain object-center mix-blend-multiply transition-all duration-500 group-hover:scale-105 ${item.pick.hoverImage ? 'group-hover:opacity-0' : ''}`}
                  loading="lazy"
                  decoding="async"
                />
                {/* Hover image mounts only on hover/focus so it isn't fetched upfront */}
                {item.pick.hoverImage && hoveredIdx === idx && (
                  <img
                    {...cldResponsiveImg(item.pick.hoverImage, {
                      widths: [300, 400, 600, 800],
                      sizes: `(max-width: 768px) 50vw, ${gridCols === 4 ? '25vw' : '33vw'}`,
                    })}
                    alt={`${item.pick.title} by ${item.designerName} — alternate view`}
                    className="absolute inset-0 m-auto max-w-[80%] max-h-[80%] object-contain object-center mix-blend-multiply opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                )}
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
              </div>
              <div className="mt-3 flex h-12 w-full items-start justify-between gap-4 px-1">
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <Link
                    to={`/designers/${designerSlugify(item.designerId || item.designerName)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block w-full truncate whitespace-nowrap font-body text-[10px] font-semibold uppercase tracking-wider text-foreground antialiased hover:text-foreground/70 transition-colors"
                  >
                    {item.designerName.includes(' - ') ? item.designerName.split(' - ')[0].trim() : item.designerName}
                  </Link>
                  <h3 className="mt-0.5 line-clamp-1 font-body text-xs font-medium leading-snug text-muted-foreground antialiased">
                    {subcategory === "Dining Tables" && !item.pick.title.toLowerCase().includes("table")
                      ? `${item.pick.title} Table`
                      : item.pick.title}
                  </h3>
                </div>
                <div className="shrink-0 whitespace-nowrap text-right">
                  <p className="whitespace-nowrap font-body text-xs font-semibold text-foreground antialiased">
                    {formatPublicRrpForDestination(publicRrpMap[item.pick.id || ""], destination.currency) || "Price upon request"}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
        {!dbPicksLoading && filtered.length === 0 && (
          <p className="py-20 text-center font-body text-sm text-muted-foreground">
            No pieces are currently available for this room.
          </p>
        )}
      </div>

    </section>
    <AuthGateDialog open={gateOpen} onClose={closeGate} action={gateAction} />
    </>
  );
};

export default ProductGrid;
