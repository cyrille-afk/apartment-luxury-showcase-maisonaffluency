import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo } from "react";
import { Search, X, Instagram, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";

// Gallery image index mapping (based on flattened gallery items order)
// 0: A Masterful Suite, 1: Unique by Design, 2: Design Icons and Collectibles
// 3: An Inviting Bespoke Sofa, 4: A Sophisticated Living Room, 5: With Panoramic Cityscape Views
// 6: A Sophisticated Boudoir, 7: A Serene Decor, 8: An Art Master Display

const partnerBrands = [
  {
    id: "alexander-lamont-reef",
    name: "Alexander Lamont",
    category: "Decorative Objects",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Reef Vessels",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 3, // An Inviting Bespoke Sofa
  },
  {
    id: "alexander-lamont-mantle",
    name: "Alexander Lamont",
    category: "Decorative Objects",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Straw Marquetry Mantle Box",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 8, // An Art Master Display
  },
  {
    id: "alinea-design-objects",
    name: "Alinea Design Objects",
    category: "Designer Furniture",
    origin: "Belgium",
    description: "Belgian design house curating and producing exceptional furniture pieces that blend sculptural form with functional elegance.",
    featured: "Angelo M Table",
    instagram: "https://instagram.com/alinea_design_objects",
    galleryIndex: 5, // With Panoramic Cityscape Views
  },
  {
    id: "apparatus-studio-median",
    name: "Apparatus Studio",
    category: "Sculptural Lighting",
    origin: "United States",
    description: "New York-based design studio creating refined lighting and furniture that bridges art and function through meticulous craftsmanship and material exploration.",
    featured: "Median 3 Surface Alabaster Lights",
    instagram: "https://instagram.com/apparatusstudio",
    galleryIndex: 3, // An Inviting Bespoke Sofa
  },
  {
    id: "apparatus-studio-metronome",
    name: "Apparatus Studio",
    category: "Sculptural Lighting",
    origin: "United States",
    description: "New York-based design studio creating refined lighting and furniture that bridges art and function through meticulous craftsmanship and material exploration.",
    featured: "Metronome Reading Suede Floor Lamp",
    instagram: "https://instagram.com/apparatusstudio",
    galleryIndex: 7, // A Serene Decor
  },
  {
    id: "baleri",
    name: "Baleri Italia",
    category: "Designer Furniture",
    origin: "Italy",
    description: "Italian furniture company known for innovative designs and collaborations with leading architects and designers since 1984.",
    featured: "Plato Bookcase",
    instagram: "https://instagram.com/baleriitalia",
    galleryIndex: 8, // An Art Master Display
  },
  {
    id: "cc-tapis",
    name: "CC-Tapis",
    category: "Rugs & Textiles",
    origin: "Italy",
    description: "Italian rug manufacturer known for contemporary designs and traditional Nepalese hand-knotting techniques. Their Giudecca custom rugs blend artistry with exceptional craftsmanship.",
    featured: "Giudecca Custom Rug",
    instagram: "https://instagram.com/cc_tapis",
    galleryIndex: 0, // A Masterful Suite
  },
  {
    id: "celso-de-lemos",
    name: "Celso de Lemos",
    category: "Luxury Textiles",
    origin: "Portugal",
    description: "Portuguese textile house crafting exquisite bed linens and home textiles using the finest natural fibers and artisanal techniques.",
    featured: "Silk Bed Cover",
    instagram: "https://instagram.com/celso.de.lemos",
    galleryIndex: 0, // A Masterful Suite
  },
  {
    id: "ecart-paris",
    name: "Ecart Paris",
    category: "Heritage Furniture Editions",
    origin: "France",
    description: "Founded by legendary designer Andrée Putman, Ecart International re-edits iconic furniture designs from the 20th century's greatest masters, including Jean-Michel Frank, Eileen Gray, and Pierre Chareau. Their meticulous reproductions preserve the original craftsmanship and materials.",
    featured: "Jean-Michel Frank Re-editions, Eileen Gray Designs",
    instagram: "https://instagram.com/ecart.paris",
    galleryIndex: 4, // A Sophisticated Living Room (Jean-Michel Frank Stool)
  },
  {
    id: "eric-schmitt-studio",
    name: "Eric Schmitt Studio",
    category: "Sculptural Furniture",
    origin: "France",
    description: "French designer creating bold sculptural furniture in bronze and iron, each piece a statement of artistic vision and master craftsmanship.",
    featured: "Chairie Dining Chair",
    instagram: "https://instagram.com/studio_eric_schmitt_",
    galleryIndex: 5, // With Panoramic Cityscape Views
  },
  {
    id: "haymann-editions",
    name: "Haymann Editions",
    category: "Sculptural Lighting",
    origin: "France",
    description: "British design studio creating sculptural lighting and objects in carved marble and natural materials, each piece a unique work of art.",
    featured: "Carved Marble Marie Lamp",
    instagram: "https://instagram.com/haymanneditions",
    galleryIndex: 2, // Design Icons and Collectibles
  },
  {
    id: "iksel-brunelleschi",
    name: "Iksel",
    category: "Wallcoverings & Murals",
    origin: "United Kingdom",
    description: "Masters of decorative wallcoverings, creating hand-painted panoramic murals and scenic wallpapers inspired by historical archives and artistic traditions.",
    featured: "Brunelleschi Perspective Wallcover",
    instagram: "https://instagram.com/iksel_decorative_arts",
    galleryIndex: 0, // A Masterful Suite
  },
  {
    id: "iksel-white-blossom",
    name: "Iksel",
    category: "Wallcoverings & Murals",
    origin: "United Kingdom",
    description: "Masters of decorative wallcoverings, creating hand-painted panoramic murals and scenic wallpapers inspired by historical archives and artistic traditions.",
    featured: "White Blossom Wallcover",
    instagram: "https://instagram.com/iksel_decorative_arts",
    galleryIndex: 7, // A Serene Decor
  },
  {
    id: "made-in-kira",
    name: "Made in Kira",
    category: "Artisan Lighting",
    origin: "France",
    description: "Japanese lighting atelier creating delicate paper and natural material lamps that embody the principles of wabi-sabi and mindful design.",
    featured: "Toshiro Lamp",
    instagram: "https://instagram.com/madeinkira",
    galleryIndex: 6, // A Sophisticated Boudoir
  },
  {
    id: "nika-zupanc",
    name: "Nika Zupanc Studio",
    category: "Contemporary Design",
    origin: "Slovenia",
    description: "Slovenian designer known for poetic, feminine furniture and lighting that combines nostalgic elegance with contemporary sensibility.",
    featured: "Stardust Loveseat",
    instagram: "https://instagram.com/nikazupancstudio",
    galleryIndex: 6, // A Sophisticated Boudoir
  },
  {
    id: "okha",
    name: "Okha",
    category: "Contemporary Furniture",
    origin: "South Africa",
    description: "South African design studio creating sophisticated furniture that bridges African craft traditions with contemporary global aesthetics.",
    featured: "Adam Court's Villa Pedestal Nightstand",
    instagram: "https://instagram.com/_okha",
    galleryIndex: 1, // Unique by Design
  },
  {
    id: "peter-reed",
    name: "Peter Reed 1861",
    category: "Fine Linens",
    origin: "United Kingdom",
    description: "British heritage brand creating the world's finest bed linens since 1861, using exclusive long-staple Egyptian cotton and meticulous craftsmanship.",
    featured: "Riyad Double Faced Throw and Cushion",
    instagram: "https://instagram.com/peterreed1861",
    galleryIndex: 1, // Unique by Design
  },
  {
    id: "pinton-1867",
    name: "Pinton 1867",
    category: "Rugs & Tapestries",
    origin: "France",
    description: "French textile house continuing the Aubusson tradition of handcrafted rugs and tapestries, blending historical techniques with contemporary design.",
    featured: "Custom Rug Collection",
    instagram: "https://instagram.com/pinton1867",
    galleryIndex: 1, // Unique by Design
  },
  {
    id: "poltrona-frau",
    name: "Poltrona Frau",
    category: "Luxury Furniture",
    origin: "Italy",
    description: "Iconic Italian furniture house renowned for exceptional leather craftsmanship since 1912. Their timeless designs grace prestigious residences and institutions worldwide.",
    featured: "Albero Bookcase",
    instagram: "https://instagram.com/poltronafrauofficial",
    galleryIndex: 3, // An Inviting Bespoke Sofa
  },
  {
    id: "robicara",
    name: "Robicara",
    category: "Bespoke Furniture",
    origin: "Italy",
    description: "Italian design studio creating bespoke furniture and cabinetry with exceptional attention to material, proportion, and craftsmanship.",
    featured: "Sira Credenza",
    instagram: "https://instagram.com/robicaradesign",
    galleryIndex: 4, // A Sophisticated Living Room
  },
  {
    id: "theoreme-editions",
    name: "Théorème Editions",
    category: "Decorative Objects",
    origin: "France",
    description: "French publisher of limited edition decorative objects, collaborating with renowned artists and designers including Garnier & Linker.",
    featured: "Lost-wax Cast Crystal Centerpiece",
    instagram: "https://instagram.com/theoreme_editions",
    galleryIndex: 4, // A Sophisticated Living Room
  },
];

const BrandsAteliers = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return partnerBrands;
    const query = searchQuery.toLowerCase();
    return partnerBrands.filter(
      (brand) =>
        brand.name.toLowerCase().includes(query) ||
        brand.category.toLowerCase().includes(query) ||
        brand.origin.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const scrollToGallery = (galleryIndex: number) => {
    const gallerySection = document.getElementById('gallery');
    if (gallerySection) {
      gallerySection.scrollIntoView({ behavior: 'smooth' });
      // Store the gallery index in sessionStorage to trigger lightbox after scroll
      sessionStorage.setItem('openGalleryIndex', galleryIndex.toString());
    }
  };

  return (
    <section ref={ref} className="py-16 px-4 md:py-24 md:px-12 lg:px-20 bg-muted/30">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-center"
        >
          <p className="mb-2 md:mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-primary text-sm md:text-xl lg:text-2xl font-serif">
            OUR PARTNERS
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground mb-4">
            Brands & Ateliers
          </h2>
          <p className="text-base md:text-lg text-muted-foreground font-body max-w-3xl mx-auto">
            We collaborate with the world's most distinguished furniture houses, textile ateliers, and artisan workshops 
            to bring exceptional pieces to discerning collectors and design professionals.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, category, or origin..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 bg-card/50 border-border/40 focus:border-primary/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              {filteredBrands.length} brand{filteredBrands.length !== 1 ? 's' : ''} found
            </p>
          )}
        </motion.div>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBrands.map((brand, index) => (
            <motion.div
              key={brand.id}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="group p-6 bg-card/50 border border-border/40 rounded-lg hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-serif text-lg md:text-xl text-foreground group-hover:text-primary transition-colors duration-300">
                    {brand.name}
                  </h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                    {brand.origin}
                  </p>
                </div>
                {brand.instagram && (
                  <a
                    href={brand.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors duration-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
              </div>
              
              <p className="text-xs md:text-sm text-primary font-body italic mb-3">
                {brand.category}
              </p>
              
              <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">
                {brand.description}
              </p>
              
              <div className="pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Featured</p>
                {brand.galleryIndex !== undefined ? (
                  <button
                    onClick={() => scrollToGallery(brand.galleryIndex)}
                    className="text-sm text-foreground/80 font-body hover:text-primary transition-colors duration-300 flex items-center gap-1 group/link"
                  >
                    <span className="underline underline-offset-2 decoration-primary/40 group-hover/link:decoration-primary">
                      {brand.featured}
                    </span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                  </button>
                ) : (
                  <p className="text-sm text-foreground/80 font-body">
                    {brand.featured}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandsAteliers;
