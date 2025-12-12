import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import bedroomImage from "@/assets/master-suite.jpg";
import diningImage from "@/assets/dining-room.jpg";
import boudoirImage from "@/assets/boudoir.jpg";
import livingRoomImage from "@/assets/living-room-hero.jpg";
import bedroomAltImage from "@/assets/bedroom-alt.jpg";
import bedroomThirdImage from "@/assets/bedroom-third.jpg";
import bespokeSofaImage from "@/assets/bespoke-sofa.jpg";
import artMasterBronzeImage from "@/assets/art-master-bronze.jpg";
import bedroomSecondImage from "@/assets/bedroom-second.jpg";

const galleryExperiences = [{
  experience: "Social Gathering",
  subtitle: "Custom sofas, artisan rugs, sculptural lighting and collectible furniture",
  items: [{
    image: bespokeSofaImage,
    title: "An Inviting Lounge Area",
    description: "Thierry Lemaire's Niko 420 custom sofa, Atelier Février's Ricky custom rug, Poltrona Frau's Albero bookcase, Jindrich Halabala's lounge chair, Apparatus Studio's Median 3 Surface Alabaster lights, Alexander Lamont's Reef Vessels"
  }, {
    image: livingRoomImage,
    title: "A Sophisticated Living Room",
    description: "Thierry Lemaire Orsay Centre Table, Robicara's Sira Credenza, Jean-Michel Frank & Adolphe Chanaux' Stool 1934, Olivia Cognet's Valauris Lamp, Leo Sentou's AB armchair, Garnier & Linker lost-wax cast crystal centerpiece for Théorème Editions"
  }, {
    image: diningImage,
    title: "With Panoramic Cityscape Views",
    description: "Alinea Design Objects' Angelo M table, Eric Schmitt Studio's Chairie and Cazes&Conquet's Augusta dining chairs, Emanuelle Levet Stenne's Alabaster Pendant Light, Emmanuel Babled's Limited Edition Sculptured Book Cover from his emblematic Osmosi Series"
  }]
}, {
  experience: "Restful Retreat",
  subtitle: "Curated collectibles, bespoke furniture and handcrafted rugs",
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
  experience: "Personal Sanctuary",
  subtitle: "Bespoke desk, handcrafted chandelier, artisan lamp and bronze painting",
  items: [{
    image: boudoirImage,
    title: "A Sophisticated Boudoir",
    description: "Bruno de Maistre's Lyric Desk, Hamrei's Pépé Chair, Made in Kira's Toshiro Lamp, Nathalie Ziegler's Custom Glass Chandelier and Gold Leaves+Glass Snake Vase, Nika Zupanc's Stardust Loveseat"
  }, {
    image: bedroomSecondImage,
    title: "A Serene Decor",
    description: "Iksel's White Blossom Wallcover, Apparatus Studio's Metronome Reading Suede Floor Lamp"
  }, {
    image: artMasterBronzeImage,
    title: "An Art Master Display",
    description: "Pierre Bonnefille's Bronze Painting 204, Alexander Lamont's Straw Marquetry Mantle Box, Baleri's Plato bookcase"
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

  // Minimum swipe distance required (in px)
  const minSwipeDistance = 50;

  // Flatten all gallery items for lightbox navigation
  const allItems = useMemo(() => {
    return galleryExperiences.flatMap(section => section.items);
  }, []);

  // Check for gallery index from sessionStorage (set by BrandsAteliers)
  useEffect(() => {
    const checkForGalleryIndex = () => {
      const storedIndex = sessionStorage.getItem('openGalleryIndex');
      if (storedIndex !== null) {
        const index = parseInt(storedIndex, 10);
        if (!isNaN(index) && index >= 0 && index < allItems.length) {
          setCurrentImageIndex(index);
          setLightboxOpen(true);
        }
        sessionStorage.removeItem('openGalleryIndex');
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
    const handleOpenLightbox = (e: CustomEvent<{ index: number }>) => {
      const index = e.detail.index;
      if (index >= 0 && index < allItems.length) {
        setCurrentImageIndex(index);
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
    setLightboxOpen(true);
  };

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? allItems.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev === allItems.length - 1 ? 0 : prev + 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrevious();
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "Escape") setLightboxOpen(false);
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

  return (
    <>
      <section ref={ref} className="py-16 px-4 md:py-24 md:px-12 lg:px-20 bg-muted/30">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="mb-12 md:mb-16 text-center"
          >
            <p className="mb-2 md:mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-primary text-sm md:text-xl lg:text-2xl font-serif">
              OUR GALLERY
            </p>
            <h2 className="text-xl leading-relaxed md:text-3xl text-foreground text-left px-2 md:text-justify font-serif lg:text-lg">
              From Thierry Lemaire's Orsay Mds Centre Table, Jean-Michel Frank Table Soleil 1930, Nathalie Ziegler's and Hervé van der Straeten's Chandeliers, to Hamrei's whimsical Chairs and Pierre Bonnefille's Bronze Painting, Maison Affluency Singapore is a uniquely curated venue where design and art congregate
            </h2>
          </motion.div>

          {galleryExperiences.map((section, sectionIndex) => (
            <div key={section.experience} className="mb-16 md:mb-24">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: sectionIndex * 0.2 }}
                className="mb-8 md:mb-12"
              >
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-serif text-primary mb-2">
                  {section.experience}
                </h3>
                <p className="text-sm md:text-base text-muted-foreground font-body italic">
                  {section.subtitle}
                </p>
              </motion.div>

              <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item, index) => (
                  <motion.div
                    key={`${item.title}-${index}`}
                    initial={{ opacity: 0, y: 40 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6, delay: sectionIndex * 0.2 + index * 0.1 }}
                    className="group cursor-pointer"
                    onClick={() => openLightbox(sectionIndex, index)}
                  >
                    <div className="relative mb-4 md:mb-6 aspect-[4/5] overflow-hidden rounded-sm">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="bg-background/80 text-foreground px-4 py-2 rounded-full text-sm font-body">
                          Click to enlarge
                        </span>
                      </div>
                    </div>

                    <h3 className="mb-2 font-display text-xl md:text-2xl text-foreground">
                      {item.title}
                    </h3>
                    <div className="font-body text-sm md:text-base leading-relaxed text-muted-foreground">
                      <span className="font-semibold italic text-primary">Featuring:</span>
                      <ul className="mt-2 space-y-1 list-disc list-inside">
                        {item.description.split(', ').map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none"
          onKeyDown={handleKeyDown}
        >
          <div 
            className="relative w-full h-full flex items-center justify-center"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 z-50 p-2 bg-background/20 hover:bg-background/40 rounded-full transition-colors"
              aria-label="Close lightbox"
            >
              <X className="h-6 w-6 text-white" />
            </button>

            {/* Previous button */}
            <button
              onClick={goToPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-8 w-8 text-white" />
            </button>

            {/* Image container */}
            <div className="flex flex-col items-center justify-center max-w-[90vw] max-h-[85vh] px-16">
              <img
                src={allItems[currentImageIndex]?.image}
                alt={allItems[currentImageIndex]?.title}
                className="max-w-full max-h-[70vh] object-contain"
              />
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
            <button
              onClick={goToNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="h-8 w-8 text-white" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Gallery;
