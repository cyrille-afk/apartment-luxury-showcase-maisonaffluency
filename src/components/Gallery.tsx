import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ChevronDown, X, Maximize2, Minimize2, Instagram, Copy } from "lucide-react";
import PinchZoomImage from "./PinchZoomImage";
import PinchHint from "./PinchHint";
import GalleryHotspots from "./GalleryHotspots";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cloudinaryUrl, cloudinarySrcSet } from "@/lib/cloudinary";

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
const sunLitReadingImage = g("IMG_2402_y3atdm");
const artMasterBronzeImage = g("art-master-bronze_hf6bad");
const detailsConsoleImage = g("details-console_hk6uxt");
const intimateDiningImage = g("intimate-dining_ux4pee");
const intimateTableImage = g("intimate-table-detail_aqxvvm");
const intimateLoungeImage = g("intimate-lounge_tf4sm1");
const smallRoomPersonalityImage = g("small-room-personality_wvxz6y");
const smallRoomVaseImage = g("small-room-vase_s3nz5o");
const smallRoomBedroomImage = g("small-room-bedroom_mp8mdd");
const detailsSectionImage = g("details-section_u6rwbu");
const detailsLampImage = g("details-lamp_clzcrk");
const detailsConsole4Image = g("AffluencySG_204_1_qbbpqb");
const smallRoomChairImage = g("small-room-chair_aobzyb");
const homeOfficeDeskImage = g("home-office-desk_g0ywv2");
const homeOfficeDesk2Image = g("home-office-desk-2_gb1nlb");
const homeOffice3Image = g("home-office-3_t39msw");
const officeBooksCornerImage = g("AffluencySG_143_1_f9iihg");
const galleryCategories = ["Lighting", "Seating", "Storage", "Tables", "Rugs", "Decorative Object"] as const;

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

