import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileDown, ChevronLeft, ChevronRight, ArrowUp } from "lucide-react";
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
import PinchZoomImage from "./PinchZoomImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";

// ─── SUB_TAGS mapping (same as FeaturedDesigners) ────────────────────────
const SUB_TAGS: Record<string, string[]> = {
  "Sofas": ["Sofa"], "Armchairs": ["Armchair", "Armchairs"], "Chairs": ["Chair"],
  "Daybeds & Benches": ["Daybed", "Bench"], "Ottomans & Stools": ["Ottoman", "Stool"],
  "Bar Stools": ["Bar Stool"], "Consoles": ["Console"], "Coffee Tables": ["Coffee Table"],
  "Desks": ["Desk"], "Dining Tables": ["Dining Table"], "Side Tables": ["Side Table"],
  "Wall Lights": ["Wall Light", "Sconce"], "Ceiling Lights": ["Ceiling Light", "Chandelier", "Pendant"],
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

  // Atelier-only picks
  for (const [id, data] of Object.entries(atelierPicks)) {
    for (const pick of data.curatorPicks) {
      if (pick.image) {
        items.push({ pick, designerName: data.name, designerId: id, section: "ateliers" });
      }
    }
  }

  return items;
}

function pickMatchesFilter(pick: CuratorPick, category: string | null, subcategory: string | null): boolean {
  if (!category && !subcategory) return true;
  if (subcategory) {
    const tags = SUB_TAGS[subcategory] || [subcategory];
    return tags.some(tag =>
      pick.subcategory === tag ||
      pick.category === tag ||
      (pick.tags && pick.tags.some(t => t.toLowerCase() === tag.toLowerCase()))
    );
  }
  return pick.category === category || (pick.tags && pick.tags.includes(category!)) || false;
}

const SECTION_LABELS: Record<string, string> = {
  designers: "Designers & Makers",
  collectibles: "Collectible Design",
  ateliers: "Ateliers & Partners",
};

