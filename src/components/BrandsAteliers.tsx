import { motion } from "framer-motion";
import { useInView, AnimatePresence } from "framer-motion";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Search, X, Instagram, ExternalLink, SlidersHorizontal, ChevronDown, Star, Maximize2, Minimize2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
import alexanderLamontBg from "@/assets/designers/alexander-lamont-bg.png";
import leoAertsBg from "@/assets/designers/leo-aerts-alinea-bg.jpg";
import apparatusBg from "@/assets/designers/apparatus-studio-bg.jpg";
import atelierFevrierBg from "@/assets/designers/atelier-fevrier-bg.jpg";
import atelierDemichelisBg from "@/assets/designers/atelier-demichelis-bg.jpg";
import emmanuelBabledBg from "@/assets/designers/emmanuel-babled-bg.jpg";
import brunoDeMaistreBg from "@/assets/designers/bruno-de-maistre-bg.jpg";
import celsoDeLemosBg from "@/assets/designers/celso-de-lemos-bg.jpg";

import delaEspadaBg from "@/assets/designers/de-la-espada-bg.jpg";
import damienLangloisMeurinneBg from "@/assets/designers/damien-langlois-meurinne-bg.jpg";
import berntPetersenBg from "@/assets/designers/bernt-petersen-bg.jpg";
import erstensBg from "@/assets/designers/kerstens-bg.jpg";
import ccTapisBg from "@/assets/designers/cc-tapis-bg.jpg";
import cristallerieSaintLouisBg from "@/assets/designers/cristallerie-saint-louis-bg.jpg";
import delcourtBg from "@/assets/designers/delcourt-bg.jpg";
import ecartParisBg from "@/assets/designers/ecart-paris-bg.jpg";
import entrelacsBg from "@/assets/designers/entrelacs-bg.jpg";
import garnierLinkerBg from "@/assets/designers/garnier-linker-bg.jpg";
import haymannEditionsBg from "@/assets/designers/haymann-editions-bg.jpg";
import kiraBg from "@/assets/designers/kira-bg.jpg";
import okhaBg from "@/assets/designers/okha-bg.jpg";
import cazesConquetBg from "@/assets/designers/cazes-conquet-bg.jpg";
import hamreiBg from "@/assets/designers/hamrei-bg.jpg";
import ikselBg from "@/assets/designers/iksel-bg.jpg";
import kikoLopezBg from "@/assets/designers/kiko-lopez-bg.jpg";
import leoSentouBg from "@/assets/designers/leo-sentou-bg.jpg";
import manOfPartsBg from "@/assets/designers/man-of-parts-bg.jpg";
import takayokayaBg from "@/assets/designers/takayokaya-bg.jpg";
import theoremeEditionsBg from "@/assets/designers/theoreme-editions-bg.jpg";
import thierryLemaireBg from "@/assets/designers/thierry-lemaire-bg.jpg";
import sergeMouilleBg from "@/assets/designers/serge-mouille-bg.jpg";
import robicaraBg from "@/assets/designers/robicara-bg.jpg";
import peterReedBg from "@/assets/designers/peter-reed-bg.jpg";
import pierreBonnefilleBg from "@/assets/designers/pierre-bonnefille-bg.jpg";
import pinton1867Bg from "@/assets/designers/pinton-1867-bg.jpg";
import ericSchmittBg from "@/assets/designers/eric-schmitt-bg.jpg";
import jindrichHalabalaBg from "@/assets/designers/jindrich-halabala-bg.jpg";
import oliviaCognetBg from "@/assets/designers/olivia-cognet-bg.jpg";
import ooummBg from "@/assets/designers/ooumm-bg.png";
import matthieuGicquelBg from "@/assets/designers/matthieu-gicquel-bg.png";
import poltronaFrauBg from "@/assets/designers/poltrona-frau-bg.jpg";
import nathalieZieglerBg from "@/assets/designers/nathalie-ziegler-bg.png";
import seCollectionsBg from "@/assets/designers/se-collections-bg.png";
import maisonWecraftBg from "@/assets/designers/maison-wecraft-bg.jpg";
import herveVanDerStraetenBg from "@/assets/designers/herve-van-der-straeten-bg.png";
import pouenatBg from "@/assets/designers/pouenat-bg.png";
import valeriaNascimentoBg from "@/assets/designers/valeria-nascimento-bg.png";
import simonCabrolBg from "@/assets/designers/simon-cabrol-bg.jpg";
import andreePutmanBg from "@/assets/designers/andree-putman-bg.jpg";
import noomBg from "@/assets/designers/noom-bg.png";
import nicolasAubagnacBg from "@/assets/designers/nicolas-aubagnac-bg.png";
import ozoneLightBg from "@/assets/designers/ozone-light-bg.jpg";
import collectionParticuliereBg from "@/assets/designers/collection-particuliere-bg.jpg";
import biekeCasteleynBg from "@/assets/designers/bieke-casteleyn-bg.jpg";
import galerieMcdeBg from "@/assets/designers/galerie-mcde-bg.png";
import gillesBoissierBg from "@/assets/designers/gilles-boissier-bg.png";
import jacobHashimotoBg from "@/assets/designers/jacob-hashimoto-bg.png";
import paulCocksedgeBg from "@/assets/designers/paul-cocksedge-bg.jpg";
import leBerreVevaudBg from "@/assets/designers/le-berre-vevaud-bg.png";
import binaBaitelBg from "@/assets/designers/bina-baitel-bg.png";
import charlesParisBg from "@/assets/designers/charles-paris-bg.png";
import victoriaMagniantBg from "@/assets/designers/victoria-magniant-bg.png";
import pierreYovanovitchBg from "@/assets/designers/pierre-yovanovitch-bg.png";
import brunoMoinardBg from "@/assets/designers/bruno-moinard-bg.png";
import noeDuchaufourBg from "@/assets/designers/noe-duchaufour-lawrance.jpg";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import redaAmalouBg from "@/assets/designers/reda-amalou-bg.png";
import homLeXuanBg from "@/assets/designers/hom-le-xuan-bg.jpg";

// Gallery image index mapping (based on flattened gallery items order)
// 0: An Inviting Lounge Area, 1: A Sophisticated Living Room, 2: With Panoramic Cityscape Views
// 3: A Dreamy Tuscan Landscape, 4: A Highly Customised Table, 5: A Relaxed Setting
// 6: A Sophisticated Boudoir, 7: A Serene Decor, 8: A Design Treasure Trove
// 9: A Masterful Suite, 10: Unique by Design, 11: Design Tableau
// 12: Artistic Statement, 13: Compact Elegance, 14: A Sunlit Corner
// 15: A Workspace of Distinction, 16: Refined Details, 17: Light & Focus
// 18: Curated Vignette, 19: Artisan Materials, 20: Light & Texture

