import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import logoIcon from "@/assets/affluency-logo-icon.jpeg";

// Import images
import demichelisPick1 from "@/assets/curators-picks/demichelis-1.jpg";

interface Collectible {
  id: string;
  title: string;
  designer: string;
  designerSlug: string;
  category: string;
  image: string;
  materials: string;
  dimensions: string;
  description: string;
  priceRange: string;
}

const collectibles: Collectible[] = [
  {
    id: "babel-table-lamp",
    title: "Babel Table Lamp",
    designer: "Atelier Demichelis",
    designerSlug: "atelier-demichelis",
    category: "Lighting",
    image: demichelisPick1,
    materials: "Bronze • Brass • Ash wood • White fabric shade",
    dimensions: "Ø45 × H60.9 cm",
    description: "A masterwork of mixed-media lighting design. The Babel Table Lamp features hand-patinated bronze and brass elements anchored by an ash wood base, crowned with a handcrafted fabric shade.",
    priceRange: "Price upon request"
  },
];

const Collectibles = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>("");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="mx-auto max-w-7xl px-4 md:px-12 lg:px-20">
          <div className="flex h-20 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 group">
              <img src={logoIcon} alt="Affluency Logo" className="h-9 w-auto" />
              <span className="font-serif text-lg md:text-xl font-extrabold text-foreground transition-all duration-300 group-hover:text-primary">
                Maison Affluency
              </span>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block text-sm uppercase tracking-[0.3em] text-primary mb-4"
          >
            Curated Collection
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl lg:text-6xl text-foreground mb-6"
          >
            Collectibles
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="font-body text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            A curated selection of exceptional pieces from our featured designers and ateliers. 
            Each item represents the pinnacle of artisanal craftsmanship and timeless design.
          </motion.p>
        </div>
      </section>

      {/* Collectibles Grid */}
      <section className="pb-24 px-4 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {collectibles.map((item, index) => (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group bg-card border border-border rounded-sm overflow-hidden shadow-sm hover:shadow-elegant transition-all duration-500"
              >
                {/* Image */}
                <div 
                  className="relative aspect-[4/3] overflow-hidden cursor-pointer"
                  onClick={() => {
                    setSelectedImage(item.image);
                    setSelectedTitle(item.title);
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="inline-block px-3 py-1 bg-background/90 backdrop-blur-sm text-xs uppercase tracking-wider text-foreground border border-border/50">
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h2 className="font-serif text-xl text-foreground mb-1 group-hover:text-primary transition-colors duration-300">
                    {item.title}
                  </h2>
                  <p className="text-sm text-primary uppercase tracking-wider mb-4">
                    {item.designer}
                  </p>
                  
                  <p className="font-body text-sm text-muted-foreground mb-4 line-clamp-3">
                    {item.description}
                  </p>

                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p>
                      <span className="text-foreground/70">Materials:</span>{" "}
                      {item.materials}
                    </p>
                    <p className="italic">
                      {item.dimensions}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border/50 flex items-center justify-between">
                    <span className="text-sm font-medium text-accent">
                      {item.priceRange}
                    </span>
                    <a
                      href="mailto:concierge@myaffluency.com?subject=Inquiry: ${item.title}"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      Inquire
                    </a>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 px-4 md:px-12 lg:px-20 bg-muted/30 border-t border-border/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-4">
            Interested in a Piece?
          </h2>
          <p className="font-body text-muted-foreground mb-6">
            Our concierge team is available to provide detailed information, arrange viewings, 
            and assist with custom requests. Contact us to begin your acquisition journey.
          </p>
          <a
            href="mailto:concierge@myaffluency.com?subject=Collectibles Inquiry"
            className="inline-flex items-center gap-2 px-8 py-3 bg-background border border-accent text-foreground hover:bg-accent/10 transition-all duration-300"
          >
            <Mail className="h-4 w-4" />
            Contact Concierge
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 md:px-12 lg:px-20 border-t border-border/50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Maison Affluency. All rights reserved.
          </p>
          <Link to="/" className="text-sm text-primary hover:text-primary/80 transition-colors">
            Return to Home
          </Link>
        </div>
      </footer>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-background/95 backdrop-blur-sm border-border">
          <VisuallyHidden>
            <DialogTitle>{selectedTitle}</DialogTitle>
          </VisuallyHidden>
          {selectedImage && (
            <img
              src={selectedImage}
              alt={selectedTitle}
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Collectibles;