const ProductGrid = () => {
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const allProducts = useMemo(() => buildProductList(atelierOnlyPicks), []);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [navigatedToProfile, setNavigatedToProfile] = useState(false);
  const [isLightboxImageLoaded, setIsLightboxImageLoaded] = useState(false);
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
  // Listen for global filter events
  useEffect(() => {
    const handleSetCategory = (e: CustomEvent) => {
      const { category: cat, subcategory: sub } = e.detail || {};
      setCategory(cat || null);
      setSubcategory(sub || null);
    };
    window.addEventListener('setDesignerCategory', handleSetCategory as EventListener);
    // Also listen for sync events from mega-menu source
    const handleSync = (e: CustomEvent) => {
      const { category: cat, subcategory: sub, source } = e.detail || {};
      if (source === 'designers') {
        setCategory(cat || null);
        setSubcategory(sub || null);
      }
    };
    window.addEventListener('syncCategoryFilter', handleSync as EventListener);
    return () => {
      window.removeEventListener('setDesignerCategory', handleSetCategory as EventListener);
      window.removeEventListener('syncCategoryFilter', handleSync as EventListener);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!category && !subcategory) return [];
    const matched = allProducts.filter(item => pickMatchesFilter(item.pick, category, subcategory));
    // Deduplicate: keep only the first image per product title per designer
    const seen = new Set<string>();
    return matched.filter(item => {
      const key = `${item.designerId}::${item.pick.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allProducts, category, subcategory]);

  const isActive = (category || subcategory) && filtered.length > 0;

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
    window.dispatchEvent(new CustomEvent('setDesignerCategory', { detail: { category: null, subcategory: null } }));
  }, []);

  const navigateLightbox = useCallback((dir: 1 | -1) => {
    const newIdx = lightboxIndex + dir;
    if (newIdx >= 0 && newIdx < filtered.length) {
      setLightboxIndex(newIdx);
      setIsLightboxImageLoaded(false);
      setIsZoomed(false);
    }
  }, [lightboxIndex, filtered]);

  if (!isActive) return null;

  const filterLabel = subcategory || category || "";

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
              {filtered.length} {filtered.length === 1 ? "piece" : "pieces"} across all collections
            </p>
          </div>
          <button
            onClick={handleClearFilter}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full border border-[hsl(var(--gold))] bg-white shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] font-body text-xs uppercase tracking-[0.15em] text-foreground transition-all duration-300"
          >
            <X className="h-3.5 w-3.5" />
            Clear Filter
          </button>
        </div>

        {/* Product Grid */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
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
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-muted/30 mb-3">
                {(() => {
                  const tags: string[] = item.pick.tags || [];
                  const specialTags = tags.filter(t => /couture|edition|limited|re-edition/i.test(t));
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
                  alt={item.pick.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                />
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
      <Dialog open={lightboxOpen} onOpenChange={() => { setLightboxOpen(false); setIsZoomed(false); setIsLightboxImageLoaded(false); }}>
        <DialogContent className="max-w-[95vw] md:max-w-4xl p-0 border-none bg-[#181818] shadow-2xl overflow-hidden [&>button]:hidden">
          <VisuallyHidden><DialogTitle>Product Detail</DialogTitle></VisuallyHidden>
          {lightboxOpen && filtered[lightboxIndex] && (() => {
            const currentItem = filtered[lightboxIndex];
            return (
            <div className="relative flex flex-col items-center w-full">
              {/* Top control bar (always visible, non-overlay) */}
              <div className="w-full flex items-center justify-end gap-2 px-3 pt-3 md:px-4 md:pt-4">
                <div className="px-3 py-1.5 rounded-full bg-foreground/85 text-background text-[11px] font-body tracking-wider border border-background/20 shadow-md">
                  {lightboxIndex + 1} / {filtered.length}
                </div>
                <button
                  onClick={() => { setLightboxOpen(false); setIsZoomed(false); }}
                  className="p-2 rounded-full bg-foreground/85 text-background hover:opacity-90 transition-opacity border border-background/20 shadow-md"
                  aria-label="Close lightbox"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Image area with arrows */}
              <div className="w-full flex items-center justify-center px-4 md:px-8 pt-2 pb-2">
                {/* Left arrow - outside image on mobile, inside on desktop */}
                {lightboxIndex > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                    className="shrink-0 mr-2 md:mr-0 md:absolute md:left-3 md:top-1/2 md:-translate-y-1/2 z-30 p-2 md:p-2.5 rounded-full bg-foreground/85 text-background hover:opacity-90 transition-opacity border border-background/20 shadow-md"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
                  </button>
                )}

                <div
                  className="relative inline-flex items-center justify-center"
                  onClick={() => setIsZoomed(!isZoomed)}
                >
                  {/* Desktop-only arrows inside image container */}
                  {lightboxIndex > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigateLightbox(-1); }}
                      className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-foreground/85 text-background hover:opacity-90 transition-opacity border border-background/20 shadow-md"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}

                  {lightboxIndex < filtered.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                      className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-foreground/85 text-background hover:opacity-90 transition-opacity border border-background/20 shadow-md"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}

                  <PinchZoomImage
                    key={currentItem.pick.image || `${currentItem.designerId}-${lightboxIndex}`}
                    src={currentItem.pick.image || ""}
                    alt={currentItem.pick.title}
                    className={cn(
                      "max-h-[55vh] md:max-h-[60vh] max-w-[75vw] md:max-w-[60vw] w-auto object-contain transition-transform duration-300",
                      isZoomed ? "cursor-zoom-out scale-150" : "cursor-zoom-in"
                    )}
                    onLoad={() => setIsLightboxImageLoaded(true)}
                    onZoomChange={setIsZoomed}
                  />

                  {/* PDF download */}
                  {currentItem.pick.pdfUrl && (
                    <a
                      href={currentItem.pick.pdfUrl}
                      download={currentItem.pick.pdfFilename || true}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-3 right-3 z-30 flex items-center gap-1 p-2 md:p-2.5 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity border border-background/30 shadow-md"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileDown className="h-4 w-4 md:h-5 md:w-5" />
                      <span className="text-[10px] md:text-xs font-body font-medium">PDF</span>
                    </a>
                  )}
                </div>

                {/* Right arrow - outside image on mobile */}
                {lightboxIndex < filtered.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); navigateLightbox(1); }}
                    className="shrink-0 ml-2 md:hidden p-2 rounded-full bg-foreground/85 text-background hover:opacity-90 transition-opacity border border-background/20 shadow-md"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Metadata */}
              {isLightboxImageLoaded && (
                <div className="text-center w-full max-w-[75vw] md:max-w-[60vw] px-4 pb-4">
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
                  <button
                    onClick={() => {
                      setLightboxOpen(false);
                      setIsZoomed(false);
                      handleNavigateToDesigner(currentItem);
                    }}
                    className="mt-4 font-body text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white/80 underline underline-offset-4 transition-colors"
                  >
                    View {currentItem.designerName}'s Profile
                  </button>
                </div>
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
          className="fixed top-28 right-6 md:right-10 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background shadow-lg hover:shadow-xl font-body text-[11px] uppercase tracking-[0.15em] transition-all duration-300 hover:scale-105"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          Back to Grid
        </motion.button>
      )}
    </AnimatePresence>
    </>
  );
};

export default ProductGrid;
