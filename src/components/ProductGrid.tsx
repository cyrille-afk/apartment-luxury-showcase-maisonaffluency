import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileDown, ChevronLeft, ChevronRight, ArrowUp, Maximize2, Minimize2, MessageSquareQuote, Search, Scale } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
import PinchZoomImage from "./PinchZoomImage";
import QuoteRequestDialog from "./QuoteRequestDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";

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
};

// Import atelierOnlyPicks directly (it's now exported)
import { atelierOnlyPicks } from "@/components/BrandsAteliers";

function buildProductList(atelierPicks: Record<string, { name: string; curatorPicks: CuratorPick[] }>): ProductItem[] {
  const items: ProductItem[] = [];

  // Featured Designers
  for (const d of featuredDesigners) {
    for (const pick of d.curatorPicks) {
      if (pick.image) {
        items.push({ pick, designerName: d.name, designerId: d.id || d.name, section: "designers" });
      }
    }
  }

  // Collectible Designers
  for (const d of collectibleDesigners) {
    for (const pick of d.curatorPicks) {
      if (pick.image) {
        items.push({ pick, designerName: d.name, designerId: d.id || d.name, section: "collectibles" });
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
        items.push({ pick, designerName: displayName, designerId: id, section: "ateliers" });
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
  "Seating": ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools", "Bar Stools"],
  "Tables": ["Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables", "Centre Tables"],
  "Storage": ["Bookcases", "Cabinets"],
  "Lighting": ["Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights"],
  "Rugs": ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"],
  "Décor": ["Vases & Vessels", "Mirrors", "Books", "Candle Holders", "Decorative Objects"],
};

function pickMatchesFilter(pick: CuratorPick, category: string | null, subcategory: string | null): boolean {
  if (!category && !subcategory) return true;
  if (subcategory) {
    const tags = SUB_TAGS[subcategory] || [subcategory];
    return tags.some(tag =>
      categoryMatch(pick.subcategory, tag) ||
      categoryMatch(pick.subcategory, subcategory) ||
      categoryMatch(pick.category, tag) ||
      (pick.tags && pick.tags.some(t => categoryMatch(t, tag)))
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
        (pick.tags && pick.tags.some(t => categoryMatch(t, tag)))
      );
    });
  }
  // Fallback: exact category match only (no tag matching to prevent cross-category leaks)
  return categoryMatch(pick.category, category || undefined) || false;
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

const ProductGrid = ({ sectionScope }: { sectionScope?: "designers" | "collectibles" | "ateliers" }) => {
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [textQuery, setTextQuery] = useState<string | null>(null);
  const allProducts = _sharedProductList;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [gridCols, setGridCols] = useState<3 | 4>(4);
  const [navigatedToProfile, setNavigatedToProfile] = useState(false);
  const [isLightboxImageLoaded, setIsLightboxImageLoaded] = useState(false);
  const [lightboxHovered, setLightboxHovered] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState<{ name?: string; designer?: string }>({});
  const gridRef = useRef<HTMLElement>(null);
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);

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
    if (!category && !subcategory && !textQuery) return [];

    // Scope results based on which section triggered the filter
    const sectionFilter = filterSource === 'collectibles' ? 'collectibles'
      : filterSource === 'brands' ? 'ateliers'
      : null; // 'designers' or mega-menu → show all

    const pool = sectionFilter ? allProducts.filter(item => item.section === sectionFilter) : allProducts;
    const normalizedQuery = normalizeSearchText(textQuery || undefined);

    const matched = pool.filter(item => {
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
  }, [allProducts, category, subcategory, filterSource, textQuery]);

  const isActive = (category || subcategory || textQuery) && filtered.length > 0;

  // Reset image-loaded state on lightbox slide changes
  useEffect(() => {
    if (lightboxOpen) setIsLightboxImageLoaded(false);
  }, [lightboxOpen, lightboxIndex]);

  // Track whether user has scrolled away from the grid AND navigated to a profile
  const showBackToGrid = navigatedToProfile && isActive;

  // Reset navigatedToProfile when filter changes
  useEffect(() => {
    setNavigatedToProfile(false);
  }, [category, subcategory]);

  const scrollBackToGrid = useCallback(() => {
    setNavigatedToProfile(false);
    const el = document.getElementById("product-grid");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleNavigateToDesigner = useCallback((item: ProductItem) => {
    const sectionMap: Record<string, { scrollId: string; deeplinkSection: string }> = {
      designers: { scrollId: "designers", deeplinkSection: "designer" },
      collectibles: { scrollId: "collectibles", deeplinkSection: "collectible" },
      ateliers: { scrollId: "brands", deeplinkSection: "atelier" },
    };
    const mapped = sectionMap[item.section];
    if (!mapped) return;

    window.dispatchEvent(new CustomEvent("deeplink-open-profile", {
      detail: { section: mapped.deeplinkSection, id: item.designerId }
    }));

    setNavigatedToProfile(true);
    setTimeout(() => {
      const el = document.getElementById(mapped.scrollId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, []);

  const handleCardClick = useCallback((_item: ProductItem, index: number) => {
    setLightboxIndex(index);
    setIsLightboxImageLoaded(false);
    setLightboxOpen(true);
    setIsZoomed(false);
  }, []);

  const handleClearFilter = useCallback(() => {
    setCategory(null);
    setSubcategory(null);
    setTextQuery(null);
    window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: null, subcategory: null } }));
    window.dispatchEvent(new CustomEvent('syncProductSearch', { detail: { query: null, source: filterSource } }));
  }, [filterSource]);

  const navigateLightbox = useCallback((dir: 1 | -1) => {
    const newIdx = lightboxIndex + dir;
    if (newIdx >= 0 && newIdx < filtered.length) {
      setLightboxIndex(newIdx);
      setIsLightboxImageLoaded(false);
      setIsZoomed(false);
      setLightboxHovered(false);
    }
  }, [lightboxIndex, filtered]);

  // If scoped, only render when the filter source matches this instance
  const activeScope = filterSource ? (SOURCE_TO_SCOPE[filterSource] || "designers") : null;
  if (sectionScope && activeScope !== sectionScope) return null;

  if (!isActive) return null;

  const filterLabel = subcategory || category || (textQuery ? `Search: “${textQuery}”` : "");

  return (
    <>
    <section ref={gridRef} id="product-grid" className="py-12 md:py-16 bg-background scroll-mt-28 md:scroll-mt-32">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-2xl md:text-3xl text-foreground">
              {filterLabel}
            </h2>
            <p className="font-body text-sm text-[hsl(var(--accent))] mt-1">
              {filtered.length} {filtered.length === 1 ? "piece" : "pieces"} across {
                filterSource === 'collectibles' ? 'Collectible Design'
                : filterSource === 'brands' ? 'all Ateliers'
                : filterSource === 'designers' ? 'all Designers'
                : 'all collections'
              }
            </p>
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
              onClick={handleClearFilter}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-[hsl(var(--gold))] bg-white shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] font-body text-xs uppercase tracking-[0.15em] text-foreground transition-all duration-300"
            >
              <X className="h-3.5 w-3.5" />
              Clear Filter
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
              className="group cursor-pointer"
              onClick={() => handleCardClick(item, idx)}
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-[#f0eeeb] mb-3 flex items-center justify-center">
                {(() => {
                  const tags: string[] = item.pick.tags || [];
                  const specialTags = tags.filter(t => /couture|edition|limited|re-edition|unique/i.test(t));
                  // Also include the edition field if present and not already covered
                  if (item.pick.edition && !specialTags.some(t => t.toLowerCase() === item.pick.edition!.toLowerCase())) {
                    specialTags.unshift(item.pick.edition);
                  }
                  return specialTags.length > 0 ? (
                    <div className="absolute top-2 right-2 z-10 flex flex-wrap gap-1 justify-end">
                      {specialTags.map((tag, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 text-[9px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-black/20 backdrop-blur-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
                <img
                  src={item.pick.image}
                  alt={`${item.pick.title} by ${item.designerName} — collectible design furniture`}
                  className={`max-w-[90%] max-h-[90%] object-contain transition-all duration-500 group-hover:scale-105 ${item.pick.hoverImage ? 'group-hover:opacity-0' : ''}`}
                  loading="lazy"
                  style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                />
                {item.pick.hoverImage && (
                  <img
                    src={item.pick.hoverImage}
                    alt={`${item.pick.title} by ${item.designerName} — alternate view`}
                    className="absolute inset-0 w-full h-full max-w-[90%] max-h-[90%] object-contain m-auto opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    loading="lazy"
                    style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                  />
                )}
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
              <div className="text-center mt-1">
                <p className="font-body text-[9px] md:text-[10px] uppercase tracking-[0.15em] text-foreground/80 font-semibold">
                  {item.designerName.includes(' - ') ? item.designerName.split(' - ')[0].trim() : item.designerName}
                </p>
                <h3 className="font-body text-sm md:text-base text-foreground leading-tight mt-1.5 font-medium">
                  {subcategory === "Dining Tables" && !item.pick.title.toLowerCase().includes("table")
                    ? `${item.pick.title} Table`
                    : item.pick.title}
                </h3>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ─── Lightbox ─────────────────────────────────────────────────── */}
      <Dialog modal={false} open={lightboxOpen} onOpenChange={() => { setLightboxOpen(false); setIsZoomed(false); setIsLightboxImageLoaded(false); }}>
        <DialogContent
          hideClose
          className="max-w-[100vw] max-h-[100dvh] w-screen h-[100dvh] p-0 border-none bg-black/95 overflow-hidden flex items-center justify-center [&>button]:hidden"
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (!filtered.length) return;
            if (e.key === "ArrowLeft") navigateLightbox(-1);
            if (e.key === "ArrowRight") navigateLightbox(1);
          }}
        >
          <VisuallyHidden><DialogTitle>Product Detail</DialogTitle></VisuallyHidden>
          {lightboxOpen && filtered[lightboxIndex] && (() => {
            const currentItem = filtered[lightboxIndex];
            return (
            <div className="relative w-full h-full flex items-center justify-center touch-pan-y select-none" style={{ WebkitUserSelect: 'none' }}>
              <div
                onTouchStart={(e) => { if (isZoomed) return; touchStartRef.current = e.targetTouches[0].clientX; touchEndRef.current = null; }}
                onTouchMove={(e) => { if (isZoomed) return; touchEndRef.current = e.targetTouches[0].clientX; }}
                onTouchEnd={() => {
                  if (isZoomed || touchStartRef.current === null) return;
                  if (touchEndRef.current !== null) {
                    const distance = touchStartRef.current - touchEndRef.current;
                    if (distance > 50) navigateLightbox(1);
                    else if (distance < -50) navigateLightbox(-1);
                  }
                  touchStartRef.current = null;
                  touchEndRef.current = null;
                }}
                className={`flex flex-col items-center justify-start md:justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 overflow-y-auto md:overflow-visible select-none touch-pan-y ${isZoomed ? 'max-h-[95vh] pb-4 pt-2' : 'max-h-[85vh] pb-4 pt-6 md:pt-4'}`}
                style={{ WebkitUserSelect: 'none' }}
              >
                <div className="relative inline-flex flex-col items-center">
                  {/* Special tags */}
                  {(() => {
                    const tags: string[] = currentItem.pick.tags || [];
                    const specialTags = tags.filter(t => /couture|edition|limited|re-edition/i.test(t));
                    return specialTags.length > 0 && !isZoomed ? (
                      <div className="absolute top-2 right-2 z-20 flex flex-wrap gap-1.5 justify-end">
                        {specialTags.map((tag, i) => (
                          <span key={i} className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-black/20 backdrop-blur-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  <div className="relative inline-block overflow-visible"
                    onMouseEnter={() => { if (currentItem.pick.hoverImage) setLightboxHovered(true); }}
                    onMouseLeave={() => setLightboxHovered(false)}
                  >
                    <PinchZoomImage
                      key={currentItem.pick.image || `${currentItem.designerId}-${lightboxIndex}`}
                      src={currentItem.pick.image || ""}
                      alt={currentItem.pick.title}
                      className={cn(
                        "object-contain select-none transition-opacity duration-500",
                        isZoomed
                          ? "max-h-[88vh] max-w-[90vw]"
                          : "max-w-[85vw] max-h-[55vh] md:max-w-[70vw] md:max-h-[60vh]",
                        isZoomed ? "cursor-zoom-out" : "cursor-zoom-in",
                        lightboxHovered && currentItem.pick.hoverImage ? "opacity-0" : "opacity-100"
                      )}
                      draggable={false}
                      decoding="sync"
                      loading="eager"
                      fetchPriority="high"
                      onLoad={() => setIsLightboxImageLoaded(true)}
                      onZoomChange={setIsZoomed}
                    />
                    {currentItem.pick.hoverImage && (
                      <img
                        src={currentItem.pick.hoverImage}
                        alt={`${currentItem.pick.title} - alternate view`}
                        className={cn(
                          "absolute inset-0 w-full h-full object-contain select-none transition-opacity duration-500 pointer-events-none",
                          isZoomed ? "max-h-[88vh] max-w-[90vw]" : "max-w-[85vw] max-h-[55vh] md:max-w-[70vw] md:max-h-[60vh]",
                          lightboxHovered ? "opacity-100" : "opacity-0"
                        )}
                        draggable={false}
                      />
                    )}

                    {/* Desktop hover overlay — click to enlarge/minimize */}
                    <div
                      className={`hidden md:flex absolute inset-0 items-center justify-center transition-all duration-500 ease-out z-[5] group ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                      onClick={() => setIsZoomed(!isZoomed)}
                    >
                      {!isZoomed && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out">
                          <Search size={24} className="text-foreground drop-shadow-lg" />
                        </div>
                      )}
                    </div>

                    {/* Desktop close button — bottom-right outside */}
                    <button
                      onClick={() => { setLightboxOpen(false); setIsZoomed(false); }}
                      className="hidden md:flex absolute bottom-2 -right-12 lg:-right-14 p-2.5 rounded-full bg-white/15 text-white/85 hover:text-white hover:bg-white/30 backdrop-blur-sm transition-all duration-300 z-20 border border-white/20"
                      aria-label="Close lightbox"
                    >
                      <X className="h-5 w-5" />
                    </button>

                    {/* PDF download — inside image, bottom-right */}
                    {currentItem.pick.pdfUrl && (
                      <button
                        className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-2 bg-[#d32f2f]/80 backdrop-blur-sm rounded-full hover:bg-[#d32f2f] transition-colors cursor-pointer"
                        aria-label="Download PDF"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const url = currentItem.pick.pdfUrl as string;
                          const filename = currentItem.pick.pdfFilename || `${currentItem.pick.title.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
                          try {
                            const res = await fetch(url);
                            const blob = await res.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = blobUrl;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(blobUrl);
                          } catch {
                            window.open(url, '_blank');
                          }
                        }}
                      >
                        <FileDown size={14} className="md:hidden text-white" />
                        <FileDown size={16} className="hidden md:block text-white" />
                        <span className="text-[10px] md:text-xs font-medium leading-none text-white">PDF</span>
                      </button>
                    )}

                    {/* Mobile expand/minimize button — bottom-left */}
                    <button
                      onClick={() => setIsZoomed(!isZoomed)}
                      className="md:hidden absolute bottom-2 left-2 z-10 bg-black/40 backdrop-blur-sm p-2 rounded-full hover:bg-black/60 transition-colors cursor-pointer"
                      aria-label={isZoomed ? "Minimize image" : "Maximize image"}
                    >
                      {isZoomed ? <Minimize2 size={16} className="text-white" /> : <Maximize2 size={16} className="text-white" />}
                    </button>

                    {/* Desktop Quote + Pin — stacked vertically under PDF, anchored to image right */}
                    {!isZoomed && (
                      <div className="hidden md:flex absolute top-full -right-20 mt-2 flex-col items-end gap-2 z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuoteProduct({ name: currentItem.pick.title, designer: currentItem.designerName });
                            setQuoteOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300 cursor-pointer whitespace-nowrap"
                          aria-label="Request a Quote"
                        >
                          <MessageSquareQuote size={14} className="shrink-0" />
                          <span className="text-[10px] font-display uppercase tracking-[0.08em] leading-none">Request a Quote</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin({ pick: currentItem.pick, designerName: currentItem.designerName, designerId: currentItem.designerId, section: currentItem.section });
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all duration-300 cursor-pointer whitespace-nowrap",
                            isPinned(currentItem.pick.title, currentItem.designerId)
                              ? "bg-[hsl(var(--gold)/0.2)] border-[hsl(var(--gold)/0.4)] text-white/80"
                              : "bg-white/5 border-white/15 text-white/60 hover:text-white hover:bg-white/10",
                            compareItems.length >= 3 && !isPinned(currentItem.pick.title, currentItem.designerId) && "opacity-40 pointer-events-none"
                          )}
                          aria-label={isPinned(currentItem.pick.title, currentItem.designerId) ? "Remove from selection" : "Pin your selection of 3"}
                        >
                          <Scale size={14} className="shrink-0" />
                          <span className="text-[10px] font-display uppercase tracking-[0.08em] leading-none">
                            {isPinned(currentItem.pick.title, currentItem.designerId) ? "Pinned" : "Pin your selection of 3"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {!isZoomed && <div className="hidden md:block h-12" aria-hidden="true" />}

                {/* Outside image: mobile close (left) + quote button (right) */}
                {!isZoomed && (
                  <div className="md:hidden flex justify-between items-center w-full mt-2">
                    <div>
                      <button
                        onClick={() => { setLightboxOpen(false); setIsZoomed(false); }}
                        className="p-2 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-300 border border-white/20"
                        aria-label="Close"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin({ pick: currentItem.pick, designerName: currentItem.designerName, designerId: currentItem.designerId, section: currentItem.section });
                        }}
                        className={cn(
                          "p-1.5 rounded-full backdrop-blur-sm border transition-all duration-300",
                          isPinned(currentItem.pick.title, currentItem.designerId)
                            ? "bg-[hsl(var(--gold)/0.3)] border-[hsl(var(--gold)/0.6)] text-white"
                            : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20",
                          compareItems.length >= 3 && !isPinned(currentItem.pick.title, currentItem.designerId) && "opacity-40 pointer-events-none"
                        )}
                        aria-label="Compare"
                      >
                        <Scale size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuoteProduct({ name: currentItem.pick.title, designer: currentItem.designerName });
                          setQuoteOpen(true);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 text-white hover:bg-white/25 transition-all duration-300 cursor-pointer"
                        aria-label="Request a Quote"
                      >
                        <MessageSquareQuote size={14} />
                        <span className="text-[10px] font-display font-bold uppercase tracking-[0.08em] leading-none">Quote</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Scroll dots — mobile and desktop */}
                {filtered.length > 1 && !isZoomed && (
                  <div className="flex items-center gap-2 mt-3">
                    {filtered.map((_, idx) => (
                      <button
                        key={idx}
                        aria-label={`Go to image ${idx + 1}`}
                        onClick={() => { setLightboxIndex(idx); setIsZoomed(false); setIsLightboxImageLoaded(false); }}
                        className={`rounded-full transition-all duration-300 ${lightboxIndex === idx ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`}
                      />
                    ))}
                  </div>
                )}

                {/* Metadata */}
                {!isZoomed && (
                  <div className="text-center w-full px-4 md:px-12 mt-4">
                    <h3 className="font-display text-lg md:text-xl text-white whitespace-nowrap">
                      {(() => {
                        const baseTitle = currentItem.pick.title;
                        const isYear = currentItem.pick.subtitle && /^\d{4}/.test(currentItem.pick.subtitle.trim());
                        return isYear ? `${baseTitle} ${currentItem.pick.subtitle}` : baseTitle;
                      })()}
                    </h3>
                    {currentItem.pick.subtitle && !/^\d{4}/.test(currentItem.pick.subtitle.trim()) && (() => {
                      const sub = currentItem.pick.subtitle.trim().toLowerCase();
                      const filterType = subcategory ? singularizeSub(subcategory).toLowerCase() : '';
                      if (filterType && sub === filterType) return null;
                      return <p className="font-body text-sm text-white/60 mt-0.5">{currentItem.pick.subtitle}</p>;
                    })()}
                    {currentItem.pick.materials && (
                      <p className="font-body text-xs text-white/50 mt-2 leading-relaxed">
                        {currentItem.pick.materials.replace(/\n/g, " · ")}
                      </p>
                    )}
                    {currentItem.pick.dimensions && (
                      <p className="font-body text-sm md:text-base text-white font-medium mt-1.5">
                        {currentItem.pick.dimensions.replace(/\n/g, " · ")}
                      </p>
                    )}
                    {/* Desktop: clickable profile link */}
                    <button
                      onClick={() => {
                        setLightboxOpen(false);
                        setIsZoomed(false);
                        handleNavigateToDesigner(currentItem);
                      }}
                      className="hidden md:block mt-4 font-body text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white/80 underline underline-offset-4 transition-colors"
                    >
                      View {currentItem.designerName}'s Profile
                    </button>
                  </div>
                )}
              </div>
              {/* Desktop navigation arrows — at screen edges */}
              {lightboxIndex > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                  className="hidden md:flex absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-30 text-white/50 hover:text-white transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={32} />
                </button>
              )}
              {lightboxIndex < filtered.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                  className="hidden md:flex absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-30 text-white/50 hover:text-white transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight size={32} />
                </button>
              )}
            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </section>

    {/* Floating "Back to Grid" button */}
    <AnimatePresence>
      {showBackToGrid && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          onClick={scrollBackToGrid}
          className="fixed bottom-20 left-4 md:bottom-auto md:left-auto md:top-1/2 md:-translate-y-1/2 md:right-10 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background shadow-lg hover:shadow-xl font-body text-[11px] uppercase tracking-[0.15em] transition-all duration-300 hover:scale-105"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          Back to Grid
        </motion.button>
      )}
    </AnimatePresence>
    <QuoteRequestDialog
      open={quoteOpen}
      onOpenChange={setQuoteOpen}
      productName={quoteProduct.name}
      designerName={quoteProduct.designer}
    />
    </>
  );
};

export default ProductGrid;
