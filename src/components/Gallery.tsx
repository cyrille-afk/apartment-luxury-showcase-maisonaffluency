import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "framer-motion";
import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useLightboxSwipe } from "@/hooks/useLightboxSwipe";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ChevronDown, X, Maximize2, Minimize2, Expand, Shrink, Instagram, Copy, Plus, Minus, CalendarDays } from "lucide-react";
import PinchZoomImage from "./PinchZoomImage";
import PinchHint from "./PinchHint";
import GalleryHotspots from "./GalleryHotspots";
import QuoteRequestDialog from "./QuoteRequestDialog";
import PrivateTourDialog from "./PrivateTourDialog";
import PublicProductLightbox, { type PublicLightboxItem } from "./PublicProductLightbox";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import SliderDots from "@/components/ui/SliderDots";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchCatalogManifest } from "@/lib/catalogManifest";
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

const getFixedHeaderOffset = () => {
  const nav = document.querySelector("nav");
  const navHeight = nav?.getBoundingClientRect().height ?? 96;
  return Math.ceil(navHeight + 8);
};

const pinElementBelowHeader = (element: HTMLElement, maxPasses = 8) => {
  let passes = 0;
  const pin = () => {
    const top = element.getBoundingClientRect().top + window.scrollY - getFixedHeaderOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    passes += 1;
    if (passes < maxPasses) window.setTimeout(pin, 80);
  };
  requestAnimationFrame(() => requestAnimationFrame(pin));
};

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
    image: g("calming-2"),
    srcSet: gSet("calming-2"),
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

type GalleryGridCols = 1 | 3 | 4;

const GalleryGridIcon = ({ columns }: { columns: GalleryGridCols }) => {
  const bars = columns === 1 ? [{ x: 9, width: 6 }] : columns === 3
    ? [{ x: 2, width: 5.5 }, { x: 9.25, width: 5.5 }, { x: 16.5, width: 5.5 }]
    : [{ x: 1.5, width: 4 }, { x: 7, width: 4 }, { x: 12.5, width: 4 }, { x: 18, width: 4 }];

  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y="3" width={bar.width} height="18" rx="1" fill="currentColor" />
      ))}
    </svg>
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
            onClick={() => openLightbox(originalSectionIndex, activeIdx)}
          >
            <img
              src={item.image}
              srcSet={(item as any).srcSet}
              sizes="(max-width: 1024px) 100vw, 1200px"
              alt={`${item.title} — ${section.experience}`}
              className="h-full w-full object-cover brightness-[1.05] contrast-[1.08] saturate-[1.05] transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.92] rounded-sm"
              loading="lazy"
              decoding="async"
              width={1600}
              height={1000}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 rounded-sm" />
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
              onClick={(e) => { e.stopPropagation(); openLightbox(originalSectionIndex, activeIdx); }}
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
      <SliderDots
        count={section.items.length}
        activeIndex={activeIdx}
        onSelect={scrollToIdx}
        variant="dark"
        className="mt-3"
        ariaPrefix="Go to photo"
      />
    </motion.div>
  );
};

interface GalleryProps {
  /** Trade mode: pass to GalleryHotspots as onAddToQuote */
  onHotspotAddToQuote?: (product: { product_name: string; designer_name: string | null; product_image_url: string | null; materials: string | null; dimensions: string | null }) => void;
  /** Hide the section intro text (e.g. when embedded in trade portal) */
  hideIntro?: boolean;
}

type GalleryHotspotPosition = {
  x: number;
  y: number;
  label: string;
  designer: string;
  linkUrl: string | null;
  mappedPickId: string | null;
};

type MobileGalleryImageCardProps = {
  item: typeof galleryExperiences[number]["items"][number];
  isHotspotSection: boolean;
  hotspots: GalleryHotspotPosition[];
  onHotspotActivate: (hotspot: GalleryHotspotPosition) => void;
};