const Gallery = () => {
  const isMobile = useIsMobile();
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const imageZoomedRef = useRef(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [hasTapped, setHasTapped] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sourceItemKey, setSourceItemKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState<3 | 4>(3);

  // Pulsing hotspot hint — show once per session on the first hotspot section image
  const [showHotspotHint, setShowHotspotHint] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("__hotspot_hint_seen");
  });
  const hotspotHintRef = useRef<HTMLDivElement>(null);
  const [hintVisible, setHintVisible] = useState(false);

  // Only start the dismiss timer once the hint is actually visible on screen
  useEffect(() => {
    if (!showHotspotHint) return;
    const el = hotspotHintRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHintVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [showHotspotHint]);

  useEffect(() => {
    if (!hintVisible) return;
    const timer = setTimeout(() => {
      setShowHotspotHint(false);
      sessionStorage.setItem("__hotspot_hint_seen", "1");
    }, 6000);
    return () => clearTimeout(timer);
  }, [hintVisible]);

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

  // Check for gallery index from sessionStorage (set by BrandsAteliers)
  useEffect(() => {
    const checkForGalleryIndex = () => {
      const storedIndex = sessionStorage.getItem('openGalleryIndex');
      const sourceId = sessionStorage.getItem('gallerySourceId');
      if (storedIndex !== null) {
        const index = parseInt(storedIndex, 10);
        if (!isNaN(index) && index >= 0 && index < allItems.length) {
          const { sectionIndex, itemIndex } = flatIndexToSectionItem(index);
          setCurrentSectionIndex(sectionIndex);
          setCurrentItemIndex(itemIndex);
          setExternalSourceId(sourceId);
          setSourceItemKey(null);
          setLightboxOpen(true);
        }
        sessionStorage.removeItem('openGalleryIndex');
        sessionStorage.removeItem('gallerySourceId');
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
    }>) => {
      const index = e.detail.index;
      if (index >= 0 && index < allItems.length) {
        const { sectionIndex, itemIndex } = flatIndexToSectionItem(index);
        setCurrentSectionIndex(sectionIndex);
        setCurrentItemIndex(itemIndex);
        setExternalSourceId(e.detail.sourceId || null);
        setSourceItemKey(null);
        setLightboxOpen(true);
      }
    };
    window.addEventListener('openGalleryLightbox', handleOpenLightbox as EventListener);
    return () => window.removeEventListener('openGalleryLightbox', handleOpenLightbox as EventListener);
  }, [allItems.length]);
  const openLightbox = (sectionIndex: number, itemIndex: number) => {
    setCurrentSectionIndex(sectionIndex);
    setCurrentItemIndex(itemIndex);
    setSourceItemKey(`${sectionIndex}-${itemIndex}`);
    imageZoomedRef.current = false;
    setImageZoomed(false);
    // Auto-expand for sections without descriptions (e.g. "A Sociable Environment" uses hotspots)
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
    // Scroll back to the source item after closing
    if (externalSourceId) {
      setTimeout(() => {
        const element = document.getElementById(externalSourceId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setExternalSourceId(null);
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
  const goToPrevious = () => {
    setCurrentItemIndex(prev => prev === 0 ? currentSectionItems.length - 1 : prev - 1);
  };
  const goToNext = () => {
    setCurrentItemIndex(prev => prev === currentSectionItems.length - 1 ? 0 : prev + 1);
  };
  // Swipe detection via native listeners to avoid interfering with PinchZoomImage
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const swipeTouchStart = useRef<number | null>(null);
  const swipeTouchEnd = useRef<number | null>(null);


  useEffect(() => {
    if (!lightboxOpen) return;
    const el = swipeContainerRef.current;
    if (!el) return;

    const handleSwipeStart = (e: TouchEvent) => {
      if (imageZoomedRef.current) return;
      if (e.touches.length > 1) return;
      swipeTouchEnd.current = null;
      swipeTouchStart.current = e.touches[0].clientX;
    };
    const handleSwipeMove = (e: TouchEvent) => {
      if (imageZoomedRef.current) return;
      if (e.touches.length > 1) return;
      swipeTouchEnd.current = e.touches[0].clientX;
    };
    const handleSwipeEnd = (e: TouchEvent) => {
      if (imageZoomedRef.current) return;
      if (swipeTouchStart.current === null) return;
      const endX = swipeTouchEnd.current ?? e.changedTouches?.[0]?.clientX ?? null;
      if (endX === null) return;
      const distance = swipeTouchStart.current - endX;
      if (distance > minSwipeDistance) goToNext();
      else if (distance < -minSwipeDistance) goToPrevious();
      swipeTouchStart.current = null;
      swipeTouchEnd.current = null;
    };

    el.addEventListener("touchstart", handleSwipeStart, { passive: true });
    el.addEventListener("touchmove", handleSwipeMove, { passive: true });
    el.addEventListener("touchend", handleSwipeEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleSwipeStart);
      el.removeEventListener("touchmove", handleSwipeMove);
      el.removeEventListener("touchend", handleSwipeEnd);
    };
  }, [lightboxOpen]);
  return <>
      <section id="gallery" ref={ref} className="pt-0 pb-16 px-4 md:pt-0 md:pb-24 md:px-12 lg:px-20 bg-muted/30 scroll-mt-24">
        <div className="mx-auto max-w-7xl">
          <motion.div initial={{
          opacity: 0,
          y: 30
        }} animate={isInView ? {
          opacity: 1,
          y: 0
        } : {}} transition={{
          duration: 0.8
        }} className="mb-6 md:mb-10">
            {activeCategory && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body mb-2">
                {filteredExperiences.length} {filteredExperiences.length === 1 ? "scene" : "scenes"} · {activeCategory}
              </p>
            )}
            <h2 className="hidden md:block text-base md:text-base lg:text-lg leading-relaxed text-foreground text-justify font-serif">
              This experiential residence represents a harmonious dialogue between Eastern aesthetics and Western modernism.<br />Each space has been thoughtfully crafted to showcase the interplay of texture, light, and artisanal craftsmanship.
            </h2>
          </motion.div>

          {(() => {
            const firstHotspotSectionIdx = galleryExperiences.findIndex(s => !s.items.some(i => i.description));
            return filteredExperiences.map((section, sectionIndex) => {
            // Find original index for proper lightbox mapping
            const originalSectionIndex = galleryExperiences.indexOf(section);
            return <div key={section.experience} className={`mb-6 md:mb-10 ${originalSectionIndex === 0 ? 'pt-6 md:pt-0' : ''}`}>
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
                <div className="flex items-center justify-between">
                  <h3 className="text-xl md:text-2xl lg:text-2xl font-serif text-foreground md:text-primary mb-2">
                    {section.experience}
                  </h3>
                  {originalSectionIndex === 0 && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setGridCols(gridCols === 3 ? 4 : 3)}
                            className="hidden md:flex items-center p-1.5 rounded transition-all hover:opacity-70"
                            aria-label={`Switch to ${gridCols === 3 ? 4 : 3} column grid`}
                          >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                              {gridCols === 3 ? (
                                <>
                                  <rect x="4" y="3" width="4" height="18" rx="1" fill="black" />
                                  <rect x="10" y="3" width="4" height="18" rx="1" fill="black" />
                                  <rect x="16" y="3" width="4" height="18" rx="1" fill="black" />
                                </>
                              ) : (
                                <>
                                  <rect x="2" y="3" width="4" height="18" rx="1" fill="black" />
                                  <rect x="7.5" y="3" width="4" height="18" rx="1" fill="black" />
                                  <rect x="13" y="3" width="4" height="18" rx="1" fill="black" />
                                  <rect x="18.5" y="3" width="4" height="18" rx="0.5" fill="black" />
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
                  )}
                </div>
                <p className="hidden md:block text-sm md:text-base text-muted-foreground font-body italic">
                  {section.subtitle}
                </p>
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
                          {/* Pulsing hotspot hint — first image of first hotspot section only */}
                          {isHotspotSection && index === 0 && originalSectionIndex === firstHotspotSectionIdx && showHotspotHint && (
                            <div ref={hotspotHintRef} className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                              {/* Pulsing dot + rings */}
                              <div className="relative flex items-center justify-center">
                                <span className="absolute w-14 h-14 rounded-full bg-primary/20 animate-ping" />
                                <span className="absolute w-10 h-10 rounded-full bg-primary/25 animate-pulse" />
                                <span className="relative block w-5 h-5 rounded-full bg-black/70 border-[2.5px] border-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]" />
                              </div>
                              {/* Label */}
                              <span
                                className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white text-sm font-body font-medium tracking-wide bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full whitespace-nowrap animate-fade-in shadow-lg"
                              >
                                Tap to explore products
                              </span>
                            </div>
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
                    <h4 className="font-serif text-foreground text-base mt-3 px-1">
                      {section.items[activeIdx]?.title}
                    </h4>
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

              <div className={`hidden md:grid md:gap-8 md:grid-cols-2 ${gridCols === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} transition-all duration-300`}>
                {(gridCols === 3 ? section.items.slice(0, 3) : section.items).map((item, index) => {
                  const itemKey = `${originalSectionIndex}-${index}`;
                  const isExpanded = expandedItem === itemKey;

                  return (
                    <motion.div
                      key={`${item.title}-${index}`}
                      id={`gallery-item-${itemKey}`}
                      initial={{ opacity: 0, y: 40 }}
                      animate={isInView ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.6, delay: originalSectionIndex * 0.2 + index * 0.1 }}
                      className="group cursor-pointer"
                    >
                      <div
                        className="relative mb-2 aspect-[4/5] overflow-hidden rounded-sm"
                        onClick={() => openLightbox(originalSectionIndex, index)}
                      >
                        <img src={item.image} alt={`${item.title} — ${section.experience} | Maison Affluency curated luxury interiors`} sizes={gridCols === 4 ? "(max-width: 1024px) 50vw, 25vw" : "(max-width: 1024px) 50vw, 33vw"} className="h-full w-full object-cover brightness-[1.05] contrast-[1.08] saturate-[1.05] transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        {/* Pulsing hotspot hint — desktop: first image of first hotspot section */}
                        {!section.items.some(i => i.description) && index === 0 && originalSectionIndex === firstHotspotSectionIdx && showHotspotHint && (
                          <div ref={hotspotHintRef} className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
                            <div className="relative">
                              <span className="absolute -inset-3 rounded-full bg-primary/30 animate-ping" />
                              <span className="relative block w-3 h-3 rounded-full bg-black/70 border-2 border-primary/70 shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
                            </div>
                            <span className="absolute bottom-16 left-1/2 -translate-x-1/2 text-white/90 text-xs font-body tracking-wide bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full whitespace-nowrap animate-fade-in">
                              Click to explore products
                            </span>
                          </div>
                        )}
                        {/* Expand icon - opens lightbox directly */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openLightbox(originalSectionIndex, index);
                          }}
                          className="absolute bottom-2 left-2 md:bottom-4 md:left-auto md:right-4 flex opacity-100 transition-opacity duration-300"
                          aria-label="View full image"
                        >
                          <span className={`bg-black/60 text-white rounded-full shadow-lg backdrop-blur-sm hover:bg-black/80 transition-all duration-300 ${gridCols === 4 ? 'p-1.5' : 'p-1.5 md:p-2'}`}>
                            <Maximize2 className={`w-3 h-3 ${gridCols === 4 ? '' : 'md:w-3.5 md:h-3.5'}`} />
                          </span>
                        </button>
                      </div>
                      <div className="mb-4 md:mb-6">
                        <h4 className={`font-serif text-foreground group-hover:text-primary transition-colors duration-300 ${gridCols === 4 ? 'text-sm' : 'text-base'}`}>
                          {item.title}
                        </h4>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
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
                             />
                           )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Close button — bottom-left of image area */}
                  <button
                    onClick={closeLightbox}
                    className="absolute bottom-2 left-3 z-50 p-1.5 bg-black/60 backdrop-blur-sm rounded-full"
                    aria-label="Close lightbox"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>

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
               className="relative w-full h-full flex items-center justify-center"
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
                      />
                      {/* Close button — desktop: near image */}
                      <button
                        onClick={closeLightbox}
                        className={`hidden md:flex absolute z-50 p-2.5 rounded-full bg-white/15 text-white/85 hover:text-white hover:bg-white/30 backdrop-blur-sm transition-all duration-300 border border-white/20 ${isExpanded ? 'bottom-2 -right-12 lg:-right-14' : 'bottom-2 -right-12 lg:-right-14'}`}
                        aria-label="Close lightbox"
                      >
                        <X className="h-5 w-5" />
                      </button>
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
                  {/* Dot indicators */}
                  <div className="flex justify-center gap-1.5 mt-1.5 shrink-0">
                    {currentSectionItems.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentItemIndex(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentItemIndex ? 'bg-white' : 'bg-white/40'}`}
                        aria-label={`Go to image ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="pb-6" />
                </ExpandedScrollContainer>

               {/* Next button */}
               <button onClick={goToNext} className="hidden md:flex absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-50 text-white/50 hover:text-white transition-colors" aria-label="Next image">
                 <ChevronRight className="h-8 w-8" />
               </button>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </>;
};
export default Gallery;