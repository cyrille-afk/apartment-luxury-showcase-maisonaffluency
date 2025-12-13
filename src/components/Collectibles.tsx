import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Instagram, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Star, X, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Designer images
import atelierDemichelisImg from "@/assets/designers/atelier-demichelis.jpg";
import kikoLopezImg from "@/assets/designers/kiko-lopez.jpg";
import nathalieZieglerImg from "@/assets/designers/nathalie-ziegler.jpg";

// Curators' Picks images
import demichelisPick1 from "@/assets/curators-picks/demichelis-1.jpg";
import demichelisPick2 from "@/assets/curators-picks/demichelis-2.jpg";
import demichelisPick3 from "@/assets/curators-picks/demichelis-3.jpg";
import demichelisPick4 from "@/assets/curators-picks/demichelis-4.jpg";

const collectibleDesigners = [
  {
    id: "atelier-demichelis",
    name: "Atelier Demichelis",
    founder: "Laura Demichelis",
    specialty: "Limited Edition Lighting & Artisan Craftsmanship",
    image: atelierDemichelisImg,
    biography:
      "Atelier Demichelis is a contemporary design studio specializing in limited edition lighting fixtures. Each piece is meticulously handcrafted, combining traditional techniques with innovative design.",
    philosophy: "We create lighting that elevates everyday moments into experiences of beauty and contemplation.",
    curatorPicks: [
      { 
        image: demichelisPick1, 
        title: "Babel Table Lamp", 
        category: "Lighting",
        materials: "Bronze • Brass • Ash wood • White fabric shade",
        dimensions: "Ø45 × H60.9 cm",
        edition: "Numbered edition of 20"
      },
      { 
        image: demichelisPick4, 
        title: "Echo Floor Lamp", 
        category: "Lighting",
        materials: "Patinated and varnished brass",
        dimensions: "Ø38 × H166 cm",
        edition: "Numbered edition of 20"
      },
      { 
        image: demichelisPick2, 
        title: "Bud Table Lamp", 
        category: "Lighting",
        materials: "Bronze • White oak • Hand-made fabric shade",
        dimensions: "Ø40 × H71 cm",
        edition: "Numbered edition of 20"
      },
      { 
        image: demichelisPick3, 
        title: "Table d'appoint RHINO", 
        category: "Furniture",
        materials: "Patinated bronze • Raw brass • Brown cowhide leather top",
        dimensions: "H43.5 × L35 cm",
        edition: "Numbered edition of 8 + 2 APs"
      },
    ],
    instagram: "https://instagram.com/atelier_demichelis",
  },
  {
    id: "kiko-lopez",
    name: "Kiko Lopez",
    specialty: "Artisan Mirrors & Reflective Surfaces",
    image: kikoLopezImg,
    biography:
      "Kiko Lopez is a French master mirror artisan renowned for creating extraordinary reflective surfaces that blur the line between functional object and sculptural art.",
    philosophy: "A mirror is not merely a reflection—it is a portal that transforms light and space into something magical.",
    curatorPicks: [
      { 
        image: kikoLopezImg,
        title: "Silver Glass Hammer Mirror", 
        category: "Mirrors",
        materials: "Hand-silvered glass • Hammered texture",
        dimensions: "H120 × W80 cm",
        edition: "Unique Piece"
      },
      { 
        image: kikoLopezImg,
        title: "Shadow Drawings Mirror", 
        category: "Mirrors",
        materials: "Antiqued glass • Bronze patina frame",
        dimensions: "H100 × W70 cm",
        edition: "Limited Edition"
      },
      { 
        image: kikoLopezImg,
        title: "Antiqued Console Mirror", 
        category: "Mirrors",
        materials: "Hand-antiqued glass • Sculptural frame",
        dimensions: "H150 × W60 cm",
        edition: "Numbered & Signed"
      },
      { 
        image: kikoLopezImg,
        title: "Reflective Sculpture", 
        category: "Decorative Objects",
        materials: "Mercury glass • Hand-formed",
        dimensions: "H45 × W30 × D15 cm",
        edition: "Unique Piece"
      },
    ],
    instagram: "https://instagram.com/kikolumieres",
  },
  {
    id: "nathalie-ziegler",
    name: "Nathalie Ziegler",
    specialty: "Bespoke Glass Art & Chandeliers",
    image: nathalieZieglerImg,
    biography:
      "Nathalie Ziegler is a French glass artist known for her custom chandeliers and glass sculptures that blur the line between functional lighting and fine art.",
    philosophy:
      "Glass is alive—it captures and transforms light, creating an ever-changing dialogue with its environment.",
    curatorPicks: [
      { 
        image: nathalieZieglerImg,
        title: "Saint Just Custom Glass Chandelier", 
        category: "Lighting",
        materials: "Hand-blown glass • Brass armature",
        dimensions: "Ø120 × H80 cm",
        edition: "Bespoke Commission"
      },
      { 
        image: nathalieZieglerImg,
        title: "Gold Leaves + Glass Snake Vase", 
        category: "Decorative Objects",
        materials: "Hand-blown glass • Gold leaf accents",
        dimensions: "H55 × Ø25 cm",
        edition: "Limited Edition"
      },
      { 
        image: nathalieZieglerImg,
        title: "Amber Cascade Pendant", 
        category: "Lighting",
        materials: "Amber glass • Hand-formed droplets",
        dimensions: "Ø60 × H90 cm",
        edition: "Numbered & Signed"
      },
      { 
        image: nathalieZieglerImg,
        title: "Crystal Wave Sconce", 
        category: "Lighting",
        materials: "Clear glass • Sculptural form",
        dimensions: "H40 × W35 × D20 cm",
        edition: "Limited Edition"
      },
    ],
    instagram: "https://instagram.com/nathaliezieglerpasqua",
  },
];

