import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useLightboxSwipe } from "@/hooks/useLightboxSwipe";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ChevronDown, X, Maximize2, Minimize2, Instagram, Copy, MapPin, Plus, Share2 } from "lucide-react";
import PinchZoomImage from "./PinchZoomImage";
import PinchHint from "./PinchHint";
import GalleryHotspots from "./GalleryHotspots";
import QuoteRequestDialog from "./QuoteRequestDialog";
import PublicProductLightbox, { type PublicLightboxItem } from "./PublicProductLightbox";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";
import { supabase } from "@/integrations/supabase/client";
import { resolveCuratorPickDescription } from "@/lib/curatorPickDescription";

const g = (id: string) => cloudinaryUrl(id, { width: 1200, quality: "auto:good", crop: "fill" });
const gSet = (id: string) => cloudinarySrcSet(id, [400, 600, 800, 1200, 1600], { quality: "auto:good", crop: "fill" });

const bedroomImage = g("master-suite_y6jaix");
const diningImage = g("dining-room_ey0bu5");
const livingRoomImage = g("living-room-hero_zxfcxl");
const bedroomSecondImage = g("bedroom-second_cyfmdj");
const boudoirImage = g("boudoir_ll5spn");
const bedroomAltImage = g("bedroom-alt_yk0j0d");
const bedroomThirdImage = g("bedroom-third_ol56sx");
const bespokeSofaImage = g("bespoke-sofa_gxidtx");
const sunLitReadingImage = g("IMG_2402-resized_swt5iy");
const artMasterBronzeImage = g("art-master-bronze_hf6bad");
const detailsConsoleImage = g("WhatsApp_Image_2026-03-30_at_7.35.18_PM_nkvc8c");
const intimateDiningImage = g("intimate-dining_ux4pee");
const intimateTableImage = g("intimate-table-detail_aqxvvm");
const intimateLoungeImage = g("intimate-lounge_tf4sm1");
const smallRoomPersonalityImage = g("small-room-personality_wvxz6y");
const smallRoomVaseImage = g("small-room-vase_s3nz5o");
const smallRoomBedroomImage = g("AffluencySG_094-Bloom_35_color_gimp_correction_okyphd");
const detailsSectionImage = g("IMG_2397-resized_rufbef");
const detailsLampImage = g("details-lamp_clzcrk");
const detailsConsole4Image = g("AffluencySG_204_1_qbbpqb");
const smallRoomChairImage = g("small-room-chair_aobzyb");
const homeOfficeDeskImage = g("home-office-desk_g0ywv2");
const homeOfficeDesk2Image = g("home-office-desk-2_gb1nlb");
const homeOffice3Image = g("home-office-3_t39msw");
const officeBooksCornerImage = g("AffluencySG_143_1_f9iihg");
const galleryCategories = ["Lighting", "Seating", "Storage", "Tables", "Rugs", "Decorative Object"] as const;

const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const galleryExperiences = [{
  experience: "A Sociable Environment",
  subtitle: "Bespoke sofa, hand-knotted artisan rug, sculptural lighting and collectible furniture",
  categories: ["Seating", "Lighting", "Rugs", "Tables", "Decorative Object"] as string[],
  items: [{
    image: bespokeSofaImage,
    title: "An Inviting Lounge Area",
    description: ""
  }, {
    image: livingRoomImage,
    title: "A Sophisticated Living Room",
    description: ""
  }, {
    image: diningImage,
    title: "Panoramic Cityscape Views",
    description: ""
  }, {
    image: sunLitReadingImage,
    title: "A Sun Lit Reading Corner",
    description: ""
  }]
}, {
  experience: "An Intimate Setting",
  subtitle: "Custom dining furniture, hand-blown glass pendants, sculptural seating and artisan accessories",
  categories: ["Tables", "Lighting", "Seating", "Decorative Object"] as string[],
  items: [{
    image: intimateDiningImage,
    title: "A Dreamy Tuscan Landscape",
    description: ""
  }, {
    image: intimateTableImage,
    title: "A Highly Customised Dining Room",
    description: ""
  }, {
    image: intimateLoungeImage,
    title: "A Relaxed Setting",
    description: ""
  }, {
    image: cloudinaryUrl("IMG_2133_wtxd62", { width: 1200, quality: "auto:good", crop: "fill" }),
    title: "A Colourful Nook",
    description: ""
  }]
}, {
  experience: "A Personal Sanctuary",
  subtitle: "Bespoke marquetry desk, hand-blown glass chandelier, artisan suede lamp and bronze painting",
  categories: ["Lighting", "Seating", "Tables", "Decorative Object"] as string[],
  items: [{
    image: boudoirImage,
    title: "A Sophisticated Boudoir",
    description: ""
  }, {
    image: "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,e_brightness:-15/v1772177400/70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq.jpg",
    title: "A Jewelry Box Like Setting",
    description: ""
  }, {
    image: bedroomSecondImage,
    title: "A Serene Decor",
    description: ""
  }, {
    image: artMasterBronzeImage,
    title: "A Design Treasure Trove",
    description: ""
  }]
}, {
  experience: "A Calming and Dreamy Environment",
  subtitle: "Curated collectibles, hand-carved furniture and hand-knotted silk rugs",
  categories: ["Rugs", "Lighting", "Seating", "Decorative Object", "Storage"] as string[],
  items: [{
    image: bedroomImage,
    title: "A Masterful Suite",
    description: ""
  }, {
    image: bedroomThirdImage,
    title: "Design Tableau",
    description: ""
  }, {
    image: "/gallery/calming-2.jpg",
    title: "A Venitian Cocoon",
    description: ""
  }, {
    image: bedroomAltImage,
    title: "Unique By Design Vignette",
    description: ""
  }]
}, {
  experience: "A Small Room with Massive Personality",
  subtitle: "Bold statement pieces, artisan craftsmanship and curated collectibles",
  categories: ["Lighting", "Tables", "Decorative Object"] as string[],
  items: [{
    image: smallRoomBedroomImage,
    title: "An Artistic Statement",
    description: ""
  }, {
    image: smallRoomPersonalityImage,
    title: "Compact Elegance",
    description: ""
  }, {
    image: smallRoomVaseImage,
    title: "Yellow Crystalline",
    description: ""
  }, {
    image: smallRoomChairImage,
    title: "Golden Hour",
    description: ""
  }]
}, {
  experience: "Home Office with a View",
  subtitle: "Sculptural desk, refined lighting and curated accessories for a workspace of distinction",
  categories: ["Tables", "Lighting", "Seating"] as string[],
  items: [{
    image: homeOfficeDeskImage,
    title: "A Workspace of Distinction",
    description: ""
  }, {
    image: homeOfficeDesk2Image,
    title: "Refined Details",
    description: ""
  }, {
    image: homeOffice3Image,
    title: "Light & Focus",
    description: ""
  }, {
    image: officeBooksCornerImage,
    title: "Design & Fine Art Books Corner",
    description: ""
  }]
}, {
  experience: "The Details Make the Design",
  subtitle: "The details are not the details. They make the design",
  categories: ["Decorative Object", "Lighting", "Storage", "Tables"] as string[],
  items: [{
    image: detailsSectionImage,
    title: "Curated Vignette",
    description: ""
  }, {
    image: detailsConsoleImage,
    title: "The Details Make The Design",
    description: ""
  }, {
    image: detailsLampImage,
    title: "Light & Texture",
    description: ""
  }, {
    image: detailsConsole4Image,
    title: "Craftsmanship At Every Corner",
    description: ""
  }]
}];
/** Scrollable container for expanded lightbox images — shows a bounce arrow when content overflows */
const ExpandedScrollContainer = ({ isExpanded, children }: { isExpanded: boolean; children: React.ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const check = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 10;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
      setShowHint(canScroll && !atBottom);
    };
    // Debounce scroll checks via rAF
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(check); };
    el.addEventListener('scroll', onScroll, { passive: true });
    const obs = new ResizeObserver(check);
    obs.observe(el);
    check();
    return () => { el.removeEventListener('scroll', onScroll); obs.disconnect(); cancelAnimationFrame(raf); };
  }, [isExpanded]);

  return (
    <div ref={ref} className="flex flex-col items-center w-full max-w-[98vw] px-12 max-h-[96vh] overflow-y-auto scrollbar-hide relative">
      {children}
    </div>
  );
};

