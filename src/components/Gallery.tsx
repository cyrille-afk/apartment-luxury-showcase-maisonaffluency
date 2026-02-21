import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Maximize2, Instagram } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import bedroomImage from "@/assets/master-suite.jpg";
import diningImage from "@/assets/dining-room.jpg";
import boudoirImage from "@/assets/boudoir.jpg";
import livingRoomImage from "@/assets/living-room-hero.jpg";
import bedroomAltImage from "@/assets/bedroom-alt.jpg";
import bedroomThirdImage from "@/assets/bedroom-third.jpg";
import bespokeSofaImage from "@/assets/bespoke-sofa.jpg";
import artMasterBronzeImage from "@/assets/art-master-bronze.jpg";
import bedroomSecondImage from "@/assets/bedroom-second.jpg";
import intimateDiningImage from "@/assets/intimate-dining.jpg";
import intimateTableImage from "@/assets/intimate-table-detail.jpg";
import intimateLoungeImage from "@/assets/intimate-lounge.jpg";
import smallRoomPersonalityImage from "@/assets/small-room-personality.jpg";
import smallRoomVaseImage from "@/assets/small-room-vase.jpg";
import smallRoomBedroomImage from "@/assets/small-room-bedroom.jpg";
import detailsSectionImage from "@/assets/details-section.jpg";
import detailsConsoleImage from "@/assets/details-console.jpg";
import detailsLampImage from "@/assets/details-lamp.jpg";
import homeOfficeDeskImage from "@/assets/home-office-desk.jpg";
import homeOfficeDesk2Image from "@/assets/home-office-desk-2.jpg";
import homeOffice3Image from "@/assets/home-office-3.jpg";
const galleryCategories = ["Lighting", "Seating", "Storage", "Tables", "Rugs", "Decorative Object"] as const;

