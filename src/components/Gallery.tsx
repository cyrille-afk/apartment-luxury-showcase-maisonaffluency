import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Maximize2, Instagram, Copy } from "lucide-react";
import PinchZoomImage from "./PinchZoomImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cloudinaryUrl } from "@/lib/cloudinary";

const g = (id: string) => cloudinaryUrl(id, { width: 1600, quality: "auto:good", crop: "fill" });

const bedroomImage = g("master-suite_y6jaix");
const diningImage = g("dining-room_ey0bu5");
const livingRoomImage = g("living-room-hero_zxfcxl");
const bedroomSecondImage = g("bedroom-second_cyfmdj");
const boudoirImage = g("boudoir_ll5spn");
const bedroomAltImage = g("bedroom-alt_yk0j0d");
const bedroomThirdImage = g("bedroom-third_ol56sx");
const bespokeSofaImage = g("bespoke-sofa_gxidtx");
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
    description: "Sofa: Thierry Lemaire's Niko 420 custom, Rug: Atelier Février's Ricky custom rug, Coffee table: Thierry Lemaire's Orsay Coffee table (edition of 12), Blue Crystal Centerpiece: Garnier & Linker for Théorème Editions, Ceiling light: Apparatus Studio's Median 3 Surface Alabaster lights, Bookcase: Gianfranco Frattini's Albero Bookcase for Poltrona Frau, Vessel behind the sofa: Maarten Vrolijk's Sakura TRP 22001 Vessel (unique piece), Bronze Vessels: Alexander Lamont's Reef Vessels, Lounge Chair: Jindrich Halabala's Vintage Lounge Chair c.1970"
  }, {
    image: livingRoomImage,
    title: "A Sophisticated Living Room",
    description: "Coffee Table: Thierry Lemaire Orsay Coffee Table (edition of 12), Garnier & Linker's Lost-Wax Crystal Cast Centerpiece for Théorème Editions, Shagreen Credenza: Robicara's Sira Credenza, Atop the Credenza: Matthieu Gicquel's Texture Glass with Gold Leaf rim Géode, Jean-Michel Frank & Adolphe Chanaux' Stool 1934, Wall Mounted Picture: Stéphane CG's Orsay Abstract Diasec, Olivia Cognet's Blue glazed Vallauris Floor Lamp, Leo Sentou's AB Armchair, Jean-Michel Frank's Soleil Coffee Table 1930, Iksel's Japanese Cranes Wallcover"
  }, {
    image: diningImage,
    title: "Panoramic Cityscape Views",
    description: "Dining Table: Alinea Design Objects' Custom Angelo M Table, Dining Chairs: 2 x Eric Schmitt Studio's Chairie and 1 x Cazes&Conquet's Augusta Dining Chairs, Alabaster Pendant: Emanuelle Levet Stenne's Pendant Light, Sculptured Book Cover: Emmanuel Babled's Limited Edition of 8 + 4 AP from the Osmosi Series, Sofa: Thierry Lemaire's Niko 420 custom, Bookcase: Gianfranco Frattini's Albero Bookcase for Poltrona Frau, Vessel behind the sofa: Maarten Vrolijk's Sakura TRP 22001 Vessel (unique piece)"
  }, {
    image: "/gallery/sociable-4.jpeg",
    title: "A Sun Lit Reading Corner",
    description: "Floor Lamp: Olivia Cognet's Blue glazed Vallauris Floor Lamp, Armchair: Leo Sentou's AB Chair, Coffee Table: Jean-Michel Frank's Soleil Table (Straw) 1930, Iksel's Japanese Cranes Wallcover, Haas Brothers' Monster Gold-Tone Incense Burner for L'Objet, Textured Bronze Globes: Alexander Lamont's Hammered Bowls"
  }]
}, {
  experience: "An Intimate Setting",
  subtitle: "Custom dining furniture, hand-blown glass pendants, sculptural seating and artisan accessories",
  categories: ["Tables", "Lighting", "Seating", "Decorative Object"] as string[],
  items: [{
    image: intimateDiningImage,
    title: "A Dreamy Tuscan Landscape",
    description: "Dining Table: Atelier Pendhapa's Deepah Custom Table, Dining Chairs: Hamrei's Pépé Custom Chairs in FJ Hamikian Fabric, Pendant Lights: Jeremy Maxwell Wintrebert's Murano Cloud Bulle Pendants, Blue Vessel: Milan Pekař's Crystalline Vase Volume 3, Pierre Frey's Tuscan Journey Wallcover"
  }, {
    image: intimateTableImage,
    title: "A Highly Customised Dining Room",
    description: "Dining Table: Atelier Pendhapa's Deepah Custom Table, Dining Chairs: Hamrei's Pépé Custom Chairs in FJ Hamikian Fabric, Blue Vessel: Milan Pekař's Crystalline Vase Volume 3, Pierre Frey's Tuscan Journey Wallcover"
  }, {
    image: intimateLoungeImage,
    title: "A Relaxed Setting",
    description: "Armchair: Forest & Giaconia's BOB Armchair for Delcourt Collection, Side Table: Alinea Design Objects' Angelo M Side Table, Mirror: Kiko Lopez' Shadow Drawings (Unique Piece), Cushion: Takayokaya's Ojami Cushion, Vessel: Milan Pekař's Crystalline Green Vessel Volume 5"
  }, {
    image: cloudinaryUrl("IMG_2133_wtxd62", { width: 1600, quality: "auto:good", crop: "fill" }),
    title: "A Colourful Nook",
    description: "Armchair: Forest & Giaconia's BOB Armchair for Delcourt Collection, Side Table: Alinea Design Objects' Angelo M Side Table, Mirror: Kiko Lopez' Shadow Drawings (Unique Piece), Cushion: Takayokaya's Ojami Cushion, Ottoman: Bina Baitel's Sublime Ottoman M in Métaphores Fabric, Vessel: Milan Pekař's Crystalline Green Vessel Volume 5"
  }]
}, {
  experience: "A Personal Sanctuary",
  subtitle: "Bespoke marquetry desk, hand-blown glass chandelier, artisan suede lamp and bronze painting",
  categories: ["Lighting", "Seating", "Tables", "Decorative Object"] as string[],
  items: [{
    image: boudoirImage,
    title: "A Sophisticated Boudoir",
    description: "Sofa/Loveseat: Nika Zupanc's Stardust Loveseat for Sé Collections, Desk: BdM's Lyric Desk, Chair: Hamrei's Pépé Chair, Table Lamp: Made in Kira's Toshiro Lamp, Chandelier: Nathalie Ziegler's Custom Saint-Just Glass Chandelier, Vessel: Nathalie Ziegler's Gold Leaves+Glass Snake Vessel (Unique Piece)"
  }, {
    image: "/gallery/sanctuary-2.jpg",
    title: "Detailed Craftsmanship",
    description: "Desk Close-Up: BdM's Lyric Desk, Chair: Hamrei's Pépé Chair, Vessel: Nathalie Ziegler's Gold Leaves+Glass Snake Vessel (Unique Piece)"
  }, {
    image: bedroomSecondImage,
    title: "A Serene Decor",
    description: "Sofa/Loveseat: Nika Zupanc's Stardust Loveseat for Sé Collections, Floor Lamp: Apparatus' Metronome Reading Floor Lamp"
  }, {
    image: artMasterBronzeImage,
    title: "A Design Treasure Trove",
    description: "Top Left Box: Alexander Lamont's Straw Marquetry Mantle Box, Painting: Pierre Bonnefille's Bronze Painting 204, Bookcase: Baleri Italia's Marble Carved and Solid Wood Plato Bookcase"
  }]
}, {
  experience: "A Calming and Dreamy Environment",
  subtitle: "Curated collectibles, hand-carved furniture and hand-knotted silk rugs",
  categories: ["Rugs", "Lighting", "Seating", "Decorative Object", "Storage"] as string[],
  items: [{
    image: bedroomImage,
    title: "A Masterful Suite",
    description: "Rug: Zanellato and Bortotto's Giudecca Rug (Custom) for CC-Tapis, Bed Throw: Celso de Lemos' Silk Bed Throw, Chandelier: Hervé van der Straeten's Bronze MicMac Chandelier, Nightstand: Adam Courts' Villa Pedestal for Okha, Table Lamps: Atelier DeMichelis' Bronze Bud Table Lamps (Edition of 20), Vessel: Milan Pekař's Crystalline Blue Vessel Volume 5, Nightstand Rug: Pinton 1867 'After the Rain' Custom Rug, Iksel's Brunelleschi Perspective Wallcover"
  }, {
    image: bedroomThirdImage,
    title: "Design Tableau",
    description: "Console: Damien Langlois-Meurinne's Ooh La La Console for Sé Collections, Table Lamp: Toni Grilo's Marble Marie Lamp for Hayman Editions, Mirror: Kiko Lopez' Silver Glass Hammer Mirror (Unique Piece), Bench: Gallery S.Bensimon's MB02 Bench, Candle: Dan Yeffet's Lyra Marble Candle for oOumm"
  }, {
    image: "/gallery/calming-2.jpg",
    title: "A Venitian Cocoon",
    description: "Rug: CC-Tapis Giudecca Rug (Custom), Bed Throw: Peter Reed 1861's Riyad Double Faced Throw and Cushions, Chandelier: Hervé van der Straeten's Bronze MicMac Chandelier, Nightstand: Adam Courts' Villa Pedestal for Okha, Table Lamps: Atelier DeMichelis' Bronze Bud Table Lamps (Edition of 20), Console: Damien Langlois-Meurinne's Ooh La La Console for Sé Collections, Table Lamp: Toni Grilo's Marble Marie Lamp for Hayman Editions, Mirror: Kiko Lopez' Silver Glass Hammer Mirror (Unique Piece), Bench: Gallery S.Bensimon's MB02 Bench, Candle: Dan Yeffet's Lyra Marble Candle for oOumm"
  }, {
    image: bedroomAltImage,
    title: "Unique By Design Vignette",
    description: "Nightstand: Adam Courts' Villa Pedestal for Okha, Table Lamps: Atelier DeMichelis' Bronze Bud Table Lamps (Edition of 20), Nightstand Rug: Pinton 1867 'After the Rain' Custom Rug, Iksel's Brunelleschi Perspective Wallcover, Curtains: Pierre Frey's Le Manach Fountain Toile de Tours"
  }]
}, {
  experience: "A Small Room with Massive Personality",
  subtitle: "Bold statement pieces, artisan craftsmanship and curated collectibles",
  categories: ["Lighting", "Tables", "Decorative Object"] as string[],
  items: [{
    image: smallRoomBedroomImage,
    title: "An Artistic Statement",
    description: "Wall Light: Felix Millory Martell Wall Lamp for Entrelacs, Table Lamp: Apparatus Studio Lantern, Side Table: Reda Amalou's Eggshell DOT Side Table, Armchair: Pierre Frey's Kagura Headboard Fabric, Wallcovering: Pierre Frey's Natte, Bed Throw: Peter Reed 1861's Riyad Double Faced Throw"
  }, {
    image: smallRoomPersonalityImage,
    title: "Compact Elegance",
    description: "Headboard: Pierre Frey's Kagura Fabric, Apparatus Studio Lantern Table, Reda Amalou Eggshell DOT side table, Pierre Frey Kagura and Kasimir Fabrics, Pierre Frey Natte Wallcovering, Peter Reed's Riyad Double Faced Throw"
  }, {
    image: smallRoomVaseImage,
    title: "Yellow Crystalline",
    description: "Vessel: Milan Pekař's Yellow Crystalline Vessel Volume 5, Bed Throw: Peter Reed 1861's Riyad Double Faced Throw"
  }, {
    image: smallRoomChairImage,
    title: "Golden Hour",
    description: "Bar/Counter Stool: Yabu Pushelberg's Park Place Stool for Man of Parts, Side Table: Jaime Hayon's Time Piece Ceramic for Sé Collections"
  }]
}, {
  experience: "Home Office with a View",
  subtitle: "Sculptural desk, refined lighting and curated accessories for a workspace of distinction",
  categories: ["Tables", "Lighting", "Seating"] as string[],
  items: [{
    image: homeOfficeDeskImage,
    title: "A Workspace of Distinction",
    description: "Executive Desk: Bernt Petersen 4-Drawer Desk, Wall Lamp at Right of Desk: Kheops Wall Lamp by Kelly Boukobza for Entrelacs, Table Lamp at Left: RoWin' Atelier's None II Table Lamp, Pendant Light: Mernøe N1 Pendant, Office Chair: Vitra Eames Soft Pad EA 219 by Charles & Ray Eames"
  }, {
    image: homeOfficeDesk2Image,
    title: "Refined Details",
    description: "Executive Desk: Bernt Petersen 4-Drawer Desk, Table Lamp: RoWin' Atelier's None II Table Lamp (Unique Piece)"
  }, {
    image: homeOffice3Image,
    title: "Light & Focus",
    description: "Executive Desk: Bernt Petersen 4-Drawer Desk, Office Chair: Vitra Eames' Soft Pad EA 219 Chair by Charles & Ray Eames, Wall Light: Tristan Auer's YSA Wall Light for Véronèse, Desk Display Wall Lamp: Kheops Wall Lamp by Kelly Boukobza for Entrelacs"
  }, {
    image: officeBooksCornerImage,
    title: "Design & Fine Art Books Corner",
    description: "Executive Desk: Bernt Petersen 4-Drawer Desk details, Table Lamp: RoWin' Atelier's None II Table Lamp (Unique Piece)"
  }]
}, {
  experience: "The Details Make the Design",
  subtitle: "The details are not the details. They make the design",
  categories: ["Decorative Object", "Lighting", "Storage", "Tables"] as string[],
  items: [{
    image: detailsSectionImage,
    title: "Curated Vignette",
    description: "Console: Alexandre Lamont's Corteza Console, Table Lamp: Thierry Lemaire's Kedis Lamp, Small Vase: Milan Pekař's small Crystalline Vase, Blue Vessel: Marcantonio Brandolini D'Adda's Vase 'Unknown N.83', Side Table: Jaime Hayon's Time Piece Ceramic for Sé Collections, Lounge Chair: Jindrich Halabala's Lounge Chair in Dedar's UKIYO MONOGATARI 003, Bookcase: Gianfranco Frattini's Albero Bookcase for Poltrona Frau, Vessel: Maarten Vrolijk's Sakura TRP 22001 Vessel"
  }, {
    image: detailsConsoleImage,
    title: "The Details Make The Design",
    description: "Console Details: Alexandre Lamont's Corteza Console featuring shagreen leather with curved bullnose edge, Blue Vessel: Marcantonio Brandolini D'Adda's Cotissi Vessel 'Unknown N.83', Small Vase: Milan Pekař's small Crystalline Vase"
  }, {
    image: detailsLampImage,
    title: "Light & Texture",
    description: "Noe Duchaufour Lawrance's Amber Folia Portable Lamp for Cristallerie Saint-Louis"
  }, {
    image: detailsConsole4Image,
    title: "Craftsmanship At Every Corner",
    description: "Shagreen Panels: Robicara's Sira Credenza details, Matthieu Gicquel's Texture Glass with Gold Leaf rim Géode details"
  }]
}];
const Gallery = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: "-100px"
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const imageZoomedRef = useRef(false);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [hasTapped, setHasTapped] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [sourceItemKey, setSourceItemKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState<3 | 4>(3);

  // Preload first section's gallery images only (visible on initial load)
  useEffect(() => {
    if (galleryExperiences.length > 0) {
      galleryExperiences[0].items.slice(0, 3).forEach(item => {
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
  const minSwipeDistance = 50;

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
    setCurrentItemIndex(prev => prev === 0 ? currentSectionItems.length - 1 : prev - 1);
  };
  const goToNext = () => {
    setCurrentItemIndex(prev => prev === currentSectionItems.length - 1 ? 0 : prev + 1);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrevious();
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "Escape") closeLightbox();
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (imageZoomedRef.current) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (imageZoomedRef.current) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = () => {
    if (imageZoomedRef.current) return;
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
      <section id="gallery" ref={ref} className="pt-2 pb-16 px-4 md:pt-4 md:pb-24 md:px-12 lg:px-20 bg-muted/30 scroll-mt-24">
        <div className="mx-auto max-w-7xl">
          <motion.div initial={{
          opacity: 0,
          y: 30
        }} animate={isInView ? {
          opacity: 1,
          y: 0
        } : {}} transition={{
          duration: 0.8
        }} className="mb-6 md:mb-10 text-left">
            <div className="mb-2 md:mb-3">
              <p className="text-foreground text-xl md:text-2xl lg:text-2xl font-serif font-bold">
                A Uniquely Curated Venue
              </p>
            </div>
            {activeCategory && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body mb-2">
                {filteredExperiences.length} {filteredExperiences.length === 1 ? "scene" : "scenes"} · {activeCategory}
              </p>
            )}
            <h2 className="text-sm leading-relaxed md:text-3xl text-foreground text-justify px-1 md:px-2 font-serif lg:text-lg">
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
                <p className="text-sm md:text-base text-muted-foreground font-body italic">
                  {section.subtitle}
                </p>
              </motion.div>

              {/* Mobile: swipeable carousel like Instagram */}
              <div className="md:hidden relative">
                <div
                  ref={el => { scrollStripRefs.current[originalSectionIndex] = el; }}
                  onScroll={() => handleStripScroll(originalSectionIndex)}
                  className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                >
                  {section.items.map((item, index) => (
                    <div
                      key={`${item.title}-${index}-mobile`}
                      className="relative flex-none w-full snap-center aspect-[3/4] cursor-pointer"
                      onClick={() => openLightbox(originalSectionIndex, index)}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        className={`h-full w-full object-cover brightness-[1.05] contrast-[1.08] saturate-[1.05] ${item.image === bespokeSofaImage ? "object-[center_35%]" : ""}`}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
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
                    {(activeScrollIndices[originalSectionIndex] || 0) === 0 ? (
                      <Copy className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <span className="text-white text-[10px] font-body font-medium leading-none">
                        {(activeScrollIndices[originalSectionIndex] || 0) + 1}/{section.items.length}
                      </span>
                    )}
                  </div>
                )}
                {/* Photo title below carousel */}
                <h4 className="font-serif text-foreground text-base mt-3 px-1">
                  {section.items[activeScrollIndices[originalSectionIndex] || 0]?.title}
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
                          (activeScrollIndices[originalSectionIndex] || 0) === dotIndex
                            ? 'w-1.5 h-1.5 bg-primary'
                            : 'w-1.5 h-1.5 bg-primary/30'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

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
                        <img src={item.image} alt={item.title} className="h-full w-full object-cover brightness-[1.05] contrast-[1.08] saturate-[1.05] transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        {/* Expand icon - opens lightbox directly */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openLightbox(originalSectionIndex, index);
                          }}
                          className="absolute bottom-2 left-2 md:bottom-4 md:left-auto md:right-4 flex opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          aria-label="View full image"
                        >
                          <span className={`bg-background/90 text-foreground rounded-full shadow-lg backdrop-blur-sm hover:bg-background transition-all duration-300 ${gridCols === 4 ? 'p-1.5 md:p-1.5' : 'p-1.5 md:p-2.5'}`}>
                            <Maximize2 className={`w-3 h-3 ${gridCols === 4 ? 'md:w-3 md:h-3' : 'md:w-4 md:h-4'}`} />
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
          })}
        </div>
      </section>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 pt-14 md:pt-0 bg-black/95 border-none [&>button]:hidden overflow-hidden" onKeyDown={handleKeyDown} aria-describedby={undefined}>
          <VisuallyHidden>
            <DialogTitle>{currentSectionItems[currentItemIndex]?.title || 'Gallery Image'}</DialogTitle>
          </VisuallyHidden>
          <div className="relative w-full h-full flex items-start md:items-center justify-center" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

            {/* Pill indicator - top right */}
            <div className="absolute top-4 right-4 z-50 bg-black/60 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center pointer-events-none">
              <span className="text-white text-[10px] font-body font-medium leading-none">
                {currentItemIndex + 1}/{currentSectionItems.length}
              </span>
            </div>

            {/* Previous button - desktop only */}
            <button onClick={goToPrevious} className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" aria-label="Previous image">
              <ChevronLeft className="h-8 w-8 text-white" />
            </button>

            {/* Scrollable image + legend container */}
            <div className="flex flex-col items-center w-full md:max-w-[90vw] px-4 md:px-16 pt-2 md:pt-0 overflow-y-auto max-h-[calc(95vh-3.5rem)] md:max-h-[90vh] scrollbar-hide">
              <h3 className="text-xl md:text-2xl font-serif text-white mb-3 text-center shrink-0 w-full">
                {currentSectionItems[currentItemIndex]?.title}
              </h3>
              <div className="relative inline-block shrink-0">
                <PinchZoomImage key={currentItemIndex} src={currentSectionItems[currentItemIndex]?.image} alt={currentSectionItems[currentItemIndex]?.title} className="w-full md:max-w-full max-h-[45vh] md:max-h-[65vh] object-contain brightness-[1.05] contrast-[1.08] saturate-[1.05] transition-opacity duration-200" loading="eager" decoding="async" onZoomChange={(z) => { imageZoomedRef.current = z; setImageZoomed(z); }} />
                {/* Close button - bottom left on mobile, bottom right on desktop */}
                <button onClick={closeLightbox} className="absolute bottom-2 left-1 md:left-auto md:right-2 z-50 p-1.5 bg-black/60 backdrop-blur-sm rounded-full transition-colors" aria-label="Close lightbox">
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
              {/* Dot indicators */}
              <div className="flex justify-center gap-1.5 mt-3 shrink-0">
                {currentSectionItems.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentItemIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentItemIndex ? 'bg-white' : 'bg-white/40'}`}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
              <div className="mt-3 text-center shrink-0 pb-6">
                <p className="text-sm md:text-base text-white/70 font-body max-w-2xl text-justify">
                  {currentSectionItems[currentItemIndex]?.description}
                </p>
              </div>
            </div>

            {/* Next button - desktop only */}
            <button onClick={goToNext} className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" aria-label="Next image">
              <ChevronRight className="h-8 w-8 text-white" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>;
};
export default Gallery;