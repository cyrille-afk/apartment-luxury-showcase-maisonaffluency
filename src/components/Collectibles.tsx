import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Instagram, ChevronDown, ExternalLink, Star, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
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
      "Atelier Demichelis is a contemporary design studio specializing in limited edition lighting fixtures. Each piece is meticulously handcrafted, combining traditional techniques with innovative design. Their Bud Table Lamp represents their commitment to creating functional art objects with exceptional attention to detail.",
    notableWorks: "Limited Edition Bud Table Lamp, Artisan Lighting Collection",
    philosophy: "We create lighting that elevates everyday moments into experiences of beauty and contemplation.",
    curatorPicks: [
      { 
        image: demichelisPick1, 
        title: "Babel Table Lamp", 
        category: "Lighting",
        materials: "Bronze • Brass • Ash wood • White fabric shade",
        dimensions: "Ø45 × H60.9 cm"
      },
      { 
        image: demichelisPick4, 
        title: "Echo Floor Lamp", 
        category: "Lighting",
        materials: "Patinated and varnished brass",
        dimensions: "Ø38 × H166 cm"
      },
      { 
        image: demichelisPick2, 
        title: "Bud Table Lamp", 
        category: "Lighting",
        materials: "Bronze • White oak • Hand-made fabric shade",
        dimensions: "Ø40 × H71 cm"
      },
      { 
        image: demichelisPick3, 
        title: "Table d'appoint RHINO", 
        category: "Furniture",
        materials: "Patinated bronze • Raw brass • Brown cowhide leather top",
        dimensions: "H43.5 × L35 cm"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/atelier_demichelis" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "kiko-lopez",
    name: "Kiko Lopez",
    specialty: "Artisan Mirrors & Reflective Surfaces",
    image: kikoLopezImg,
    biography:
      "Kiko Lopez is a French master mirror artisan renowned for creating extraordinary reflective surfaces that blur the line between functional object and sculptural art. Using traditional techniques combined with innovative approaches to glass and metal, his mirrors transform spaces with their unique textural qualities and light-capturing properties. His Silver Glass Hammer Mirror and Shadow Drawings Mirror exemplify his distinctive style of treating mirrors as artistic statements.",
    notableWorks: "Silver Glass Hammer Mirror, Shadow Drawings Mirror, Antiqued Mirror Collection, Sculptural Reflective Surfaces",
    philosophy: "A mirror is not merely a reflection—it is a portal that transforms light and space into something magical.",
    links: [
      { type: "Instagram", url: "https://instagram.com/kikolumieres" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "nathalie-ziegler",
    name: "Nathalie Ziegler",
    specialty: "Bespoke Glass Art & Chandeliers",
    image: nathalieZieglerImg,
    biography:
      "Nathalie Ziegler is a French glass artist known for her custom chandeliers and glass sculptures that blur the line between functional lighting and fine art. Her Saint Just Custom Glass Chandelier showcases her ability to manipulate glass into dramatic, ethereal forms that transform spaces with light and color.",
    notableWorks: "Saint Just Custom Glass Chandelier, Gold Leaves+Glass Snake Vase, Sculptural Glass Series",
    philosophy:
      "Glass is alive—it captures and transforms light, creating an ever-changing dialogue with its environment.",
    links: [
      { type: "Instagram", url: "https://instagram.com/nathaliezieglerpasqua" },
      { type: "Curators' Picks" },
    ],
  },
];

const Collectibles = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [selectedImage, setSelectedImage] = useState<{ name: string; image: string } | null>(null);
  const [openDesigners, setOpenDesigners] = useState<string[]>([]);
  const [curatorPicksDesigner, setCuratorPicksDesigner] = useState<typeof collectibleDesigners[0] | null>(null);
  const [curatorPickIndex, setCuratorPickIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const minSwipeDistance = 50;

  const allDesignerIds = collectibleDesigners.map(d => d.id);
  const isAllExpanded = openDesigners.length === allDesignerIds.length;

  const toggleAllDesigners = () => {
    if (isAllExpanded) {
      setOpenDesigners([]);
    } else {
      setOpenDesigners(allDesignerIds);
    }
  };

  const openCuratorPicks = (designer: typeof collectibleDesigners[0]) => {
    if (designer.curatorPicks && designer.curatorPicks.length > 0) {
      setCuratorPicksDesigner(designer);
      setCuratorPickIndex(0);
      setIsZoomed(false);
    }
  };

  const closeCuratorPicks = () => {
    setCuratorPicksDesigner(null);
    setCuratorPickIndex(0);
    setIsZoomed(false);
  };

  const goToPreviousPick = () => {
    if (curatorPicksDesigner?.curatorPicks) {
      setCuratorPickIndex(prev => 
        prev === 0 ? curatorPicksDesigner.curatorPicks!.length - 1 : prev - 1
      );
      setIsZoomed(false);
    }
  };

  const goToNextPick = () => {
    if (curatorPicksDesigner?.curatorPicks) {
      setCuratorPickIndex(prev => 
        prev === curatorPicksDesigner.curatorPicks!.length - 1 ? 0 : prev + 1
      );
      setIsZoomed(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPreviousPick();
    if (e.key === "ArrowRight") goToNextPick();
    if (e.key === "Escape") closeCuratorPicks();
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
      goToNextPick();
    } else if (isRightSwipe) {
      goToPreviousPick();
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    if (timeSinceLastTap < 300) {
      setIsZoomed(!isZoomed);
    }
    lastTapRef.current = now;
  };

  return (
    <>
      <section id="collectibles" ref={ref} className="py-16 px-4 md:py-24 md:px-12 lg:px-20 bg-background">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="mb-12 md:mb-16 text-center"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground mb-4">
              Collectibles
            </h2>
            <p className="text-base md:text-lg text-muted-foreground font-body max-w-3xl mx-auto">
              Limited edition and unique pieces
            </p>
          </motion.div>

          <div className="flex justify-end mb-4">
            <button
              onClick={toggleAllDesigners}
              className="text-xs text-muted-foreground hover:text-primary font-body transition-colors duration-300 flex items-center gap-1"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isAllExpanded ? 'rotate-180' : ''}`} />
              <span>{isAllExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Accordion 
              type="multiple" 
              value={openDesigners} 
              onValueChange={(values) => {
                if ('vibrate' in navigator) {
                  navigator.vibrate(10);
                }
                if (window.innerWidth < 768 && values.length > openDesigners.length) {
                  const newDesigner = values.find(v => !openDesigners.includes(v));
                  if (newDesigner) {
                    setTimeout(() => {
                      const element = document.querySelector(`[data-collectible="${newDesigner}"]`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 100);
                  }
                }
                setOpenDesigners(values);
              }} 
              className="w-full space-y-4"
            >
              {collectibleDesigners.map((designer, index) => (
                <AccordionItem
                  key={designer.id}
                  value={designer.id}
                  id={`collectible-${designer.id}`}
                  data-collectible={designer.id}
                  className="border border-border/40 rounded-lg px-4 md:px-6 bg-card/30 hover:bg-card/50 transition-colors duration-300 scroll-mt-16"
                >
                  <AccordionTrigger className="hover:no-underline py-4 md:py-6 group active:scale-[0.99] touch-manipulation">
                    <div className="flex items-center gap-4 md:gap-6 text-left w-full">
                      <Dialog>
                        <DialogTrigger asChild>
                          <div
                            className="relative flex-shrink-0 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImage({ name: designer.name, image: designer.image });
                            }}
                          >
                            <img
                              src={designer.image}
                              alt={designer.name}
                              className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover ring-2 ring-border/40 transition-all duration-300 hover:ring-primary/60 hover:scale-105 hover:shadow-lg"
                            />
                            <div className="absolute inset-0 rounded-full bg-primary/0 hover:bg-primary/10 transition-all duration-300 flex items-center justify-center">
                              <svg
                                className="w-8 h-8 text-primary opacity-0 hover:opacity-100 transition-opacity duration-300"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                                />
                              </svg>
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl" aria-describedby={undefined}>
                          <VisuallyHidden>
                            <DialogTitle>{selectedImage?.name || designer.name}</DialogTitle>
                          </VisuallyHidden>
                          <div className="relative w-full h-full">
                            <img
                              src={selectedImage?.image || designer.image}
                              alt={selectedImage?.name || designer.name}
                              className="w-full h-auto rounded-lg object-contain"
                            />
                            <p className="text-center mt-4 text-lg font-serif text-foreground">
                              {designer.founder || selectedImage?.name || designer.name}
                            </p>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {designer.links?.find(l => l.type === "Instagram")?.url && (
                            <a
                              href={designer.links.find(l => l.type === "Instagram")?.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-0.5 transition-transform duration-300 hover:scale-110"
                              aria-label="Instagram"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="url(#instagram-gradient-collectibles)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                          <h3 className="font-serif text-xl md:text-2xl text-foreground group-hover:text-primary transition-colors duration-300">
                            {designer.name}
                          </h3>
                        </div>
                        <p className="text-sm md:text-base text-primary font-body">{designer.specialty}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <div className="space-y-4 pt-2 md:pl-[calc(8rem+1.5rem)] pl-0">
                      <p className="text-sm md:text-base text-muted-foreground font-body leading-relaxed">
                        {designer.biography}
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-body">
                          <span className="text-foreground font-medium">Notable Works:</span>{" "}
                          <span className="text-muted-foreground">{designer.notableWorks}</span>
                        </p>
                        <p className="text-sm font-body italic text-primary/80">
                          "{designer.philosophy}"
                        </p>
                      </div>
                      {designer.curatorPicks && designer.curatorPicks.length > 0 && (
                        <div className="pt-2">
                          <button
                            onClick={() => openCuratorPicks(designer)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body bg-gradient-to-r from-accent/90 to-primary/80 hover:from-accent hover:to-primary text-white rounded-md transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 cursor-pointer border border-accent/30"
                          >
                            <Star size={16} className="fill-current" />
                            <span className="font-medium">Limited Editions</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Curators' Picks Dialog */}
      <Dialog open={!!curatorPicksDesigner} onOpenChange={(open) => !open && closeCuratorPicks()}>
        <DialogContent 
          className="max-w-[95vw] md:max-w-4xl max-h-[95vh] p-0 bg-background/98 backdrop-blur-sm border-border overflow-hidden" 
          onKeyDown={handleKeyDown}
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>
              {curatorPicksDesigner?.name} - Curators' Picks
            </DialogTitle>
          </VisuallyHidden>
          
          {curatorPicksDesigner?.curatorPicks && (
            <div className="relative">
              {/* Header */}
              <div className="p-4 md:p-6 border-b border-border/50 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1">Curators' Picks</p>
                <h3 className="font-serif text-xl md:text-2xl text-foreground">{curatorPicksDesigner.name}</h3>
              </div>

              {/* Image container */}
              <div 
                className="relative bg-muted/20"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {/* Navigation buttons */}
                {curatorPicksDesigner.curatorPicks.length > 1 && (
                  <>
                    <button
                      onClick={goToPreviousPick}
                      className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 bg-background/80 hover:bg-background rounded-full shadow-lg transition-colors"
                      aria-label="Previous pick"
                    >
                      <ChevronLeft className="h-5 w-5 md:h-6 md:w-6 text-foreground" />
                    </button>
                    <button
                      onClick={goToNextPick}
                      className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 bg-background/80 hover:bg-background rounded-full shadow-lg transition-colors"
                      aria-label="Next pick"
                    >
                      <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-foreground" />
                    </button>
                  </>
                )}

                {/* Image */}
                <div 
                  className={`flex items-center justify-center p-4 md:p-8 ${isZoomed ? 'overflow-auto' : 'overflow-hidden'}`}
                  onClick={handleDoubleTap}
                >
                  <img
                    src={curatorPicksDesigner.curatorPicks[curatorPickIndex].image}
                    alt={curatorPicksDesigner.curatorPicks[curatorPickIndex].title}
                    className={`max-h-[50vh] md:max-h-[55vh] object-contain transition-transform duration-300 ${isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`}
                  />
                  {/* Zoom indicator on mobile */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsZoomed(!isZoomed);
                    }}
                    className="absolute bottom-4 right-4 md:hidden p-2 bg-background/80 rounded-full shadow-lg"
                    aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                  >
                    {isZoomed ? (
                      <ZoomOut className="h-5 w-5 text-foreground" />
                    ) : (
                      <ZoomIn className="h-5 w-5 text-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 md:p-6 border-t border-border/50">
                <div className="text-center mb-4">
                  <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-xs uppercase tracking-wider rounded mb-2">
                    {curatorPicksDesigner.curatorPicks[curatorPickIndex].category}
                  </span>
                  <h4 className="font-serif text-lg md:text-xl text-foreground">
                    {curatorPicksDesigner.curatorPicks[curatorPickIndex].title}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {curatorPicksDesigner.curatorPicks[curatorPickIndex].materials}
                  </p>
                  <p className="text-xs text-muted-foreground italic mt-1">
                    {curatorPicksDesigner.curatorPicks[curatorPickIndex].dimensions}
                  </p>
                </div>

                {/* Thumbnail navigation */}
                {curatorPicksDesigner.curatorPicks.length > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <TooltipProvider>
                      {curatorPicksDesigner.curatorPicks.map((pick, idx) => (
                        <Tooltip key={idx}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                setCuratorPickIndex(idx);
                                setIsZoomed(false);
                              }}
                              className={`w-12 h-12 md:w-14 md:h-14 rounded overflow-hidden transition-all duration-300 ${
                                idx === curatorPickIndex 
                                  ? 'ring-2 ring-primary scale-105' 
                                  : 'ring-1 ring-border/50 opacity-60 hover:opacity-100'
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

                {/* Counter */}
                <p className="text-center text-xs text-muted-foreground mt-4">
                  {curatorPickIndex + 1} / {curatorPicksDesigner.curatorPicks.length}
                </p>

                {/* Footer disclaimer */}
                <p className="text-center text-xs text-muted-foreground mt-8">
                  For further details, please request our catalogue at{" "}
                  <a 
                    href="mailto:concierge@myaffluency.com" 
                    className="text-primary hover:underline"
                  >
                    concierge@myaffluency.com
                  </a>
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Collectibles;