const Collectibles = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeDesigner, setActiveDesigner] = useState(0);
  const [activePickIndex, setActivePickIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const minSwipeDistance = 50;

  const currentDesigner = collectibleDesigners[activeDesigner];
  const currentPicks = currentDesigner?.curatorPicks || [];

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    setIsZoomed(false);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setIsZoomed(false);
  };

  const goToPrevious = () => {
    setLightboxIndex(prev => prev === 0 ? currentPicks.length - 1 : prev - 1);
    setIsZoomed(false);
  };

  const goToNext = () => {
    setLightboxIndex(prev => prev === currentPicks.length - 1 ? 0 : prev + 1);
    setIsZoomed(false);
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
    if (distance > minSwipeDistance) goToNext();
    else if (distance < -minSwipeDistance) goToPrevious();
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setIsZoomed(!isZoomed);
    }
    lastTapRef.current = now;
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      setActivePickIndex(prev => Math.max(0, prev - 1));
    } else {
      setActivePickIndex(prev => Math.min(currentPicks.length - 1, prev + 1));
    }
  };

  return (
    <>
      <section id="collectibles" ref={ref} className="py-10 px-4 md:py-24 md:px-12 lg:px-20 bg-background scroll-mt-24">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="mb-8 md:mb-12 text-left"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground mb-4">
              Collectibles
            </h2>
            <p className="text-base md:text-lg text-muted-foreground font-body max-w-3xl">
              Limited Editions & Unique Pieces
            </p>
          </motion.div>

          {/* Designer Tabs - Horizontal scroll on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8 md:mb-12"
          >
            <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
              {collectibleDesigners.map((designer, index) => (
                <button
                  key={designer.id}
                  onClick={() => {
                    setActiveDesigner(index);
                    setActivePickIndex(0);
                  }}
                  className={`flex-shrink-0 group relative overflow-hidden rounded-xl transition-all duration-500 ${
                    activeDesigner === index 
                      ? 'ring-2 ring-primary shadow-lg scale-[1.02]' 
                      : 'ring-1 ring-border/40 hover:ring-primary/60 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="relative w-28 h-28 md:w-36 md:h-36">
                    <img
                      src={designer.image}
                      alt={designer.name}
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 ${
                      activeDesigner === index ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'
                    }`} />
                    <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                      <p className="text-white text-xs md:text-sm font-serif leading-tight">
                        {designer.name}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Featured Designer Hero Section */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentDesigner.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="mb-8 md:mb-12"
            >
              {/* Hero Card */}
              <div className="relative rounded-2xl overflow-hidden bg-card/50 border border-border/40">
                <div className="grid md:grid-cols-2 gap-0">
                  {/* Left: Designer Info */}
                  <div className="p-6 md:p-10 lg:p-12 flex flex-col justify-center order-2 md:order-1">
                    <div className="flex items-center gap-3 mb-4">
                      {currentDesigner.instagram && (
                        <a
                          href={currentDesigner.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 transition-transform duration-300 hover:scale-110"
                          aria-label="Instagram"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="url(#instagram-gradient-collectibles)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <defs>
                              <linearGradient id="instagram-gradient-collectibles" x1="0%" y1="100%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#f09433" />
                                <stop offset="25%" stopColor="#e6683c" />
                                <stop offset="50%" stopColor="#dc2743" />
                                <stop offset="75%" stopColor="#cc2366" />
                                <stop offset="100%" stopColor="#bc1888" />
                              </linearGradient>
                            </defs>
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                          </svg>
                        </a>
                      )}
                      <span className="text-xs uppercase tracking-wider text-primary font-body">
                        {currentDesigner.specialty}
                      </span>
                    </div>
                    
                    <h3 className="text-2xl md:text-3xl lg:text-4xl font-serif text-foreground mb-4">
                      {currentDesigner.name}
                    </h3>
                    
                    <p className="text-sm md:text-base text-muted-foreground font-body leading-relaxed mb-6">
                      {currentDesigner.biography}
                    </p>
                    
                    <p className="text-sm font-body italic text-primary/80 mb-6">
                      "{currentDesigner.philosophy}"
                    </p>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-body">
                      <Star size={16} className="text-accent fill-accent" />
                      <span>{currentPicks.length} Limited Editions Available</span>
                    </div>
                  </div>

                  {/* Right: Featured Image */}
                  <div className="relative h-64 md:h-auto md:min-h-[400px] order-1 md:order-2">
                    <img
                      src={currentPicks[0]?.image || currentDesigner.image}
                      alt={currentDesigner.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-card/20 hidden md:block" />
                    
                    {/* Featured piece badge */}
                    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 bg-black/70 backdrop-blur-sm rounded-lg p-3 md:p-4">
                      <p className="text-[10px] uppercase tracking-wider text-white/60 mb-1">Featured Piece</p>
                      <p className="text-sm md:text-base font-serif text-white">{currentPicks[0]?.title}</p>
                      <p className="text-xs text-white/70 mt-1">{currentPicks[0]?.edition}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Pieces Carousel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg md:text-xl font-serif text-foreground">
                Curated Collection
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => scrollCarousel('left')}
                  disabled={activePickIndex === 0}
                  className="p-2 rounded-full bg-card/50 border border-border/40 hover:bg-card hover:border-primary/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous pieces"
                >
                  <ChevronLeft className="h-4 w-4 text-foreground" />
                </button>
                <button
                  onClick={() => scrollCarousel('right')}
                  disabled={activePickIndex >= currentPicks.length - 1}
                  className="p-2 rounded-full bg-card/50 border border-border/40 hover:bg-card hover:border-primary/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next pieces"
                >
                  <ChevronRight className="h-4 w-4 text-foreground" />
                </button>
              </div>
            </div>

            {/* Carousel */}
            <div className="relative overflow-hidden">
              <motion.div 
                className="flex gap-4 md:gap-6"
                animate={{ x: `-${activePickIndex * (280 + 16)}px` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {currentPicks.map((pick, index) => (
                  <motion.div
                    key={`${currentDesigner.id}-${index}`}
                    className="flex-shrink-0 w-[280px] md:w-[320px] group cursor-pointer"
                    whileHover={{ y: -4 }}
                    onClick={() => openLightbox(index)}
                  >
                    <div className="relative aspect-[4/5] rounded-xl overflow-hidden mb-3 bg-muted/20">
                      <img
                        src={pick.image}
                        alt={pick.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm rounded-full p-3">
                          <ArrowRight className="h-5 w-5 text-foreground" />
                        </div>
                      </div>
                      <div className="absolute top-3 left-3">
                        <span className="inline-block px-2 py-1 text-[10px] uppercase tracking-wider font-body bg-black/60 backdrop-blur-sm text-white rounded-full">
                          {pick.category}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h5 className="font-serif text-base md:text-lg text-foreground group-hover:text-primary transition-colors">
                        {pick.title}
                      </h5>
                      <p className="text-xs text-muted-foreground font-body mt-1">
                        {pick.edition}
                      </p>
                      <p className="text-xs text-muted-foreground/70 font-body mt-1 line-clamp-1">
                        {pick.materials}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Carousel Indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {currentPicks.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActivePickIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === activePickIndex 
                      ? 'w-8 bg-primary' 
                      : 'w-1.5 bg-border hover:bg-primary/50'
                  }`}
                  aria-label={`Go to piece ${index + 1}`}
                />
              ))}
            </div>
          </motion.div>

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 text-center"
          >
            <p className="text-sm text-muted-foreground font-body">
              For further details, please request our catalogue at{" "}
              <a 
                href="mailto:concierge@myaffluency.com" 
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                concierge@myaffluency.com
              </a>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none" 
          onKeyDown={handleKeyDown}
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>
              {currentDesigner?.name} - {currentPicks[lightboxIndex]?.title}
            </DialogTitle>
          </VisuallyHidden>
          
          {currentPicks.length > 0 && (
            <div 
              className="relative w-full h-full flex items-center justify-center"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Close button */}
              <button 
                onClick={closeLightbox} 
                className="absolute top-4 right-4 z-50 p-2 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                aria-label="Close lightbox"
              >
                <X className="h-6 w-6 text-white" />
              </button>

              {/* Previous button */}
              {currentPicks.length > 1 && (
                <button 
                  onClick={goToPrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8 text-white" />
                </button>
              )}

              {/* Image container */}
              <div className={`flex flex-col items-center justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 ${isZoomed ? 'max-h-[95vh] pb-4' : 'max-h-[85vh] pb-24'}`}>
                <div 
                  className={`relative overflow-auto transition-all duration-300 ${isZoomed ? 'max-h-[85vh]' : ''}`}
                  onClick={handleDoubleTap}
                >
                  <img 
                    src={currentPicks[lightboxIndex]?.image} 
                    alt={currentPicks[lightboxIndex]?.title} 
                    className={`object-contain transition-all duration-300 select-none ${isZoomed ? 'max-w-none w-[150vw] md:w-auto md:max-w-full md:max-h-[80vh]' : 'max-w-full max-h-[55vh]'}`}
                    draggable={false}
                  />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsZoomed(!isZoomed);
                    }}
                    className={`absolute bottom-3 left-3 md:right-3 md:left-auto p-2 bg-black/40 backdrop-blur-sm rounded-full transition-all duration-300 hover:bg-black/60 cursor-pointer ${isZoomed ? 'opacity-70' : 'opacity-70 hover:opacity-100'}`}
                    aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                  >
                    {isZoomed ? (
                      <ZoomOut className="h-5 w-5 text-white" />
                    ) : (
                      <ZoomIn className="h-5 w-5 text-white" />
                    )}
                  </button>
                </div>
                <div className={`mt-2 text-center transition-all duration-300 ${isZoomed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {currentPicks[lightboxIndex]?.category && (
                      <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
                        {currentPicks[lightboxIndex].category}
                      </span>
                    )}
                    {currentPicks[lightboxIndex]?.edition && (
                      <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
                        {currentPicks[lightboxIndex].edition}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm md:text-base font-serif text-white mb-1">
                    {currentPicks[lightboxIndex]?.title}
                  </h3>
                  {(currentPicks[lightboxIndex]?.materials || currentPicks[lightboxIndex]?.dimensions) && (
                    <div className="mt-2 max-w-xl space-y-1">
                      {currentPicks[lightboxIndex]?.materials && (
                        <p className="text-xs md:text-sm text-white/60 font-body">
                          {currentPicks[lightboxIndex].materials}
                        </p>
                      )}
                      {currentPicks[lightboxIndex]?.dimensions && (
                        <p className="text-xs md:text-sm text-white/40 font-body italic">
                          {currentPicks[lightboxIndex].dimensions}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="mt-12 text-xs text-white font-body italic">
                    For further details, please request our catalogue at{" "}
                    <a href="mailto:concierge@myaffluency.com" className="underline hover:text-white/80 transition-colors">
                      concierge@myaffluency.com
                    </a>
                  </p>
                </div>
              </div>

              {/* Next button */}
              {currentPicks.length > 1 && (
                <button 
                  onClick={goToNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                  aria-label="Next image"
                >
                  <ChevronRight className="h-8 w-8 text-white" />
                </button>
              )}

              {/* Thumbnail navigation */}
              {currentPicks.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  <TooltipProvider>
                    {currentPicks.map((pick, idx) => (
                      <Tooltip key={idx}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setLightboxIndex(idx);
                              setIsZoomed(false);
                            }}
                            className={`w-10 h-10 md:w-12 md:h-12 rounded overflow-hidden transition-all duration-300 ${
                              idx === lightboxIndex 
                                ? 'ring-2 ring-white scale-105' 
                                : 'ring-1 ring-white/30 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={pick.image}
                              alt={pick.title}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{pick.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Collectibles;
