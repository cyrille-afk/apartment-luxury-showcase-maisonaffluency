import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Mail, Maximize2, X, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Import images
import demichelisPick1 from "@/assets/curators-picks/demichelis-1.jpg";
import demichelisPick2 from "@/assets/curators-picks/demichelis-2.jpg";
import demichelisPick3 from "@/assets/curators-picks/demichelis-3.jpg";
import demichelisPick4 from "@/assets/curators-picks/demichelis-4.jpg";
import yvesMacheretPick1 from "@/assets/curators-picks/yves-macheret-1.jpg";

interface Collectible {
  id: string;
  title: string;
  designer: string;
  category: string;
  image: string;
  materials: string;
  dimensions: string;
}

const collectibles: Collectible[] = [
  {
    id: "babel-table-lamp",
    title: "Babel Table Lamp",
    designer: "Atelier Demichelis",
    category: "Lighting",
    image: demichelisPick1,
    materials: "Bronze • Brass • Ash wood • White fabric shade",
    dimensions: "Ø45 × H60.9 cm",
  },
  {
    id: "bud-lamp",
    title: "Bud Table Lamp",
    designer: "Atelier Demichelis",
    category: "Lighting",
    image: demichelisPick2,
    materials: "Hand-patinated bronze • Silk shade",
    dimensions: "Ø30 × H45 cm",
  },
  {
    id: "flora-chandelier",
    title: "Flora Chandelier",
    designer: "Atelier Demichelis",
    category: "Lighting",
    image: demichelisPick3,
    materials: "Brass • Hand-blown glass",
    dimensions: "Ø80 × H55 cm",
  },
  {
    id: "leaf-sconce",
    title: "Leaf Wall Sconce",
    designer: "Atelier Demichelis",
    category: "Lighting",
    image: demichelisPick4,
    materials: "Gilded bronze • Alabaster",
    dimensions: "W25 × H40 cm",
  },
  {
    id: "entrelacs-chair",
    title: "Entrelacs Chair",
    designer: "Yves Macheret",
    category: "Furniture",
    image: yvesMacheretPick1,
    materials: "Hand-woven wicker • Solid oak frame",
    dimensions: "H85 × W65 × D70 cm",
  },
];

const Collectibles = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [hasTapped, setHasTapped] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Collectible | null>(null);

  const openLightbox = (item: Collectible) => {
    setSelectedItem(item);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setSelectedItem(null);
  };

  return (
    <>
      <section id="collectibles" ref={ref} className="py-16 px-4 md:py-24 md:px-12 lg:px-20 bg-background">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="mb-12 md:mb-16 text-center"
          >
            <p className="mb-2 md:mb-3 uppercase tracking-[0.15em] md:tracking-[0.3em] text-primary text-base md:text-xl lg:text-2xl font-serif">
              COLLECTIBLES
            </p>
            <h2 className="text-sm leading-relaxed md:text-3xl text-foreground text-left px-1 md:px-2 md:text-justify font-serif lg:text-lg">
              A curated selection of exceptional pieces from our featured designers and ateliers. Each item represents the pinnacle of artisanal craftsmanship and timeless design.
            </h2>
          </motion.div>

          <div className="grid gap-6 md:gap-8 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {collectibles.map((item, index) => {
              const isExpanded = expandedItem === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="group cursor-pointer"
                >
                  <div
                    className="relative mb-3 md:mb-4 aspect-[4/5] overflow-hidden rounded-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHasTapped(true);
                      setExpandedItem(isExpanded ? null : item.id);
                    }}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                    {/* Mobile tap indicator */}
                    {!hasTapped && (
                      <div className="absolute bottom-3 right-3 md:hidden bg-background/80 text-foreground p-2 rounded-full flex items-center justify-center">
                        <Eye className="w-4 h-4" />
                      </div>
                    )}
                    
                    {/* Expand/View indicator */}
                    <div className="absolute bottom-3 right-3 flex opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="bg-background/90 text-foreground p-2 rounded-full shadow-lg backdrop-blur-sm">
                        {isExpanded ? <X className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                      </span>
                    </div>
                  </div>

                  {/* Title and designer - always visible */}
                  <h3 className="font-serif text-sm md:text-base text-foreground mb-0.5 group-hover:text-primary transition-colors duration-300 line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-primary uppercase tracking-wider">
                    {item.designer}
                  </p>

                  {/* Expanded details */}
                  <motion.div
                    initial={false}
                    animate={{
                      height: isExpanded ? "auto" : 0,
                      opacity: isExpanded ? 1 : 0,
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 text-xs text-muted-foreground space-y-1">
                      <p>{item.materials}</p>
                      <p className="italic">{item.dimensions}</p>
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openLightbox(item);
                          }}
                          className="text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                        >
                          <Maximize2 className="w-3 h-3" />
                          View
                        </button>
                        <a
                          href={`mailto:concierge@myaffluency.com?subject=Inquiry: ${item.title}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                        >
                          <Mail className="w-3 h-3" />
                          Inquire
                        </a>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent className="max-w-4xl p-0 bg-background/95 backdrop-blur-sm border-border">
          <VisuallyHidden>
            <DialogTitle>{selectedItem?.title}</DialogTitle>
          </VisuallyHidden>
          {selectedItem && (
            <div className="relative">
              <img
                src={selectedItem.image}
                alt={selectedItem.title}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="p-4 text-center">
                <h3 className="font-serif text-lg md:text-xl text-foreground mb-1">
                  {selectedItem.title}
                </h3>
                <p className="text-sm text-primary uppercase tracking-wider mb-2">
                  {selectedItem.designer}
                </p>
                <p className="text-xs text-muted-foreground">{selectedItem.materials}</p>
                <p className="text-xs text-muted-foreground italic">{selectedItem.dimensions}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Collectibles;
