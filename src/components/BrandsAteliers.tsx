import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect } from "react";
import { Search, X, Instagram, ExternalLink, ChevronDown, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

// Gallery image index mapping (based on flattened gallery items order)
// 0: A Masterful Suite, 1: Unique by Design, 2: Design Icons and Collectibles
// 3: An Inviting Bespoke Sofa, 4: A Sophisticated Living Room, 5: With Panoramic Cityscape Views
// 6: A Sophisticated Boudoir, 7: A Serene Decor, 8: An Art Master Display

const partnerBrands = [
  {
    id: "alexander-lamont-reef",
    name: "Alexander Lamont",
    category: "Art Objects",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Reef Vessels",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 3, // An Inviting Bespoke Sofa
  },
  {
    id: "alexander-lamont-mantle",
    name: "Alexander Lamont",
    category: "Art Objects",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Straw Marquetry Mantle Box",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 8, // An Art Master Display
  },
  {
    id: "alinea-design-objects",
    name: "Alinea Design Objects",
    category: "Furniture",
    origin: "Belgium",
    description: "Belgian design house curating and producing exceptional furniture pieces that blend sculptural form with functional elegance.",
    featured: "Angelo M Table",
    instagram: "https://instagram.com/alinea_design_objects",
    galleryIndex: 5, // With Panoramic Cityscape Views
  },
  {
    id: "atelier-demichelis",
    name: "Atelier DeMichelis",
    category: "Lighting",
    origin: "France",
    description: "French atelier crafting limited edition lighting pieces that combine organic forms with precious materials, each piece a sculptural work of art.",
    featured: "Limited Edition Bud Table Lamp",
    instagram: "https://instagram.com/atelierdemichelis",
    galleryIndex: 1, // Unique by Design
  },
  {
    id: "atelier-fevrier",
    name: "Atelier Février",
    category: "Rugs & Textiles",
    origin: "France",
    description: "French atelier specializing in bespoke handcrafted rugs, combining traditional weaving techniques with contemporary design sensibility.",
    featured: "Ricky Custom Rug",
    instagram: "https://instagram.com/atelierfevrier",
    galleryIndex: 3, // An Inviting Bespoke Sofa
  },
  {
    id: "apparatus-studio-median",
    name: "Apparatus Studio",
    category: "Lighting",
    origin: "United States",
    description: "New York-based design studio creating refined lighting and furniture that bridges art and function through meticulous craftsmanship and material exploration.",
    featured: "Median 3 Surface Alabaster Lights",
    instagram: "https://instagram.com/apparatusstudio",
    galleryIndex: 3, // An Inviting Bespoke Sofa
  },
  {
    id: "apparatus-studio-metronome",
    name: "Apparatus Studio",
    category: "Lighting",
    origin: "United States",
    description: "New York-based design studio creating refined lighting and furniture that bridges art and function through meticulous craftsmanship and material exploration.",
    featured: "Metronome Reading Suede Floor Lamp",
    instagram: "https://instagram.com/apparatusstudio",
    galleryIndex: 7, // A Serene Decor
  },
  {
    id: "baleri",
    name: "Baleri Italia",
    category: "Furniture",
    origin: "Italy",
    description: "Italian furniture company known for innovative designs and collaborations with leading architects and designers since 1984.",
    featured: "Plato Bookcase",
    instagram: "https://instagram.com/baleriitalia",
    galleryIndex: 8, // An Art Master Display
  },
  {
    id: "bruno-de-maistre",
    name: "Bruno de Maistre",
    category: "Furniture",
    origin: "France",
    description: "French furniture designer creating refined bespoke pieces that combine classical proportions with contemporary elegance and exceptional craftsmanship.",
    featured: "Lyric Desk",
    instagram: "https://instagram.com/brunodemaistre",
    galleryIndex: 6, // A Sophisticated Boudoir
  },
  {
    id: "cazes-conquet",
    name: "Cazes & Conquet",
    category: "Furniture",
    origin: "France",
    description: "French design duo creating refined furniture pieces that blend contemporary aesthetics with traditional craftsmanship and timeless elegance.",
    featured: "Augusta Dining Chairs",
    instagram: "https://instagram.com/cazesconquet",
    galleryIndex: 5, // With Panoramic Cityscape Views
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
    id: "damien-langlois-meurinne",
    name: "Damien Langlois-Meurinne",
    category: "Furniture",
    origin: "France",
    description: "French designer creating bold, sculptural furniture and lighting that combines artistic vision with masterful craftsmanship and luxurious materials.",
    featured: "Ooh La La Console",
    instagram: "https://instagram.com/damienlanglois_meurinne",
    galleryIndex: 2, // Design Icons and Collectibles
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
    id: "emanuelle-levet-stenne",
    name: "Emanuelle Levet Stenne",
    category: "Lighting",
    origin: "France",
    description: "French lighting designer creating ethereal alabaster pendant lights and sculptural fixtures that transform spaces with their warm, natural glow.",
    featured: "Alabaster Pendant Light",
    instagram: "https://instagram.com/emanuellelevetstenne",
    galleryIndex: 5, // With Panoramic Cityscape Views
  },
  {
    id: "emmanuel-babled",
    name: "Emmanuel Babled",
    category: "Art Objects",
    origin: "France",
    description: "French-Italian designer creating limited edition sculptural objects in glass and marble, his Osmosi Series represents the pinnacle of material exploration and artistic vision.",
    featured: "Limited Edition Osmosi Series Sculptured Book Cover",
    instagram: "https://instagram.com/emmanuelbabled",
    galleryIndex: 5, // With Panoramic Cityscape Views
  },
  {
    id: "eric-schmitt-studio",
    name: "Eric Schmitt Studio",
    category: "Furniture",
    origin: "France",
    description: "French designer creating bold sculptural furniture in bronze and iron, each piece a statement of artistic vision and master craftsmanship.",
    featured: "Chairie Dining Chair",
    instagram: "https://instagram.com/studio_eric_schmitt_",
    galleryIndex: 5, // With Panoramic Cityscape Views
  },
  {
    id: "garnier-linker",
    name: "Garnier & Linker",
    category: "Art Objects",
    origin: "France",
    description: "French artist duo creating exceptional lost-wax cast crystal sculptures and decorative objects, their work for Théorème Editions exemplifies masterful artistry.",
    featured: "Lost-wax Cast Crystal Centerpiece",
    instagram: "https://instagram.com/garnieretlinker",
    galleryIndex: 4, // A Sophisticated Living Room
  },
  {
    id: "haymann-editions",
    name: "Haymann Editions",
    category: "Lighting",
    origin: "France",
    description: "British design studio creating sculptural lighting and objects in carved marble and natural materials, each piece a unique work of art.",
    featured: "Carved Marble Marie Lamp",
    instagram: "https://instagram.com/haymanneditions",
    galleryIndex: 2, // Design Icons and Collectibles
  },
  {
    id: "herve-van-der-straeten",
    name: "Hervé van der Straeten",
    category: "Lighting",
    origin: "France",
    description: "Renowned French designer and artist creating sculptural furniture and lighting in bronze, his pieces are celebrated for their organic forms and exceptional craftsmanship.",
    featured: "Bronze MicMac Chandelier",
    instagram: "https://instagram.com/hervevanderstraeten",
    galleryIndex: 0, // A Masterful Suite
  },
  {
    id: "hamrei",
    name: "Hamrei",
    category: "Furniture",
    origin: "France",
    description: "French design studio crafting whimsical and sculptural furniture pieces that blend playful forms with exceptional craftsmanship and artistic expression.",
    featured: "Pépé Chair",
    instagram: "https://instagram.com/hamrei_",
    galleryIndex: 6, // A Sophisticated Boudoir
  },
  {
    id: "jindrich-halabala",
    name: "Jindrich Halabala",
    category: "Furniture",
    origin: "Czech Republic",
    description: "Legendary Czech furniture designer whose iconic mid-century lounge chairs represent the pinnacle of functionalist design, prized by collectors worldwide.",
    featured: "Lounge Chair",
    instagram: "",
    galleryIndex: 3, // An Inviting Bespoke Sofa
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
    id: "kiko-lopez",
    name: "Kiko Lopez",
    category: "Glass Art",
    origin: "France",
    description: "French glass artist renowned for his extraordinary hand-silvered mirrors and sculptural glass works, each piece a unique testament to ancient techniques reimagined.",
    featured: "Silver Glass Hammer Mirror",
    instagram: "https://instagram.com/kikolopez_",
    galleryIndex: 2, // Design Icons and Collectibles
  },
  {
    id: "leo-sentou",
    name: "Leo Sentou",
    category: "Furniture",
    origin: "France",
    description: "French furniture designer creating refined contemporary pieces that balance sculptural presence with functional elegance and exceptional craftsmanship.",
    featured: "AB Armchair",
    instagram: "https://instagram.com/leosentou",
    galleryIndex: 4, // A Sophisticated Living Room
  },
  {
    id: "made-in-kira",
    name: "Made in Kira",
    category: "Lighting",
    origin: "France",
    description: "Japanese lighting atelier creating delicate paper and natural material lamps that embody the principles of wabi-sabi and mindful design.",
    featured: "Toshiro Lamp",
    instagram: "https://instagram.com/madeinkira",
    galleryIndex: 6, // A Sophisticated Boudoir
  },
  {
    id: "nathalie-ziegler",
    name: "Nathalie Ziegler",
    category: "Glass Art",
    origin: "France",
    description: "French glass artist creating bespoke chandeliers and sculptural glass pieces, each work a unique expression of light and organic form.",
    featured: "Custom Glass Chandelier",
    instagram: "https://instagram.com/nathalieziegler",
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
    category: "Furniture",
    origin: "South Africa",
    description: "South African design studio creating sophisticated furniture that bridges African craft traditions with contemporary global aesthetics.",
    featured: "Adam Court's Villa Pedestal Nightstand",
    instagram: "https://instagram.com/_okha",
    galleryIndex: 1, // Unique by Design
  },
  {
    id: "ooumm",
    name: "oOumm",
    category: "Luxury Candles & Objects",
    origin: "France",
    description: "French luxury brand creating sculptural marble candles and decorative objects that blend artisanal craftsmanship with contemporary design sensibility.",
    featured: "Lyra Marble Candle",
    instagram: "https://instagram.com/ooumm_paris",
    galleryIndex: 2, // Design Icons and Collectibles
  },
  {
    id: "olivia-cognet",
    name: "Olivia Cognet",
    category: "Lighting",
    origin: "France",
    description: "French artist and designer creating sculptural ceramic lighting and furniture that celebrates organic forms and handcrafted textures.",
    featured: "Valauris Lamp",
    instagram: "https://instagram.com/oliviacognet",
    galleryIndex: 4, // A Sophisticated Living Room
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
    id: "pierre-bonnefille",
    name: "Pierre Bonnefille",
    category: "Fine Art",
    origin: "France",
    description: "French artist renowned for his bronze paintings and sculptural works, creating pieces that blur the boundaries between painting and sculpture through masterful material exploration.",
    featured: "Bronze Painting 204",
    instagram: "https://instagram.com/pierrebonnefille",
    galleryIndex: 8, // An Art Master Display
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
    category: "Furniture",
    origin: "Italy",
    description: "Iconic Italian furniture house renowned for exceptional leather craftsmanship since 1912. Their timeless designs grace prestigious residences and institutions worldwide.",
    featured: "Albero Bookcase",
    instagram: "https://instagram.com/poltronafrauofficial",
    galleryIndex: 3, // An Inviting Bespoke Sofa
  },
  {
    id: "robicara",
    name: "Robicara",
    category: "Furniture",
    origin: "Italy",
    description: "Italian design studio creating bespoke furniture and cabinetry with exceptional attention to material, proportion, and craftsmanship.",
    featured: "Sira Credenza",
    instagram: "https://instagram.com/robicaradesign",
    galleryIndex: 4, // A Sophisticated Living Room
  },
  {
    id: "theoreme-editions",
    name: "Théorème Editions",
    category: "Art Objects",
    origin: "France",
    description: "French publisher of limited edition decorative objects, collaborating with renowned artists and designers including Garnier & Linker.",
    featured: "Lost-wax Cast Crystal Centerpiece",
    instagram: "https://instagram.com/theoreme_editions",
    galleryIndex: 4, // A Sophisticated Living Room
  },
  {
    id: "thierry-lemaire-sofa",
    name: "Thierry Lemaire",
    category: "Furniture",
    origin: "France",
    description: "Renowned French interior architect and furniture designer creating timeless bespoke pieces that blend classical elegance with contemporary refinement.",
    featured: "Niko 420 Custom Sofa",
    instagram: "https://instagram.com/thierrylemaire",
    galleryIndex: 3, // An Inviting Bespoke Sofa
  },
  {
    id: "thierry-lemaire-table",
    name: "Thierry Lemaire",
    category: "Furniture",
    origin: "France",
    description: "Renowned French interior architect and furniture designer creating timeless bespoke pieces that blend classical elegance with contemporary refinement.",
    featured: "Orsay Centre Table",
    instagram: "https://instagram.com/thierrylemaire",
    galleryIndex: 4, // A Sophisticated Living Room
  },
];

const BrandsAteliers = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [searchQuery, setSearchQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([]);

  // Get all unique categories from partner brands
  const allUniqueCategories = useMemo(() => {
    const categories = [...new Set(partnerBrands.map(brand => brand.category))];
    return categories.sort((a, b) => a.localeCompare(b));
  }, []);

  const filteredBrands = useMemo(() => {
    let brands = partnerBrands;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      brands = brands.filter(
        (brand) =>
          brand.name.toLowerCase().includes(query) ||
          brand.category.toLowerCase().includes(query) ||
          brand.origin.toLowerCase().includes(query)
      );
    }
    
    // Filter by selected categories
    if (selectedCategoryFilters.length > 0) {
      brands = brands.filter(brand => selectedCategoryFilters.includes(brand.category));
    }
    
    return brands;
  }, [searchQuery, selectedCategoryFilters]);

  // Group brands by category
  const groupedBrands = useMemo(() => {
    const groups: Record<string, typeof partnerBrands> = {};
    filteredBrands.forEach((brand) => {
      if (!groups[brand.category]) {
        groups[brand.category] = [];
      }
      groups[brand.category].push(brand);
    });
    // Sort categories alphabetically
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredBrands]);

  const toggleCategoryFilter = (category: string) => {
    setSelectedCategoryFilters(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearCategoryFilters = () => {
    setSelectedCategoryFilters([]);
  };

  // Initialize open categories when grouped brands change
  const allCategories = useMemo(() => groupedBrands.map(([category]) => category), [groupedBrands]);
  
  // Set all categories open by default on first render or when categories change
  useEffect(() => {
    setOpenCategories(allCategories);
  }, [allCategories]);

  const isAllExpanded = openCategories.length === allCategories.length;

  const toggleAllCategories = () => {
    if (isAllExpanded) {
      setOpenCategories([]);
    } else {
      setOpenCategories(allCategories);
    }
  };

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
            <span className="ml-3 text-lg md:text-xl lg:text-2xl text-muted-foreground font-body">
              ({partnerBrands.length})
            </span>
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
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <div className="relative w-full max-w-md">
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
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="bg-card/50 border-border/40 hover:bg-card/80">
                  <Filter className="h-4 w-4 mr-2" />
                  Categories
                  {selectedCategoryFilters.length > 0 && (
                    <span className="ml-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {selectedCategoryFilters.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 bg-card border-border z-50" align="end">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif text-sm text-foreground">Filter by Category</h4>
                  {selectedCategoryFilters.length > 0 && (
                    <button
                      onClick={clearCategoryFilters}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allUniqueCategories.map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedCategoryFilters.includes(category)}
                        onCheckedChange={() => toggleCategoryFilter(category)}
                      />
                      <span className="text-sm text-foreground font-body">{category}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {(searchQuery || selectedCategoryFilters.length > 0) && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              {filteredBrands.length} brand{filteredBrands.length !== 1 ? 's' : ''} found
              {selectedCategoryFilters.length > 0 && ` in ${selectedCategoryFilters.length} categor${selectedCategoryFilters.length !== 1 ? 'ies' : 'y'}`}
            </p>
          )}
        </motion.div>

        <div className="flex justify-end mb-4">
          <button
            onClick={toggleAllCategories}
            className="text-sm text-muted-foreground hover:text-primary font-body transition-colors duration-300 flex items-center gap-2"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isAllExpanded ? 'rotate-180' : ''}`} />
            {isAllExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>

        <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories} className="space-y-4">
          {groupedBrands.map(([category, brands], categoryIndex) => (
            <AccordionItem key={category} value={category} className="border border-border/40 rounded-lg bg-card/30 overflow-hidden">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-card/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-serif text-lg md:text-xl text-primary">{category}</span>
                  <span className="text-sm text-muted-foreground font-body">({brands.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-2">
                  {brands.map((brand, index) => (
                    <motion.div
                      key={brand.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={isInView ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.5, delay: categoryIndex * 0.1 + index * 0.05 }}
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
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default BrandsAteliers;