/** Desktop single-column carousel strip (mirrors mobile swipe UX) */
const DesktopCarouselStrip = ({
  section,
  originalSectionIndex,
  isInView,
  hotspotCounts,
  openLightbox,
}: {
  section: typeof galleryExperiences[number];
  originalSectionIndex: number;
  isInView: boolean;
  hotspotCounts: Record<string, number>;
  openLightbox: (sectionIndex: number, itemIndex: number) => void;
}) => {
  const stripRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const handleScroll = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const cardWidth = strip.scrollWidth / section.items.length;
    const index = Math.round(strip.scrollLeft / cardWidth);
    setActiveIdx(index);
  }, [section.items.length]);

  const scrollToIdx = (idx: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    const cardWidth = strip.scrollWidth / section.items.length;
    strip.scrollTo({ left: cardWidth * idx, behavior: 'smooth' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: originalSectionIndex * 0.2 }}
      className="hidden md:block"
    >
      <div
        ref={stripRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      >
        {section.items.map((item, index) => (
          <div
            key={`${item.title}-${index}-desktop-strip`}
            className="group relative flex-none w-full snap-center cursor-pointer aspect-[16/10] max-h-[calc(100vh-280px)] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.4)] rounded-sm overflow-hidden"
            onClick={() => openLightbox(originalSectionIndex, index)}
          >
            <img
              src={item.image}
              alt={`${item.title} — ${section.experience}`}
              className="h-full w-full object-cover brightness-[1.05] contrast-[1.08] saturate-[1.05] transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.92] rounded-sm"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 rounded-sm" />
            {/* Title overlay on hover */}
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-10 translate-y-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 pointer-events-none z-10">
              <p className="font-display text-white text-sm tracking-widest uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                {item.title}
              </p>
            </div>
            {/* Pulsating hotspot — first card */}
            {index === 0 && (
              <div className="absolute top-3 left-3 z-20 pointer-events-none">
                <span className="relative flex items-center justify-center w-5 h-5 rounded-full bg-black/70 backdrop-blur-sm border-2 border-primary/70 shadow-[0_0_8px_hsl(var(--primary)/0.4)]">
                  <Plus className="w-2.5 h-2.5 text-white" />
                  <span className="absolute inset-0 rounded-full border border-black/20 animate-ping" style={{ animationDuration: "2s" }} />
                </span>
              </div>
            )}
            {/* +N more bubble — shows remaining photos, clicks to next slide */}
            {index < section.items.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); scrollToIdx(index + 1); }}
                className="absolute top-3 right-3 z-10 bg-black/50 backdrop-blur-sm text-white font-body text-xs tracking-wide px-3 py-1.5 rounded-full hover:bg-black/70 transition-all duration-300"
              >
                +{section.items.length - 1 - index} more
              </button>
            )}
            {/* Expand icon */}
            <button
              onClick={(e) => { e.stopPropagation(); openLightbox(originalSectionIndex, index); }}
              className="absolute bottom-4 right-4 flex opacity-100 transition-opacity duration-300"
              aria-label="View full image"
            >
              <span className="bg-black/60 text-white p-2 rounded-full shadow-lg backdrop-blur-sm hover:bg-black/80 transition-all duration-300">
                <Maximize2 className="w-4 h-4" />
              </span>
            </button>
          </div>
        ))}
      </div>
      {/* Dot indicators */}
      {section.items.length > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {section.items.map((_, dotIndex) => (
            <button
              key={dotIndex}
              aria-label={`Go to photo ${dotIndex + 1}`}
              onClick={() => scrollToIdx(dotIndex)}
              className={`rounded-full transition-all duration-300 ${
                activeIdx === dotIndex
                  ? 'w-2 h-2 bg-primary'
                  : 'w-2 h-2 bg-primary/30'
              }`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
};

interface GalleryProps {
  /** Trade mode: pass to GalleryHotspots as onAddToQuote */
  onHotspotAddToQuote?: (product: { product_name: string; designer_name: string | null; product_image_url: string | null; materials: string | null; dimensions: string | null }) => void;
  /** Hide the section intro text (e.g. when embedded in trade portal) */
  hideIntro?: boolean;
}

const Gallery = ({ onHotspotAddToQuote, hideIntro }: GalleryProps = {}) => {
  const isMobile = useIsMobile();
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const imageZoomedRef = useRef(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [hasTapped, setHasTapped] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sourceItemKey, setSourceItemKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState<1 | 2 | 3 | 4>(1);
  const [activeMobilePill, setActiveMobilePill] = useState(0);
  const pillBarRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Quote request dialog state (triggered from hotspot pins)
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState<{ name: string; designer: string }>({ name: "", designer: "" });

  const handleHotspotQuoteRequest = useCallback((productName: string, designerName: string) => {
    setQuoteProduct({ name: productName, designer: designerName });
    setQuoteDialogOpen(true);
  }, []);

  // ── Hotspot → PublicProductLightbox matching ──
  const [hotspotLightboxProduct, setHotspotLightboxProduct] = useState<PublicLightboxItem | null>(null);
  const [dbCuratorPicks, setDbCuratorPicks] = useState<PublicLightboxItem[]>([]);

  useEffect(() => {
    const fetchDbCuratorPicks = async () => {
      const [{ data: picks }, { data: designers }] = await Promise.all([
        supabase
          .from("designer_curator_picks_public")
          .select("id,title,subtitle,image_url,hover_image_url,materials,dimensions,description,category,subcategory,pdf_url,pdf_urls,designer_id")
          .not("image_url", "is", null),
        supabase
          .from("designers")
          .select("id, name")
      ]);

      if (!picks) return;

      const designerMap = new Map((designers || []).map((d: any) => [d.id, d.name]));

      const mapped: PublicLightboxItem[] = (picks as any[]).map((p) => {
        const brandName = designerMap.get(p.designer_id) || "Unknown";

        return {
          id: p.id,
          title: p.title,
          subtitle: p.subtitle || null,
          image_url: p.image_url,
          hover_image_url: p.hover_image_url || null,
          brand_name: brandName,
          materials: p.materials || null,
          dimensions: p.dimensions || null,
          description: resolveCuratorPickDescription({ description: p.description }),
          category: p.category || null,
          subcategory: p.subcategory || null,
          pdf_url: p.pdf_url || null,
          pdf_urls: (p.pdf_urls as any) || null,
        };
      });

      setDbCuratorPicks(mapped);
    };

    fetchDbCuratorPicks();
  }, []);

  const allCuratorPicks = useMemo((): PublicLightboxItem[] => {
    const staticPicks = getAllTradeProducts()
      .filter(p => p.image_url)
      .map(p => ({
        id: p.id,
        title: p.product_name,
        subtitle: p.subtitle || null,
        image_url: p.image_url!,
        hover_image_url: p.hover_image_url || null,
        brand_name: p.brand_name,
        materials: p.materials || null,
        dimensions: p.dimensions || null,
        description: resolveCuratorPickDescription({ description: p.description }),
        category: p.category || null,
        subcategory: p.subcategory || null,
        pdf_url: p.pdf_url || null,
        pdf_urls: p.pdf_urls || null,
      }));

    const byKey = new Map<string, PublicLightboxItem>();
    for (const pick of staticPicks) byKey.set(`${slugify(pick.brand_name)}::${slugify(pick.title)}`, pick);
    for (const pick of dbCuratorPicks) byKey.set(`${slugify(pick.brand_name)}::${slugify(pick.title)}`, pick);

    return [...byKey.values()];
  }, [dbCuratorPicks]);

  const handleHotspotViewProduct = useCallback((productName: string, designerName: string, linkUrl?: string | null) => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const normName = norm(productName);
    const normDesigner = norm(designerName);
    const tokenize = (s: string) => s.split(" ").filter(t => t.length > 2);
    const nameTokens = tokenize(normName);
    const designerTokens = tokenize(normDesigner);

    // Brand ↔ designer aliases for parent-brand relationships
    const brandAliases: Record<string, string[]> = {
      "ecart": ["jean michel frank", "eileen gray", "pierre chareau", "mariano fortuny", "paul laszlo", "felix aublet", "laurent maugoust", "cecile chenais"],
      "jean michel frank": ["ecart"],
      "eileen gray": ["ecart"],
      "pierre chareau": ["ecart"],
      "mariano fortuny": ["ecart"],
      "paul laszlo": ["ecart"],
      "felix aublet": ["ecart"],
    };

    const isDesignerMatch = (itemBrand: string): boolean => {
      if (!normDesigner) return false;
      if (itemBrand.includes(normDesigner) || normDesigner.includes(itemBrand)) return true;
      if (designerTokens.length >= 2) {
        const brandTokens = tokenize(itemBrand);
        const overlap = designerTokens.filter(t => brandTokens.includes(t)).length;
        if (overlap >= 2) return true;
      }
      const aliases = brandAliases[normDesigner] || [];
      if (aliases.some(a => itemBrand.includes(a) || a.includes(itemBrand))) return true;
      const rev = brandAliases[itemBrand] || [];
      if (rev.some(a => normDesigner.includes(a) || a.includes(normDesigner))) return true;
      return false;
    };

    let best: PublicLightboxItem | null = null;
    let bestScore = 0;
    let bestNoDesigner: PublicLightboxItem | null = null;
    let bestNoDesignerScore = 0;

    for (const item of allCuratorPicks) {
      const itemName = norm(item.title);
      const itemBrand = norm(item.brand_name);
      const itemTokens = tokenize(itemName);

      const overlap = nameTokens.filter(t => itemTokens.includes(t)).length;
      const shorter = Math.min(nameTokens.length, itemTokens.length);
      const nameScore = shorter > 0 ? overlap / shorter : 0;

      const substringBonus = (itemName.includes(normName) || normName.includes(itemName)) ? 0.3 : 0;
      const designerMatch = isDesignerMatch(itemBrand);

      const score = nameScore + substringBonus;
      if (score < 0.3 && substringBonus === 0) continue;

      if (designerMatch && score > bestScore) {
        bestScore = score;
        best = item;
      } else if (!designerMatch && score > bestNoDesignerScore) {
        bestNoDesignerScore = score;
        bestNoDesigner = item;
      }
    }

    // Prefer designer-matched result; only fall back if no designer match found
    if (!best && !normDesigner) best = bestNoDesigner;

    if (best) {
      setHotspotLightboxProduct(best);
      return;
    }

    if (linkUrl?.startsWith('/')) {
      navigate(linkUrl);
      return;
    }

    if (linkUrl) {
      window.location.href = linkUrl;
    }
  }, [allCuratorPicks, navigate]);

  // Pulsing hotspot hint — always visible on first card of each section
  const showHotspotHint = true;

  // ── Hotspot piece counts per image ──
  const [hotspotCounts, setHotspotCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from("gallery_hotspots").select("image_identifier");
      if (data) {
        const counts: Record<string, number> = {};
        for (const row of data) {
          counts[row.image_identifier] = (counts[row.image_identifier] || 0) + 1;
        }
        setHotspotCounts(counts);
      }
    };
    fetchCounts();
  }, []);

  // Embla carousel for mobile lightbox
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, startIndex: currentItemIndex });

  // Sync embla slide changes → currentItemIndex
  useEffect(() => {
    if (!emblaApi || !isMobile) return;
    const onSelect = () => {
      setCurrentItemIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, isMobile]);

  // When lightbox opens or section changes, re-init embla to correct slide
  useEffect(() => {
    if (!emblaApi || !isMobile || !lightboxOpen) return;
    emblaApi.scrollTo(currentItemIndex, true);
  }, [emblaApi, isMobile, lightboxOpen, currentSectionIndex]);

  // Preload first section's gallery images only (visible on initial load)
  useEffect(() => {
    if (galleryExperiences.length > 0) {
      galleryExperiences[0].items.forEach(item => {
        const img = new Image();
        img.src = item.image;
      });
    }
  }, []);

  // Listen for category changes from Navigation
  useEffect(() => {
    const handleCategoryChange = (e: CustomEvent<string | null>) => {
      setActiveCategory(e.detail);
    };
    window.addEventListener('setGalleryCategory', handleCategoryChange as EventListener);
    return () => window.removeEventListener('setGalleryCategory', handleCategoryChange as EventListener);
  }, []);

  const filteredExperiences = useMemo(() => {
    if (!activeCategory) return galleryExperiences;
    return galleryExperiences.filter(section => section.categories.includes(activeCategory));
  }, [activeCategory]);
  // Track active dot per mobile scroll strip (one index per section)
  const [activeScrollIndices, setActiveScrollIndices] = useState<number[]>(
    galleryExperiences.map(() => 0)
  );
  const scrollStripRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleStripScroll = useCallback((sectionIndex: number) => {
    const strip = scrollStripRefs.current[sectionIndex];
    if (!strip) return;
    const cardWidth = strip.scrollWidth / galleryExperiences[sectionIndex].items.length;
    const index = Math.round(strip.scrollLeft / cardWidth);
    setActiveScrollIndices(prev => {
      const next = [...prev];
      next[sectionIndex] = index;
      return next;
    });
  }, []);

  // Minimum swipe distance required (in px)
  const minSwipeDistance = 35;

  // Flatten all gallery items for external link compatibility
  const allItems = useMemo(() => {
    return galleryExperiences.flatMap(section => section.items);
  }, []);

  // Get current section's items for scoped lightbox navigation
  const currentSectionItems = useMemo(() => {
    return galleryExperiences[currentSectionIndex]?.items || [];
  }, [currentSectionIndex]);

  // Helper: convert flat index to section + item index
  const flatIndexToSectionItem = useCallback((flatIndex: number) => {
    let remaining = flatIndex;
    for (let s = 0; s < galleryExperiences.length; s++) {
      if (remaining < galleryExperiences[s].items.length) {
        return { sectionIndex: s, itemIndex: remaining };
      }
      remaining -= galleryExperiences[s].items.length;
    }
    return { sectionIndex: 0, itemIndex: 0 };
  }, []);

  // Preload adjacent gallery images for smooth transitions
  useEffect(() => {
    if (!lightboxOpen) return;
    const items = currentSectionItems;
    const toPreload = [currentItemIndex - 1, currentItemIndex, currentItemIndex + 1].filter(
      i => i >= 0 && i < items.length
    );
    toPreload.forEach(i => {
      const img = new Image();
      img.src = items[i].image;
    });
  }, [currentItemIndex, lightboxOpen, currentSectionItems]);

  const [externalSourceId, setExternalSourceId] = useState<string | null>(null);
  const [filterDesigner, setFilterDesigner] = useState<string | null>(null);

  // Check for gallery index from sessionStorage (set by BrandsAteliers)
  useEffect(() => {
    const checkForGalleryIndex = () => {
      const storedIndex = sessionStorage.getItem('openGalleryIndex');
      const sourceId = sessionStorage.getItem('gallerySourceId');
      const storedDesigner = sessionStorage.getItem('galleryFilterDesigner');
      if (storedIndex !== null) {
        const index = parseInt(storedIndex, 10);
        if (!isNaN(index) && index >= 0 && index < allItems.length) {
          const { sectionIndex, itemIndex } = flatIndexToSectionItem(index);
          setCurrentSectionIndex(sectionIndex);
          setCurrentItemIndex(itemIndex);
          setExternalSourceId(sourceId);
          setSourceItemKey(null);
          setFilterDesigner(storedDesigner || null);
          setLightboxOpen(true);
        }
        sessionStorage.removeItem('openGalleryIndex');
        sessionStorage.removeItem('gallerySourceId');
        sessionStorage.removeItem('galleryFilterDesigner');
      }
    };

    // Check immediately
    checkForGalleryIndex();

    // Also set up an interval to check for changes (when user clicks from BrandsAteliers)
    const interval = setInterval(checkForGalleryIndex, 300);
    return () => clearInterval(interval);
  }, [allItems.length]);

  // Listen for custom event from FeaturedDesigners
  useEffect(() => {
    const handleOpenLightbox = (e: CustomEvent<{
      index: number;
      sourceId?: string;
      returnUrl?: string;
      filterDesigner?: string;
    }>) => {
      const index = e.detail.index;
      if (index >= 0 && index < allItems.length) {
        const { sectionIndex, itemIndex } = flatIndexToSectionItem(index);
        setCurrentSectionIndex(sectionIndex);
        setCurrentItemIndex(itemIndex);
        setExternalSourceId(e.detail.sourceId || null);
        setReturnUrl(e.detail.returnUrl || null);
        setFilterDesigner(e.detail.filterDesigner || null);
        setSourceItemKey(null);
        setLightboxOpen(true);
      }
    };
    window.addEventListener('openGalleryLightbox', handleOpenLightbox as EventListener);
    return () => window.removeEventListener('openGalleryLightbox', handleOpenLightbox as EventListener);
  }, [allItems.length]);

  // Restore gallery lightbox after returning from curators' picks (opened via hotspot "View details")
  useEffect(() => {
    const handleRestore = () => {
      const raw = sessionStorage.getItem('__gallery_hotspot_restore');
      if (!raw) return;
      sessionStorage.removeItem('__gallery_hotspot_restore');
      try {
        const { imageIdentifier } = JSON.parse(raw);
        for (let si = 0; si < galleryExperiences.length; si++) {
          const ii = galleryExperiences[si].items.findIndex(item => item.title === imageIdentifier);
          if (ii >= 0) {
            openLightbox(si, ii);
            return;
          }
        }
      } catch {}
    };
    window.addEventListener('gallery-hotspot-return', handleRestore);
    return () => window.removeEventListener('gallery-hotspot-return', handleRestore);
  }, []);
  const openLightbox = (sectionIndex: number, itemIndex: number) => {
    setCurrentSectionIndex(sectionIndex);
    setCurrentItemIndex(itemIndex);
    setSourceItemKey(`${sectionIndex}-${itemIndex}`);
    setFilterDesigner(null); // Clear designer filter when opening from gallery directly
    imageZoomedRef.current = false;
    setImageZoomed(false);
    const hasDescription = galleryExperiences[sectionIndex]?.items.some(item => item.description);
    setIsExpanded(!isMobile && !hasDescription);
    setLightboxOpen(true);
  };

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [lightboxOpen]);

  // Ensure swipe is never blocked by stale zoom state on mobile
  useEffect(() => {
    if (lightboxOpen && isMobile) {
      imageZoomedRef.current = false;
      setImageZoomed(false);
    }
  }, [lightboxOpen, isMobile, currentItemIndex]);

  const closeLightbox = () => {
    setLightboxOpen(false);
    setIsExpanded(false);
    imageZoomedRef.current = false;
    setImageZoomed(false);
    // Navigate to return URL if set (e.g. designer profile after thumbnail click)
    if (returnUrl) {
      const url = returnUrl;
      setReturnUrl(null);
      setExternalSourceId(null);
      setFilterDesigner(null);
      setTimeout(() => navigate(url), 100);
    } else if (externalSourceId) {
      setTimeout(() => {
        const element = document.getElementById(externalSourceId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setExternalSourceId(null);
        setFilterDesigner(null);
      }, 100);
    } else if (sourceItemKey) {
      setTimeout(() => {
        const element = document.getElementById(`gallery-item-${sourceItemKey}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  // Compute flat gallery index for current lightbox image
  const currentFlatIndex = useMemo(() => {
    let flat = 0;
    for (let s = 0; s < currentSectionIndex; s++) {
      flat += galleryExperiences[s].items.length;
    }
    return flat + currentItemIndex;
  }, [currentSectionIndex, currentItemIndex]);

  

  const shareLightboxImage = useCallback(() => {
    const title = currentSectionItems[currentItemIndex]?.title || '';
    const titleSlug = slugify(title);
    const designerSlug = filterDesigner ? slugify(filterDesigner) : '';
    const urlPath = designerSlug
      ? `gallery/${designerSlug}/${titleSlug}.html`
      : `gallery/${titleSlug}.html`;
    const url = `https://www.maisonaffluency.com/${urlPath}`;
    const parts = ['Maison Affluency', 'Interactive Gallery'];
    if (filterDesigner) parts.push(filterDesigner);
    if (title) parts.push(title);
    const text = parts.join(' · ');
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobileDevice) {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
    } else {
      navigator.clipboard.writeText(`${text} — ${url}`);
      import('sonner').then(({ toast }) => toast.success('Link copied'));
    }
  }, [currentFlatIndex, currentItemIndex, currentSectionItems, filterDesigner]);

  const goToPrevious = () => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(prev => prev - 1);
    } else if (currentSectionIndex > 0) {
      const prevSection = currentSectionIndex - 1;
      setCurrentSectionIndex(prevSection);
      setCurrentItemIndex(galleryExperiences[prevSection].items.length - 1);
    }
  };
  const goToNext = () => {
    if (currentItemIndex < currentSectionItems.length - 1) {
      setCurrentItemIndex(prev => prev + 1);
    } else if (currentSectionIndex < galleryExperiences.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      setCurrentItemIndex(0);
    }
  };
  // Swipe detection via shared hook with native non-passive listeners
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  useLightboxSwipe({
    containerRef: swipeContainerRef,
    enabled: lightboxOpen,
    imageZoomedRef,
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrevious,
    minDistance: minSwipeDistance,
  });
  return <>
       <section id="gallery" ref={ref} className="pt-0 pb-16 md:pt-0 md:pb-24 bg-white scroll-mt-24">
        <div className="mx-auto max-w-6xl px-4 md:px-12 lg:px-20">
          <motion.div initial={{
          opacity: 0,
          y: 30
        }} animate={isInView ? {
          opacity: 1,
          y: 0
        } : {}} transition={{
          duration: 0.8
        }} className="mb-2 md:mb-4">
            {activeCategory && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body mb-2">
                {filteredExperiences.length} {filteredExperiences.length === 1 ? "scene" : "scenes"} · {activeCategory}
              </p>
            )}
          </motion.div>

          {/* Mobile: Interactive Gallery badge — outside section loop so it stays visible */}
          <div className="md:hidden">
            <div className="flex justify-start mb-4">
              <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-foreground font-body font-light">
                <span className="relative flex items-center justify-center w-5 h-5 rounded-full bg-black/70 border border-primary/70">
                  <span className="absolute inset-0 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: "2.2s" }} />
                  <Plus className="relative h-2.5 w-2.5 text-white" />
                </span>
                Interactive Gallery
              </span>
            </div>
          </div>

          {(() => {
            const firstHotspotSectionIdx = galleryExperiences.findIndex(s => !s.items.some(i => i.description));
            return filteredExperiences.map((section, sectionIndex) => {
            // Find original index for proper lightbox mapping
            const originalSectionIndex = galleryExperiences.indexOf(section);
            const isMobilePillActive = originalSectionIndex === activeMobilePill;
            return <div key={section.experience} ref={el => { sectionRefs.current[originalSectionIndex] = el; }} className={`mb-6 md:mb-10 ${originalSectionIndex === 0 ? 'pt-2 md:pt-0' : ''} ${!isMobilePillActive ? 'hidden md:block' : ''}`}>
              {originalSectionIndex === 0 && <div id="sociable-environment" className="scroll-mt-[10rem] md:scroll-mt-[11rem]" style={{ pointerEvents: "none" }} aria-hidden="true" />}
              <motion.div initial={{
            opacity: 0,
            y: 20
          }} animate={isInView ? {
            opacity: 1,
            y: 0
          } : {}} transition={{
            duration: 0.6,
            delay: originalSectionIndex * 0.2
          }} className="mb-4 md:mb-6">
                {/* Desktop-only: Interactive Gallery badge for first section */}
                {originalSectionIndex === 0 ? (
                  <>
                    {/* Row 1: Interactive Gallery (left) with icon on right */}
                    <div className="hidden md:block mt-1" />
                    <div className="hidden md:flex items-center mb-0">
                      <span className="inline-flex items-center gap-3 font-serif text-sm md:text-base text-foreground font-light tracking-wide">
                        Interactive Gallery
                        <span className="relative flex items-center justify-center w-5 h-5 rounded-full bg-black/70 border border-primary/70">
                          <span className="absolute inset-0 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: "2.2s" }} />
                          <Plus className="relative h-2.5 w-2.5 text-white" />
                        </span>
                      </span>
                    </div>
                    {/* Row 2: Title + Share centred */}
                    <div className="hidden md:flex flex-col items-center text-center mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl md:text-2xl lg:text-2xl font-serif text-primary">
                          {section.experience}
                        </h3>
                        <button
                          onClick={() => {
                            const firstItem = galleryExperiences[originalSectionIndex].items[0];
                            const titleSlug = slugify(firstItem?.title || '');
                            const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                            const url = `https://www.maisonaffluency.com/gallery/${titleSlug}.html`;
                            const text = `${section.experience} — Maison Affluency`;
                            if (isMobileDevice) {
                              window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
                            } else {
                              navigator.clipboard.writeText(`${text} — ${url}`);
                              import('sonner').then(({ toast }) => toast.success('Link copied'));
                            }
                          }}
                          className="inline-flex flex-col items-center gap-0.5 text-foreground hover:text-primary transition-colors flex-shrink-0"
                          aria-label={`Share ${section.experience}`}
                        >
                          <Share2 className="w-4 h-4" />
                          <span className="text-[7px] uppercase tracking-[0.12em] font-body">Share</span>
                        </button>
                      </div>
                      {/* Subtitle centred, grid icons right-aligned on same row */}
                      <div className="flex items-center w-full mt-1">
                        <div className="flex-1" />
                        <p className="text-sm md:text-base text-muted-foreground font-body italic">
                          {section.subtitle}
                        </p>
                        <div className="flex-1 flex justify-end">
                          <div className="flex items-center gap-1">
                            {/* Left button: cycles to the "lower" option — 1col when in 3/4, 3col when in 1 */}
                            <button
                              onClick={() => setGridCols(gridCols === 1 ? 3 : 1)}
                              className={`flex items-center justify-center rounded-md border-2 p-1 transition-all ${gridCols === (gridCols === 1 ? 3 : 1) ? 'border-foreground opacity-100' : 'border-foreground/25 opacity-40 hover:opacity-60 hover:border-foreground/40'}`}
                              aria-label={gridCols === 1 ? 'Switch to 3 columns' : 'Switch to 1 column'}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                {gridCols === 1
                                  ? (<><rect x="2" y="3" width="5.5" height="18" rx="1.5" fill="currentColor" /><rect x="9.25" y="3" width="5.5" height="18" rx="1.5" fill="currentColor" /><rect x="16.5" y="3" width="5.5" height="18" rx="1.5" fill="currentColor" /></>)
                                  : <rect x="7" y="3" width="10" height="18" rx="1.5" fill="currentColor" />
                                }
                              </svg>
                            </button>
                            {/* Right button: cycles to the "higher" option — 4col when in 1/3, 3col when in 4 */}
                            <button
                              onClick={() => setGridCols(gridCols === 4 ? 3 : 4)}
                              className={`flex items-center justify-center rounded-md border-2 p-1 transition-all ${gridCols === (gridCols === 4 ? 3 : 4) ? 'border-foreground opacity-100' : 'border-foreground/25 opacity-40 hover:opacity-60 hover:border-foreground/40'}`}
                              aria-label={gridCols === 4 ? 'Switch to 3 columns' : 'Switch to 4 columns'}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                {gridCols === 4
                                  ? (<><rect x="2" y="3" width="5.5" height="18" rx="1.5" fill="currentColor" /><rect x="9.25" y="3" width="5.5" height="18" rx="1.5" fill="currentColor" /><rect x="16.5" y="3" width="5.5" height="18" rx="1.5" fill="currentColor" /></>)
                                  : (<><rect x="1.5" y="3" width="4" height="18" rx="1" fill="currentColor" /><rect x="7" y="3" width="4" height="18" rx="1" fill="currentColor" /><rect x="12.5" y="3" width="4" height="18" rx="1" fill="currentColor" /><rect x="18" y="3" width="4" height="18" rx="1" fill="currentColor" /></>)
                                }
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Mobile: title + subtitle centred with share */}
                    <div className="md:hidden flex flex-col items-center text-center mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-serif text-foreground">{section.experience}</h3>
                        <button
                          onClick={() => {
                            const firstItem = galleryExperiences[originalSectionIndex].items[0];
                            const titleSlug = slugify(firstItem?.title || '');
                            const url = `https://www.maisonaffluency.com/gallery/${titleSlug}.html`;
                            const text = `${section.experience} — Maison Affluency`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
                          }}
                          className="p-1.5 text-foreground hover:text-primary transition-colors"
                          aria-label={`Share ${section.experience}`}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                      {section.subtitle && (
                        <p className="text-sm text-muted-foreground font-body italic mt-0.5">{section.subtitle}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Mobile: title + subtitle centred with share */}
                    <div className="md:hidden flex flex-col items-center text-center mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-serif text-foreground">{section.experience}</h3>
                        <button
                          onClick={() => {
                            const firstItem = galleryExperiences[originalSectionIndex].items[0];
                            const titleSlug = slugify(firstItem?.title || '');
                            const url = `https://www.maisonaffluency.com/gallery/${titleSlug}.html`;
                            const text = `${section.experience} — Maison Affluency`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
                          }}
                          className="p-1.5 text-foreground hover:text-primary transition-colors"
                          aria-label={`Share ${section.experience}`}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                      {section.subtitle && (
                        <p className="text-sm text-muted-foreground font-body italic mt-0.5">{section.subtitle}</p>
                      )}
                    </div>
                    {/* Desktop: centred title + share, centred subtitle */}
                    <div className="hidden md:flex flex-col items-center text-center mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl md:text-2xl lg:text-2xl font-serif text-primary">
                          {section.experience}
                        </h3>
                        <button
                          onClick={() => {
                            const firstItem = galleryExperiences[originalSectionIndex].items[0];
                            const titleSlug = slugify(firstItem?.title || '');
                            const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                            const url = `https://www.maisonaffluency.com/gallery/${titleSlug}.html`;
                            const text = `${section.experience} — Maison Affluency`;
                            if (isMobileDevice) {
                              window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
                            } else {
                              navigator.clipboard.writeText(`${text} — ${url}`);
                              import('sonner').then(({ toast }) => toast.success('Link copied'));
                            }
                          }}
                          className="inline-flex flex-col items-center gap-0.5 text-foreground hover:text-primary transition-colors flex-shrink-0"
                          aria-label={`Share ${section.experience}`}
                        >
                          <Share2 className="w-4 h-4" />
                          <span className="text-[7px] uppercase tracking-[0.12em] font-body">Share</span>
                        </button>
                      </div>
                      <p className="text-sm md:text-base text-muted-foreground font-body italic mt-1">
                        {section.subtitle}
                      </p>
                    </div>
                  </>
                )}
              </motion.div>

              {/* Mobile: swipeable carousel like Instagram */}
              {(() => {
                const isHotspotSection = !section.items.some(item => item.description);
                const activeIdx = activeScrollIndices[originalSectionIndex] || 0;
                return (
                  <div className="md:hidden relative">
                    <div
                      ref={el => { scrollStripRefs.current[originalSectionIndex] = el; }}
                      onScroll={() => handleStripScroll(originalSectionIndex)}
                      className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                    >
                      {section.items.map((item, index) => (
                        <div
                          key={`${item.title}-${index}-mobile`}
                          className={`relative flex-none w-full snap-center cursor-pointer ${isHotspotSection ? 'aspect-[4/5]' : 'aspect-[3/4]'}`}
                          onClick={() => openLightbox(originalSectionIndex, index)}
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            sizes="100vw"
                            className={`h-full w-full object-cover brightness-[1.05] contrast-[1.08] saturate-[1.05] ${item.image === bespokeSofaImage ? "object-[center_35%]" : ""}`}
                            loading="lazy"
                          />
                          {!isHotspotSection && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                          )}
                          {/* Pulsating hotspot icon — first card only */}
                          {isHotspotSection && index === 0 && hotspotCounts[item.title] > 0 && (
                            <span className="absolute top-3 left-3 z-20 pointer-events-none">
                              <span className="relative flex items-center justify-center w-5 h-5 rounded-full bg-black/70 border border-primary/70">
                                <span className="absolute inset-0 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: "2.2s" }} />
                                <Plus className="relative h-2.5 w-2.5 text-white" />
                              </span>
                            </span>
                          )}
                          {/* Expand icon - bottom left */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openLightbox(originalSectionIndex, index);
                            }}
                            className="absolute bottom-2 left-2 z-10"
                            aria-label="View full image"
                          >
                            <span className="bg-black/60 text-white p-1.5 rounded-full shadow-lg backdrop-blur-sm flex items-center justify-center">
                              <Maximize2 className="w-3 h-3" />
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Instagram-style indicator — top right: icon on first photo, counter on others */}
                    {section.items.length > 1 && (
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full pointer-events-none w-7 h-7 flex items-center justify-center">
                        {activeIdx === 0 ? (
                          <Copy className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <span className="text-white text-[10px] font-body font-medium leading-none">
                            {activeIdx + 1}/{section.items.length}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Photo title below carousel */}
                    <div className="flex items-center justify-between mt-3 px-1">
                      <h4 className="font-serif text-foreground text-base">
                        {section.items[activeIdx]?.title}
                      </h4>
                    </div>
                    {/* Dot indicators */}
                    {section.items.length > 1 && (
                      <div className="flex justify-center gap-1.5 mt-2">
                        {section.items.map((_, dotIndex) => (
                          <button
                            key={dotIndex}
                            aria-label={`Go to photo ${dotIndex + 1}`}
                            onClick={() => {
                              const strip = scrollStripRefs.current[originalSectionIndex];
                              if (!strip) return;
                              const cardWidth = strip.scrollWidth / section.items.length;
                              strip.scrollTo({ left: cardWidth * dotIndex, behavior: 'smooth' });
                            }}
                            className={`rounded-full transition-all duration-300 ${
                              activeIdx === dotIndex
                                ? 'w-1.5 h-1.5 bg-primary'
                                : 'w-1.5 h-1.5 bg-primary/30'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Mobile pill bar — rendered after first section's pictures */}
              {originalSectionIndex === 0 && (
                <div className="md:hidden mt-6 mb-2">
                  <div
                    ref={pillBarRef}
                    className="flex overflow-x-auto scrollbar-hide gap-2 pb-3 snap-x snap-mandatory"
                    onScroll={() => {
                      const el = pillBarRef.current;
                      if (!el) return;
                      const buttons = el.querySelectorAll<HTMLButtonElement>('button');
                      const center = el.scrollLeft + el.clientWidth / 2;
                      let closestIdx = 0;
                      let closestDist = Infinity;
                      buttons.forEach((btn, i) => {
                        const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
                        const dist = Math.abs(btnCenter - center);
                        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
                      });
                      if (closestIdx !== activeMobilePill) setActiveMobilePill(closestIdx);
                    }}
                  >
                    {galleryExperiences.map((exp, idx) => (
                      <button
                        key={exp.experience}
                        onClick={() => {
                          setActiveMobilePill(idx);
                          const el = pillBarRef.current;
                          const btn = el?.querySelectorAll<HTMLButtonElement>('button')[idx];
                          if (el && btn) {
                            const scrollTo = btn.offsetLeft - el.clientWidth / 2 + btn.offsetWidth / 2;
                            el.scrollTo({ left: scrollTo, behavior: 'smooth' });
                          }
                        }}
                        className={`flex-none px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.12em] font-body font-semibold whitespace-nowrap border transition-all duration-300 snap-center ${
                          activeMobilePill === idx
                            ? 'bg-foreground text-background border-foreground'
                            : 'bg-transparent text-foreground border-foreground/30 hover:border-foreground/60'
                        }`}
                      >
                        {exp.experience}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center gap-1 mt-1">
                    {galleryExperiences.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setActiveMobilePill(idx);
                          const el = pillBarRef.current;
                          const btn = el?.querySelectorAll<HTMLButtonElement>('button')[idx];
                          if (el && btn) {
                            const scrollTo = btn.offsetLeft - el.clientWidth / 2 + btn.offsetWidth / 2;
                            el.scrollTo({ left: scrollTo, behavior: 'smooth' });
                          }
                        }}
                        className={`rounded-full transition-all duration-300 ${
                          activeMobilePill === idx
                            ? 'w-1.5 h-1.5 bg-foreground'
                            : 'w-1 h-1 bg-foreground/25'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Desktop: single-column = horizontal carousel with dots; multi-column = grid */}
              {gridCols === 1 ? (
                <DesktopCarouselStrip
                  section={section}
                  originalSectionIndex={originalSectionIndex}
                  isInView={isInView}
                  hotspotCounts={hotspotCounts}
                  openLightbox={openLightbox}
                />
              ) : (
                <div className={`hidden md:grid transition-all duration-300 ${gridCols === 3 ? 'md:grid-cols-2 lg:grid-cols-3 md:gap-8' : 'md:grid-cols-2 lg:grid-cols-4 md:gap-8'}`}>
                {section.items.map((item, index) => {
                  const itemKey = `${originalSectionIndex}-${index}`;
                  const isExpanded = expandedItem === itemKey;
                  const hiddenIn3Col = gridCols === 3 && index >= 3;

                  return (
                    <motion.div
                      key={`${item.title}-${index}`}
                      id={`gallery-item-${itemKey}`}
                      initial={{ opacity: 0, y: 40 }}
                      animate={isInView ? { opacity: hiddenIn3Col ? 0 : 1, y: hiddenIn3Col ? 20 : 0 } : {}}
                      transition={{ duration: 0.6, delay: originalSectionIndex * 0.2 + index * 0.15 }}
                      className={`group cursor-pointer ${hiddenIn3Col ? 'hidden' : ''}`}
                    >
                      <div
                        className={`relative mb-2 overflow-hidden rounded-sm shadow-[0_20px_50px_-10px_rgba(0,0,0,0.4)] transition-all duration-500 group-hover:shadow-[0_25px_60px_-10px_rgba(0,0,0,0.5)] aspect-[4/5]`}
                        onClick={() => openLightbox(originalSectionIndex, index)}
                      >
                        <img src={item.image} alt={`${item.title} — ${section.experience} | Maison Affluency curated luxury interiors`} sizes={gridCols === 3 ? "(max-width: 1024px) 50vw, 33vw" : "(max-width: 1024px) 50vw, 25vw"} className="h-full w-full object-cover brightness-[1.05] contrast-[1.08] saturate-[1.05] transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.92]" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        {/* Cinematic title overlay on hover */}
                        <div className="absolute bottom-0 left-0 right-0 px-4 pb-10 translate-y-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 pointer-events-none z-10">
                          <p className="font-display text-white text-sm tracking-widest uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                            {item.title}
                          </p>
                        </div>
                        {/* Pulsating hotspot hint — first card of every section */}
                        {index === 0 && (
                          <div className="absolute top-3 left-3 z-20 pointer-events-none">
                            <span className="relative flex items-center justify-center w-5 h-5 rounded-full bg-black/70 backdrop-blur-sm border-2 border-primary/70 shadow-[0_0_8px_hsl(var(--primary)/0.4)]">
                              <Plus className="w-2.5 h-2.5 text-white" />
                              <span className="absolute inset-0 rounded-full border border-black/20 animate-ping" style={{ animationDuration: "2s" }} />
                            </span>
                          </div>
                        )}
                        {/* +1 more indicator on last visible card in 3-col mode — top right */}
                        {gridCols === 3 && index === 2 && section.items.length > 3 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setGridCols(4);
                            }}
                            className="absolute top-2 right-2 md:top-4 md:right-4 z-10 bg-black/50 backdrop-blur-sm text-white font-body text-xs tracking-wide px-3 py-1.5 rounded-full hover:bg-black/70 transition-all duration-300"
                            aria-label="Show 1 more photo"
                          >
                            +1 more
                          </button>
                        )}
                        {/* Expand icon — bottom right */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openLightbox(originalSectionIndex, index);
                          }}
                          className="absolute bottom-2 right-2 md:bottom-4 md:right-4 flex opacity-100 transition-opacity duration-300"
                          aria-label="View full image"
                        >
                          <span className={`bg-black/60 text-white rounded-full shadow-lg backdrop-blur-sm hover:bg-black/80 transition-all duration-300 ${gridCols >= 3 ? 'p-1' : 'p-2'}`}>
                            <Maximize2 className={`${gridCols >= 3 ? 'w-2.5 h-2.5' : 'w-4 h-4'}`} />
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              )}
            </div>;
          });
          })()}
        </div>
      </section>

      {/* Lightbox - using Radix Dialog (react-remove-scroll blocks browser gestures, enabling PinchZoomImage) */}
      <Dialog
        open={lightboxOpen}
        onOpenChange={(open) => { if (!open) closeLightbox(); }}
      >
        <DialogContent
          hideClose
          className="max-w-[100vw] max-h-[100dvh] w-screen h-[100dvh] p-0 border-none bg-black/95 overflow-hidden flex items-center justify-center [&>button]:hidden"
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") goToPrevious();
            if (e.key === "ArrowRight") goToNext();
          }}
        >
          <VisuallyHidden>
            <DialogTitle>{currentSectionItems[currentItemIndex]?.title || 'Gallery Image'}</DialogTitle>
          </VisuallyHidden>
           {isMobile ? (
             /* ── Mobile: Embla Carousel lightbox ── */
              <div className="relative w-full h-full flex flex-col items-center justify-center overflow-y-auto">
                {/* Title */}
                <h3 className="text-lg font-serif text-white mt-2 mb-1.5 text-center px-4 shrink-0">
                  {currentSectionItems[currentItemIndex]?.title}
                </h3>

                {/* Embla carousel with close button */}
                <div className="relative w-full shrink-0 overflow-hidden">
                  <div ref={emblaRef} className="overflow-hidden">
                    <div className="flex">
                      {currentSectionItems.map((item, i) => (
                        <div key={i} className="flex-[0_0_100%] min-w-0 flex items-center justify-center">
                          <div className="relative w-full">
                           <img
                             src={item.image}
                             alt={item.title}
                             sizes="100vw"
                             className="object-contain brightness-[1.05] contrast-[1.08] saturate-[1.05] w-full max-h-[65vh]"
                             loading={Math.abs(i - currentItemIndex) <= 1 ? "eager" : "lazy"}
                             decoding="async"
                             draggable={false}
                           />
                           {i === currentItemIndex && (
                             <GalleryHotspots
                                imageIdentifier={item.title}
                                visible={true}
                                onCloseLightbox={closeLightbox}
                                 filterDesigner={filterDesigner}
                                 {...(onHotspotAddToQuote ? { onAddToQuote: onHotspotAddToQuote } : { onRequestQuote: handleHotspotQuoteRequest, onViewProduct: handleHotspotViewProduct })}
                              />
                           )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Close button — mobile bottom-left */}
                  <div className="absolute bottom-2 left-3 z-50">
                    <button
                      onClick={closeLightbox}
                      className="p-1.5 bg-black/60 backdrop-blur-sm rounded-full"
                      aria-label="Close lightbox"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                  {/* Share button — mobile top-left */}
                  <div className="absolute top-2 left-3 z-50">
                    <button
                      onClick={shareLightboxImage}
                      className="p-1.5 bg-black/60 backdrop-blur-sm rounded-full"
                      aria-label="Share this image"
                    >
                      <Share2 className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>

                {/* Section label */}
                <p className="text-center text-[9px] uppercase tracking-[0.15em] text-white/50 font-body mt-2 shrink-0">
                  {galleryExperiences[currentSectionIndex]?.experience.replace(/^An?\s+/i, '')}
                  <span className="text-white/30 ml-1.5">{currentSectionIndex + 1}/{galleryExperiences.length}</span>
                </p>

                {/* Dot indicators */}
                <div className="flex justify-center gap-1.5 mt-1.5 shrink-0">
                  {currentSectionItems.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setCurrentItemIndex(i); emblaApi?.scrollTo(i); }}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentItemIndex ? 'bg-white' : 'bg-white/40'}`}
                      aria-label={`Go to image ${i + 1}`}
                    />
                  ))}
                </div>

                <div className="pb-6" />
             </div>
           ) : (
             /* ── Desktop: existing layout ── */
             <div
               ref={swipeContainerRef}
               className="relative w-full h-full flex items-center justify-center overflow-x-hidden overscroll-contain"
             >

                {/* Pill indicator */}
                <div className={`absolute top-4 ${isExpanded ? 'right-16' : 'right-4'} z-50 bg-black/60 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center pointer-events-none ${isExpanded ? 'hidden md:flex' : ''}`}>
                  <span className="text-white text-[10px] font-body font-medium leading-none">
                    {currentItemIndex + 1}/{currentSectionItems.length}
                  </span>
                </div>

               {/* Previous button */}
               <button onClick={goToPrevious} className="hidden md:flex absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-50 text-white/50 hover:text-white transition-colors" aria-label="Previous image">
                 <ChevronLeft className="h-8 w-8" />
               </button>

               {/* Image container */}
                <ExpandedScrollContainer isExpanded={isExpanded}>
                  <h3 className="text-xl font-serif text-white mb-1.5 text-center shrink-0 w-full">
                    {currentSectionItems[currentItemIndex]?.title}
                  </h3>
                   <div className="relative inline-block shrink-0">
                     <PinchZoomImage key={currentItemIndex} src={currentSectionItems[currentItemIndex]?.image} alt={currentSectionItems[currentItemIndex]?.title} className={`object-contain brightness-[1.05] contrast-[1.08] saturate-[1.05] transition-all duration-300 ${isExpanded ? 'max-h-[88vh] max-w-[95vw]' : 'w-full max-w-full max-h-[65vh]'}`} loading="eager" decoding="sync" fetchPriority="high" onZoomChange={(z) => { imageZoomedRef.current = z; setImageZoomed(z); }} />
                     <GalleryHotspots
                         imageIdentifier={currentSectionItems[currentItemIndex]?.title || ""}
                         visible={!imageZoomed}
                         onCloseLightbox={closeLightbox}
                         filterDesigner={filterDesigner}
                         {...(onHotspotAddToQuote ? { onAddToQuote: onHotspotAddToQuote } : { onRequestQuote: handleHotspotQuoteRequest, onViewProduct: handleHotspotViewProduct })}
                       />
                      {/* Share button — desktop top-right */}
                      <div className="hidden md:flex absolute top-3 right-3 z-50">
                        <button
                          onClick={shareLightboxImage}
                          className="p-2.5 rounded-full bg-white/15 text-white/85 hover:text-white hover:bg-white/30 backdrop-blur-sm transition-all duration-300 border border-white/20"
                          aria-label="Share this image"
                        >
                          <Share2 className="h-5 w-5" />
                        </button>
                      </div>
                      {/* Close button — desktop near image */}
                      <div className={`hidden md:flex absolute z-50 ${isExpanded ? 'bottom-2 -right-12 lg:-right-14' : 'bottom-2 -right-12 lg:-right-14'}`}>
                        <button
                          onClick={closeLightbox}
                          className="p-2.5 rounded-full bg-white/15 text-white/85 hover:text-white hover:bg-white/30 backdrop-blur-sm transition-all duration-300 border border-white/20"
                          aria-label="Close lightbox"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      {/* Maximize / Minimize icon — z-50 to stay above PinchZoomImage overlay */}
                      {!isExpanded ? (
                        <button
                          onClick={() => setIsExpanded(true)}
                          className="absolute bottom-2 left-2 md:left-auto md:right-2 z-50 bg-black/40 backdrop-blur-sm p-1.5 rounded-full hover:bg-black/60 transition-colors cursor-pointer"
                          aria-label="Maximize image"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-white" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsExpanded(false)}
                          className="absolute bottom-2 left-2 md:left-auto md:right-2 z-50 bg-black/40 backdrop-blur-sm p-2 rounded-full hover:bg-black/60 transition-colors cursor-pointer"
                          aria-label="Minimize image"
                        >
                          <Minimize2 className="w-4 h-4 text-white" />
                        </button>
                      )}
                   </div>
                </ExpandedScrollContainer>

                {/* Section label + dot indicators — fixed at bottom */}
                <div className="absolute bottom-6 left-0 right-0 z-50 flex flex-col items-center gap-1.5 pointer-events-none">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-white/50 font-body">
                    {galleryExperiences[currentSectionIndex]?.experience.replace(/^An?\s+/i, '')}
                    <span className="text-white/30 ml-1.5">{currentSectionIndex + 1}/{galleryExperiences.length}</span>
                  </p>
                  <div className="flex justify-center gap-1.5 pointer-events-auto">
                    {currentSectionItems.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentItemIndex(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentItemIndex ? 'bg-white' : 'bg-white/40'}`}
                        aria-label={`Go to image ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

               {/* Next button */}
               <button onClick={goToNext} className="hidden md:flex absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-50 text-white/50 hover:text-white transition-colors" aria-label="Next image">
                 <ChevronRight className="h-8 w-8" />
               </button>
             </div>
           )}
          {/* Product lightbox inside Dialog so it's within focus-trap scope */}
          {!onHotspotAddToQuote && hotspotLightboxProduct && (
            <PublicProductLightbox
              product={hotspotLightboxProduct}
              allPicks={allCuratorPicks.filter(p => p.brand_name === hotspotLightboxProduct?.brand_name)}
              onClose={() => setHotspotLightboxProduct(null)}
              onSelectRelated={(item) => setHotspotLightboxProduct(item)}
              inline
            />
          )}
        </DialogContent>
      </Dialog>
      {!onHotspotAddToQuote && (
        <QuoteRequestDialog
          open={quoteDialogOpen}
          onOpenChange={setQuoteDialogOpen}
          productName={quoteProduct.name}
          designerName={quoteProduct.designer}
        />
      )}
      {/* Render outside Dialog for non-lightbox hotspot views */}
      {!onHotspotAddToQuote && !lightboxOpen && (
        <PublicProductLightbox
          product={hotspotLightboxProduct}
          allPicks={allCuratorPicks.filter(p => p.brand_name === hotspotLightboxProduct?.brand_name)}
          onClose={() => setHotspotLightboxProduct(null)}
          onSelectRelated={(item) => setHotspotLightboxProduct(item)}
        />
      )}
    </>;
};
export default Gallery;