const partnerBrands = [
  {
    id: "alexander-lamont-mantle",
    name: "Alexander Lamont",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Straw Marquetry Mantle Box",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 10, // A Design Treasure Trove
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
    galleryIndex: 23, // Artisan Materials in The Details Make the Design
  },
  {
    id: "alexander-lamont-hammered",
    name: "Alexander Lamont",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "Thailand",
    description: "Master craftsman creating exquisite decorative objects using rare materials and ancient techniques, blending Eastern and Western artistic traditions.",
    featured: "Textured Bronze Globes Hammered Bowls",
    instagram: "https://instagram.com/alexanderlamont",
    galleryIndex: 3, // A Sun Lit Reading Corner in A Sociable Environment
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
    id: "alinea-design-objects-side",
    name: "Alinea Design Objects",
    category: "Tables",
    subcategory: "Tables",
    tableType: "Side Tables",
    origin: "Belgium",
    description: "Belgian design house curating and producing exceptional furniture pieces that blend sculptural form with functional elegance.",
    featured: "Angelo M/SR 55 Side Table",
    instagram: "https://instagram.com/alinea_design_objects",
    galleryIndex: 6, // A Relaxed Setting
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
    galleryIndex: 12, // Unique by Design
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
    galleryIndex: 10, // A Serene Decor
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
    galleryIndex: 16, // Compact Elegance in A Small Room with Massive Personality
  },
  {
    id: "bieke-casteleyn",
    name: "Bieke Casteleyn",
    category: "Tables",
    subcategory: "Tables",
    origin: "Belgium",
    description: "Belgian designer of refined interiors and sculptural furniture, handcrafted in Belgium. Trained at Sint-Lucas School of Arts in Ghent and Domus Academy in Milan, her collections bring high-end serenity through innovative materials and harmonious forms.",
    instagram: "https://www.instagram.com/biekecasteleyn/",
  },
  {
    id: "bruno-de-maistre",
    name: "Bruno de Maistre - Atelier BdM",
    category: "Tables",
    subcategory: "Desks",
    origin: "France",
    description: "French furniture designer creating refined bespoke pieces that combine classical proportions with contemporary elegance and exceptional craftsmanship.",
    featured: "Lyric Desk",
    instagram: "https://instagram.com/bruno_de_maistre_bdm",
    galleryIndex: 7, // A Sophisticated Boudoir
  },
  {
    id: "bina-baitel",
    name: "Bina Baitel Studio",
    category: "Decorative Objects",
    subcategory: "Sculptural Objects",
    origin: "France",
    description: "Paris-based design studio creating interior and industrial design projects as well as unique creations in collaboration with museums and galleries, with a constant focus on timeless projects and a search for innovation.",
    instagram: "https://instagram.com/binabaitel",
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
    galleryIndex: 12, // A Masterful Suite
  },
  {
    id: "collection-particuliere",
    name: "Collection Particulière",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    origin: "France",
    description: "Launched in Paris in 2014 by Jérôme Aumont, Collection Particulière invites renowned designers to create contemporary furniture firmly rooted in French and European craftsmanship, blurring the line between furniture, object and collectible design.",
    instagram: "https://www.instagram.com/collection_particuliere/",
  },
  {
    id: "dagmar",
    name: "Dagmar London",
    category: "Tables",
    subcategory: "Desks",
    origin: "United Kingdom",
    description: "London-based house founded in 2014, producing classic 20th century Scandinavian furniture for the modern home — celebrating the golden era of Scandinavian Modern design from 1930 to 1970.",
    featured: "Bernt Petersen 4-Drawer Executive Desk, c1960s",
    instagram: "https://www.instagram.com/dagmarlondon/",
    galleryIndex: 19, // A Workspace of Distinction - Home Office with a View
  },
  {
    id: "de-la-espada",
    name: "De La Espada",
    category: "Tables",
    subcategory: "Tables",
    origin: "Portugal",
    description: "Anglo-Portuguese furniture studio creating refined contemporary pieces rooted in the craft traditions of Portugal, combining natural materials with precise joinery and enduring form.",
    instagram: "https://www.instagram.com/delaespada/",
  },
  {
    id: "delcourt",
    name: "Delcourt Collection",
    category: "Seating",
    subcategory: "Armchairs",
    seatType: "Armchairs",
    origin: "France",
    description: "Prestigious French furniture house known for their refined approach to contemporary seating and upholstery, combining generous proportions with elegant detailing.",
    featured: "BOB Armchair",
    instagram: "https://instagram.com/delcourtcollection",
    galleryIndex: 6, // A Relaxed Setting
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
    galleryIndex: 12, // A Masterful Suite
  },
  {
    id: "entrelacs-creation",
    name: "Entrelacs Création",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    seatType: "Sofas & Loveseats",
    origin: "France",
    description: "French atelier renowned for bespoke upholstery and furniture, combining traditional savoir-faire with contemporary design to create exceptional seating pieces.",
    instagram: "https://www.instagram.com/entrelacs_lightings/",
  },
  {
    id: "entrelacs-creation-kheops",
    name: "Entrelacs Création",
    category: "Lighting",
    subcategory: "Wall Lights",
    origin: "France",
    description: "French atelier renowned for bespoke upholstery and furniture, combining traditional savoir-faire with contemporary design to create exceptional seating pieces.",
    featured: "Kheops Bronze & Alabaster Wall Light",
    instagram: "https://www.instagram.com/entrelacs_lightings/",
    galleryIndex: 19, // A Workspace of Distinction - Home Office with a View
  },
  {
    id: "damien-langlois-meurinne",
    name: "Damien Langlois Meurinne Studio",
    category: "Tables",
    subcategory: "Tables",
    tableType: "Console Tables",
    origin: "France",
    description: "French designer creating bold, sculptural furniture and lighting that combines artistic vision with masterful craftsmanship and luxurious materials.",
    featured: "Ooh La La Console for Sé Collections",
    instagram: "https://instagram.com/damienlangloismeurinne_studio",
    galleryIndex: 15, // Design Tableau
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
    galleryIndex: 3, // A Sun Lit Reading Corner (Jean-Michel Frank Table Soleil 1930)
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
    featured: "Carved Marble Marie Lamp by Toni Grilo",
    instagram: "https://instagram.com/haymanneditions",
    galleryIndex: 13, // Design Tableau
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
    galleryIndex: 12, // A Masterful Suite
  },
  {
    id: "hamrei",
    name: "Hamrei",
    category: "Seating",
    subcategory: "Chairs",
    seatType: "Chairs",
    origin: "Portugal",
    description: "French design studio crafting whimsical and sculptural furniture pieces that blend playful forms with exceptional craftsmanship and artistic expression.",
    featured: "Pépé Chair",
    instagram: "https://instagram.com/hamrei",
    galleryIndex: 4, // A Dreamy Tuscan Landscape (Intimate Setting)
  },
  {
    id: "hom-le-xuan",
    name: "Hom Le Xuan",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "Franco-Vietnamese designer creating refined furniture and decorative objects that blend Eastern craftsmanship with Western contemporary design sensibility.",
    instagram: "https://www.instagram.com/hom_lexuan/?hl=en",
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
    galleryIndex: 23, // Curated Vignette
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
    galleryIndex: 12, // A Masterful Suite
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
    galleryIndex: 9, // A Serene Decor
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
    galleryIndex: 13, // Design Tableau
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
    galleryIndex: 3, // A Sun Lit Reading Corner
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
    galleryIndex: 8, // A Sophisticated Boudoir
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
    galleryIndex: 7, // A Sophisticated Boudoir
  },
  {
    id: "maison-wecraft",
    name: "Maison WeCraft",
    category: "Lighting",
    subcategory: "Lighting",
    origin: "Singapore",
    description: "Singapore-based atelier bridging artisanal craftsmanship with contemporary design across lighting, rugs, and bespoke storage solutions.",
    instagram: "https://instagram.com/maisonwecraft",
  },
  {
    id: "maison-wecraft-rugs",
    name: "Maison WeCraft",
    category: "Rugs",
    subcategory: "Rugs",
    origin: "Singapore",
    description: "Singapore-based atelier bridging artisanal craftsmanship with contemporary design across lighting, rugs, and bespoke storage solutions.",
    instagram: "https://instagram.com/maisonwecraft",
  },
  {
    id: "maison-wecraft-storage",
    name: "Maison WeCraft",
    category: "Storage",
    subcategory: "Storage",
    origin: "Singapore",
    description: "Singapore-based atelier bridging artisanal craftsmanship with contemporary design across lighting, rugs, and bespoke storage solutions.",
    instagram: "https://instagram.com/maisonwecraft",
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
    galleryIndex: 15, // Unique by Design
  },
  {
    id: "ooumm",
    name: "oOumm",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "French luxury brand creating sculptural marble candles and decorative objects that blend artisanal craftsmanship with contemporary design sensibility.",
    featured: "Dan Yeffet's Lyra Marble Candle",
    instagram: "https://instagram.com/ooummparis",
    galleryIndex: 13, // Design Tableau
  },
  {
    id: "olivia-cognet",
    name: "Olivia Cognet",
    category: "Lighting",
    subcategory: "Floor Lamps",
    origin: "France",
    description: "French artist and designer creating sculptural ceramic lighting and furniture that celebrates organic forms and handcrafted textures.",
    featured: "Blue glazed Vallauris floor lamp",
    instagram: "https://www.instagram.com/olivia_cognet",
    galleryIndex: 3, // A Sun Lit Reading Corner
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
    galleryIndex: 14, // A Venetian Dream
  },
  {
    id: "pierre-bonnefille",
    name: "Pierre Bonnefille",
    category: "Fine Art",
    origin: "France",
    description: "French artist renowned for his bronze paintings and sculptural works, creating pieces that blur the boundaries between painting and sculpture through masterful material exploration.",
    featured: "Bronze Painting 204",
    instagram: "https://instagram.com/pierrebonnefille",
    galleryIndex: 11, // A Design Treasure Trove
  },
  {
    id: "pinton-1867",
    name: "Pinton 1867",
    category: "Rugs",
    origin: "France",
    description: "French textile house continuing the Aubusson tradition of handcrafted rugs and tapestries, blending historical techniques with contemporary design.",
    featured: "Custom Rug Collection",
    instagram: "https://instagram.com/pinton1867",
    galleryIndex: 12, // Unique by Design
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
    id: "reda-amalou-design",
    name: "Reda Amalou Design",
    category: "Tables",
    subcategory: "Tables",
    tableType: "Side Tables",
    origin: "France",
    description: "French architect and designer creating collectible furniture editions that transcend the boundaries between architecture and design, with pieces of geometric precision and sculptural elegance.",
    featured: "DOT Side Table",
    instagram: "https://instagram.com/redaamalou",
    galleryIndex: 17,
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
    galleryIndex: 6, // A Relaxed Setting
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
    galleryIndex: 20, // Light & Texture in The Details Make the Design
  },
  {
    id: "kerstens",
    name: "Kerstens",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    seatType: "Sofas & Loveseats",
    origin: "Belgium",
    description: "Multidisciplinary design studio founded in 2015 with a distinct vision for architecture, interior and furniture design. The studio aims to create an atmospheric quality within a refined architectural design language.",
    instagram: "https://www.instagram.com/_kerstens/?hl=en",
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
  {
    id: "serge-mouille",
    name: "Serge Mouille",
    category: "Lighting",
    subcategory: "Floor Lamps",
    origin: "France",
    description: "Serge Mouille (1922–1988) is considered the most important French lighting designer of the 1950s. Trained as a silversmith, he brought the precision of jewelry-making to lighting design. His tripod floor lamps and spider wall lights are now part of MoMA's permanent collection.",
    instagram: "https://www.instagram.com/sergemouilleofficial/?hl=en",
  },
  {
    id: "pouenat",
    name: "Pouenat",
    category: "Lighting",
    subcategory: "Floor Lamps",
    origin: "France",
    description: "Founded in 1880, Pouenat is a Parisian atelier of master metalworkers (bronziers) specializing in bespoke lighting and furniture. Collaborating with leading designers including Tristan Auer, the house produces exceptional limited-edition pieces where artisanal metalwork meets contemporary design vision.",
    instagram: "https://www.instagram.com/pouenat.official/?hl=en",
  },
  {
    id: "se-collections",
    name: "Sé Collections",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    seatType: "Sofas & Loveseats",
    origin: "United Kingdom",
    description: "London-based luxury furniture house collaborating with visionary designers including Nika Zupanc, Jaime Hayon and Damien Langlois-Meurinne to create bold, sculptural pieces that push the boundaries of contemporary design.",
    featured: "Stardust Loveseat by Nika Zupanc",
    instagram: "https://www.instagram.com/se_collections/",
    galleryIndex: 9, // A Serene Decor in A Personal Sanctuary
  },
  {
    id: "se-collections-ooh-la-la",
    name: "Sé Collections",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    seatType: "Sofas & Loveseats",
    origin: "United Kingdom",
    description: "London-based luxury furniture house collaborating with visionary designers including Nika Zupanc, Jaime Hayon and Damien Langlois-Meurinne to create bold, sculptural pieces that push the boundaries of contemporary design.",
    featured: "Ooh La La Console by Damien Langlois-Meurinne",
    instagram: "https://www.instagram.com/se_collections/",
    galleryIndex: 13, // Design Tableau
  },
  {
    id: "valeria-nascimento",
    name: "Valeria Nascimento",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "United Kingdom",
    description: "Brazilian-born, London-based artist inspired by the exuberant landscapes of her native Goiânia and the works of Burle Marx and Niemeyer. Trained in architecture, she creates intricate ceramic botanical sculptures that fuse natural forms with urban sensibility.",
    instagram: "https://www.instagram.com/valerianascimento_studio/",
  },
  {
    id: "simon-cabrol",
    name: "Simon Cabrol",
    category: "Storage",
    subcategory: "Cabinets",
    origin: "France",
    description: "French artisan designer and cabinetmaker whose style is a delicate balance between form, color, and detail. Trained with the Compagnons du Devoir, his work captivates the imagination, eliciting tactile and visual emotion.",
    instagram: "https://www.instagram.com/simoncabrol/?hl=en",
  },
  {
    id: "nicolas-aubagnac",
    name: "Nicolas Aubagnac",
    category: "Lighting",
    subcategory: "Lighting",
    origin: "France",
    description: "French designer creating refined lighting and furniture pieces that blend Art Deco influences with contemporary sensibility, celebrated for their sculptural elegance and luxurious materials.",
    instagram: "https://www.instagram.com/nicolas_aubagnac/",
  },
  {
    id: "noom",
    name: "Noom",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    seatType: "Sofas & Loveseats",
    origin: "Ukraine",
    description: "Ukrainian design studio creating bold, sculptural furniture that fuses modernist geometry with artisanal craftsmanship and rich material palettes.",
    instagram: "https://www.instagram.com/noomhome/",
  },
  {
    id: "andree-putman",
    name: "Andrée Putman",
    category: "Tables",
    subcategory: "Desks",
    origin: "France",
    description: "Iconic French designer who reset and expanded our visual culture in interior decoration. Her passion for craftsmanship, knowledge of French Arts Décoratifs tradition, and eye for minimalist shapes made her a legend. Her designs are re-issued by Ecart International.",
    instagram: "https://www.instagram.com/andreeputman_/?hl=en",
  },
  {
    id: "ozone-light",
    name: "Ozone Light",
    category: "Lighting",
    subcategory: "Lighting",
    origin: "France",
    description: "Parisian lighting atelier founded in 2000 by Etienne Gounot and Eric Jähnke, creating refined luminaires that fuse artisanal craftsmanship with the technology of light.",
    instagram: "https://www.instagram.com/ozone_light/?hl=en",
  },
  {
    id: "charles-paris",
    name: "Charles Paris",
    category: "Lighting",
    subcategory: "Lighting",
    origin: "France",
    description: "Maison Charles Paris, founded in 1908, is a prestigious French lighting manufacturer renowned for its exceptional bronze work and artisanal savoir-faire, creating timeless luminaires that illuminate the world's finest interiors.",
    instagram: "https://www.instagram.com/maisoncharlesparis/",
  },
  {
    id: "gilles-boissier",
    name: "Gilles & Boissier",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "Parisian design duo Patrick Gilles and Dorothée Boissier create refined furniture and objects that blend French elegance with global influences, celebrated for their sophisticated material palettes and timeless sensibility.",
    instagram: "https://www.instagram.com/gillesetboissier.home/",
  },
  {
    id: "paul-cocksedge-studio",
    name: "Paul Cocksedge Studio",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "United Kingdom",
    description: "London-based studio led by Paul Cocksedge, known for poetic and inventive design that transforms everyday materials into extraordinary sculptural works, installations, and functional objects.",
    instagram: "https://www.instagram.com/paulcocksedge/",
  },
  {
    id: "jacob-hashimoto-studio",
    name: "Jacob Hashimoto Studio",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "United States",
    description: "American artist creating immersive, large-scale installations from thousands of hand-crafted bamboo and paper kites, weaving together painting, sculpture, and architecture into mesmerizing layered compositions.",
    instagram: "https://www.instagram.com/jacobhashimotostudio/",
  },
  {
    id: "le-berre-vevaud",
    name: "Le Berre Vevaud",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "Parisian interior architecture studio founded by Fabrice Le Berre and Antoine Vevaud, celebrated for their sophisticated approach to luxury interiors that harmonize contemporary art with classical French elegance.",
    instagram: "https://www.instagram.com/leberrevevaud/",
  },
  {
    id: "galerie-mcde",
    name: "Galerie MCDE",
    category: "Decorative Object",
    subcategory: "Iconic Editions",
    origin: "France",
    description: "Parisian gallery dedicated to the re-edition and preservation of Pierre Chareau's visionary furniture and lighting designs, maintaining the legacy of one of the 20th century's most influential French designers.",
    instagram: "https://www.instagram.com/galeriemcde/",
  },
  {
    id: "victoria-magniant",
    name: "Victoria Magniant",
    category: "Tables",
    subcategory: "Limited Editions",
    origin: "France",
    description: "Limited-edition furniture designer trained at Central Saint Martins, Victoria Magniant develops her practice in Paris in close collaboration with master artisans, creating pieces at the intersection of design, sculpture, and the decorative arts.",
    instagram: "https://www.instagram.com/victoria_magniant/",
  },
  {
    id: "pierre-yovanovitch",
    name: "Pierre Yovanovitch",
    category: "Seating",
    subcategory: "Furniture",
    origin: "France",
    description: "French architect and designer renowned for his bold, sculptural furniture that merges modernist rigor with a warm, tactile sensibility, produced in collaboration with the finest European ateliers.",
    instagram: "https://www.instagram.com/pierre.yovanovitch.mobilier/",
  },
  {
    id: "bruno-moinard-editions",
    name: "Bruno Moinard Editions",
    category: "Tables",
    subcategory: "Furniture",
    origin: "France",
    description: "French architect and designer Bruno Moinard creates refined furniture editions that embody timeless Parisian elegance, blending noble materials with masterful craftsmanship and understated sophistication.",
    instagram: "https://www.instagram.com/brunomoinard/",
  },
  {
    id: "ndl-editions",
    name: "NDL Editions",
    category: "Furniture",
    subcategory: "Furniture",
    origin: "France",
    description: "NDL Editions is the eponymous furniture line by Noé Duchaufour-Lawrance, translating his organic, biomorphic design language into a curated collection of limited-edition furniture pieces crafted with exceptional materials and artisanal savoir-faire.",
    instagram: "https://www.instagram.com/noeduchaufourlawrance/",
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
  "Bruno de Maistre - Atelier BdM": brunoDeMaistreBg,
  "Bina Baitel Studio": binaBaitelBg,
  "Celso de Lemos": celsoDeLemosBg,
  
  "Garnier & Linker": garnierLinkerBg,
  "Haymann Editions": haymannEditionsBg,
  "Made in Kira": kiraBg,
  "Okha": okhaBg,
  "De La Espada": delaEspadaBg,
  "Damien Langlois Meurinne Studio": damienLangloisMeurinneBg,
  "Dagmar London": berntPetersenBg,
  "Kerstens": erstensBg,
  "CC-Tapis": ccTapisBg,
  "Cristallerie Saint-Louis": cristallerieSaintLouisBg,
  "Delcourt Collection": delcourtBg,
  "Ecart Paris": ecartParisBg,
  "Entrelacs Création": entrelacsBg,
  "Cazes & Conquet": cazesConquetBg,
  "Hamrei": hamreiBg,
  "Iksel": ikselBg,
  "Kiko Lopez": kikoLopezBg,
  "Leo Sentou": leoSentouBg,
  "Man of Parts": manOfPartsBg,
  "Takayokaya": takayokayaBg,
  "Théorème Editions": theoremeEditionsBg,
  "Thierry Lemaire": thierryLemaireBg,
  "Serge Mouille": sergeMouilleBg,
  "Robicara": robicaraBg,
  "Reda Amalou Design": redaAmalouBg,
  "Peter Reed 1861": peterReedBg,
  "Pierre Bonnefille": pierreBonnefilleBg,
  "Pinton 1867": pinton1867Bg,
  "Eric Schmitt Studio": ericSchmittBg,
  "Jindrich Halabala": jindrichHalabalaBg,
  "Olivia Cognet": oliviaCognetBg,
  "oOumm": ooummBg,
  "Matthieu Gicquel": matthieuGicquelBg,
  "Nathalie Ziegler": nathalieZieglerBg,
  "Sé Collections": seCollectionsBg,
  "Maison WeCraft": maisonWecraftBg,
  "Hervé van der Straeten": herveVanDerStraetenBg,
  "Pouenat": pouenatBg,
  "Poltrona Frau": poltronaFrauBg,
  "Valeria Nascimento": valeriaNascimentoBg,
  "Simon Cabrol": simonCabrolBg,
  "Andrée Putman": andreePutmanBg,
  "Noom": noomBg,
  "Nicolas Aubagnac": nicolasAubagnacBg,
  "Ozone Light": ozoneLightBg,
  "Collection Particulière": collectionParticuliereBg,
  "Bieke Casteleyn": biekeCasteleynBg,
  "Galerie MCDE": galerieMcdeBg,
  "Gilles & Boissier": gillesBoissierBg,
  "Jacob Hashimoto Studio": jacobHashimotoBg,
  "Paul Cocksedge Studio": paulCocksedgeBg,
  "Le Berre Vevaud": leBerreVevaudBg,
  "Charles Paris": charlesParisBg,
  "Victoria Magniant": victoriaMagniantBg,
  "Pierre Yovanovitch": pierreYovanovitchBg,
  "Bruno Moinard Editions": brunoMoinardBg,
  "NDL Editions": noeDuchaufourBg,
  "Hom Le Xuan": homLeXuanBg,
};

// Mapping from consolidated brand names to FeaturedDesigners IDs for Curators' Picks navigation
const brandToDesignerMap: Record<string, string> = {
  "Alexander Lamont": "alexander-lamont",
  "Alinea Design Objects": "leo-aerts-alinea",
  "Apparatus Studio": "apparatus-studio",
  "Atelier Février": "atelier-fevrier",
  "Atelier Pendhapa": "atelier-pendhapa",
  "Babled Studio": "emmanuel-babled",
  "Bruno de Maistre - Atelier BdM": "bruno-de-maistre",
  "Bina Baitel Studio": "bina-baitel",
  "Ecart Paris": "jean-michel-frank",
  "Eric Schmitt Studio": "eric-schmitt-studio",
  "Garnier & Linker": "garnier-linker",
  "Hamrei": "hamrei",
  "Hervé van der Straeten": "herve-van-der-straeten",
  "Kerstens": "kerstens",
  "Kiko Lopez": "kiko-lopez",
  "Leo Sentou": "leo-sentou",
  "Made in Kira": "kira",
  "Man of Parts": "man-of-parts",
  "Nathalie Ziegler": "nathalie-ziegler",
  "Okha": "adam-courts-okha",
  "Olivia Cognet": "olivia-cognet",
  "Pierre Bonnefille": "pierre-bonnefille",
  "Robicara": "robicara",
  "Reda Amalou Design": "reda-amalou",
  "Thierry Lemaire": "thierry-lemaire",
  "Théorème Editions": "theoreme-editions",
  "Cristallerie Saint-Louis": "noe-duchaufour-lawrance",
  "NDL Editions": "noe-duchaufour-lawrance",
  "Delcourt Collection": "forest-giaconia",
  "Entrelacs Création": "entrelacs-creation",
  "Charles Paris": "felix-agostini",
  "Sé Collections": "se-collections",
  "Reda Amalou": "reda-amalou",
  "Bina Baitel": "bina-baitel",
  "Emanuelle Levet Stenne": "emanuelle-levet-stenne",
  "Milan Pekař": "milan-pekar",
  "Matthieu Gicquel": "matthieu-gicquel",
  "CC-Tapis": "cc-tapis",
  "Haymann Editions": "haymann-editions",
  "Atelier DeMichelis": "atelier-demichelis",
  "De La Espada": "de-la-espada",
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
  onOpenPicks,
}: {
  letter: string;
  brands: ConsolidatedBrand[];
  isInView: boolean;
  scrollToGallery: (idx: number, name: string) => void;
  onOpenPicks: (brandName: string) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

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
              onClick={() => setExpandedCard(expandedCard === brand.name ? null : brand.name)}
              className={`group flex-none w-[80vw] md:w-[340px] snap-start border border-border/40 rounded-lg hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden p-5 md:p-6 ${expandedCard === brand.name ? "min-h-[280px] md:min-h-[300px]" : "h-[280px] md:h-[300px]"}`}
            >
              {/* Lazy-loaded background image */}
              {bg && (
                <img
                  src={bg}
                  alt=""
                  loading="eager"
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full pointer-events-none select-none"
                  style={{
                    objectFit: "cover",
                    objectPosition: brand.name === "Jindrich Halabala" ? "center center" : brand.name === "Eric Schmitt Studio" ? "center 30%" : brand.name === "Dagmar London" ? "center 45%" : brand.name === "Robicara" ? "center 45%" : brand.name === "Okha" ? "center 30%" : brand.name === "Sé Collections" ? "center center" : brand.name === "Andrée Putman" ? "center 60%" : "center top",
                  }}
                />
              )}
              <div className={`absolute inset-0 transition-all duration-300 ${hasBg ? "bg-black/35 group-hover:bg-black/25" : "bg-card/50 group-hover:bg-card/80"}`} />
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
                        <svg className="h-6 w-6 md:h-7 md:w-7 transition-transform duration-300 group-hover/insta:scale-110" viewBox="0 0 24 24" fill="none" stroke="url(#instagram-gradient-strip)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                      <h3 className={`font-serif text-lg md:text-xl transition-colors duration-300 mb-1 ${hasBg ? "text-white" : "text-foreground group-hover:text-primary"}`}>
                        {brand.name}
                      </h3>
                      <span className={`text-[10px] md:text-xs uppercase tracking-wider transition-colors duration-300 ${hasBg ? "text-white/80" : "text-muted-foreground"}`}>
                        {brand.origin}
                      </span>
                    </div>
                  </div>
                </div>

                <p className={`text-xs md:text-sm font-body leading-relaxed mb-3 transition-colors duration-300 pl-8 md:pl-0 ${expandedCard === brand.name ? "" : "line-clamp-3"} ${hasBg ? "text-white/90" : "text-muted-foreground"}`}>
                  {brand.description}
                </p>

                {brand.featuredItems.some(item => item.featured) && (
                <div className="space-y-1 mb-3 pl-8 md:pl-0">
                  <span className={`text-[10px] md:text-xs uppercase tracking-wider block transition-colors duration-300 ${hasBg ? "text-white/70" : "text-muted-foreground"}`}>Gallery Featured</span>
                  <ul className="space-y-0.5">
                    {brand.featuredItems.map((item, itemIndex) => (
                      <li key={itemIndex}>
                        {item.featured && item.galleryIndex !== undefined ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); scrollToGallery(item.galleryIndex!, brand.name); }}
                            className={`text-xs md:text-sm font-body hover:text-primary transition-colors duration-300 flex items-center gap-1 group/link touch-manipulation text-left ${hasBg ? "text-white" : "text-foreground"}`}
                          >
                            <span className={`underline underline-offset-2 ${hasBg ? "decoration-white/40 group-hover/link:decoration-white" : "decoration-primary/40 group-hover/link:decoration-primary"}`}>
                              {item.featured}
                            </span>
                            <svg className={`h-3 w-3 opacity-50 group-hover/link:opacity-100 transition-opacity flex-shrink-0 ${hasBg ? "text-white/80" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          </button>
                        ) : item.featured ? (
                          <span className={`text-xs md:text-sm font-body transition-colors duration-300 ${hasBg ? "text-white/90" : "text-foreground"}`}>
                            {item.featured}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                )}


              </div>


               {/* Curators' Picks — bottom center */}
              <button
                onClick={(e) => { e.stopPropagation(); onOpenPicks(brand.name); }}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 md:gap-1.5 text-sm md:text-xs tracking-wider font-body group/picks touch-manipulation transition-all duration-300 text-white whitespace-nowrap"
              >
                <Star className="h-4 w-4 md:h-3 md:w-3 flex-shrink-0 fill-current" />
                <span className="group-hover/picks:underline underline-offset-2">
                  Curators' Picks
                </span>
              </button>

              {/* Expand/collapse indicator */}
              <div className={`absolute bottom-3 left-3 md:left-auto md:right-3 right-auto z-10 transition-all duration-300 ${expandedCard === brand.name ? "rotate-180" : ""}`}>
                <div className={`rounded-full p-1.5 backdrop-blur-sm ${hasBg ? "bg-white/20 text-white" : "bg-foreground/10 text-foreground"}`}>
                  <ChevronDown className="h-4 w-4" />
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategoryRaw] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategoryRaw] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const broadcastFilter = useCallback((cat: string | null, sub: string | null) => {
    window.dispatchEvent(new CustomEvent('syncCategoryFilter', { detail: { category: cat, subcategory: sub, source: 'brands' } }));
  }, []);

  const setSelectedCategory = useCallback((cat: string | null) => {
    setSelectedCategoryRaw(cat);
    setSelectedSubcategoryRaw(null);
    broadcastFilter(cat, null);
  }, [broadcastFilter]);

  const setSelectedSubcategory = useCallback((sub: string | null) => {
    setSelectedSubcategoryRaw(sub);
    broadcastFilter(selectedCategory, sub);
  }, [selectedCategory, broadcastFilter]);
  // Curators' Picks lightbox state
  const [picksDesignerName, setPicksDesignerName] = useState<string | null>(null);
  const [picksIndex, setPicksIndex] = useState(0);
  const [picksZoomed, setPicksZoomed] = useState(false);
  const [picksTouchStart, setPicksTouchStart] = useState<number | null>(null);
  const [picksTouchEnd, setPicksTouchEnd] = useState<number | null>(null);

  // Brands that should use FeaturedDesigners data instead of Collectibles
  const preferFeatured = new Set(["Pierre Bonnefille"]);

  const picksDesigner = useMemo(() => {
    if (!picksDesignerName) return null;
    const designerId = brandToDesignerMap[picksDesignerName];
    if (!designerId) return null;
    // Check collectible designers first, unless brand prefers featured
    if (!preferFeatured.has(picksDesignerName)) {
      const collectibleMatch = collectibleDesigners.find(d => d.id === designerId || d.name === picksDesignerName);
      if (collectibleMatch) return collectibleMatch as any;
    }
    return featuredDesigners.find(d => d.id === designerId) || null;
  }, [picksDesignerName]);

  const openPicks = useCallback((brandName: string) => {
    setPicksDesignerName(brandName);
    setPicksIndex(0);
    setPicksZoomed(false);
  }, []);

  useEffect(() => {
    const handleCategorySync = (e: CustomEvent) => {
      const { category, subcategory, source } = e.detail || {};
      if (source === 'brands') return;
      setSelectedCategoryRaw(category || null);
      setSelectedSubcategoryRaw(subcategory || null);
    };
    window.addEventListener('syncCategoryFilter', handleCategorySync as EventListener);
    return () => window.removeEventListener('syncCategoryFilter', handleCategorySync as EventListener);
  }, []);

  // Fixed category order matching the artisans section
  const CATEGORY_ORDER = ["Seating", "Tables", "Lighting", "Storage", "Rugs", "Décor"];

  // Use the same fixed subcategory names as the All Categories navigation
  const categoryMap = useMemo<Record<string, string[]>>(() => ({
    "Seating": ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools", "Bar Stools"],
    "Tables": ["Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables"],
    "Lighting": ["Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights"],
    "Storage": ["Bookcases", "Cabinets"],
    "Rugs": ["Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs"],
    "Décor": ["Vases & Vessels", "Mirrors", "Books", "Candle Holders", "Decorative Objects"],
  }), []);

  const categories = useMemo(() => {
    const ordered = CATEGORY_ORDER.filter(cat => categoryMap[cat]);
    const extra = Object.keys(categoryMap).filter(cat => !CATEGORY_ORDER.includes(cat));
    return [...ordered, ...extra];
  }, [categoryMap]);

  const filteredBrands = useMemo(() => {
    let brands = partnerBrands;
    
    const normalizeSearch = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    if (searchQuery.trim()) {
      const query = normalizeSearch(searchQuery);
      brands = brands.filter(
        (brand) =>
          normalizeSearch(brand.name).includes(query) ||
          normalizeSearch(brand.category).includes(query) ||
          normalizeSearch(brand.origin).includes(query)
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
      if (!brand.name) return; // skip entries with no name
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
    
    const sorted = Object.values(brandMap).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
    
    // Group by first letter
    const groups: Record<string, ConsolidatedBrand[]> = {};
    sorted.forEach(brand => {
      if (!brand.name) return;
      const letter = brand.name[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(brand);
    });
    
    return Object.entries(groups).sort(([a], [b]) =>
      (a || '').localeCompare(b || '')
    );
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
          <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-2">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground">
              Ateliers
            </h2>
          </div>
          {/* A-Z alphabet jump bar + Search + Filter */}
          {(() => {
            const activeLettersArr = alphaGroups.map(([l]) => l);
            return (
              <div className="flex flex-col gap-3 mb-3">
                <div
                  className="flex items-center gap-1 px-3 py-1.5 bg-background/90 backdrop-blur-md border border-border/40 rounded-full shadow-sm overflow-x-auto flex-shrink min-w-0"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" } as any}
                >
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
                    const isActive = activeLettersArr.includes(letter);
                    return (
                      <button
                        key={letter}
                        onClick={() => {
                          if (isActive) {
                            const el = document.getElementById(`alpha-group-${letter}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }}
                        className={`flex-none font-serif text-xs md:text-sm leading-none px-1.5 py-1 rounded-full transition-all duration-200 ${
                          isActive
                            ? "text-foreground/60 hover:text-primary hover:bg-primary/10 cursor-pointer"
                            : "text-foreground/20 cursor-default"
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {searchOpen ? (
                    <div className="relative flex-1 sm:flex-none sm:w-48 animate-in slide-in-from-right-2 duration-200">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search by brand..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="pl-9 pr-8 h-9 text-sm bg-background/90 backdrop-blur-md border-border/40 rounded-full focus:border-primary/60 font-body"
                      />
                      <button
                        onClick={() => { setSearchQuery(""); setSearchOpen(false); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSearchOpen(true)}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Search"
                    >
                      <span className="text-xs font-body uppercase tracking-wider">Search</span>
                      <Search className="h-5 w-5" />
                    </button>
                  )}
                  <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                    <PopoverTrigger asChild>
                      <button className="text-muted-foreground hover:text-primary transition-colors relative flex-none flex items-center gap-1.5" aria-label="Filter">
                        <span className="text-xs font-body uppercase tracking-wider">Filter</span>
                        <SlidersHorizontal className="h-5 w-5" />
                        {selectedCategory && (
                          <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
                            1
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[260px] p-4 max-h-[400px] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-serif text-sm text-foreground flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5" /> Filter</h4>
                        <div className="flex items-center gap-2">
                        {selectedCategory && (
                          <button
                            onClick={() => { setSelectedCategory(null); }}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            Clear
                          </button>
                        )}
                        <button onClick={() => setFilterOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close filter">
                          <X className="h-4 w-4" />
                        </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {categories.map((category) => (
                          <div key={category}>
                            <label className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                              <Checkbox
                                checked={selectedCategory === category}
                                onCheckedChange={() => {
                                  if (selectedCategory === category) {
                                    setSelectedCategory(null);
                                  } else {
                                    setSelectedCategory(category);
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
            );
          })()}
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
                onOpenPicks={openPicks}
              />
            </div>
          ))}
        </div>

        {/* Curators' Picks Lightbox */}
        <Dialog
          open={!!picksDesignerName}
          onOpenChange={(open) => {
            if (!open) {
              setPicksDesignerName(null);
              setPicksIndex(0);
              setPicksZoomed(false);
            }
          }}
        >
          <DialogContent
            className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none"
            aria-describedby={undefined}
            onKeyDown={(e) => {
              if (!picksDesigner?.curatorPicks?.length) return;
              if (e.key === "ArrowLeft") setPicksIndex(prev => prev === 0 ? picksDesigner.curatorPicks.length - 1 : prev - 1);
              if (e.key === "ArrowRight") setPicksIndex(prev => prev === picksDesigner.curatorPicks.length - 1 ? 0 : prev + 1);
            }}
          >
            <VisuallyHidden>
              <DialogTitle>Curators' Picks - {picksDesignerName}</DialogTitle>
            </VisuallyHidden>
            {picksDesigner ? (
              picksDesigner.curatorPicks && picksDesigner.curatorPicks.length > 0 ? (
                <div
                  className="relative w-full h-full flex items-center justify-center"
                  onTouchStart={(e) => { setPicksTouchEnd(null); setPicksTouchStart(e.targetTouches[0].clientX); }}
                  onTouchMove={(e) => { setPicksTouchEnd(e.targetTouches[0].clientX); }}
                  onTouchEnd={() => {
                    if (!picksTouchStart || !picksDesigner.curatorPicks?.length) return;
                    if (picksTouchEnd !== null) {
                      const distance = picksTouchStart - picksTouchEnd;
                      if (distance > 50) setPicksIndex(prev => prev === picksDesigner.curatorPicks.length - 1 ? 0 : prev + 1);
                      else if (distance < -50) setPicksIndex(prev => prev === 0 ? picksDesigner.curatorPicks.length - 1 : prev - 1);
                    }
                  }}
                >
                  <button
                    onClick={() => { setPicksDesignerName(null); setPicksIndex(0); setPicksZoomed(false); }}
                    className="absolute top-4 right-4 z-50 p-2 bg-background/20 hover:bg-background/40 rounded-full transition-colors"
                    aria-label="Close lightbox"
                  >
                    <X className="h-6 w-6 text-white" />
                  </button>

                  <div className={`flex flex-col items-center justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 ${picksZoomed ? 'max-h-[95vh] pb-4' : 'max-h-[85vh] pb-4'}`}>
                    <div className="relative">
                      {!picksZoomed && ((picksDesigner.curatorPicks[picksIndex] as any)?.tags?.length > 0 || picksDesigner.curatorPicks[picksIndex]?.edition) && (
                        <div className="text-center mb-2 flex flex-wrap gap-1.5 justify-center">
                          {((picksDesigner.curatorPicks[picksIndex] as any)?.tags || [(picksDesigner.curatorPicks[picksIndex] as any)?.category]).map((tag: string, i: number) => (
                            <span key={i} className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">{tag}</span>
                          ))}
                          {picksDesigner.curatorPicks[picksIndex]?.edition && (
                            <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">{picksDesigner.curatorPicks[picksIndex].edition}</span>
                          )}
                        </div>
                      )}
                      <div className="relative inline-block">
                        {picksDesigner.curatorPicks[picksIndex]?.image ? (
                          <img
                            key={picksIndex}
                            src={picksDesigner.curatorPicks[picksIndex]?.image}
                            alt={picksDesigner.curatorPicks[picksIndex]?.title}
                            className={`object-contain select-none transition-all duration-300 ${picksZoomed ? 'max-h-[88vh] max-w-[90vw]' : 'max-w-full max-h-[55vh]'}`}
                            draggable={false}
                          />
                        ) : (
                          <div className="flex items-center justify-center max-w-full max-h-[55vh] w-64 h-64 bg-white/5 border border-white/10 rounded-lg">
                            <span className="text-white/40 font-serif text-lg text-center px-4">{picksDesigner.curatorPicks[picksIndex]?.title}</span>
                          </div>
                        )}
                        {picksDesigner.curatorPicks[picksIndex]?.photoCredit && (
                          <p className="absolute bottom-2 left-2 z-10 text-[10px] text-white/50 font-body tracking-wider flex items-center gap-1">
                            Photo: <a href="https://www.instagram.com/lucabonnefille/?hl=en" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white/80 transition-colors" onClick={e => e.stopPropagation()}><Instagram className="w-3 h-3" />{picksDesigner.curatorPicks[picksIndex].photoCredit}</a>
                          </p>
                        )}
                        <button
                          onClick={() => setPicksZoomed(!picksZoomed)}
                          className="absolute bottom-2 left-2 md:left-auto md:right-2 z-10 bg-black/40 backdrop-blur-sm p-1.5 rounded-full hover:bg-black/60 transition-colors cursor-pointer"
                          aria-label={picksZoomed ? "Minimize image" : "Maximize image"}
                        >
                          {picksZoomed ? <Minimize2 className="w-3.5 h-3.5 text-white" /> : <Maximize2 className="w-3.5 h-3.5 text-white" />}
                        </button>
                      </div>
                    </div>

                    {picksDesigner.curatorPicks.length > 1 && !picksZoomed && (
                      <div className="flex items-center gap-2 mt-3">
                        {picksDesigner.curatorPicks.map((_: CuratorPick, idx: number) => (
                          <button key={idx} aria-label={`Go to image ${idx + 1}`} onClick={() => { setPicksIndex(idx); setPicksZoomed(false); }}
                            className={`rounded-full transition-all duration-300 ${picksIndex === idx ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`} />
                        ))}
                      </div>
                    )}

                    <div className={`mt-3 text-center transition-all duration-300 ${picksZoomed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                      <h3 className="text-sm md:text-base font-serif text-white mb-1">
                        {picksDesigner.curatorPicks[picksIndex]?.title}
                        {(picksDesigner.curatorPicks[picksIndex] as any)?.subtitle && (
                          <span className="font-serif"> {(picksDesigner.curatorPicks[picksIndex] as any).subtitle}</span>
                        )}
                      </h3>
                      {picksDesigner.curatorPicks[picksIndex]?.materials && (
                        <p className="text-white/60 font-body text-xs md:text-sm mb-1 whitespace-pre-line">{picksDesigner.curatorPicks[picksIndex].materials}</p>
                      )}
                      {picksDesigner.curatorPicks[picksIndex]?.dimensions && (
                        <div className="mt-2 max-w-xl space-y-1 mx-auto text-center">
                          <p className="text-xs md:text-sm text-white/40 font-body italic whitespace-pre-line">{picksDesigner.curatorPicks[picksIndex].dimensions}</p>
                          {(picksDesigner.curatorPicks[picksIndex] as any)?.description && (
                            <p className="text-xs md:text-sm text-white/50 font-body leading-relaxed max-w-lg mt-2 mx-auto text-center">{(picksDesigner.curatorPicks[picksIndex] as any).description}</p>
                          )}
                        </div>
                      )}

                      {picksDesigner.curatorPicks.length > 1 && (
                        <div className="mt-6 flex items-center gap-2 overflow-x-auto scrollbar-hide justify-center flex-wrap md:flex-nowrap">
                          {picksDesigner.curatorPicks.map((pick: CuratorPick, idx: number) => (
                            <button key={idx} onClick={() => { setPicksIndex(idx); setPicksZoomed(false); }} aria-label={`View ${pick.title}`}
                              className={`flex-none relative w-10 h-10 md:w-12 md:h-12 rounded overflow-hidden transition-all duration-300 ${picksIndex === idx ? 'ring-2 ring-white scale-110 opacity-100' : 'ring-1 ring-white/20 opacity-50 hover:opacity-90 hover:ring-white/50'}`}>
                              {pick.image ? (
                                <img src={pick.image} alt={pick.title} className="w-full h-full object-cover" loading="eager" />
                              ) : (
                                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                  <span className="text-white/40 text-[6px] text-center leading-tight px-0.5">{pick.title}</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}

                      <p className="mt-6 text-xs text-white font-body italic">
                        For further details, please contact{" "}
                        <a href="mailto:concierge@myaffluency.com" className="underline hover:text-white/80 transition-colors">concierge@myaffluency.com</a>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative flex items-center justify-center w-full h-full">
                  <button
                    onClick={() => { setPicksDesignerName(null); setPicksIndex(0); setPicksZoomed(false); }}
                    className="absolute top-4 right-4 z-50 p-2 bg-background/20 hover:bg-background/40 rounded-full transition-colors"
                    aria-label="Close lightbox"
                  >
                    <X className="h-6 w-6 text-white" />
                  </button>
                  <div className="text-center p-8">
                    <Star className="h-16 w-16 text-white/30 mx-auto mb-4" />
                    <h3 className="text-2xl font-serif text-white mb-2">Curators' Picks</h3>
                    <p className="text-white/70 font-body mb-2">{picksDesigner.name}</p>
                    <p className="text-sm text-white/50 font-body italic">Curated selections coming soon</p>
                  </div>
                </div>
              )
            ) : (
              <div className="relative flex items-center justify-center w-full h-full">
                <button
                  onClick={() => { setPicksDesignerName(null); setPicksIndex(0); setPicksZoomed(false); }}
                  className="absolute top-4 right-4 z-50 p-2 bg-background/20 hover:bg-background/40 rounded-full transition-colors"
                  aria-label="Close lightbox"
                >
                  <X className="h-6 w-6 text-white" />
                </button>
                <div className="text-center p-8">
                  <Star className="h-16 w-16 text-white/30 mx-auto mb-4" />
                  <h3 className="text-2xl font-serif text-white mb-2">Curators' Picks</h3>
                  <p className="text-sm text-white/50 font-body italic">Coming soon</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default BrandsAteliers;

