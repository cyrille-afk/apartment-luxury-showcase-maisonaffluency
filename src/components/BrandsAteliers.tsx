import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo } from "react";
import { Search, X, Instagram, ExternalLink, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

// Gallery image index mapping (based on flattened gallery items order)
// 0: An Inviting Lounge Area, 1: A Sophisticated Living Room, 2: With Panoramic Cityscape Views
// 3: A Dreamy Tuscan Landscape, 4: A Highly Customised Table, 5: A Relaxed Setting
// 6: A Sophisticated Boudoir, 7: A Serene Decor, 8: A Design Treasure Trove
// 9: A Masterful Suite, 10: Unique by Design, 11: Design Icons and Collectibles

const partnerBrands = [
  {
    id: "alexander-lamont-reef",
    name: "Alexander Lamont",
    category: "Decor",
    subcategory: "Decorative Objects",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Reef Vessels",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 0, // An Inviting Lounge Area
  },
  {
    id: "alexander-lamont-mantle",
    name: "Alexander Lamont",
    category: "Decor",
    subcategory: "Decorative Objects",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Straw Marquetry Mantle Box",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 8, // A Design Treasure Trove
  },
  {
    id: "alinea-design-objects",
    name: "Alinea Design Objects",
    category: "Furniture",
    subcategory: "Tables",
    tableType: "Dining Tables",
    origin: "Belgium",
    description: "Belgian design house curating and producing exceptional furniture pieces that blend sculptural form with functional elegance.",
    featured: "Angelo M Table",
    instagram: "https://instagram.com/alinea_design_objects",
    galleryIndex: 2, // With Panoramic Cityscape Views
  },
  {
    id: "atelier-demichelis",
    name: "Atelier DeMichelis",
    category: "Lighting",
    subcategory: "Table Lamps",
    origin: "France",
    description: "French atelier crafting limited edition lighting pieces that combine organic forms with precious materials, each piece a sculptural work of art.",
    featured: "Limited Edition Bud Table Lamp",
    instagram: "https://instagram.com/atelier_demichelis",
    galleryIndex: 10, // Unique by Design
  },
  {
    id: "atelier-fevrier",
    name: "Atelier Février",
    category: "Rugs",
    origin: "France",
    description: "French atelier specializing in bespoke handcrafted rugs, combining traditional weaving techniques with contemporary design sensibility.",
    featured: "Ricky Custom Rug",
    instagram: "https://instagram.com/atelierfevrier",
    galleryIndex: 0, // An Inviting Lounge Area
  },
  {
    id: "apparatus-studio-median",
    name: "Apparatus Studio",
    category: "Lighting",
    subcategory: "Ceiling Lights",
    origin: "United States",
    description: "New York-based design studio creating refined lighting and furniture that bridges art and function through meticulous craftsmanship and material exploration.",
    featured: "Median 3 Surface Alabaster Lights",
    instagram: "https://instagram.com/apparatusstudio",
    galleryIndex: 0, // An Inviting Lounge Area
  },
  {
    id: "apparatus-studio-metronome",
    name: "Apparatus Studio",
    category: "Lighting",
    subcategory: "Floor Lamps",
    origin: "United States",
    description: "New York-based design studio creating refined lighting and furniture that bridges art and function through meticulous craftsmanship and material exploration.",
    featured: "Metronome Reading Suede Floor Lamp",
    instagram: "https://instagram.com/apparatusstudio",
    galleryIndex: 7, // A Serene Decor
  },
  {
    id: "apparatus-studio-lantern",
    name: "Apparatus Studio",
    category: "Lighting",
    subcategory: "Table Lamps",
    origin: "United States",
    description: "New York-based design studio creating refined lighting and furniture that bridges art and function through meticulous craftsmanship and material exploration.",
    featured: "Lantern Table Lamp",
    instagram: "https://instagram.com/apparatusstudio",
  },
  {
    id: "baleri",
    name: "Baleri Italia",
    category: "Furniture",
    subcategory: "Bookcases & Credenzas",
    origin: "Italy",
    description: "Italian furniture company known for innovative designs and collaborations with leading architects and designers since 1984.",
    featured: "Plato Bookcase",
    instagram: "https://instagram.com/baleriitalia",
    galleryIndex: 8, // A Design Treasure Trove
  },
  {
    id: "bruno-de-maistre",
    name: "Bruno de Maistre",
    category: "Furniture",
    subcategory: "Desks",
    origin: "France",
    description: "French furniture designer creating refined bespoke pieces that combine classical proportions with contemporary elegance and exceptional craftsmanship.",
    featured: "Lyric Desk",
    instagram: "https://instagram.com/bruno_de_maistre_bdm",
    galleryIndex: 6, // A Sophisticated Boudoir
  },
  {
    id: "cazes-conquet",
    name: "Cazes & Conquet",
    category: "Furniture",
    subcategory: "Seating",
    seatType: "Chairs",
    origin: "France",
    description: "French design duo creating refined furniture pieces that blend contemporary aesthetics with traditional craftsmanship and timeless elegance.",
    featured: "Augusta Dining Chairs",
    instagram: "https://instagram.com/thierryconquet",
    galleryIndex: 2, // With Panoramic Cityscape Views
  },
  {
    id: "cc-tapis",
    name: "CC-Tapis",
    category: "Rugs",
    origin: "Italy",
    description: "Italian rug manufacturer known for contemporary designs and traditional Nepalese hand-knotting techniques. Their Giudecca custom rugs blend artistry with exceptional craftsmanship.",
    featured: "Giudecca Custom Rug",
    instagram: "https://instagram.com/cc_tapis",
    galleryIndex: 9, // A Masterful Suite
  },
  {
    id: "delcourt-collection",
    name: "Delcourt Collection",
    category: "Furniture",
    subcategory: "Seating",
    seatType: "Armchairs",
    origin: "France",
    description: "Prestigious French furniture house known for their refined approach to contemporary seating and upholstery, combining generous proportions with elegant detailing.",
    featured: "BOB Armchair",
    instagram: "https://instagram.com/delcourtcollection",
    galleryIndex: 5, // A Relaxed Setting
  },
  {
    id: "celso-de-lemos",
    name: "Celso de Lemos",
    category: "Decor",
    subcategory: "Linens",
    origin: "Portugal",
    description: "Portuguese textile house crafting exquisite bed linens and home textiles using the finest natural fibers and artisanal techniques.",
    featured: "Silk Bed Cover",
    instagram: "https://instagram.com/celso.de.lemos",
    galleryIndex: 9, // A Masterful Suite
  },
  {
    id: "damien-langlois-meurinne",
    name: "Damien Langlois Meurinne Studio",
    category: "Furniture",
    subcategory: "Tables",
    tableType: "Console Tables",
    origin: "France",
    description: "French designer creating bold, sculptural furniture and lighting that combines artistic vision with masterful craftsmanship and luxurious materials.",
    featured: "Ooh La La Console",
    instagram: "https://instagram.com/damienlangloismeurinne_studio",
    galleryIndex: 11, // Design Icons and Collectibles
  },
  {
    id: "ecart-paris",
    name: "Ecart Paris",
    category: "Furniture",
    subcategory: "Iconic Editions",
    origin: "France",
    description: "Founded by legendary designer Andrée Putman, Ecart International re-edits iconic furniture designs from the 20th century's greatest masters, including Jean-Michel Frank and Pierre Chareau. Their meticulous reproductions preserve the original craftsmanship and materials.",
    featured: "Jean-Michel Frank Table Soleil 1930",
    instagram: "https://instagram.com/ecart.paris",
    galleryIndex: 1, // A Sophisticated Living Room (Jean-Michel Frank Stool)
  },
  {
    id: "emmanuel-babled",
    name: "Babled Studio",
    category: "Decor",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "French-Italian designer creating limited edition sculptural objects in glass and marble, his Osmosi Series represents the pinnacle of material exploration and artistic vision.",
    featured: "Limited Edition Osmosi Series Sculptured Book Cover",
    instagram: "https://instagram.com/emmanuelbabled",
    galleryIndex: 2, // With Panoramic Cityscape Views
  },
  {
    id: "eric-schmitt-studio",
    name: "Eric Schmitt Studio",
    category: "Furniture",
    subcategory: "Seating",
    seatType: "Chairs",
    origin: "France",
    description: "French designer creating bold sculptural furniture in bronze and iron, each piece a statement of artistic vision and master craftsmanship.",
    featured: "Chairie Dining Chair",
    instagram: "https://instagram.com/studio_eric_schmitt_",
    galleryIndex: 2, // With Panoramic Cityscape Views
  },
  {
    id: "garnier-linker",
    name: "Garnier & Linker",
    category: "Decor",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "French artist duo creating exceptional lost-wax cast crystal sculptures and decorative objects, their work for Théorème Editions exemplifies masterful artistry.",
    featured: "Lost-wax Cast Crystal Centerpiece",
    instagram: "https://instagram.com/garnieretlinker",
    galleryIndex: 1, // A Sophisticated Living Room
  },
  {
    id: "haymann-editions",
    name: "Haymann Editions",
    category: "Lighting",
    subcategory: "Table Lamps",
    origin: "France",
    description: "British design studio creating sculptural lighting and objects in carved marble and natural materials, each piece a unique work of art.",
    featured: "Carved Marble Marie Lamp",
    instagram: "https://instagram.com/haymanneditions",
    galleryIndex: 11, // Design Icons and Collectibles
  },
  {
    id: "herve-van-der-straeten",
    name: "Hervé van der Straeten",
    category: "Lighting",
    subcategory: "Chandeliers",
    origin: "France",
    description: "Renowned French designer and artist creating sculptural furniture and lighting in bronze, his pieces are celebrated for their organic forms and exceptional craftsmanship.",
    featured: "Bronze MicMac Chandelier",
    instagram: "https://instagram.com/hervevanderstraetengalerie",
    galleryIndex: 9, // A Masterful Suite
  },
  {
    id: "hamrei",
    name: "Hamrei",
    category: "Furniture",
    subcategory: "Seating",
    seatType: "Chairs",
    origin: "France",
    description: "French design studio crafting whimsical and sculptural furniture pieces that blend playful forms with exceptional craftsmanship and artistic expression.",
    featured: "Pépé Chair",
    instagram: "https://instagram.com/hamrei",
    galleryIndex: 3, // A Dreamy Tuscan Landscape (Intimate Setting)
  },
  {
    id: "jindrich-halabala",
    name: "Jindrich Halabala",
    category: "Furniture",
    subcategory: "Seating",
    seatType: "Armchairs",
    origin: "Czech Republic",
    description: "Legendary Czech furniture designer whose iconic mid-century lounge chairs represent the pinnacle of functionalist design, prized by collectors worldwide.",
    featured: "Lounge Chair",
    instagram: "",
    galleryIndex: 0, // An Inviting Lounge Area
  },
  {
    id: "iksel-brunelleschi",
    name: "Iksel",
    category: "Decor",
    subcategory: "Wallcoverings",
    origin: "United Kingdom",
    description: "Masters of decorative wallcoverings, creating hand-painted panoramic murals and scenic wallpapers inspired by historical archives and artistic traditions.",
    featured: "Brunelleschi Perspective Wallcover",
    instagram: "https://instagram.com/iksel_decorative_arts",
    galleryIndex: 9, // A Masterful Suite
  },
  {
    id: "iksel-white-blossom",
    name: "Iksel",
    category: "Decor",
    subcategory: "Wallcoverings",
    origin: "United Kingdom",
    description: "Masters of decorative wallcoverings, creating hand-painted panoramic murals and scenic wallpapers inspired by historical archives and artistic traditions.",
    featured: "White Blossom Wallcover",
    instagram: "https://instagram.com/iksel_decorative_arts",
    galleryIndex: 7, // A Serene Decor
  },
  {
    id: "kiko-lopez",
    name: "Kiko Lopez",
    category: "Decor",
    subcategory: "Mirrors",
    origin: "France",
    description: "French glass artist renowned for his extraordinary hand-silvered mirrors and sculptural glass works, each piece a unique testament to ancient techniques reimagined.",
    featured: "Silver Glass Hammer Mirror",
    instagram: "https://instagram.com/kikolumieres",
    galleryIndex: 11, // Design Icons and Collectibles
  },
  {
    id: "leo-sentou",
    name: "Leo Sentou",
    category: "Furniture",
    subcategory: "Seating",
    seatType: "Armchairs",
    origin: "France",
    description: "French furniture designer creating refined contemporary pieces that balance sculptural presence with functional elegance and exceptional craftsmanship.",
    featured: "AB Armchair",
    instagram: "https://www.instagram.com/leosentou",
    galleryIndex: 1, // A Sophisticated Living Room
  },
  {
    id: "made-in-kira",
    name: "Made in Kira",
    category: "Lighting",
    subcategory: "Table Lamps",
    origin: "France",
    description: "Japanese lighting atelier creating delicate paper and natural material lamps that embody the principles of wabi-sabi and mindful design.",
    featured: "Toshiro Lamp",
    instagram: "https://instagram.com/madeinkira",
    galleryIndex: 6, // A Sophisticated Boudoir
  },
  {
    id: "nathalie-ziegler",
    name: "Nathalie Ziegler",
    category: "Lighting",
    subcategory: "Chandeliers",
    origin: "France",
    description: "French glass artist creating bespoke chandeliers and sculptural glass pieces, each work a unique expression of light and organic form.",
    featured: "Custom Glass Chandelier",
    instagram: "https://instagram.com/nathaliezieglerpasqua",
    galleryIndex: 6, // A Sophisticated Boudoir
  },
  {
    id: "nika-zupanc",
    name: "Nika Zupanc Studio",
    category: "Furniture",
    subcategory: "Seating",
    seatType: "Sofas & Loveseats",
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
    subcategory: "Tables",
    tableType: "Side Tables",
    origin: "South Africa",
    description: "South African design studio creating sophisticated furniture that bridges African craft traditions with contemporary global aesthetics.",
    featured: "Adam Court's Villa Pedestal Nightstand",
    instagram: "https://instagram.com/__okha",
    galleryIndex: 10, // Unique by Design
  },
  {
    id: "ooumm",
    name: "oOumm",
    category: "Decor",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "French luxury brand creating sculptural marble candles and decorative objects that blend artisanal craftsmanship with contemporary design sensibility.",
    featured: "Lyra Marble Candle",
    instagram: "https://instagram.com/ooummparis",
    galleryIndex: 11, // Design Icons and Collectibles
  },
  {
    id: "olivia-cognet",
    name: "Olivia Cognet",
    category: "Lighting",
    subcategory: "Floor Lamps",
    origin: "France",
    description: "French artist and designer creating sculptural ceramic lighting and furniture that celebrates organic forms and handcrafted textures.",
    featured: "Valauris Lamp",
    instagram: "https://www.instagram.com/olivia_cognet",
    galleryIndex: 1, // A Sophisticated Living Room
  },
  {
    id: "peter-reed",
    name: "Peter Reed 1861",
    category: "Decor",
    subcategory: "Linens",
    origin: "United Kingdom",
    description: "British heritage brand creating the world's finest bed linens since 1861, using exclusive long-staple Egyptian cotton and meticulous craftsmanship.",
    featured: "Riyad Double Faced Throw and Cushion",
    instagram: "https://instagram.com/peterreed1861",
    galleryIndex: 10, // Unique by Design
  },
  {
    id: "pierre-bonnefille",
    name: "Pierre Bonnefille",
    category: "Fine Art",
    origin: "France",
    description: "French artist renowned for his bronze paintings and sculptural works, creating pieces that blur the boundaries between painting and sculpture through masterful material exploration.",
    featured: "Bronze Painting 204",
    instagram: "https://instagram.com/pierrebonnefille",
    galleryIndex: 8, // A Design Treasure Trove
  },
  {
    id: "pinton-1867",
    name: "Pinton 1867",
    category: "Rugs",
    origin: "France",
    description: "French textile house continuing the Aubusson tradition of handcrafted rugs and tapestries, blending historical techniques with contemporary design.",
    featured: "Custom Rug Collection",
    instagram: "https://instagram.com/pinton1867",
    galleryIndex: 10, // Unique by Design
  },
  {
    id: "poltrona-frau",
    name: "Poltrona Frau",
    category: "Furniture",
    subcategory: "Bookcases & Credenzas",
    origin: "Italy",
    description: "Iconic Italian furniture house renowned for exceptional leather craftsmanship since 1912. Their timeless designs grace prestigious residences and institutions worldwide.",
    featured: "Albero Bookcase",
    instagram: "https://instagram.com/poltronafrauofficial",
    galleryIndex: 0, // An Inviting Lounge Area
  },
  {
    id: "robicara",
    name: "Robicara",
    category: "Furniture",
    subcategory: "Bookcases & Credenzas",
    origin: "Italy",
    description: "Italian design studio creating bespoke furniture and cabinetry with exceptional attention to material, proportion, and craftsmanship.",
    featured: "Sira Credenza",
    instagram: "https://instagram.com/robicaradesign",
    galleryIndex: 1, // A Sophisticated Living Room
  },
  {
    id: "theoreme-editions",
    name: "Théorème Editions",
    category: "Decor",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "French publisher of limited edition decorative objects, collaborating with renowned artists and designers including Garnier & Linker.",
    featured: "Lost-wax Cast Crystal Centerpiece",
    instagram: "https://instagram.com/theoreme_editions",
    galleryIndex: 1, // A Sophisticated Living Room
  },
  {
    id: "thierry-lemaire-sofa",
    name: "Thierry Lemaire",
    category: "Furniture",
    subcategory: "Seating",
    seatType: "Sofas & Loveseats",
    origin: "France",
    description: "Renowned French interior architect and furniture designer creating timeless bespoke pieces that blend classical elegance with contemporary refinement.",
    featured: "Niko 420 Custom Sofa",
    instagram: "https://www.instagram.com/thierrylemaire_/?hl=en",
    galleryIndex: 0, // An Inviting Lounge Area
  },
  {
    id: "thierry-lemaire-table",
    name: "Thierry Lemaire",
    category: "Furniture",
    subcategory: "Tables",
    tableType: "Coffee Tables",
    origin: "France",
    description: "Renowned French interior architect and furniture designer creating timeless bespoke pieces that blend classical elegance with contemporary refinement.",
    featured: "Orsay Centre Table",
    instagram: "https://www.instagram.com/thierrylemaire_/?hl=en",
    galleryIndex: 1, // A Sophisticated Living Room
  },
  {
    id: "takayokaya",
    name: "Takayokaya",
    category: "Decor",
    subcategory: "Decorative Objects",
    origin: "Japan",
    description: "Japanese artisan studio specializing in traditional textile craftsmanship with a contemporary sensibility, creating pieces that represent the pinnacle of Japanese comfort design.",
    featured: "Ojami Cushion",
    instagram: "https://instagram.com/takaokaya_en",
    galleryIndex: 5, // A Relaxed Setting
  },
];

const BrandsAteliers = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [searchQuery, setSearchQuery] = useState("");
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

  // Consolidate brands by name and sort alphabetically
  const consolidatedBrands = useMemo(() => {
    type ConsolidatedBrand = {
      name: string;
      origin: string;
      description: string;
      instagram: string;
      categories: string[];
      featuredItems: Array<{ featured: string; galleryIndex?: number; category: string }>;
    };
    
    const brandMap: Record<string, ConsolidatedBrand> = {};
    
    filteredBrands.forEach((brand) => {
      if (!brandMap[brand.name]) {
        brandMap[brand.name] = {
          name: brand.name,
          origin: brand.origin,
          description: brand.description,
          instagram: brand.instagram,
          categories: [],
          featuredItems: [],
        };
      }
      if (!brandMap[brand.name].categories.includes(brand.category)) {
        brandMap[brand.name].categories.push(brand.category);
      }
      brandMap[brand.name].featuredItems.push({
        featured: brand.featured,
        galleryIndex: brand.galleryIndex,
        category: brand.category,
      });
    });
    
    // Return sorted array of brands
    return Object.values(brandMap).sort((a, b) => a.name.localeCompare(b.name));
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

  const scrollToGallery = (galleryIndex: number) => {
    const gallerySection = document.getElementById('gallery');
    if (gallerySection) {
      gallerySection.scrollIntoView({ behavior: 'smooth' });
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
          className="sticky top-0 z-40 -mx-4 px-4 md:-mx-12 md:px-12 lg:-mx-20 lg:px-20 py-3 md:py-4 mb-4 bg-muted/95 backdrop-blur-md border-b border-border/20"
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search brands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 bg-card/80 border-border/40 focus:border-primary/60 h-9 text-sm"
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
              
              <div className="flex items-center gap-2 sm:gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-card/80 border-border/40 hover:bg-card h-9">
                      <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                      <span className="hidden sm:inline">Categories</span>
                      {selectedCategoryFilters.length > 0 && (
                        <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">
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
            </div>
            
            {(searchQuery || selectedCategoryFilters.length > 0) && (
              <p className="text-center text-xs text-muted-foreground mt-2">
                {consolidatedBrands.length} brand{consolidatedBrands.length !== 1 ? 's' : ''} found
                {selectedCategoryFilters.length > 0 && ` in ${selectedCategoryFilters.length} categor${selectedCategoryFilters.length !== 1 ? 'ies' : 'y'}`}
              </p>
            )}
          </div>
        </motion.div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {consolidatedBrands.map((brand, brandIndex) => (
            <motion.div
              key={brand.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: brandIndex * 0.02 }}
              className="group p-5 md:p-6 bg-card/50 border border-border/40 rounded-lg hover:bg-card/80 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 cursor-default"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg md:text-xl text-foreground group-hover:text-primary transition-colors duration-300 mb-1">
                    {brand.name}
                  </h3>
                  <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                    {brand.origin}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-3">
                  {brand.instagram && (
                    <a
                      href={brand.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors duration-300 p-1.5 -m-1.5 touch-manipulation"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Instagram className="h-5 w-5" />
                    </a>
                  )}
                  <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                    {brand.categories.map((category, catIndex) => (
                      <span 
                        key={catIndex}
                        className="text-[9px] md:text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <p className="text-xs md:text-sm text-muted-foreground font-body leading-relaxed mb-3 line-clamp-3">
                {brand.description}
              </p>
              
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Featured:</span>
                {brand.featuredItems.map((item, itemIndex) => (
                  <span key={itemIndex} className="flex items-center">
                    {item.galleryIndex !== undefined ? (
                      <button
                        onClick={() => scrollToGallery(item.galleryIndex!)}
                        className="text-xs md:text-sm text-primary/80 font-body hover:text-primary transition-colors duration-300 flex items-center gap-1 group/link touch-manipulation"
                      >
                        <span className="underline underline-offset-2 decoration-primary/40 group-hover/link:decoration-primary">
                          {item.featured}
                        </span>
                        <ExternalLink className="h-3 w-3 opacity-50 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                      </button>
                    ) : (
                      <span className="text-xs md:text-sm text-foreground/80 font-body">
                        {item.featured}
                      </span>
                    )}
                    {itemIndex < brand.featuredItems.length - 1 && (
                      <span className="text-muted-foreground mx-1">•</span>
                    )}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandsAteliers;
