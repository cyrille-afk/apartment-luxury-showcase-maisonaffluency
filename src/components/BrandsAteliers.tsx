import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Search, X, Instagram, ExternalLink, SlidersHorizontal } from "lucide-react";
import alexanderLamontBg from "@/assets/designers/alexander-lamont-bg.png";
import leoAertsBg from "@/assets/designers/leo-aerts-alinea-bg.jpg";
import apparatusBg from "@/assets/designers/apparatus-studio-bg.jpg";
import atelierFevrierBg from "@/assets/designers/atelier-fevrier-bg.jpg";
import atelierDemichelisBg from "@/assets/designers/atelier-demichelis-bg.jpg";
import emmanuelBabledBg from "@/assets/designers/emmanuel-babled-bg.jpg";
import brunoDeMaistreBg from "@/assets/designers/bruno-de-maistre-bg.jpg";
import celsoDeLemosBg from "@/assets/designers/celso-de-lemos-bg.jpg";
import baleriItaliaBg from "@/assets/designers/baleri-italia-bg.jpg";
import erstensBg from "@/assets/designers/kerstens-bg.jpg";
import ccTapisBg from "@/assets/designers/cc-tapis-bg.jpg";
import cristallerieSaintLouisBg from "@/assets/designers/cristallerie-saint-louis-bg.jpg";
import delcourtBg from "@/assets/designers/delcourt-bg.jpg";
import ecartParisBg from "@/assets/designers/ecart-paris-bg.jpg";
import entrelacsBg from "@/assets/designers/entrelacs-bg.jpg";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";


// Gallery image index mapping (based on flattened gallery items order)
// 0: An Inviting Lounge Area, 1: A Sophisticated Living Room, 2: With Panoramic Cityscape Views
// 3: A Dreamy Tuscan Landscape, 4: A Highly Customised Table, 5: A Relaxed Setting
// 6: A Sophisticated Boudoir, 7: A Serene Decor, 8: A Design Treasure Trove
// 9: A Masterful Suite, 10: Unique by Design, 11: Design Icons and Collectibles

