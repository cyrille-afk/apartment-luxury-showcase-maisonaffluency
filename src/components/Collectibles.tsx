import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo } from "react";
import { Instagram, ChevronDown, ExternalLink, Star, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Designer images
import atelierDemichelisImg from "@/assets/designers/atelier-demichelis.jpg";
import kikoLopezImg from "@/assets/designers/kiko-lopez.jpg";
import nathalieZieglerImg from "@/assets/designers/nathalie-ziegler.jpg";
import maartenVrolijkImg from "@/assets/designers/maarten-vrolijk.png";
import matthieuGicquelImg from "@/assets/designers/matthieu-gicquel.jpg";

// Curators' Picks images
import demichelisPick1 from "@/assets/curators-picks/demichelis-1.jpg";
import demichelisPick2 from "@/assets/curators-picks/demichelis-2.jpg";
import demichelisPick3 from "@/assets/curators-picks/demichelis-3.jpg";
import demichelisPick4 from "@/assets/curators-picks/demichelis-4.jpg";
import matthieuGicquelGeode from "@/assets/curators-picks/matthieu-gicquel-geode.jpg";
import maartenVrolijkVessel from "@/assets/curators-picks/maarten-vrolijk-sakura.jpg";
import kikoLopezMirror from "@/assets/curators-picks/kiko-lopez-mirror.jpg";
import nathalieZieglerSnakeVessel from "@/assets/curators-picks/nathalie-ziegler-snake-vessel.jpg";
import rowinAtelierImg from "@/assets/designers/rowin-atelier.jpg";
import rowinNoneIiLamp from "@/assets/curators-picks/rowin-none-ii-lamp.jpg";
import marcantonioBrandoliniImg from "@/assets/designers/marcantonio-brandolini-dadda.jpg";
import marcantonioCotissiVessel from "@/assets/curators-picks/marcantonio-cotissi-vessel.jpg";

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
    notableWorksLink: { text: "Bud Table Lamp", galleryIndex: 10 },
    philosophy: "We create lighting that elevates everyday moments into experiences of beauty and contemplation.",
    curatorPicks: [
      { 
        image: demichelisPick1, 
        title: "Babel Table Lamp", 
        category: "Lighting",
        subcategory: "Table Lamps",
        materials: "Bronze • Brass • Ash wood • White fabric shade",
        dimensions: "Ø45 × H60.9 cm",
        edition: "Numbered edition of 20"
      },
      { 
        image: demichelisPick4, 
        title: "Echo Floor Lamp", 
        category: "Lighting",
        subcategory: "Floor Lamps",
        materials: "Patinated and varnished brass",
        dimensions: "Ø38 × H166 cm",
        edition: "Numbered edition of 20"
      },
      { 
        image: demichelisPick2, 
        title: "Bud Table Lamp", 
        category: "Lighting",
        subcategory: "Table Lamps",
        materials: "Bronze • White oak • Hand-made fabric shade",
        dimensions: "Ø40 × H71 cm",
        edition: "Numbered edition of 20"
      },
      { 
        image: demichelisPick3, 
        title: "Table d'appoint RHINO", 
        category: "Tables",
        subcategory: "Side Tables",
        materials: "Patinated bronze • Raw brass • Brown cowhide leather top",
        dimensions: "H43.5 × L35 cm",
        edition: "Numbered edition of 8 + 2 APs"
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
    notableWorksLink: { text: "Silver Glass Hammer Mirror", galleryIndex: 11 },
    philosophy: "A mirror is not merely a reflection—it is a portal that transforms light and space into something magical.",
    curatorPicks: [
      { 
        image: kikoLopezMirror,
        title: "Shadow Drawings Mirror", 
        category: "Decorative Object",
        subcategory: "Mirrors",
        materials: "Antiqued glass • Bronze patina frame",
        dimensions: "H100 × W70 cm",
        edition: "Unique Piece"
      },
    ],
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
    notableWorksLink: { text: "Custom Glass Chandelier", galleryIndex: 6 },
    philosophy:
      "Glass is alive—it captures and transforms light, creating an ever-changing dialogue with its environment.",
    curatorPicks: [
      { 
        image: nathalieZieglerSnakeVessel,
        title: "Gold & Silver Snake Vessel", 
        category: "Decorative Object",
        subcategory: "Vessels",
        materials: "Hand-blown glass • Gold & silver leaf accents",
        dimensions: "H38 cm × Diam 30 cm",
        edition: "Unique Piece"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/nathaliezieglerpasqua" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "maarten-vrolijk",
    name: "Maarten Vrolijk",
    specialty: "Contemporary Handblown Glass Art & Sculptural Vessels",
    image: maartenVrolijkImg,
    biography:
      "Maarten Vrolijk is a Dutch designer known for his sculptural approach to furniture design. His work explores the intersection of art and functionality, creating pieces that challenge conventional forms while remaining inherently practical. Each creation reflects his deep understanding of materials and his commitment to pushing the boundaries of contemporary design.",
    notableWorks: "Sakura TRP 22001, Sculptural Glass Vessels, Unique Art Pieces",
    notableWorksLink: { text: "Sakura TRP 22001", galleryIndex: 15 },
    philosophy: "Furniture should be a conversation between form and function—each piece tells a story of material and intention.",
    curatorPicks: [
      { 
        image: maartenVrolijkVessel,
        title: "Sakura TRP 22001", 
        category: "Decorative Object",
        subcategory: "Vessels",
        materials: "Handblown & sculpted glass, unique piece with certificate",
        dimensions: "H 52 cm × W 40 cm × D 41 cm",
        edition: "Unique Piece"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/maartenvrolijk" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "matthieu-gicquel",
    name: "Matthieu Gicquel",
    specialty: "Artisan Glass & Tableware",
    image: matthieuGicquelImg,
    biography:
      "Matthieu Gicquel is a French glass artist renowned for his exceptional tableware and decorative objects that blend traditional craftsmanship with contemporary design. His signature pieces feature textured glass adorned with precious gold leaf details, creating functional art that elevates everyday dining into a refined experience.",
    notableWorks: "Texture Glass with Gold Leaf rim Géode, Artisan Tableware Collection",
    notableWorksLink: { text: "Texture Glass with Gold Leaf rim Géode", galleryIndex: 1 },
    philosophy: "Each piece of glass tells a story of light, texture, and the timeless beauty of artisan craftsmanship.",
    curatorPicks: [
      { 
        image: matthieuGicquelGeode,
        title: "Géode Nbr 4: Texture Glass with Gold Leaf Rim", 
        category: "Decorative Object",
        subcategory: "Tableware",
        materials: "Textured glass • 24k gold leaf rim",
        dimensions: "Ø32 cm",
        edition: "Unique Piece"
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/matthieu_gicquel/?hl=en" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "rowin-atelier",
    name: "RoWin' Atelier",
    specialty: "Artisan Ceramics & Sculptural Objects",
    image: rowinAtelierImg,
    biography:
      "RoWin' Atelier is a French ceramics studio renowned for creating exceptional handcrafted pieces that blend traditional techniques with contemporary design. Each creation showcases meticulous attention to detail and a deep understanding of material properties.",
    notableWorks: "None II Table Lamp",
    philosophy: "Every piece of clay holds the potential for extraordinary beauty when shaped by skilled hands.",
    curatorPicks: [
      { 
        image: rowinNoneIiLamp,
        title: "None II Table Lamp", 
        category: "Lighting",
        subcategory: "Table Lamps",
        materials: "Cippolino Verde Marble, Silver-Plated brass",
        dimensions: "39 cm × 22.5 cm × H 58 cm",
        edition: "Unique Piece"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/rowinatelier" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "marcantonio-brandolini-dadda",
    name: "Marcantonio Brandolini D'Adda",
    specialty: "Glass Art & Sculptural Vessels",
    image: marcantonioBrandoliniImg,
    biography:
      "Marcantonio Brandolini D'Adda is an Italian glass artist whose work represents the finest traditions of Murano glassmaking combined with contemporary artistic vision. His vessels are celebrated for their organic forms and exceptional craftsmanship.",
    notableWorks: "Cotissi Vessel, Murano Glass Sculptures",
    notableWorksLink: { text: "Cotissi Vessel", galleryIndex: 15 },
    philosophy: "Glass is a living material that captures light and transforms space into poetry.",
    curatorPicks: [
      { 
        image: marcantonioCotissiVessel,
        title: "Cotissi Vessel", 
        category: "Decorative Object",
        subcategory: "Vessels",
        materials: "Hand-blown Murano glass",
        dimensions: "H35 × Ø20 cm",
        edition: "Unique Piece"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/marcantoniobrandolinidadda" },
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const lastTapRef = useRef<number>(0);
  const minSwipeDistance = 50;

  const CATEGORY_ORDER = ["Seating", "Tables", "Storage", "Lighting", "Rugs", "Décor"];

  // Build category → subcategory map from curator picks
  const categoryMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    collectibleDesigners.forEach(designer => {
      designer.curatorPicks?.forEach((pick: any) => {
        const cat = pick.category;
        if (!map[cat]) map[cat] = new Set();
        if (pick.subcategory) {
          map[cat].add(pick.subcategory);
        }
      });
    });
    const result: Record<string, string[]> = {};
    CATEGORY_ORDER.forEach(cat => {
      if (map[cat]) result[cat] = Array.from(map[cat]).sort();
    });
    Object.keys(map).forEach(cat => {
      if (!result[cat]) result[cat] = Array.from(map[cat]).sort();
    });
    return result;
  }, []);

  const categories = useMemo(() => {
    const extra = Object.keys(categoryMap).filter(cat => !CATEGORY_ORDER.includes(cat));
    return [...CATEGORY_ORDER, ...extra];
  }, [categoryMap]);

  const filteredDesigners = useMemo(() => {
    let designers = collectibleDesigners;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      designers = designers.filter(designer => 
        designer.name.toLowerCase().includes(query) ||
        designer.specialty.toLowerCase().includes(query) ||
        designer.biography.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory) {
      designers = designers.filter(designer =>
        designer.curatorPicks?.some((pick: any) => {
          if (selectedSubcategory) return pick.subcategory === selectedSubcategory;
          return pick.category === selectedCategory;
        })
      );
    }
    
    return designers;
  }, [searchQuery, selectedCategory, selectedSubcategory]);

  const allDesignerIds = filteredDesigners.map(d => d.id);
  const isAllExpanded = openDesigners.length === allDesignerIds.length && allDesignerIds.length > 0;

  const toggleAllDesigners = () => {
    if (isAllExpanded) {
      setOpenDesigners([]);
    } else {
      setOpenDesigners(allDesignerIds);
    }
  };

  const openCuratorPicks = (designer: typeof collectibleDesigners[0]) => {
    if (designer.curatorPicks && designer.curatorPicks.length > 0) {
      // Filter picks based on active category/subcategory filter
      let filteredPicks = designer.curatorPicks;
      if (selectedSubcategory) {
        filteredPicks = designer.curatorPicks.filter((pick: any) => pick.subcategory === selectedSubcategory);
      } else if (selectedCategory) {
        filteredPicks = designer.curatorPicks.filter((pick: any) => pick.category === selectedCategory);
      }
      if (filteredPicks.length > 0) {
        setCuratorPicksDesigner({ ...designer, curatorPicks: filteredPicks });
      } else {
        setCuratorPicksDesigner(designer);
      }
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
      <section id="collectibles" ref={ref} className="py-10 px-4 md:py-24 md:px-12 lg:px-20 bg-background scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="mb-12 md:mb-16 text-left"
          >
            <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-4">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground">
                Collectibles
              </h2>
              <div className="flex items-center gap-4 pb-1">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Search designers"
                >
                  <Search className="h-5 w-5" />
                </button>
                <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-primary transition-colors relative" aria-label="Filter by category">
                      <SlidersHorizontal className="h-5 w-5" />
                      {selectedCategory && (
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
                          1
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                   <PopoverContent className="w-72 p-4 bg-card border-border z-50" align="start">
                     <div className="flex items-center justify-between mb-3">
                       <h4 className="font-serif text-sm text-foreground">Filter by Category</h4>
                       <button onClick={() => setFilterOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors ml-2" aria-label="Close filter">
                         <X size={16} />
                       </button>
                     </div>
                     <div className="flex items-center justify-between mb-3">
                      {selectedCategory && (
                        <button
                          onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {categories.map((category) => (
                        <div key={category}>
                          <label className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                            <Checkbox
                              checked={selectedCategory === category}
                              onCheckedChange={() => {
                                if (selectedCategory === category) {
                                  setSelectedCategory(null);
                                  setSelectedSubcategory(null);
                                } else {
                                  setSelectedCategory(category);
                                  setSelectedSubcategory(null);
                                }
                              }}
                            />
                            <span className="text-sm text-foreground font-body">{category}</span>
                          </label>
                          {selectedCategory === category && categoryMap[category]?.length > 0 && (
                            <div className="ml-8 mt-1 mb-2 space-y-1 border-l border-border/40 pl-3">
                              <button
                                onClick={() => setSelectedSubcategory(null)}
                                className={`block text-[11px] uppercase tracking-[0.15em] font-body transition-all duration-300 py-1 ${
                                  !selectedSubcategory ? 'text-primary' : 'text-muted-foreground/60 hover:text-primary'
                                }`}
                              >
                                All {category}
                              </button>
                              {categoryMap[category].map(sub => (
                                <button
                                  key={sub}
                                  onClick={() => { setSelectedSubcategory(selectedSubcategory === sub ? null : sub); setFilterOpen(false); }}
                                  className={`block text-[11px] uppercase tracking-[0.15em] font-body transition-all duration-300 py-1 ${
                                    selectedSubcategory === sub ? 'text-primary' : 'text-muted-foreground/60 hover:text-primary'
                                  }`}
                                >
                                  {sub}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search designers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 bg-card/80 border-border/40 focus:border-primary/60 h-9 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() => { setSearchQuery(""); setShowSearch(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            )}
            <p className="text-base md:text-lg text-muted-foreground font-body">
              Limited Editions & Unique Pieces
            </p>
          </motion.div>

          <div className="flex items-center justify-between mb-4">
            {(searchQuery || selectedCategory) ? (
              <p className="text-left text-[10px] text-muted-foreground/50 font-body tracking-wider">
                {filteredDesigners.length} designer{filteredDesigners.length !== 1 ? 's' : ''} found
                {selectedSubcategory && <span> · {selectedSubcategory}</span>}
                {selectedCategory && !selectedSubcategory && <span> · {selectedCategory}</span>}
              </p>
            ) : <div />}
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
            {filteredDesigners.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-body">
                <p>No designers found matching "{searchQuery}"</p>
              </div>
            ) : (
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
                {filteredDesigners.map((designer, index) => (
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
                              <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="none" stroke="url(#instagram-gradient-collectibles)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                        {designer.notableWorksLink && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const gallerySection = document.getElementById('gallery');
                              if (gallerySection) {
                                gallerySection.scrollIntoView({ behavior: 'smooth' });
                                setTimeout(() => {
                                  window.dispatchEvent(new CustomEvent('openGalleryLightbox', { 
                                    detail: { index: designer.notableWorksLink!.galleryIndex, sourceId: `collectible-${designer.id}` } 
                                  }));
                                }, 500);
                              }
                            }}
                            className="inline-flex items-center gap-1 mt-2 text-xs md:text-sm font-body text-primary hover:text-primary/70 transition-all duration-300 group/link touch-manipulation"
                          >
                            <span className="underline underline-offset-2 decoration-primary/40 group-hover/link:decoration-primary/60">
                              {designer.notableWorksLink.text}
                            </span>
                            <ExternalLink className="h-3 w-3 opacity-50 group-hover/link:opacity-80 transition-opacity flex-shrink-0" />
                          </button>
                        )}
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
                            <span className="font-medium">
                              {designer.curatorPicks.every(pick => pick.edition === "Unique Piece") ? "Unique Piece" : "Limited Editions"}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
              </AccordionItem>
              ))}
            </Accordion>
            )}
          </motion.div>
        </div>
      </section>

      {/* Curators' Picks Dialog - Full screen dark modal like FeaturedDesigners */}
      <Dialog open={!!curatorPicksDesigner} onOpenChange={(open) => !open && closeCuratorPicks()}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none" 
          onKeyDown={handleKeyDown}
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>
              {curatorPicksDesigner?.name} - {curatorPicksDesigner?.curatorPicks?.every(pick => pick.edition === "Unique Piece") ? "Unique Piece" : "Limited Editions"}
            </DialogTitle>
          </VisuallyHidden>
          
          {curatorPicksDesigner?.curatorPicks && curatorPicksDesigner.curatorPicks.length > 0 && (
            <div 
              className="relative w-full h-full flex items-center justify-center"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Close button */}
              <button 
                onClick={closeCuratorPicks} 
                className="absolute top-4 right-4 z-50 p-2 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                aria-label="Close lightbox"
              >
                <X className="h-6 w-6 text-white" />
              </button>

              {/* Previous button */}
              {curatorPicksDesigner.curatorPicks.length > 1 && (
                <button 
                  onClick={goToPreviousPick}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8 text-white" />
                </button>
              )}

              {/* Image container */}
              <div className={`flex flex-col items-center justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 ${isZoomed ? 'max-h-[95vh] pb-4' : 'max-h-[85vh] pb-4'}`}>
                <div 
                  className={`relative overflow-auto transition-all duration-300 ${isZoomed ? 'max-h-[85vh]' : ''}`}
                  onClick={handleDoubleTap}
                >
                  {!isZoomed && (curatorPicksDesigner.curatorPicks[curatorPickIndex]?.category || curatorPicksDesigner.curatorPicks[curatorPickIndex]?.edition) && (
                    <div className="flex items-center gap-2 mb-2">
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.category && (
                        <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex].category}
                        </span>
                      )}
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.edition && (
                        <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex].edition}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="relative inline-block">
                    <img 
                      src={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.image} 
                      alt={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title} 
                      className={`object-contain transition-all duration-300 select-none ${isZoomed ? 'max-w-none w-[150vw] md:w-auto md:max-w-full md:max-h-[80vh]' : 'max-w-full max-h-[55vh]'}`}
                      draggable={false}
                    />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsZoomed(!isZoomed);
                      }}
                      className={`absolute bottom-2 right-2 z-10 p-2 bg-black/40 backdrop-blur-sm rounded-full transition-all duration-300 hover:bg-black/60 cursor-pointer ${isZoomed ? 'opacity-70' : 'opacity-70 hover:opacity-100'}`}
                      aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                    >
                      {isZoomed ? (
                        <ZoomOut className="h-5 w-5 text-white" />
                      ) : (
                        <ZoomIn className="h-5 w-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>
                <div className={`mt-2 text-center transition-all duration-300 ${isZoomed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                  <h3 className="text-sm md:text-base font-serif text-white mb-1">
                    {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title}
                  </h3>
                  {(curatorPicksDesigner.curatorPicks[curatorPickIndex]?.materials || curatorPicksDesigner.curatorPicks[curatorPickIndex]?.dimensions) && (
                    <div className="mt-2 max-w-xl space-y-1">
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.materials && (
                        <p className="text-xs md:text-sm text-white/60 font-body">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex].materials}
                        </p>
                      )}
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.dimensions && (
                        <p className="text-xs md:text-sm text-white/40 font-body italic">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex].dimensions}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Thumbnail strip — inline, above contact line */}
                  {curatorPicksDesigner.curatorPicks.length > 1 && (
                    <div className="mt-6 flex items-center gap-2 overflow-x-auto scrollbar-hide justify-center flex-wrap md:flex-nowrap">
                      {curatorPicksDesigner.curatorPicks.map((pick, idx) => (
                        <button
                          key={idx}
                          onClick={() => { setCuratorPickIndex(idx); setIsZoomed(false); }}
                          aria-label={`View ${pick.title}`}
                          className={`flex-none relative w-10 h-10 md:w-12 md:h-12 rounded overflow-hidden transition-all duration-300 ${
                            curatorPickIndex === idx
                              ? 'ring-2 ring-white scale-110 opacity-100'
                              : 'ring-1 ring-white/20 opacity-50 hover:opacity-90 hover:ring-white/50'
                          }`}
                        >
                          <img src={pick.image} alt={pick.title} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="mt-6 text-xs text-white font-body italic">
                    For further details, please contact{" "}
                    <a href="mailto:concierge@myaffluency.com" className="underline hover:text-white/80 transition-colors">
                      concierge@myaffluency.com
                    </a>
                  </p>
                </div>
              </div>

              {/* Next button */}
              {curatorPicksDesigner.curatorPicks.length > 1 && (
                <button 
                  onClick={goToNextPick}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                  aria-label="Next image"
                >
                  <ChevronRight className="h-8 w-8 text-white" />
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Collectibles;
