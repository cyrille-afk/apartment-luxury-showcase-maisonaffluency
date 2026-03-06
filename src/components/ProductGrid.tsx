import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileDown, ChevronLeft, ChevronRight, ArrowUp, Maximize2, Minimize2 } from "lucide-react";
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
        <DialogContent
          hideClose
          className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none"
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
                className={`flex flex-col items-center justify-start md:justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 overflow-y-auto select-none touch-pan-y ${isZoomed ? 'max-h-[95vh] pb-4 pt-2' : 'max-h-[85vh] pb-4 pt-6 md:pt-4'}`}
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

                  <div className="relative inline-block">
                    <PinchZoomImage
                      key={currentItem.pick.image || `${currentItem.designerId}-${lightboxIndex}`}
                      src={currentItem.pick.image || ""}
                      alt={currentItem.pick.title}
                      className={cn(
                        "object-contain select-none transition-all duration-300",
                        isZoomed
                          ? "max-h-[88vh] max-w-[90vw]"
                          : "max-w-[85vw] max-h-[55vh] md:max-w-[70vw] md:max-h-[60vh]",
                        isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                      )}
                      draggable={false}
                      decoding="sync"
                      loading="eager"
                      fetchPriority="high"
                      onLoad={() => setIsLightboxImageLoaded(true)}
                      onZoomChange={setIsZoomed}
                    />

                    {/* Desktop hover overlay — click to enlarge/minimize */}
                    <div
                      className={`hidden md:flex absolute inset-0 items-center justify-center transition-all duration-500 ease-out z-[5] group ${isZoomed ? 'cursor-zoom-out' : 'bg-white/0 hover:bg-white/10 hover:backdrop-blur-[2px] cursor-zoom-in'}`}
                      onClick={() => setIsZoomed(!isZoomed)}
                    >
                      {!isZoomed && (
                        <Maximize2 size={28} className="text-white/0 group-hover:text-white/70 transition-all duration-500 ease-out drop-shadow-lg" />
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

                    {/* Desktop navigation arrows */}
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

                    {/* PDF download */}
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
                  </div>
                </div>

                {/* Mobile close button — outside, below-left of image */}
                {!isZoomed && (
                  <div className="md:hidden flex justify-start w-full mt-2">
                    <button
                      onClick={() => { setLightboxOpen(false); setIsZoomed(false); }}
                      className="p-2 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-300 border border-white/20"
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
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
                {isLightboxImageLoaded && !isZoomed && (
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
          className="fixed bottom-20 left-4 md:bottom-auto md:left-auto md:top-28 md:right-10 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background shadow-lg hover:shadow-xl font-body text-[11px] uppercase tracking-[0.15em] transition-all duration-300 hover:scale-105"
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