const partnerBrands = [
  {
    id: "alexander-lamont-reef",
    name: "Alexander Lamont",
    category: "Decorative Object",
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
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Straw Marquetry Mantle Box",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 8, // A Design Treasure Trove
  },
  {
    id: "alexander-lamont-corteza",
    name: "Alexander Lamont",
    category: "Tables",
    subcategory: "Tables",
    tableType: "Console Tables",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Corteza Console Table",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 16, // Artisan Materials in The Details Make the Design
  },
  {
    id: "alinea-design-objects",
    name: "Alinea Design Objects",
    category: "Tables",
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
    galleryIndex: 13, // Compact Elegance in A Small Room with Massive Personality
  },
  {
    id: "baleri",
    name: "Baleri Italia",
    category: "Storage",
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
    category: "Tables",
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
    category: "Seating",
    subcategory: "Chairs",
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
    id: "dagmar",
    name: "Dagmar",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    origin: "United Kingdom",
    description: "London-based house founded in 2014, producing classic 20th century Scandinavian furniture for the modern home — celebrating the golden era of Scandinavian Modern design from 1930 to 1970.",
    
    instagram: "https://www.instagram.com/dagmarlondon/",
  },
  {
    name: "Delcourt Collection",
    category: "Seating",
    subcategory: "Armchairs",
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
    category: "Decorative Object",
    subcategory: "Linens",
    origin: "Portugal",
    description: "Portuguese textile house crafting exquisite bed linens and home textiles using the finest natural fibers and artisanal techniques.",
    featured: "Silk Bed Cover",
    instagram: "https://instagram.com/celso.de.lemos",
    galleryIndex: 9, // A Masterful Suite
  },
  {
    id: "entrelacs-creation",
    name: "Entrelacs Création",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    seatType: "Sofas & Loveseats",
    origin: "France",
    description: "French atelier renowned for bespoke upholstery and furniture, combining traditional savoir-faire with contemporary design to create exceptional seating pieces.",
    featured: "Custom Upholstered Sofa",
    instagram: "https://instagram.com/entrelacs_creation",
  },
  {
    id: "damien-langlois-meurinne",
    name: "Damien Langlois Meurinne Studio",
    category: "Tables",
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
    category: "Decorative Object",
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
    category: "Decorative Object",
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
    category: "Seating",
    subcategory: "Chairs",
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
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "French artist duo creating exceptional lost-wax cast crystal sculptures and decorative objects, their work for Théorème Editions exemplifies masterful artistry.",
    featured: "Lost-wax Cast Crystal Centerpiece",
    instagram: "https://instagram.com/garnieretlinker",
    galleryIndex: 1, // A Sophisticated Living Room
  },
  {
    id: "matthieu-gicquel",
    name: "Matthieu Gicquel",
    category: "Decorative Object",
    subcategory: "Tableware",
    origin: "France",
    description: "French glass artist renowned for his exceptional tableware and decorative objects that blend traditional craftsmanship with contemporary design, featuring textured glass adorned with precious gold leaf details.",
    featured: "Texture Glass with Gold Leaf rim Géode",
    instagram: "https://instagram.com/matthieugicquel",
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
    category: "Seating",
    subcategory: "Chairs",
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
    category: "Seating",
    subcategory: "Armchairs",
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
    category: "Decorative Object",
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
    category: "Decorative Object",
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
    category: "Decorative Object",
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
    category: "Seating",
    subcategory: "Armchairs",
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
    category: "Seating",
    subcategory: "Sofas & Loveseats",
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
    category: "Tables",
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
    category: "Decorative Object",
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
    category: "Decorative Object",
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
    category: "Storage",
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
    category: "Storage",
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
    category: "Decorative Object",
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
    category: "Seating",
    subcategory: "Sofas & Loveseats",
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
    category: "Tables",
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
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "Japan",
    description: "Japanese artisan studio specializing in traditional textile craftsmanship with a contemporary sensibility, creating pieces that represent the pinnacle of Japanese comfort design.",
    featured: "Ojami Cushion",
    instagram: "https://instagram.com/takaokaya_en",
    galleryIndex: 5, // A Relaxed Setting
  },
  {
    id: "cristallerie-saint-louis",
    name: "Cristallerie Saint-Louis",
    category: "Lighting",
    subcategory: "Table Lamps",
    origin: "France",
    description: "Founded in 1586, Cristallerie Saint-Louis is France's oldest crystal manufacturer. A crown jewel of Hermès, the maison creates exceptional lighting and decorative objects that blend centuries of savoir-faire with contemporary design.",
    featured: "Amber Folio Portable Lamp by Noé Duchaufour Lawrance",
    instagram: "https://instagram.com/saintlouiscrystal",
    galleryIndex: 17, // Light & Texture in The Details Make the Design
  },
  {
    id: "kerstens",
    name: "Kerstens",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    seatType: "Sofas & Loveseats",
    origin: "Belgium",
    description: "Multidisciplinary design studio founded in 2015 with a distinct vision for architecture, interior and furniture design. The studio aims to create an atmospheric quality within a refined architectural design language.",
    instagram: "",
  },
  {
    id: "man-of-parts",
    name: "Man of Parts",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    seatType: "Sofas & Loveseats",
    origin: "Canada",
    description: "Canadian furniture house creating timeless pieces with a focus on quality materials, exceptional comfort, and refined contemporary design.",
    instagram: "https://instagram.com/manofparts",
  },
];

// Background image map
const brandBgMap: Record<string, string> = {
  "Alexander Lamont": alexanderLamontBg,
  "Alinea Design Objects": leoAertsBg,
  "Apparatus Studio": apparatusBg,
  "Atelier DeMichelis": atelierDemichelisBg,
  "Atelier Février": atelierFevrierBg,
  "Babled Studio": emmanuelBabledBg,
  "Bruno de Maistre": brunoDeMaistreBg,
  "Celso de Lemos": celsoDeLemosBg,
  "Baleri Italia": baleriItaliaBg,
  "Kerstens": erstensBg,
  "CC-Tapis": ccTapisBg,
  "Cristallerie Saint-Louis": cristallerieSaintLouisBg,
  "Delcourt Collection": delcourtBg,
  "Ecart Paris": ecartParisBg,
  "Entrelacs Création": entrelacsBg,
};

// ─── Horizontal scroll strip for one letter group ───────────────────────────
type ConsolidatedBrand = {
  name: string;
  origin: string;
  description: string;
  instagram: string;
  categories: string[];
  featuredItems: Array<{ featured?: string; galleryIndex?: number; category: string }>;
};