const MobileGalleryImageCard = ({ item, isHotspotSection, hotspots, onHotspotActivate }: MobileGalleryImageCardProps) => {
  const [naturalAspect, setNaturalAspect] = useState(16 / 10);

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalAspect(img.naturalWidth / img.naturalHeight);
    }
  }, []);

  return (
    <div
      className={`relative flex-none w-full snap-center overflow-hidden rounded-2xl ${isHotspotSection ? '' : 'aspect-[3/4]'}`}
      style={isHotspotSection ? { aspectRatio: naturalAspect } : undefined}
    >
      <img
        src={item.image}
        srcSet={(item as any).srcSet}
        alt={item.title}
        sizes="100vw"
        className={`${isHotspotSection ? 'absolute inset-0 h-full w-full object-fill' : 'h-full w-full object-cover'} brightness-[1.05] contrast-[1.08] saturate-[1.05] ${item.image === bespokeSofaImage && !isHotspotSection ? "object-[center_35%]" : ""}`}
        loading="lazy"
        decoding="async"
        width={isHotspotSection ? 1600 : 900}
        height={isHotspotSection ? Math.round(1600 / naturalAspect) : 1200}
        onLoad={handleImageLoad}
      />

      {!isHotspotSection && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      )}
      {hotspots.map((hotspot, hotspotIndex) => (
        <button
          key={`${item.title}-hotspot-${hotspotIndex}`}
          type="button"
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") return;
            e.stopPropagation();
            e.preventDefault();
            onHotspotActivate(hotspot);
          }}
          onClick={(e) => { e.stopPropagation(); onHotspotActivate(hotspot); }}
          aria-label={`Explore hotspot: ${hotspot.label}`}
          className="absolute z-30 flex h-5 w-5 touch-manipulation -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 backdrop-blur-sm border-2 border-primary/70 text-white shadow-[0_0_8px_hsl(var(--primary)/0.4)] active:scale-95 transition-transform"
          style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
        >
          <span className="absolute inset-0 rounded-full border border-black/20 animate-ping" style={{ animationDuration: "2s" }} />
          <Plus className="relative w-2.5 h-2.5" strokeWidth={2.5} />
        </button>
      ))}
    </div>
  );
};

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lightboxContentRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Fullscreen the page root, NOT the Radix DialogContent — putting Radix's
        // focus-trap / scroll-lock node into fullscreen causes it to re-mount and flicker.
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed', err);
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!lightboxOpen && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [lightboxOpen]);
  const [sourceItemKey, setSourceItemKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState<GalleryGridCols>(4);
  const [activeMobilePill, setActiveMobilePill] = useState(-1);
  const pillBarRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Quote request dialog state (triggered from hotspot pins)
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState<{ name: string; designer: string }>({ name: "", designer: "" });

  // Private tour dialog state
  const [tourDialogOpen, setTourDialogOpen] = useState(false);

  const handleHotspotQuoteRequest = useCallback((productName: string, designerName: string) => {
    setQuoteProduct({ name: productName, designer: designerName });
    setQuoteDialogOpen(true);
  }, []);

  // ── Hotspot → PublicProductLightbox matching ──
  const [hotspotLightboxProduct, setHotspotLightboxProduct] = useState<PublicLightboxItem | null>(null);

  // Shared cache: reused across `/`, `/designers`, and category pages via the
  // query-key factory so navigating back to Home does NOT refetch.
  // Single edge-cached manifest replaces two direct Postgres reads.
  // Cache-Control: public, s-maxage=300, stale-while-revalidate=86400 — served
  // from the CDN for repeat visitors and reused across `/`, `/designers`, and
  // category pages via the shared query-key factory.
  // Defer this 84KB manifest off the LCP critical path — only fetch after the
  // browser is idle, the user scrolls, or a hotspot needs it. Gallery is
  // below the fold, so hydration doesn't need this data for first paint.
  const [manifestEnabled, setManifestEnabled] = useState(false);
  useEffect(() => {
    if (manifestEnabled) return;
    let cancelled = false;
    const enable = () => { if (!cancelled) setManifestEnabled(true); };
    const onScroll = () => enable();
    window.addEventListener("scroll", onScroll, { passive: true, once: true });
    const idleId = (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(enable, { timeout: 4000 })
      : window.setTimeout(enable, 2500);
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      if ((window as any).cancelIdleCallback && typeof idleId === "number") {
        (window as any).cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId as any);
      }
    };
  }, [manifestEnabled]);
  const { data: manifest } = useQuery({
    queryKey: queryKeys.curatorPicksLightbox(),
    queryFn: fetchCatalogManifest,
    staleTime: 5 * 60 * 1000,
    enabled: manifestEnabled,
  });

  const picksRaw = manifest?.picks;
  const designersBasic = manifest?.designers;

  const dbCuratorPicks = useMemo<PublicLightboxItem[]>(() => {
    if (!picksRaw || !designersBasic) return [];
    const designerMap = new Map(designersBasic.map((d: any) => [d.id, { name: d.name, slug: d.slug }]));
    return picksRaw.map((p: any) => {
      const designerInfo = designerMap.get(p.designer_id);
      const brandName = designerInfo?.name || "Unknown";
      return {
        id: p.id,
        title: p.title,
        subtitle: p.subtitle || null,
        image_url: p.image_url,
        hover_image_url: p.hover_image_url || null,
        brand_name: brandName,
        materials: p.materials || null,
        materials_description: p.materials_description || null,
        dimensions: p.dimensions || null,
        lead_time: p.lead_time || null,
        origin: p.origin || null,
        description: resolveCuratorPickDescription({ description: p.description }),
        category: p.category || null,
        subcategory: p.subcategory || null,
        pdf_url: p.pdf_url || null,
        pdf_urls: (p.pdf_urls as any) || null,
        designer_slug: designerInfo?.slug || null,
        size_variants: (p.size_variants as any) || null,
        variant_placeholder: p.variant_placeholder || null,
        base_axis_label: p.base_axis_label || null,
        top_axis_label: p.top_axis_label || null,
        gallery_images: (p.gallery_images as any) || null,
        variant_image_map: (p.variant_image_map as any) || null,
      };
    });
  }, [picksRaw, designersBasic]);

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
        materials_description: (p as any).materials_description || null,
        dimensions: p.dimensions || null,
        lead_time: (p as any).lead_time || null,
        origin: (p as any).origin || null,
        description: resolveCuratorPickDescription({ description: p.description }),
        category: p.category || null,
        subcategory: p.subcategory || null,
        pdf_url: p.pdf_url || null,
        pdf_urls: p.pdf_urls || null,
        size_variants: (p as any).size_variants || null,
        variant_placeholder: (p as any).variant_placeholder || null,
        base_axis_label: (p as any).base_axis_label || null,
        top_axis_label: (p as any).top_axis_label || null,
        gallery_images: (p as any).gallery_images || null,
        variant_image_map: (p as any).variant_image_map || null,
      }));

    const byKey = new Map<string, PublicLightboxItem>();
    for (const pick of staticPicks) byKey.set(`${slugify(pick.brand_name)}::${slugify(pick.title)}`, pick);
    for (const pick of dbCuratorPicks) byKey.set(`${slugify(pick.brand_name)}::${slugify(pick.title)}`, pick);

    return [...byKey.values()];
  }, [dbCuratorPicks]);

  const handleHotspotViewProduct = useCallback((productName: string, designerName: string, linkUrl?: string | null, mappedPickId?: string | null) => {
    // Manual override — admin-picked exact catalog item wins over fuzzy matching.
    if (mappedPickId) {
      const forced = allCuratorPicks.find((p) => p.id === mappedPickId);
      if (forced) {
        setHotspotLightboxProduct(forced);
        return;
      }
    }
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

  // ── Hotspot positions per image ──
  const [hotspotCounts, setHotspotCounts] = useState<Record<string, number>>({});
  const [hotspotPositions, setHotspotPositions] = useState<Record<string, GalleryHotspotPosition[]>>({});
  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase
        .from("gallery_hotspots")
        .select("image_identifier, x_percent, y_percent, product_name, designer_name, link_url, mapped_pick_id");
      if (data) {
        const counts: Record<string, number> = {};
          const positions: Record<string, GalleryHotspotPosition[]> = {};
        for (const row of data as any[]) {
          counts[row.image_identifier] = (counts[row.image_identifier] || 0) + 1;
          if (!positions[row.image_identifier]) positions[row.image_identifier] = [];
          positions[row.image_identifier].push({
            x: Number(row.x_percent),
            y: Number(row.y_percent),
            label: row.product_name || "hotspot",
            designer: row.designer_name || "",
            linkUrl: row.link_url ?? null,
            mappedPickId: row.mapped_pick_id ?? null,
          });
        }
        setHotspotCounts(counts);
        setHotspotPositions(positions);
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
      const storedReturnUrl = sessionStorage.getItem('galleryReturnUrl');
      const intentAt = Number(sessionStorage.getItem('galleryOpenIntentAt') || 0);
      const hasFreshIntent = intentAt > 0 && Date.now() - intentAt < 5000;
      if (storedIndex !== null) {
        const index = parseInt(storedIndex, 10);
        if (hasFreshIntent && !isNaN(index) && index >= 0 && index < allItems.length) {
          const { sectionIndex, itemIndex } = flatIndexToSectionItem(index);
          setCurrentSectionIndex(sectionIndex);
          setCurrentItemIndex(itemIndex);
          setExternalSourceId(sourceId);
          setSourceItemKey(null);
          setFilterDesigner(storedDesigner || null);
          if (storedReturnUrl) setReturnUrl(storedReturnUrl);
          setLightboxOpen(true);
        }
        sessionStorage.removeItem('openGalleryIndex');
        sessionStorage.removeItem('gallerySourceId');
        sessionStorage.removeItem('galleryFilterDesigner');
        sessionStorage.removeItem('galleryReturnUrl');
        sessionStorage.removeItem('galleryOpenIntentAt');
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
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        setExternalSourceId(null);
        setFilterDesigner(null);
      }, 100);
    } else if (sourceItemKey) {
      setTimeout(() => {
        const element = document.getElementById(`gallery-item-${sourceItemKey}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
       <section id="gallery" ref={ref} className="pt-0 pb-4 md:pt-0 md:pb-24 bg-white scroll-header-offset">
        <div className="mx-auto max-w-7xl px-6 md:px-12">
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


          {(() => {
            const firstHotspotSectionIdx = galleryExperiences.findIndex(s => !s.items.some(i => i.description));
            return filteredExperiences.map((section, sectionIndex) => {
            // Find original index for proper lightbox mapping
            const originalSectionIndex = galleryExperiences.indexOf(section);
            const isMobilePillActive = originalSectionIndex === activeMobilePill;
            return <React.Fragment key={section.experience}>
              {/* Mobile accordion header — always visible */}
              <button
                type="button"
                onClick={(e) => {
                  const next = isMobilePillActive ? -1 : originalSectionIndex;
                  const btn = e.currentTarget as HTMLButtonElement;
                  setActiveMobilePill(next);
                  if (next !== -1) {
                    pinElementBelowHeader(btn);
                  }
                }}
                className="md:hidden w-full flex items-center justify-between gap-3 py-5 text-left"
                aria-expanded={isMobilePillActive}
                aria-controls={`gallery-section-${originalSectionIndex}`}
              >
                <span className="font-serif text-base text-foreground">{section.experience}</span>
                <span className="shrink-0 w-7 h-7 rounded-full border border-foreground/40 flex items-center justify-center text-foreground">
                  {isMobilePillActive ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </span>
              </button>
              <div id={`gallery-section-${originalSectionIndex}`} ref={el => { sectionRefs.current[originalSectionIndex] = el; }} className={`md:mb-10 ${originalSectionIndex === 0 ? 'pt-2 md:pt-0' : ''} ${!isMobilePillActive ? 'hidden md:block' : 'pt-3 mb-2'}`}>
              {originalSectionIndex === 0 && <div id="sociable-environment" className="scroll-header-offset" style={{ pointerEvents: "none" }} aria-hidden="true" />}
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
                {/* Desktop/tablet only: mobile/PWA uses the accordion header as the section title. */}
                {!isMobile && originalSectionIndex === 0 ? (
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
                    {/* Row 2: Title centred */}
                    <div className="hidden md:flex flex-col items-center text-center mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl md:text-2xl lg:text-2xl font-serif text-primary">
                          {section.experience}
                        </h3>
                      </div>
                      {/* Subtitle centred, grid icons right-aligned on same row */}
                      <div className="flex items-center w-full mt-1">
                        <div className="flex-1" />
                        <p className="text-sm md:text-base text-muted-foreground font-body italic">
                          {section.subtitle}
                        </p>
                        <div className="flex-1 flex justify-end">
                          <div className="flex items-center gap-2 relative z-30">
                            <button
                              type="button"
                              onClick={() => setGridCols(gridCols === 1 ? 3 : 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-foreground bg-background text-foreground transition-colors hover:bg-muted"
                              aria-label={gridCols === 1 ? "Switch to 3 columns" : "Switch to 1 column"}
                            >
                              <GalleryGridIcon columns={gridCols === 1 ? 3 : 1} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setGridCols(gridCols === 4 ? 3 : 4)}
                              className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-foreground bg-background text-foreground transition-colors hover:bg-muted"
                              aria-label={gridCols === 4 ? "Switch to 3 columns" : "Switch to 4 columns"}
                            >
                              <GalleryGridIcon columns={gridCols === 4 ? 3 : 4} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : !isMobile ? (
                  <>
                    {/* Desktop: centred title, centred subtitle */}
                    <div className="hidden md:flex flex-col items-center text-center mb-3">
                      <h3 className="text-xl md:text-2xl lg:text-2xl font-serif text-primary">
                        {section.experience}
                      </h3>
                      <p className="text-sm md:text-base text-muted-foreground font-body italic mt-1">
                        {section.subtitle}
                      </p>
                    </div>
                  </>
                ) : null}
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
                      className="flex items-start overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-2xl"
                    >
                      {section.items.map((item, index) => {
                        const itemHotspots = hotspotPositions[item.title] || [];
                        return (
                          <MobileGalleryImageCard
                            key={`${item.title}-${index}-mobile`}
                            item={item}
                            isHotspotSection={isHotspotSection}
                            hotspots={itemHotspots}
                            onHotspotActivate={(hotspot) => handleHotspotViewProduct(hotspot.label, hotspot.designer, hotspot.linkUrl, hotspot.mappedPickId)}
                          />
                        );
                      })}
                    </div>
                    {/* Instagram-style indicator — top right */}
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
                    {/* Thumbnail strip with arrows — like product sheet */}
                    {section.items.length > 1 && (() => {
                      const goToPhoto = (idx: number) => {
                        const strip = scrollStripRefs.current[originalSectionIndex];
                        if (!strip) return;
                        const cardWidth = strip.scrollWidth / section.items.length;
                        strip.scrollTo({ left: cardWidth * idx, behavior: 'smooth' });
                      };
                      const clamped = Math.max(0, Math.min(section.items.length - 1, activeIdx));
                      return (
                        <div className="relative mt-2">
                          <button
                            type="button"
                            onClick={() => goToPhoto(clamped - 1)}
                            disabled={clamped === 0}
                            aria-label="Previous photo"
                            className={`absolute left-[-0.75rem] top-1/2 z-20 flex h-full w-10 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 shadow-none transition-opacity ${clamped === 0 ? 'opacity-35 pointer-events-none' : 'opacity-100'}`}
                          >
                            <ChevronLeft className="w-5 h-5 text-foreground drop-shadow-sm" strokeWidth={1.75} />
                          </button>
                          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                            <div className="flex gap-2 justify-center min-w-full">
                              {section.items.map((item, i) => (
                                <button
                                  key={`thumb-${i}`}
                                  type="button"
                                  onClick={() => goToPhoto(i)}
                                  aria-label={`View photo ${i + 1}`}
                                  aria-current={i === clamped}
                                  className={`relative w-16 h-16 shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                                    i === clamped
                                      ? 'border-foreground shadow-[0_0_0_1px_hsl(var(--foreground)/0.4)]'
                                      : 'border-border/60 opacity-70 hover:opacity-100'
                                  }`}
                                >
                                  <img
                                    src={item.image}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    width={64}
                                    height={64}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="pointer-events-none absolute inset-y-0 left-[-1rem] z-10 w-12 bg-gradient-to-r from-background/95 via-background/65 to-background/0 backdrop-blur-[2px]" />
                          <div className="pointer-events-none absolute inset-y-0 right-[-1rem] z-10 w-12 bg-gradient-to-l from-background/95 via-background/65 to-background/0 backdrop-blur-[2px]" />
                          <button
                            type="button"
                            onClick={() => goToPhoto(clamped + 1)}
                            disabled={clamped === section.items.length - 1}
                            aria-label="Next photo"
                            className={`absolute right-[-0.75rem] top-1/2 z-20 flex h-full w-10 -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 shadow-none transition-opacity ${clamped === section.items.length - 1 ? 'opacity-35 pointer-events-none' : 'opacity-100'}`}
                          >
                            <ChevronRight className="w-5 h-5 text-foreground drop-shadow-sm" strokeWidth={1.75} />
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

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
                        <img src={item.image} srcSet={(item as any).srcSet} alt={`${item.title} — ${section.experience} | Maison Affluency curated luxury interiors`} sizes={gridCols === 3 ? "(max-width: 1024px) 50vw, 33vw" : "(max-width: 1024px) 50vw, 25vw"} className="h-full w-full object-cover brightness-[1.05] contrast-[1.08] saturate-[1.05] transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.92]" loading="lazy" decoding="async" width={800} height={1000} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
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
            </div>
            </React.Fragment>;
          });
          })()}

          {/* Private tour CTA — desktop only (hidden on mobile & PWA) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="hidden md:block mt-10 md:mt-16 py-10 md:py-14 text-center"
          >
            <p className="font-body text-xs uppercase tracking-[0.3em] text-primary mb-3">
              By Appointment
            </p>
            <h3 className="font-display text-2xl md:text-3xl text-foreground mb-4">
              Experience the Apartment in Person
            </h3>
            <p className="font-body text-sm text-muted-foreground max-w-xl mx-auto mb-6">
              Our Singapore showroom is open for private viewings. Arrange a guided tour with our curators.
            </p>
            <button
              onClick={() => setTourDialogOpen(true)}
              className="inline-flex min-h-12 items-center gap-2.5 px-9 py-3.5 bg-foreground text-background font-body text-sm uppercase tracking-[0.2em] rounded-xl shadow-[0_4px_20px_-4px_hsl(var(--foreground)/0.25)] hover:bg-foreground/90 hover:shadow-[0_6px_26px_-4px_hsl(var(--foreground)/0.35)] transition-all duration-300"
            >
              <CalendarDays className="h-4 w-4" />
              Request a Private Tour
            </button>
          </motion.div>
        </div>
      </section>
      {/* Lightbox - using Radix Dialog (react-remove-scroll blocks browser gestures, enabling PinchZoomImage) */}
      <Dialog
        open={lightboxOpen}
        onOpenChange={(open) => { if (!open) closeLightbox(); }}
      >
        <DialogContent
          ref={lightboxContentRef}
          hideClose
          className="!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !max-w-none !max-h-[100dvh] !w-[100dvw] !h-[100dvh] p-0 border-none bg-black/95 overflow-hidden flex items-start justify-start md:items-center md:justify-center [&>button]:hidden"
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") goToPrevious();
            if (e.key === "ArrowRight") goToNext();
            if (e.key.toLowerCase() === "f") toggleFullscreen();
          }}
        >
          <VisuallyHidden>
            <DialogTitle>{currentSectionItems[currentItemIndex]?.title || 'Gallery Image'}</DialogTitle>
          </VisuallyHidden>
           {isMobile ? (
             /* ── Mobile: Embla Carousel lightbox ── */
              <div className="relative w-full h-full flex flex-col items-center justify-start overflow-y-auto pt-4 pb-6">
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
                             className="object-contain brightness-[1.05] contrast-[1.08] saturate-[1.05] w-full max-h-[70dvh]"
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
                  <div className="absolute bottom-2 left-3 z-50 flex gap-2">
                    <button
                      onClick={closeLightbox}
                      className="p-1.5 bg-black/60 backdrop-blur-sm rounded-full"
                      aria-label="Close lightbox"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className="p-1.5 bg-black/60 backdrop-blur-sm rounded-full"
                      aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
                    >
                      {isFullscreen ? <Shrink className="h-4 w-4 text-white" /> : <Expand className="h-4 w-4 text-white" />}
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
                      {/* Close + fullscreen buttons — desktop near image */}
                      <div className={`hidden md:flex flex-col gap-2 absolute z-50 ${isExpanded ? 'bottom-2 -right-12 lg:-right-14' : 'bottom-2 -right-12 lg:-right-14'}`}>
                        <button
                          onClick={closeLightbox}
                          className="p-2.5 rounded-full bg-white/15 text-white/85 hover:text-white hover:bg-white/30 backdrop-blur-sm transition-all duration-300 border border-white/20"
                          aria-label="Close lightbox"
                        >
                          <X className="h-5 w-5" />
                        </button>
                        <button
                          onClick={toggleFullscreen}
                          className="p-2.5 rounded-full bg-white/15 text-white/85 hover:text-white hover:bg-white/30 backdrop-blur-sm transition-all duration-300 border border-white/20"
                          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
                          title={isFullscreen ? "Exit full screen (F)" : "Full screen (F)"}
                        >
                          {isFullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
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
              key={`hotspot-inline-${hotspotLightboxProduct.id}`}
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
      <PrivateTourDialog open={tourDialogOpen} onOpenChange={setTourDialogOpen} />
      {/* Render outside Dialog for non-lightbox hotspot views */}
      {!onHotspotAddToQuote && !lightboxOpen && hotspotLightboxProduct && (
        <PublicProductLightbox
          key={`hotspot-portal-${hotspotLightboxProduct.id}`}
          product={hotspotLightboxProduct}
          allPicks={allCuratorPicks.filter(p => p.brand_name === hotspotLightboxProduct?.brand_name)}
          onClose={() => setHotspotLightboxProduct(null)}
          onSelectRelated={(item) => setHotspotLightboxProduct(item)}
        />
      )}
    </>;
};
export default Gallery;