const galleryExperiences = [{
  experience: "A Sociable Environment",
  subtitle: "Bespoke sofa, hand-knotted artisan rug, sculptural lighting and collectible furniture",
  categories: ["Seating", "Lighting", "Rugs", "Tables", "Decorative Object"] as string[],
  items: [{
    image: bespokeSofaImage,
    title: "An Inviting Lounge Area",
    description: "Thierry Lemaire's Niko 420 custom sofa, Atelier Février's Ricky custom rug, Poltrona Frau's Albero bookcase, Jindrich Halabala's lounge chair, Apparatus Studio's Median 3 Surface Alabaster lights, Alexander Lamont's Reef Vessels, Maarten Vrolijk's Sakura TRP 22001"
  }, {
    image: livingRoomImage,
    title: "A Sophisticated Living Room",
    description: "Thierry Lemaire Orsay Centre Table, Robicara's Sira Credenza, Jean-Michel Frank & Adolphe Chanaux' Stool 1934, Olivia Cognet's Valauris Lamp, Leo Sentou's AB armchair, Garnier & Linker lost-wax cast crystal centerpiece for Théorème Editions, Matthieu Gicquel's Texture Glass with Gold Leaf rim Géode"
  }, {
    image: diningImage,
    title: "With Panoramic Cityscape Views",
    description: "Alinea Design Objects' Angelo M table, Eric Schmitt Studio's Chairie and Cazes&Conquet's Augusta dining chairs, Emanuelle Levet Stenne's Alabaster Pendant Light, Emmanuel Babled's Limited Edition Sculptured Book Cover from his emblematic Osmosi Series"
  }]
}, {
  experience: "An Intimate Setting",
  subtitle: "Custom dining furniture, hand-blown glass pendants, sculptural seating and artisan accessories",
  categories: ["Tables", "Lighting", "Seating", "Decorative Object"] as string[],
  items: [{
    image: intimateDiningImage,
    title: "A Dreamy Tuscan Landscape",
    description: "Atelier Pendhapa's Deepah custom table, Hamrei's Pépé custom chairs, Jeremy Maxwell Wintrebert's Cloud Bulle Pendants, Milan Pekař's Crystalline Vase"
  }, {
    image: intimateTableImage,
    title: "A Highly Customised Table",
    description: "Atelier Pendhapa's Deepah custom table details, Hamrei's Pépé custom chairs details, Milan Pekař's Crystalline Vase"
  }, {
    image: intimateLoungeImage,
    title: "A Relaxed Setting",
    description: "Delcourt Collection's BOB armchair, Kiko Lopez' shadow drawings mirror, Alinea Design Objects' Angelo M side table, Takayokaya's Ojami Cushion, Milan Pekař's Crystalline Vase"
  }]
}, {
  experience: "A Personal Sanctuary",
  subtitle: "Bespoke marquetry desk, hand-blown glass chandelier, artisan suede lamp and bronze painting",
  categories: ["Lighting", "Seating", "Tables", "Decorative Object"] as string[],
  items: [{
    image: boudoirImage,
    title: "A Sophisticated Boudoir",
    description: "Bruno de Maistre's Lyric Desk, Hamrei's Pépé Chair, Made in Kira's Toshiro Lamp, Nathalie Ziegler's Custom Glass Chandelier and Gold Leaves+Glass Snake Vase, Nika Zupanc's Stardust Loveseat for Sé Collections"
  }, {
    image: bedroomSecondImage,
    title: "A Serene Decor",
    description: "Iksel's White Blossom Wallcover, Apparatus Studio's Metronome Reading Suede Floor Lamp, Nika Zupanc's Stardust Loveseat for Sé Collections"
  }, {
    image: artMasterBronzeImage,
    title: "A Design Treasure Trove",
    description: "Pierre Bonnefille's Bronze Painting 204, Alexander Lamont's Straw Marquetry Mantle Box, Baleri Italia's Marble Carved and Solid Wood Plato bookcase"
  }]
}, {
  experience: "A Calming and Dreamy Environment",
  subtitle: "Curated collectibles, hand-carved furniture and hand-knotted silk rugs",
  categories: ["Rugs", "Lighting", "Seating", "Decorative Object", "Storage"] as string[],
  items: [{
    image: bedroomImage,
    title: "A Masterful Suite",
    description: "CC-Tapis Giudecca custom rug, Celso de Lemos' Silk Bed Cover, Hervé van der Straeten's Bronze MicMac Chandelier, Iksel's Brunelleschi Perspective Wallcover"
  }, {
    image: bedroomAltImage,
    title: "Unique by Design",
    description: "Okha's Adam Court's Villa Pedestal Nightstand, Atelier DeMichelis' Limited Edition Bud Table Lamp, Pinton 1867 Custom Rug, Peter Reed's Riyad Double Faced Throw and Cushion"
  }, {
    image: bedroomThirdImage,
    title: "Design Icons and Collectibles",
    description: "Damien Langlois-Meurinne's Ooh La La Console, Haymann Editions' Carved Marble Marie Lamp, Kiko Lopez' Silver Glass Hammer Mirror, oOumm Lyra Marble Candle"
  }]
}, {
  experience: "A Small Room with Massive Personality",
  subtitle: "Bold statement pieces, artisan craftsmanship and curated collectibles",
  categories: ["Lighting", "Tables", "Decorative Object"] as string[],
  items: [{
    image: smallRoomBedroomImage,
    title: "Artistic Statement",
    description: "Felix Millory Martell Wall Lamp for Entrelacs, Apparatus Studio Lantern Table Lamp, Reda Amalou Eggshell DOT side table, Pierre Frey Kagura Headboard Fabric, Pierre Frey Natte Wallcovering, Peter Reed's Riyad Double Faced Throw"
  }, {
    image: smallRoomPersonalityImage,
    title: "Compact Elegance",
    description: "Apparatus Studio Lantern Table, Reda Amalou Eggshell DOT side table, Pierre Frey Kagura and Kasimir Fabrics, Pierre Frey Natte Wallcovering, Peter Reed's Riyad Double Faced Throw"
  }, {
    image: smallRoomVaseImage,
    title: "A Sunlit Corner",
    description: "Milan Pekař's Crystalline Vase, Peter Reed's Riyad Double Faced Throw"
  }]
}, {
  experience: "Home Office with a View",
  subtitle: "Sculptural desk, refined lighting and curated accessories for a workspace of distinction",
  categories: ["Tables", "Lighting", "Seating"] as string[],
  items: [{
    image: homeOfficeDeskImage,
    title: "A Workspace of Distinction",
    description: "Bernt Petersen 4-Drawer Executive Desk, Entrelacs Création's Kheops Bronze & Alabaster Wall Light, Mernøe N1 Pendant, Vitra Eames Soft Pad EA 219 Office Chair by Charles & Ray Eames"
  }, {
    image: homeOfficeDesk2Image,
    title: "Refined Details",
    description: "Bernt Petersen 4-Drawer Executive Desk, RoWin' Atelier's None II Table Lamp"
  }, {
    image: homeOffice3Image,
    title: "Light & Focus",
    description: "Bernt Petersen 4-Drawer Executive Desk, Vitra Eames Soft Pad EA 219 Office Chair by Charles & Ray Eames, Tristan Auer's YSA Wall Lamp for Véronèse"
  }]
}, {
  experience: "The Details Make the Design",
  subtitle: "The details are not the details. They make the design",
  categories: ["Decorative Object", "Lighting", "Storage", "Tables"] as string[],
  items: [{
    image: detailsSectionImage,
    title: "Curated Vignette",
    description: "Alexandre Lamont's Corteza Console Table, Thierry Lemaire's Kedis Lamp, Milan Pekař's small Crystalline Vase, Marcantonio Brandolini D'Adda's Vase 'Unknown N.83', Jaime Hayon's Time Piece Ceramic for Sé Collections, Jindrich Halabala's Lounge Chair in Dedar's UKIYO MONOGATARI 003, Gianfranco Frattini's Albero Bookcase for Poltrona Frau, Maarten Vrolijk's Sakura TRP 22001 Vessel"
  }, {
    image: detailsConsoleImage,
    title: "Artisan Materials",
    description: "Alexandre Lamont's Corteza Console Table featuring shagreen leather with curved bullnose edge, Marcantonio Brandolini D'Adda's Cotissi Vessel 'Unknown N.83', Milan Pekař's small Crystalline Vase"
  }, {
    image: detailsLampImage,
    title: "Light & Texture",
    description: "Noe Duchaufour Lawrance's Amber Folio Portable Lamp for Cristallerie Saint-Louis"
  }]
}];
const Gallery = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [hasTapped, setHasTapped] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [sourceItemKey, setSourceItemKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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
  const minSwipeDistance = 50;

  // Flatten all gallery items for lightbox navigation
  const allItems = useMemo(() => {
    return galleryExperiences.flatMap(section => section.items);
  }, []);

  const [externalSourceId, setExternalSourceId] = useState<string | null>(null);

  // Check for gallery index from sessionStorage (set by BrandsAteliers)
  useEffect(() => {
    const checkForGalleryIndex = () => {
      const storedIndex = sessionStorage.getItem('openGalleryIndex');
      const sourceId = sessionStorage.getItem('gallerySourceId');
      if (storedIndex !== null) {
        const index = parseInt(storedIndex, 10);
        if (!isNaN(index) && index >= 0 && index < allItems.length) {
          setCurrentImageIndex(index);
          setExternalSourceId(sourceId);
          setSourceItemKey(null); // Clear internal source
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
        setCurrentImageIndex(index);
        setExternalSourceId(e.detail.sourceId || null);
        setSourceItemKey(null); // Clear internal source
        setLightboxOpen(true);
      }
    };
    window.addEventListener('openGalleryLightbox', handleOpenLightbox as EventListener);
    return () => window.removeEventListener('openGalleryLightbox', handleOpenLightbox as EventListener);
  }, [allItems.length]);
  const openLightbox = (sectionIndex: number, itemIndex: number) => {
    // Calculate the flat index
    let flatIndex = 0;
    for (let i = 0; i < sectionIndex; i++) {
      flatIndex += galleryExperiences[i].items.length;
    }
    flatIndex += itemIndex;
    setCurrentImageIndex(flatIndex);
    setSourceItemKey(`${sectionIndex}-${itemIndex}`);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
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
    setCurrentImageIndex(prev => prev === 0 ? allItems.length - 1 : prev - 1);
  };
  const goToNext = () => {
    setCurrentImageIndex(prev => prev === allItems.length - 1 ? 0 : prev + 1);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrevious();
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "Escape") closeLightbox();
  };
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  };
  return <>
      <section id="gallery" ref={ref} className="pt-8 pb-16 px-4 md:pt-12 md:pb-24 md:px-12 lg:px-20 bg-muted/30 scroll-mt-24">
        <div className="mx-auto max-w-7xl">
          <motion.div initial={{
          opacity: 0,
          y: 30
        }} animate={isInView ? {
          opacity: 1,
          y: 0
        } : {}} transition={{
          duration: 0.8
        }} className="mb-12 md:mb-16 text-left">
            <div className="mb-2 md:mb-3">
              <p className="uppercase tracking-[0.15em] md:tracking-[0.3em] text-primary text-sm md:text-xl lg:text-2xl font-serif">
                A UNIQUELY CURATED VENUE
              </p>
            </div>
            {activeCategory && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body mb-2">
                {filteredExperiences.length} {filteredExperiences.length === 1 ? "scene" : "scenes"} · {activeCategory}
              </p>
            )}
            <h2 className="text-sm leading-relaxed md:text-3xl text-foreground text-left px-1 md:px-2 md:text-justify font-serif lg:text-lg">
              From Thierry Lemaire's Orsay Mds Centre Table to Hervé van der Straeten's MicMac Chandelier, from Hamrei's whimsical Pépé Chair to Jeremy Maxwell Wintrebert's Cloud Bulle Pendants, from Pierre Bonnefille's Bronze Painting and Stéphane CG Abstract Diasecs, Maison Affluency Singapore is a uniquely curated venue where design and art congregate
            </h2>
          </motion.div>

          {filteredExperiences.map((section, sectionIndex) => {
            // Find original index for proper lightbox mapping
            const originalSectionIndex = galleryExperiences.indexOf(section);
            return <div key={section.experience} id={originalSectionIndex === 0 ? "sociable-environment" : undefined} className={`mb-6 md:mb-10${originalSectionIndex === 0 ? " scroll-mt-24" : ""}`}>
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
                <h3 className="text-xl md:text-3xl lg:text-4xl font-serif text-primary mb-2">
                  {section.experience}
                </h3>
                <p className="text-sm md:text-base text-muted-foreground font-body italic">
                  {section.subtitle}
                </p>
              </motion.div>

              {/* Mobile: horizontal scroll strip */}
              <div
                ref={el => { scrollStripRefs.current[originalSectionIndex] = el; }}
                onScroll={() => handleStripScroll(originalSectionIndex)}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 md:hidden scrollbar-hide -mx-4 px-4"
              >
                {section.items.map((item, index) => {
                  const itemKey = `${originalSectionIndex}-${index}`;
                  return (
                    <motion.div
                      key={`${item.title}-${index}-mobile`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="relative flex-none w-[72vw] snap-start overflow-hidden rounded-sm aspect-[3/4] cursor-pointer"
                      onClick={() => openLightbox(originalSectionIndex, index)}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      {/* Eye icon — pulsing to signal tap-to-expand */}
                      <div className="absolute bottom-3 right-3 bg-black/40 backdrop-blur-sm p-1.5 rounded-full animate-pulse-fade">
                        <Maximize2 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <p className="absolute bottom-3 left-3 right-3 text-white text-xs font-body leading-snug line-clamp-2">
                        {item.title}
                      </p>
                      {index === 2 && (
                        <p className="absolute top-2 right-2 text-[8px] text-white/40 font-body tracking-wider flex items-center gap-1">
                          Photo: <a href="https://www.instagram.com/thanawatchu.maison/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-white/60 transition-colors" onClick={e => e.stopPropagation()}><Instagram className="w-3 h-3 text-[#ee2a7b]" />Thanawat Chu</a>
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Photo credit — mobile only */}
              <p className="text-[9px] text-muted-foreground/40 font-body tracking-wider mt-3 md:hidden flex items-center gap-1">
                Photo: <a href="https://www.instagram.com/thanawatchu.maison/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-muted-foreground/70 transition-colors" onClick={e => e.stopPropagation()}><Instagram className="w-2.5 h-2.5" style={{ stroke: "url(#ig-gradient-gallery)" }} />Thanawat Chu</a>
                <svg width="0" height="0"><defs><linearGradient id="ig-gradient-gallery" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#f9ce34" /><stop offset="50%" stopColor="#ee2a7b" /><stop offset="100%" stopColor="#6228d7" /></linearGradient></defs></svg>
              </p>

              {/* Dot indicators — mobile only */}
              <div className="flex justify-center gap-2 mt-2 md:hidden">
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
                      activeScrollIndices[originalSectionIndex] === dotIndex
                        ? 'w-4 h-2 bg-primary'
                        : 'w-2 h-2 bg-primary/30'
                    }`}
                  />
                ))}
              </div>

              <div className="hidden md:grid md:gap-8 md:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item, index) => {
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
                        className="relative mb-4 md:mb-6 aspect-[4/5] overflow-hidden rounded-sm"
                      >
                        <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        {/* Expand icon - opens lightbox directly */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openLightbox(originalSectionIndex, index);
                          }}
                          className="absolute bottom-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          aria-label="View full image"
                        >
                          <span className="bg-background/90 text-foreground p-2.5 rounded-full shadow-lg backdrop-blur-sm hover:bg-background transition-colors">
                            <Maximize2 className="w-4 h-4" />
                          </span>
                        </button>
                      </div>
                      {index === 2 && (
                        <p className="text-[10px] text-muted-foreground/50 font-body tracking-wider text-right mt-1 flex items-center gap-1 justify-end">
                          Photo: <a href="https://www.instagram.com/thanawatchu.maison/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-muted-foreground transition-colors"><Instagram className="w-3 h-3" style={{ stroke: "url(#ig-gradient-gallery)" }} />Thanawat Chu</a>
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>;
          })}
        </div>
      </section>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none" onKeyDown={handleKeyDown} aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>{allItems[currentImageIndex]?.title || 'Gallery Image'}</DialogTitle>
          </VisuallyHidden>
          <div className="relative w-full h-full flex items-center justify-center" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            {/* Close button */}
            <button onClick={closeLightbox} className="absolute top-4 right-4 z-50 p-2 bg-background/20 hover:bg-background/40 rounded-full transition-colors" aria-label="Close lightbox">
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Previous button */}
            <button onClick={goToPrevious} className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" aria-label="Previous image">
              <ChevronLeft className="h-8 w-8 text-white" />
            </button>

            {/* Image container */}
            <div className="flex flex-col items-center justify-center max-w-[90vw] max-h-[85vh] px-16">
              <img src={allItems[currentImageIndex]?.image} alt={allItems[currentImageIndex]?.title} className="max-w-full max-h-[70vh] object-contain" />
              <div className="mt-4 text-center">
                <h3 className="text-xl md:text-2xl font-serif text-white mb-2">
                  {allItems[currentImageIndex]?.title}
                </h3>
                <p className="text-sm md:text-base text-white/70 font-body max-w-2xl">
                  {allItems[currentImageIndex]?.description}
                </p>
                <p className="text-xs text-white/50 mt-3 font-body">
                  {currentImageIndex + 1} / {allItems.length}
                </p>
              </div>
            </div>

            {/* Next button */}
            <button onClick={goToNext} className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" aria-label="Next image">
              <ChevronRight className="h-8 w-8 text-white" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>;
};
export default Gallery;