function AlphaStrip({
  letter,
  brands,
  isInView,
  scrollToGallery,
}: {
  letter: string;
  brands: ConsolidatedBrand[];
  isInView: boolean;
  scrollToGallery: (idx: number, name: string) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / brands.length;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(idx, brands.length - 1));
  }, [brands.length]);

  const scrollTo = useCallback((idx: number) => {
    const el = stripRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / brands.length;
    el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
  }, [brands.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className="mb-8"
    >
      {/* Letter heading */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <span className="font-serif text-2xl text-primary/60">{letter}</span>
        <div className="flex-1 h-px bg-border/30" />
        <span className="text-[10px] text-muted-foreground/40 tracking-widest font-body uppercase">
          {brands.length} {brands.length === 1 ? "brand" : "brands"}
        </span>
      </div>

      {/* Scrollable strip */}
      <div
        ref={stripRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {brands.map((brand) => {
          const bg = brandBgMap[brand.name];
          const hasBg = !!bg;
          return (
            <div
              key={brand.name}
              id={`brand-${brand.name.replace(/\s+/g, "-").toLowerCase()}`}
              className="group flex-none w-[80vw] md:w-[340px] snap-start border border-border/40 rounded-lg hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 cursor-default relative overflow-hidden p-5 md:p-6"
              style={{ minHeight: "220px" }}
            >
              {/* Lazy-loaded background image */}
              {bg && (
                <img
                  src={bg}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full pointer-events-none select-none"
                  style={{
                    objectFit: brand.name === "Baleri Italia" ? "contain" : "cover",
                    objectPosition: brand.name === "Baleri Italia" ? "center 20%" : "center top",
                    padding: brand.name === "Baleri Italia" ? "10%" : "0",
                  }}
                />
              )}
              <div className={`absolute inset-0 transition-colors duration-300 ${hasBg ? "bg-card/80 group-hover:bg-card/70" : "bg-card/50 group-hover:bg-card/80"}`} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-2">
                    {brand.instagram && (
                      <a
                        href={brand.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 -m-1 touch-manipulation flex-shrink-0 mt-0.5 group/insta"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="h-4 w-4 md:h-5 md:w-5 transition-transform duration-300 group-hover/insta:scale-110" viewBox="0 0 24 24" fill="none" stroke="url(#instagram-gradient-strip)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <defs>
                            <linearGradient id="instagram-gradient-strip" x1="0%" y1="100%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#f09433" />
                              <stop offset="25%" stopColor="#e6683c" />
                              <stop offset="50%" stopColor="#dc2743" />
                              <stop offset="75%" stopColor="#cc2366" />
                              <stop offset="100%" stopColor="#bc1888" />
                            </linearGradient>
                          </defs>
                          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                        </svg>
                      </a>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-lg md:text-xl text-foreground group-hover:text-primary transition-colors duration-300 mb-1">
                        {brand.name}
                      </h3>
                      <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                        {brand.origin}
                      </span>
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
                      {item.featured && item.galleryIndex !== undefined ? (
                        <button
                          onClick={() => scrollToGallery(item.galleryIndex!, brand.name)}
                          className="text-xs md:text-sm text-primary/80 font-body hover:text-primary transition-colors duration-300 flex items-center gap-1 group/link touch-manipulation"
                        >
                          <span className="underline underline-offset-2 decoration-primary/40 group-hover/link:decoration-primary">
                            {item.featured}
                          </span>
                          <svg className="h-3 w-3 opacity-50 group-hover/link:opacity-100 transition-opacity flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </button>
                      ) : item.featured ? (
                        <span className="text-xs md:text-sm text-foreground/80 font-body">
                          {item.featured}
                        </span>
                      ) : null}
                      {itemIndex < brand.featuredItems.length - 1 && item.featured && (
                        <span className="text-muted-foreground mx-1">•</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot indicators — only show when more than 1 card */}
      {brands.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {brands.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "w-5 h-1.5 bg-primary"
                  : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`}
              aria-label={`Go to brand ${i + 1}`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
const BrandsAteliers = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  // Fixed category order matching the artisans section
  const CATEGORY_ORDER = ["Lighting", "Seating", "Storage", "Tables", "Rugs", "Decorative Object"];

  // Build category → subcategory map from brand data
  const categoryMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    
    partnerBrands.forEach(brand => {
      const primaryCat = brand.category;
      if (!map[primaryCat]) map[primaryCat] = new Set();
      const subcat = (brand as any).subcategory || (brand as any).seatType || (brand as any).tableType;
      if (subcat && subcat !== primaryCat) {
        map[primaryCat].add(subcat);
      }
    });
    
    const result: Record<string, string[]> = {};
    CATEGORY_ORDER.forEach(cat => {
      if (map[cat]) {
        result[cat] = Array.from(map[cat]).sort();
      }
    });
    Object.keys(map).forEach(cat => {
      if (!result[cat]) {
        result[cat] = Array.from(map[cat]).sort();
      }
    });
    return result;
  }, []);

  const categories = useMemo(() => {
    const ordered = CATEGORY_ORDER.filter(cat => categoryMap[cat]);
    const extra = Object.keys(categoryMap).filter(cat => !CATEGORY_ORDER.includes(cat));
    return [...ordered, ...extra];
  }, [categoryMap]);

  const filteredBrands = useMemo(() => {
    let brands = partnerBrands;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      brands = brands.filter(
        (brand) =>
          brand.name.toLowerCase().includes(query) ||
          brand.category.toLowerCase().includes(query) ||
          brand.origin.toLowerCase().includes(query)
      );
    }
    
    if (selectedCategory || selectedSubcategory) {
      brands = brands.filter(brand => {
        if (selectedSubcategory) {
          const sub = (brand as any).subcategory || (brand as any).seatType || (brand as any).tableType;
          return sub === selectedSubcategory || brand.category === selectedSubcategory;
        }
        return brand.category === selectedCategory;
      });
    }
    
    return brands;
  }, [searchQuery, selectedCategory, selectedSubcategory]);

  // Consolidate brands by name, sort alphabetically, then group by first letter
  const alphaGroups = useMemo(() => {
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
    
    const sorted = Object.values(brandMap).sort((a, b) => a.name.localeCompare(b.name));
    
    // Group by first letter
    const groups: Record<string, ConsolidatedBrand[]> = {};
    sorted.forEach(brand => {
      const letter = brand.name[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(brand);
    });
    
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredBrands]);

  const totalBrands = alphaGroups.reduce((sum, [, brands]) => sum + brands.length, 0);

  const scrollToGallery = (galleryIndex: number, brandName: string) => {
    const gallerySection = document.getElementById('gallery');
    if (gallerySection) {
      gallerySection.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        sessionStorage.setItem('openGalleryIndex', galleryIndex.toString());
        sessionStorage.setItem('gallerySourceId', `brand-${brandName.replace(/\s+/g, '-').toLowerCase()}`);
      }, 600);
    }
  };

  return (
    <section ref={ref} className="py-10 px-4 md:py-24 md:px-12 lg:px-20 bg-muted/30">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-left"
        >
          <div className="flex items-center gap-3 mb-2 md:mb-3">
            <p className="uppercase tracking-[0.2em] md:tracking-[0.3em] text-primary text-sm md:text-xl lg:text-2xl font-serif">
              OUR PARTNERS
            </p>
            <span className="text-xs md:text-sm text-muted-foreground/50 font-body tracking-widest border border-border/30 rounded-full px-2.5 py-0.5">
              {totalBrands}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-4">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground">
              Brands & Ateliers
            </h2>
            <div className="flex items-center gap-2 pb-1">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Search brands"
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
                  placeholder="Search brands..."
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
          {/* Alphabet jump bar — large serif display */}
          <div
            className="flex md:flex-wrap gap-x-3 md:gap-x-2 gap-y-1 mb-6 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
              const available = alphaGroups.some(([l]) => l === letter);
              return (
                <button
                  key={letter}
                  disabled={!available}
                  onClick={() => {
                    const el = document.getElementById(`alpha-group-${letter}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`flex-none font-serif text-base md:text-lg leading-none transition-all duration-200 ${
                    available
                      ? "text-primary/70 hover:text-primary hover:scale-110 cursor-pointer"
                      : "text-muted-foreground/15 cursor-default"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <div className="w-full h-px bg-border/30 mb-6" />
          <p className="text-base md:text-lg text-muted-foreground font-body max-w-3xl">
            We collaborate with the world's most distinguished furniture houses, textile ateliers, and artisan workshops 
            to bring exceptional pieces to discerning collectors and design professionals.
          </p>
        </motion.div>

        {(searchQuery || selectedCategory) && (
          <p className="text-left text-[10px] text-muted-foreground/50 mb-6 font-body tracking-wider">
            {totalBrands} brand{totalBrands !== 1 ? "s" : ""} found
            {selectedSubcategory && <span> · {selectedSubcategory}</span>}
            {selectedCategory && !selectedSubcategory && <span> · {selectedCategory}</span>}
          </p>
        )}

        {/* Alphabetical strips */}
        <div>
          {alphaGroups.map(([letter, brands]) => (
            <div key={letter} id={`alpha-group-${letter}`} className="scroll-mt-24">
              <AlphaStrip
                letter={letter}
                brands={brands}
                isInView={isInView}
                scrollToGallery={scrollToGallery}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandsAteliers;

