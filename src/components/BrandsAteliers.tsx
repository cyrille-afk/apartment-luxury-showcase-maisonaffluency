import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect } from "react";
import { Search, X, Instagram, ExternalLink, ChevronDown, ChevronRight, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

// Gallery image index mapping (based on flattened gallery items order)
// 0: A Masterful Suite, 1: Unique by Design, 2: Design Icons and Collectibles
// 3: An Inviting Lounge Area, 4: A Sophisticated Living Room, 5: With Panoramic Cityscape Views
// 6: A Sophisticated Boudoir, 7: A Serene Decor, 8: An Art Master Display

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
    galleryIndex: 8, // An Art Master Display
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
    instagram: "https://instagram.com/atelierdemichelis",
    galleryIndex: 4, // Unique by Design
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
    galleryIndex: 8, // An Art Master Display
  },
  {
    id: "bruno-de-maistre",
    name: "Bruno de Maistre",
    category: "Furniture",
    subcategory: "Desks",
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
    subcategory: "Seating",
    seatType: "Chairs",
    origin: "France",
    description: "French design duo creating refined furniture pieces that blend contemporary aesthetics with traditional craftsmanship and timeless elegance.",
    featured: "Augusta Dining Chairs",
    instagram: "https://instagram.com/cazesconquet",
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
    galleryIndex: 3, // A Masterful Suite
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
    galleryIndex: 3, // A Masterful Suite
  },
  {
    id: "damien-langlois-meurinne",
    name: "Damien Langlois-Meurinne",
    category: "Furniture",
    subcategory: "Tables",
    tableType: "Console Tables",
    origin: "France",
    description: "French designer creating bold, sculptural furniture and lighting that combines artistic vision with masterful craftsmanship and luxurious materials.",
    featured: "Ooh La La Console",
    instagram: "https://instagram.com/damienlanglois_meurinne",
    galleryIndex: 5, // Design Icons and Collectibles
  },
  {
    id: "ecart-paris",
    name: "Ecart Paris",
    category: "Furniture",
    subcategory: "Iconic Editions",
    origin: "France",
    description: "Founded by legendary designer Andrée Putman, Ecart International re-edits iconic furniture designs from the 20th century's greatest masters, including Jean-Michel Frank, Eileen Gray, and Pierre Chareau. Their meticulous reproductions preserve the original craftsmanship and materials.",
    featured: "Jean-Michel Frank Re-editions, Eileen Gray Designs",
    instagram: "https://instagram.com/ecart.paris",
    galleryIndex: 1, // A Sophisticated Living Room (Jean-Michel Frank Stool)
  },
  {
    id: "emmanuel-babled",
    name: "Emmanuel Babled",
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
    galleryIndex: 5, // Design Icons and Collectibles
  },
  {
    id: "herve-van-der-straeten",
    name: "Hervé van der Straeten",
    category: "Lighting",
    subcategory: "Chandeliers",
    origin: "France",
    description: "Renowned French designer and artist creating sculptural furniture and lighting in bronze, his pieces are celebrated for their organic forms and exceptional craftsmanship.",
    featured: "Bronze MicMac Chandelier",
    instagram: "https://instagram.com/hervevanderstraeten",
    galleryIndex: 3, // A Masterful Suite
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
    instagram: "https://instagram.com/hamrei_",
    galleryIndex: 6, // A Sophisticated Boudoir
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
    galleryIndex: 3, // A Masterful Suite
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
    instagram: "https://instagram.com/kikolopez_",
    galleryIndex: 5, // Design Icons and Collectibles
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
    instagram: "https://instagram.com/leosentou",
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
    instagram: "https://instagram.com/nathalieziegler",
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
    instagram: "https://instagram.com/_okha",
    galleryIndex: 4, // Unique by Design
  },
  {
    id: "ooumm",
    name: "oOumm",
    category: "Decor",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "French luxury brand creating sculptural marble candles and decorative objects that blend artisanal craftsmanship with contemporary design sensibility.",
    featured: "Lyra Marble Candle",
    instagram: "https://instagram.com/ooumm_paris",
    galleryIndex: 5, // Design Icons and Collectibles
  },
  {
    id: "olivia-cognet",
    name: "Olivia Cognet",
    category: "Lighting",
    subcategory: "Floor Lamps",
    origin: "France",
    description: "French artist and designer creating sculptural ceramic lighting and furniture that celebrates organic forms and handcrafted textures.",
    featured: "Valauris Lamp",
    instagram: "https://instagram.com/oliviacognet",
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
    galleryIndex: 4, // Unique by Design
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
    category: "Rugs",
    origin: "France",
    description: "French textile house continuing the Aubusson tradition of handcrafted rugs and tapestries, blending historical techniques with contemporary design.",
    featured: "Custom Rug Collection",
    instagram: "https://instagram.com/pinton1867",
    galleryIndex: 4, // Unique by Design
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
    instagram: "https://instagram.com/thierrylemaire",
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
    instagram: "https://instagram.com/thierrylemaire",
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
    instagram: "https://instagram.com/takayokaya",
    galleryIndex: 5, // A Relaxed Setting
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

  // Group brands by category, then consolidate by brand name
  const groupedBrands = useMemo(() => {
    const groups: Record<string, typeof partnerBrands> = {};
    filteredBrands.forEach((brand) => {
      if (!groups[brand.category]) {
        groups[brand.category] = [];
      }
      groups[brand.category].push(brand);
    });
    
    // Consolidate brands with same name within each category
    type ConsolidatedBrand = {
      name: string;
      origin: string;
      description: string;
      instagram: string;
      subcategory?: string;
      tableType?: string;
      seatType?: string;
      featuredItems: Array<{ featured: string; galleryIndex?: number }>;
    };
    
    type SubTypeGroup = {
      subType: string | null;
      brands: ConsolidatedBrand[];
    };
    
    type SubcategoryGroup = {
      subcategory: string | null;
      brands: ConsolidatedBrand[];
      subTypeGroups?: SubTypeGroup[];
    };
    
    const consolidatedGroups: Record<string, SubcategoryGroup[]> = {};
    
    Object.entries(groups).forEach(([category, brands]) => {
      const brandMap: Record<string, ConsolidatedBrand> = {};
      brands.forEach((brand) => {
        const brandKey = `${brand.name}-${(brand as any).subcategory || ''}-${(brand as any).tableType || ''}-${(brand as any).seatType || ''}`;
        if (!brandMap[brandKey]) {
          brandMap[brandKey] = {
            name: brand.name,
            origin: brand.origin,
            description: brand.description,
            instagram: brand.instagram,
            subcategory: (brand as any).subcategory,
            tableType: (brand as any).tableType,
            seatType: (brand as any).seatType,
            featuredItems: [],
          };
        }
        brandMap[brandKey].featuredItems.push({
          featured: brand.featured,
          galleryIndex: brand.galleryIndex,
        });
      });
      
      // Group by subcategory
      const subcategoryMap: Record<string, ConsolidatedBrand[]> = {};
      Object.values(brandMap).forEach((brand) => {
        const subKey = brand.subcategory || '__none__';
        if (!subcategoryMap[subKey]) {
          subcategoryMap[subKey] = [];
        }
        subcategoryMap[subKey].push(brand);
      });
      
      // Convert to array and handle subType grouping for Tables and Seating subcategories
      const subcategoryGroups: SubcategoryGroup[] = Object.entries(subcategoryMap)
        .map(([key, brandList]) => {
          const subcategory = key === '__none__' ? null : key;
          
          // For Tables subcategory, group by tableType
          if (subcategory === 'Tables') {
            const subTypeMap: Record<string, ConsolidatedBrand[]> = {};
            brandList.forEach((brand) => {
              const typeKey = brand.tableType || '__none__';
              if (!subTypeMap[typeKey]) {
                subTypeMap[typeKey] = [];
              }
              subTypeMap[typeKey].push(brand);
            });
            
            // Sort brands within each subType by name
            Object.values(subTypeMap).forEach((list) => {
              list.sort((a, b) => a.name.localeCompare(b.name));
            });
            
            const subTypeGroups: SubTypeGroup[] = Object.entries(subTypeMap)
              .map(([typeKey, typeBrands]) => ({
                subType: typeKey === '__none__' ? null : typeKey,
                brands: typeBrands,
              }))
              .sort((a, b) => {
                if (a.subType === null && b.subType !== null) return 1;
                if (a.subType !== null && b.subType === null) return -1;
                if (a.subType && b.subType) {
                  return a.subType.localeCompare(b.subType);
                }
                return 0;
              });
            
            return {
              subcategory,
              brands: [],
              subTypeGroups,
            };
          }
          
          // For Seating subcategory, group by seatType
          if (subcategory === 'Seating') {
            const subTypeMap: Record<string, ConsolidatedBrand[]> = {};
            brandList.forEach((brand) => {
              const typeKey = brand.seatType || '__none__';
              if (!subTypeMap[typeKey]) {
                subTypeMap[typeKey] = [];
              }
              subTypeMap[typeKey].push(brand);
            });
            
            // Sort brands within each subType by name
            Object.values(subTypeMap).forEach((list) => {
              list.sort((a, b) => a.name.localeCompare(b.name));
            });
            
            const subTypeGroups: SubTypeGroup[] = Object.entries(subTypeMap)
              .map(([typeKey, typeBrands]) => ({
                subType: typeKey === '__none__' ? null : typeKey,
                brands: typeBrands,
              }))
              .sort((a, b) => {
                if (a.subType === null && b.subType !== null) return 1;
                if (a.subType !== null && b.subType === null) return -1;
                if (a.subType && b.subType) {
                  return a.subType.localeCompare(b.subType);
                }
                return 0;
              });
            
            return {
              subcategory,
              brands: [],
              subTypeGroups,
            };
          }
          
          // Sort brands within each subcategory by name
          brandList.sort((a, b) => a.name.localeCompare(b.name));
          
          return {
            subcategory,
            brands: brandList,
          };
        })
        .sort((a, b) => {
          if (a.subcategory === null && b.subcategory !== null) return -1;
          if (a.subcategory !== null && b.subcategory === null) return 1;
          if (a.subcategory && b.subcategory) {
            return a.subcategory.localeCompare(b.subcategory);
          }
          return 0;
        });
      
      consolidatedGroups[category] = subcategoryGroups;
    });
    
    // Sort categories alphabetically
    return Object.entries(consolidatedGroups).sort((a, b) => a[0].localeCompare(b[0]));
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
                      <Filter className="h-3.5 w-3.5 mr-1.5" />
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
                
                <button
                  onClick={toggleAllCategories}
                  className="text-xs text-muted-foreground hover:text-primary font-body transition-colors duration-300 flex items-center gap-1 h-9 px-2"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isAllExpanded ? 'rotate-180' : ''}`} />
                  <span className="hidden sm:inline">{isAllExpanded ? 'Collapse' : 'Expand'}</span>
                </button>
              </div>
            </div>
            
            {(searchQuery || selectedCategoryFilters.length > 0) && (
              <p className="text-center text-xs text-muted-foreground mt-2">
                {filteredBrands.length} brand{filteredBrands.length !== 1 ? 's' : ''} found
                {selectedCategoryFilters.length > 0 && ` in ${selectedCategoryFilters.length} categor${selectedCategoryFilters.length !== 1 ? 'ies' : 'y'}`}
              </p>
            )}
          </div>
        </motion.div>

        <Accordion
          type="multiple" 
          value={openCategories} 
          onValueChange={(values) => {
            // Trigger haptic feedback on mobile
            if ('vibrate' in navigator) {
              navigator.vibrate(10);
            }
            setOpenCategories(values);
            // On mobile, scroll to the newly opened category
            if (window.innerWidth < 768 && values.length > openCategories.length) {
              const newCategory = values.find(v => !openCategories.includes(v));
              if (newCategory) {
                setTimeout(() => {
                  const element = document.querySelector(`[data-category="${newCategory}"]`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }
            }
          }} 
          className="space-y-3 md:space-y-4"
        >
          {groupedBrands.map(([category, brands], categoryIndex) => (
            <AccordionItem 
              key={category} 
              value={category} 
              data-category={category}
              className="border border-border/40 rounded-lg bg-card/30 overflow-hidden scroll-mt-4"
            >
              <AccordionTrigger className="px-4 md:px-6 py-3 md:py-4 hover:no-underline hover:bg-card/50 transition-colors active:scale-[0.99] touch-manipulation">
                <span className="font-serif text-base md:text-lg lg:text-xl text-primary">{category}</span>
              </AccordionTrigger>
              <AccordionContent className="px-3 md:px-6 pb-4 md:pb-6">
                <div className="space-y-6 md:space-y-8 pt-2">
                  {brands.map((subcategoryGroup, subIndex) => (
                    <div key={subcategoryGroup.subcategory || 'general'}>
                      {subcategoryGroup.subcategory ? (
                        <Collapsible className="group/sub space-y-3 md:space-y-4">
                          <CollapsibleTrigger className="flex items-center gap-3 w-full hover:opacity-80 transition-opacity cursor-pointer">
                            <ChevronRight className="h-4 w-4 text-primary/60 transition-transform duration-200 group-data-[state=open]/sub:rotate-90" />
                            <h4 className="font-serif text-sm md:text-base text-primary/80 uppercase tracking-wider">
                              {subcategoryGroup.subcategory}
                            </h4>
                            <div className="flex-1 h-px bg-border/40" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-3 md:space-y-4">
                            {/* Handle subTypeGroups for Tables and Seating subcategories */}
                            {subcategoryGroup.subTypeGroups ? (
                              subcategoryGroup.subTypeGroups.map((subTypeGroup, typeIndex) => (
                                <Collapsible key={subTypeGroup.subType || 'general-subtype'} className="group/type space-y-2 md:space-y-3 ml-4 md:ml-6">
                                  {subTypeGroup.subType && (
                                    <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-80 transition-opacity cursor-pointer">
                                      <ChevronRight className="h-3 w-3 text-primary/50 transition-transform duration-200 group-data-[state=open]/type:rotate-90" />
                                      <h5 className="font-body text-xs md:text-sm text-primary/70 uppercase tracking-wider">
                                        {subTypeGroup.subType}
                                      </h5>
                                      <div className="flex-1 h-px bg-border/30" />
                                    </CollapsibleTrigger>
                                  )}
                                  <CollapsibleContent className={`space-y-3 md:space-y-4 ${subTypeGroup.subType ? 'ml-3 md:ml-5' : ''}`}>
                                    {subTypeGroup.brands.map((brand, index) => (
                                      <motion.div
                                        key={`${category}-${brand.name}-${brand.tableType || brand.seatType || ''}`}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                                        transition={{ duration: 0.4, delay: categoryIndex * 0.1 + subIndex * 0.05 + typeIndex * 0.03 + index * 0.02 }}
                                        className="group p-4 md:p-5 bg-card/50 border border-border/40 rounded-lg hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
                                              <h3 className="font-serif text-base md:text-lg text-foreground group-hover:text-primary transition-colors duration-300">
                                                {brand.name}
                                              </h3>
                                              <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                                                — {brand.origin}
                                              </span>
                                            </div>
                                            <p className="text-xs md:text-sm text-muted-foreground font-body leading-relaxed mb-2 line-clamp-2 md:line-clamp-none">
                                              {brand.description}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                                              <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Gallery Featured:</span>
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
                                          </div>
                                          {brand.instagram && (
                                            <a
                                              href={brand.instagram}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-muted-foreground hover:text-primary transition-colors duration-300 p-1.5 -m-1.5 touch-manipulation flex-shrink-0 ml-3"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <Instagram className="h-5 w-5 md:h-4 md:w-4" />
                                            </a>
                                          )}
                                        </div>
                                      </motion.div>
                                    ))}
                                  </CollapsibleContent>
                                </Collapsible>
                              ))
                            ) : (
                              subcategoryGroup.brands.map((brand, index) => (
                                <motion.div
                                  key={`${category}-${brand.name}`}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                                  transition={{ duration: 0.4, delay: categoryIndex * 0.1 + subIndex * 0.05 + index * 0.03 }}
                                  className="group p-4 md:p-5 bg-card/50 border border-border/40 rounded-lg hover:bg-card/80 hover:border-primary/30 transition-all duration-300 ml-4 md:ml-6"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
                                        <h3 className="font-serif text-base md:text-lg text-foreground group-hover:text-primary transition-colors duration-300">
                                          {brand.name}
                                        </h3>
                                        <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                                          — {brand.origin}
                                        </span>
                                      </div>
                                      <p className="text-xs md:text-sm text-muted-foreground font-body leading-relaxed mb-2 line-clamp-2 md:line-clamp-none">
                                        {brand.description}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                                        <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Gallery Featured:</span>
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
                                    </div>
                                    {brand.instagram && (
                                      <a
                                        href={brand.instagram}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-primary transition-colors duration-300 p-1.5 -m-1.5 touch-manipulation flex-shrink-0 ml-3"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Instagram className="h-5 w-5 md:h-4 md:w-4" />
                                      </a>
                                    )}
                                  </div>
                                </motion.div>
                              ))
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      ) : (
                        <div className="space-y-3 md:space-y-4">
                          {subcategoryGroup.brands.map((brand, index) => (
                            <motion.div
                              key={`${category}-${brand.name}`}
                              initial={{ opacity: 0, y: 20 }}
                              animate={isInView ? { opacity: 1, y: 0 } : {}}
                              transition={{ duration: 0.4, delay: categoryIndex * 0.1 + subIndex * 0.05 + index * 0.03 }}
                              className="group p-4 md:p-5 bg-card/50 border border-border/40 rounded-lg hover:bg-card/80 hover:border-primary/30 transition-all duration-300"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
                                    <h3 className="font-serif text-base md:text-lg text-foreground group-hover:text-primary transition-colors duration-300">
                                      {brand.name}
                                    </h3>
                                    <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                                      — {brand.origin}
                                    </span>
                                  </div>
                                  <p className="text-xs md:text-sm text-muted-foreground font-body leading-relaxed mb-2 line-clamp-2 md:line-clamp-none">
                                    {brand.description}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                                    <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Gallery Featured:</span>
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
                                </div>
                                {brand.instagram && (
                                  <a
                                    href={brand.instagram}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-primary transition-colors duration-300 p-1.5 -m-1.5 touch-manipulation flex-shrink-0 ml-3"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Instagram className="h-5 w-5 md:h-4 md:w-4" />
                                  </a>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
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
