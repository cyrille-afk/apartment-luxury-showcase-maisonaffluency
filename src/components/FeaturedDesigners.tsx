import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect } from "react";
import { Instagram, Search, X, ChevronDown, ExternalLink, Star, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import thierryLemaireImg from "@/assets/designers/thierry-lemaire.jpg";
import herveVanDerStraetenImg from "@/assets/designers/herve-van-der-straeten.png";
import brunoDeMaistreImg from "@/assets/designers/bruno-de-maistre.jpg";
import hamreiImg from "@/assets/designers/hamrei.jpg";
import atelierFevrierImg from "@/assets/designers/atelier-fevrier.jpg";
import apparatusStudioImg from "@/assets/designers/apparatus-studio.jpg";
import oliviaCognetImg from "@/assets/designers/olivia-cognet.jpg";
import jeremyMaxwellWintrebertImg from "@/assets/designers/jeremy-maxwell-wintrebert.jpg";
import alexanderLamontImg from "@/assets/designers/alexander-lamont.jpg";
import leoSentouImg from "@/assets/designers/leo-sentou.jpg";
import jeanMichelFrankImg from "@/assets/designers/jean-michel-frank.jpg";
import emanuelleLevetStenneImg from "@/assets/designers/emanuelle-levet-stenne.png";
import milanPekarImg from "@/assets/designers/milan-pekar.png";
import atelierPendhapaImg from "@/assets/designers/atelier-pendhapa.png";
import emmanuelBabledImg from "@/assets/designers/emmanuel-babled.png";
import yvesMacheretImg from "@/assets/designers/yves-macheret.jpg";

// Curators' Picks images
import alexanderLamontPick1 from "@/assets/curators-picks/alexander-lamont-1.jpg";
import alexanderLamontPick2 from "@/assets/curators-picks/alexander-lamont-2.jpg";
import alexanderLamontPick3 from "@/assets/curators-picks/alexander-lamont-3.jpg";
import alexanderLamontPick4 from "@/assets/curators-picks/alexander-lamont-4.jpg";
import yvesMacheretPick1 from "@/assets/curators-picks/yves-macheret-1.jpg";
import yvesMacheretPick2 from "@/assets/curators-picks/yves-macheret-2.jpg";
import yvesMacheretPick3 from "@/assets/curators-picks/yves-macheret-3.png";
import yvesMacheretPick4 from "@/assets/curators-picks/yves-macheret-4.jpg";
import apparatusPick1 from "@/assets/curators-picks/apparatus-1.jpg";
import apparatusPick2 from "@/assets/curators-picks/apparatus-2.jpg";
import apparatusPick3 from "@/assets/curators-picks/apparatus-3.jpg";
import apparatusPick4 from "@/assets/curators-picks/apparatus-4.jpg";
import pendhapaPick1 from "@/assets/curators-picks/pendhapa-1.jpg";
import pendhapaPick2 from "@/assets/curators-picks/pendhapa-2.jpg";
import pendhapaPick4 from "@/assets/curators-picks/pendhapa-4.jpg";
import pendhapaPick5 from "@/assets/curators-picks/pendhapa-5.jpg";
import atelierFevrierPick1 from "@/assets/curators-picks/atelier-fevrier-1.png";
import atelierFevrierPick2 from "@/assets/curators-picks/atelier-fevrier-2.png";
import atelierFevrierPick3 from "@/assets/curators-picks/atelier-fevrier-3.png";
import atelierFevrierPick4 from "@/assets/curators-picks/atelier-fevrier-4.png";
import emmanuelLevetStennePick1 from "@/assets/curators-picks/emmanuel-levet-stenne-1.jpg";
import emmanuelLevetStennePick2 from "@/assets/curators-picks/emmanuel-levet-stenne-2.jpg";
import emmanuelLevetStennePick3 from "@/assets/curators-picks/emmanuel-levet-stenne-3.jpg";
import emmanuelLevetStennePick4 from "@/assets/curators-picks/emmanuel-levet-stenne-4.jpg";
import emmanuelLevetStennePick5 from "@/assets/curators-picks/emmanuel-levet-stenne-5.jpg";
import emmanuelBabledPick1 from "@/assets/curators-picks/emmanuel-babled-1.jpg";
import emmanuelBabledPick2 from "@/assets/curators-picks/emmanuel-babled-2.jpg";
import emmanuelBabledPick3 from "@/assets/curators-picks/emmanuel-babled-3.jpg";
import emmanuelBabledPick4 from "@/assets/curators-picks/emmanuel-babled-4.jpg";
import emmanuelBabledPick5 from "@/assets/curators-picks/emmanuel-babled-5.jpg";
import emmanuelBabledPick6 from "@/assets/curators-picks/emmanuel-babled-6.jpg";
import emmanuelBabledPick7 from "@/assets/curators-picks/emmanuel-babled-7.jpg";
import hamreiPick1 from "@/assets/curators-picks/hamrei-1.jpg";
import hamreiPick2 from "@/assets/curators-picks/hamrei-2.jpg";
import hamreiPick3 from "@/assets/curators-picks/hamrei-3.jpg";
import hamreiPick4 from "@/assets/curators-picks/hamrei-4.jpg";
import hamreiPick5 from "@/assets/curators-picks/hamrei-5.jpg";
import jmwPick1 from "@/assets/curators-picks/jmw-1.webp";
import jmwPick2 from "@/assets/curators-picks/jmw-2.png";
import jmwPick3 from "@/assets/curators-picks/jmw-3.png";
import jmwPick4 from "@/assets/curators-picks/jmw-4.png";
import jmwPick5 from "@/assets/curators-picks/jmw-5.png";
import jmwPick6 from "@/assets/curators-picks/jmw-6.png";

import jmwPick8 from "@/assets/curators-picks/jmw-8.webp";

const featuredDesigners = [
  {
    id: "alexander-lamont",
    name: "Alexander Lamont",
    specialty: "Artisan Furniture & Luxury Craftsmanship",
    image: alexanderLamontImg,
    biography:
      "Alexander Lamont is a British designer based in Bangkok whose eponymous brand has become synonymous with exceptional craftsmanship and the innovative use of traditional materials. Working with bronze, shagreen, straw marquetry, lacquer and gold leaf, his pieces marry East and West influences with a distinct sculptural presence. Winner of multiple UNESCO Awards for Excellence in Craftsmanship, his work graces prestigious interiors worldwide.",
    notableWorks: "Hammered Bowls (UNESCO Award), Brancusi Spiral Table, River Ledge Credenza, Agata Cabinet, Lune Mirrors",
    notableWorksLink: { text: "Corteza Console Table | Natural Distress", galleryIndex: 16 },
    philosophy: "Objects have power: they connect us to our most intimate selves and to the people, places, stories and memories of our lives.",
    curatorPicks: [
      { 
        image: alexanderLamontPick3, 
        title: "Casque",
        subtitle: "Bar Cabinet",
        category: "Storage",
        tags: ["Storage", "Cabinet"],
        materials: "Straw marquetry • Hammered bronze handles • Lacquered interior",
        dimensions: "H110 × W120 × D45 cm"
      },
      { 
        image: alexanderLamontPick1, 
        title: "Ondas Sconce",
        subtitle: "Clear",
        category: "Lighting",
        tags: ["Lighting", "Sconce"],
        materials: "Hand-cast bronze with clear glass diffuser",
        dimensions: "H45 × W12 × D14 cm"
      },
      { 
        image: alexanderLamontPick4, 
        title: "Dais",
        subtitle: "Lounge Chair",
        category: "Seating",
        tags: ["Seating", "Chair"],
        materials: "Bouclé upholstery • Shagreen leather • Straw marquetry accents",
        dimensions: "H75 × W80 × D85 cm"
      },
      { 
        image: alexanderLamontPick2, 
        title: "Galea Lantern",
        subtitle: "Rock Crystal",
        category: "Lighting",
        tags: ["Lighting", "Lantern"],
        materials: "Hammered bronze base • Rock crystal & frosted glass shades",
        dimensions: "H28 × W18 × D18 cm"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/alexanderlamont" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "apparatus-studio",
    name: "Apparatus Studio",
    founder: "Gabriel Hendifar",
    specialty: "Contemporary Lighting & Industrial Design",
    image: apparatusStudioImg,
    biography:
      "Apparatus Studio is a New York-based design studio founded by Gabriel Hendifar and Jeremy Anderson. Known for their sculptural approach to lighting and furniture, their work combines industrial materials with refined aesthetics. The Metronome Reading Floor Lamp showcases their ability to create pieces that are both functional and sculptural.",
    notableWorks: "Lantern Table Lamp, Metronome Reading Floor Lamp, Sculptural Lighting Series",
    notableWorksLinks: [
      { text: "Lantern Table Lamp", galleryIndex: 12 },
      { text: "Median 3 Surface Alabaster Lights", galleryIndex: 0 },
      { text: "Metronome Reading Floor Lamp", galleryIndex: 7 }
    ],
    philosophy:
      "We create objects that exist at the intersection of art, design, and architecture—pieces that define and enhance the spaces they inhabit.",
    curatorPicks: [
      { 
        image: apparatusPick1, 
        title: "Lantern",
        subtitle: "Table Lamp",
        category: "Lighting",
        tags: ["Lighting", "Table Lamp"],
        materials: "Brass armature • Pressed glass shade",
        dimensions: "H18\" × Ø10\""
      },
      { 
        image: apparatusPick2, 
        title: "Lariat",
        subtitle: "Pendant",
        category: "Lighting",
        tags: ["Lighting", "Pendant"],
        materials: "Blackened brass • Mold-blown glass",
        dimensions: "H16\" × Ø6.5\""
      },
      { 
        image: apparatusPick3, 
        title: "Signal Y",
        subtitle: "Table Lamp",
        category: "Lighting",
        tags: ["Lighting", "Table Lamp"],
        materials: "Brass armature • Pressed glass",
        dimensions: "H23.5\" × Ø17.25\""
      },
      { 
        image: apparatusPick4, 
        title: "Tassel 57",
        subtitle: "Pendant",
        category: "Lighting",
        tags: ["Lighting", "Pendant"],
        materials: "Mold-blown glass cylinders • Brass dome and armature",
        dimensions: "Ø32.5\""
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/apparatusstudio" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "atelier-pendhapa",
    name: "Atelier Pendhapa",
    specialty: "Bespoke Furniture & Indonesian Craftsmanship",
    image: atelierPendhapaImg,
    biography:
      "Atelier Pendhapa is an Indonesian design atelier specializing in bespoke furniture that celebrates the rich tradition of Indonesian woodworking and craftsmanship. Their Deepah custom table exemplifies their philosophy of creating pieces that honor traditional techniques while embracing contemporary design sensibilities. Each piece is handcrafted by master artisans using sustainably sourced materials.",
    notableWorks: "Deepah Custom Table, Bespoke Dining Collection",
    notableWorksLink: { text: "Deepah Custom Table", galleryIndex: 3 },
    philosophy: "We create furniture that bridges the gap between ancient Indonesian craft traditions and contemporary global design.",
    curatorPicks: [
      { 
        image: pendhapaPick1, 
        title: "Mangala",
        subtitle: "Coffee Table",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Black teak • Lava stone crème brûlée tabletop",
        dimensions: "L190 × W180 × H35 cm"
      },
      { 
        image: pendhapaPick4, 
        title: "Akar",
        subtitle: "Dining Chair",
        category: "Seating",
        tags: ["Seating", "Chair"],
        materials: "Brown oak • Alpilles Camargue Trente by Elitis upholstery",
        dimensions: "L49 × W52 × H85 cm"
      },
      { 
        image: pendhapaPick5, 
        title: "Gingko",
        subtitle: "Side Table",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Natural oak • White lacquer tabletop",
        dimensions: "L75 × W48 × H50 cm"
      },
      { 
        image: pendhapaPick2, 
        title: "Anemos",
        subtitle: "Coffee Table",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Black oak • Black lacquer tabletop",
        dimensions: "L110 × W80 × H35 cm"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/pendhapa.architects" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "atelier-fevrier",
    name: "Atelier Fevrier",
    specialty: "Hand-knotted Rugs & Textile Art",
    image: atelierFevrierImg,
    biography:
      "Atelier Fevrier is a textile studio dedicated to the ancient art of hand-knotted rug making. Their Ricky Rug exemplifies their commitment to traditional techniques combined with contemporary design sensibilities. Each rug is a labor of love, taking months to complete with meticulous attention to texture, color, and pattern.",
    notableWorks: "Hand-knotted Ricky Rug, Custom Textile Collection",
    notableWorksLink: { text: "Ricky Rug", galleryIndex: 0 },
    philosophy:
      "We honor ancient textile traditions while creating works that speak to contemporary spaces and sensibilities.",
    curatorPicks: [
      { 
        image: atelierFevrierPick3, 
        title: "Nautilus",
        subtitle: "Hand-knotted Rug",
        category: "Rugs",
        tags: ["Rugs", "Textile"],
        materials: "40% wool, 60% silk — 125 knots/sq.inch",
        dimensions: "Custom dimensions available",
        description: "Inspired by and named after Nautilus, a beautiful seashell, this rug is thought provoking and possesses the power to make you think beyond the norms of ordinary. It symbolises an amalgamation of two beautiful bodies together with the mother of pearl, therefore culminating into something unique and distinct."
      },
      { 
        image: atelierFevrierPick1, 
        title: "Ceramic",
        subtitle: "Hand-knotted Rug",
        category: "Rugs",
        tags: ["Rugs", "Textile"],
        materials: "90% wool, 10% silk — 100 knots/sq. inch",
        dimensions: "Custom dimensions available",
        description: "Evocative of one of the most ancient greek ceramics, the François vase, initially discovered in pieces then eagerly put back together (so it could tell its story). Its irregularity and ostensibly mended areas – resonant with the Japanese Kintsugi practice – mirror the beauty in its rawest, most vulnerable state."
      },
      { 
        image: atelierFevrierPick2, 
        title: "Mushroom",
        subtitle: "Hand-knotted Rug",
        category: "Rugs",
        tags: ["Rugs", "Textile"],
        materials: "60% nettle, 40% silk — 100 knots/sq.inch",
        dimensions: "Custom dimensions available",
        description: "Emma Donnersberg's work embodies a delicate balance of strength and softness. Her work features playful and soft shapes and forms that exudes harmony and sophistication. The Mushroom rug beautifully captures her distinct style and Atelier Février's detailed craftsmanship and precise execution, it is a testament to a collaborative challenge put to the test and masterfully executed."
      },
      { 
        image: atelierFevrierPick4, 
        title: "Frequence 440",
        subtitle: "Hand-knotted Rug",
        category: "Rugs",
        tags: ["Rugs", "Textile"],
        materials: "15% wool, 85% silk — 125 knots/sq. inch",
        dimensions: "Custom dimensions available",
        description: "Designed by Sebastian Leon of Atelier d'Amis. The Fréquence rug collection is inspired by the enigmatic vibrational phenomenon called \"cymatics\", which correlates sound frequencies with geometric mandalas. The individual rugs are named after the frequencies of the A note – the standard for tuning – in three consecutive octaves."
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/atelierfevrier" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "bruno-de-maistre",
    name: "Bruno de Maistre",
    specialty: "Contemporary Furniture Design",
    image: brunoDeMaistreImg,
    biography:
      "Bruno de Maistre is a French designer known for his poetic approach to furniture design. His Lyrical Desk demonstrates his ability to create pieces that are both functional and emotionally resonant, with flowing lines and thoughtful proportions that inspire creativity and contemplation.",
    notableWorks: "Lyric Desk, Contemporary Furniture Series",
    notableWorksLink: { text: "Lyric Desk", galleryIndex: 6 },
    philosophy: "Furniture should not just serve the body, but also nourish the soul and inspire the mind.",
    links: [
      { type: "Instagram", url: "https://instagram.com/bruno_de_maistre_bdm" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "emanuelle-levet-stenne",
    name: "Emanuelle Levet Stenne",
    specialty: "Alabaster Lighting & Sculptural Fixtures",
    image: emanuelleLevetStenneImg,
    biography:
      "Emanuelle Levet Stenne is a French lighting designer renowned for creating ethereal alabaster pendant lights and sculptural fixtures that transform spaces with their warm, natural glow. Her work celebrates the inherent beauty of natural stone, allowing light to pass through alabaster to create an atmosphere of timeless elegance.",
    notableWorks: "Alabaster Pendant Light, Sculptural Lighting Collection",
    notableWorksLink: { text: "Alabaster Pendant Light", galleryIndex: 2 },
    philosophy: "Light should not merely illuminate—it should transform space into poetry.",
    curatorPicks: [
      {
        image: emmanuelLevetStennePick5,
        title: "Alabaster",
        subtitle: "Pendant",
        category: "Lighting",
        tags: ["Lighting", "Pendant"],
        materials: "Alabaster and slate",
        dimensions: "Ø56 × H165 cm"
      },
      {
        image: emmanuelLevetStennePick1,
        title: "Bolchoï",
        subtitle: "Console Black",
        category: "Tables",
        tags: ["Tables", "Console"],
        materials: "Lassa marble top • Lacquered aluminium & Lassa marble legs",
        dimensions: "L145 × W40 × H75 cm"
      },
      {
        image: emmanuelLevetStennePick2,
        title: "Jelly",
        subtitle: "Side Table",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Alabaster and blown glass",
        dimensions: "Ø41 × H55 cm"
      },
      {
        image: emmanuelLevetStennePick3,
        title: "Full Moon",
        subtitle: "Pendant",
        category: "Lighting",
        tags: ["Lighting", "Pendant"],
        materials: "Alabaster and plaster",
        dimensions: "Ø50 cm / Ø36 cm"
      },
      {
        image: emmanuelLevetStennePick4,
        title: "Dress Up",
        subtitle: "Dining Table / Wood",
        category: "Tables",
        tags: ["Tables", "Dining Table"],
        materials: "Oak or walnut top and base",
        dimensions: "L280 × W120 × H74 cm"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/emanuellelevetstenne" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "emmanuel-babled",
    name: "Emmanuel Babled",
    specialty: "Sculptural Glass & Marble Design",
    image: emmanuelBabledImg,
    biography:
      "Emmanuel Babled is a French-Italian designer renowned for his limited edition sculptural objects in glass and marble. His Osmosi Series represents the pinnacle of material exploration and artistic vision, blending organic forms with exceptional craftsmanship. Each piece is a unique work of art that pushes the boundaries of material possibilities.",
    notableWorks: "Osmosi Series Sculptured Book Cover, Glass Sculptures, Marble Objects",
    notableWorksLink: { text: "Osmosi Series", galleryIndex: 2 },
    philosophy: "I explore the boundaries between art and design, creating objects that challenge perception and celebrate material beauty.",
    curatorPicks: [
      {
        image: emmanuelBabledPick1,
        title: "Osmosi",
        subtitle: "Console",
        category: "Tables",
        tags: ["Tables", "Console"],
        materials: "Carrara marble, Murano blown glass",
        dimensions: "H80 × L160 × D35 cm"
      },
      {
        image: emmanuelBabledPick2,
        title: "Coral",
        subtitle: "Coffee Table",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Bianco Carrara marble, plexiglass",
        dimensions: "L150 × W100 × H28 cm"
      },
      {
        image: emmanuelBabledPick3,
        title: "Pyros Marini",
        subtitle: "Vase",
        category: "Decorative Object",
        tags: ["Decorative Object", "Vase"],
        materials: "Murano blown glass (Venini)",
        dimensions: "H45 × Ø30 cm"
      },
      {
        image: emmanuelBabledPick4,
        title: "Quark Bronze",
        subtitle: "Coffee Table",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Bronze",
        dimensions: "H30 × L122.5 × W83 cm"
      },
      {
        image: emmanuelBabledPick5,
        title: "Siliceaarenaria",
        subtitle: "Vessels",
        category: "Decorative Object",
        tags: ["Decorative Object", "Vessel"],
        materials: "Murano blown glass (Venini)",
        dimensions: "Ø25 × H22 cm (each)"
      },
      {
        image: emmanuelBabledPick6,
        title: "Etna Cabinet",
        subtitle: "Stripes",
        category: "Storage",
        tags: ["Storage", "Cabinet"],
        materials: "Murano glass doors • Lava stone legs",
        dimensions: "H85 × L120 × D45 cm"
      },
      {
        image: emmanuelBabledPick7,
        title: "Osmosi",
        subtitle: "Side Table",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Carrara marble • Murano blown glass",
        dimensions: "H55 × Ø60 cm"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/emmanuelbabled" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "hamrei",
    name: "Hamrei",
    specialty: "Whimsical Furniture & Collectible Design",
    image: hamreiImg,
    biography:
      "Hamrei brings a playful yet sophisticated approach to contemporary design. Their Pépé Chair showcases their signature style of combining comfort with unexpected visual delight. Each piece demonstrates a mastery of form and craftsmanship while maintaining a sense of joy and personality.",
    notableWorks: "Pépé Chair, Whimsical Furniture Collection",
    notableWorksLink: { text: "Pépé Chair", galleryIndex: 3 },
    philosophy:
      "Design should bring joy and surprise to daily life while maintaining the highest standards of craftsmanship.",
    curatorPicks: [
      {
        image: hamreiPick1,
        title: "PEDRO Coffee Table",
        subtitle: "Limited Edition Aqua",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Solid cast bronze, hand-patinated aqua finish",
        dimensions: "Ø60 × H38 cm"
      },
      {
        image: hamreiPick2,
        title: "ANJOS Sideboard",
        category: "Storage",
        tags: ["Storage", "Sideboard"],
        materials: "Solid gouged oak, solid-cast blackened brass",
        dimensions: "H75 × L120 × D45 cm"
      },
      {
        image: hamreiPick3,
        title: "FUN GUY Side Tables",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Solid cast bronze, hand-textured and finished",
        dimensions: "Small: Ø28 × H48 cm / Tall: Ø37 × H60 cm"
      },
      {
        image: hamreiPick4,
        title: "MIRRA Side Table",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Textured blackened brass, solid Murano glass top (Ocean Blue)",
        dimensions: "Ø36 × H48 cm (glass Ø32 cm)"
      },
      {
        image: hamreiPick5,
        title: "TRIO Dining Table",
        category: "Tables",
        tags: ["Tables", "Dining Table"],
        materials: "Hand-chiseled stone top, textured earthenware ceramic base",
        dimensions: "Ø120 × H75 cm (customisable)"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/hamrei" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "herve-van-der-straeten",
    name: "Hervé van der Straeten",
    specialty: "Bronze Sculpture & Lighting Design",
    image: herveVanDerStraetenImg,
    biography:
      "Hervé van der Straeten is a renowned French designer and sculptor who began his career as a jewelry designer for haute couture houses. His transition to furniture and lighting brought his expertise in bronze work to larger scale. His chandeliers and furniture pieces are characterized by their organic forms and masterful metalwork.",
    notableWorks: "Mic Mac Chandelier, Bronze Console Series, Sculptural Mirrors",
    notableWorksLink: { text: "Mic Mac Chandelier", galleryIndex: 9 },
    philosophy:
      "I work with bronze as a jeweler works with precious metals—creating pieces that capture light and movement.",
    links: [
      { type: "Instagram", url: "https://instagram.com/hervevanderstraetengalerie" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "jeremy-maxwell-wintrebert",
    name: "Jeremy Maxwell Wintrebert",
    specialty: "Freehand Glassblown Lights & Sculptures",
    image: jeremyMaxwellWintrebertImg,
    biography:
      "Born in Paris and raised in Western Africa, Jeremy Maxwell Wintrebert is a French-American glass artist who established JMW Studio in 2015 beneath the historic Viaduc des Arts in Paris. After apprenticing with masters including Dale Chihuly in Seattle and Davide Salvadore in Venice, he developed his signature freehand glassblowing technique. Winner of the 2019 Prix Bettencourt pour l'Intelligence de la Main, his work graces the collections of the Victoria & Albert Museum, Palais de Tokyo, and MusVerre.",
    notableWorks: "Cloud Bulle Pendants, Autumn Light Pendants, Space Nugget Side Table, Sonde Chandelier, Dark Matter Installation",
    notableWorksLink: { text: "Cloud Bulle Pendants", galleryIndex: 3 },
    philosophy: "Freehand glassblowing is an emotional conversation between hands, head, heart, and material. You start with a small seed and help it grow—it is a humble process.",
    curatorPicks: [
      {
        image: jmwPick3,
        title: "Autumn Light",
        subtitle: "Pendant",
        category: "Lighting",
        tags: ["Lighting", "Pendant"],
        materials: "Freehand blown glass • Matte & satin finishes",
        dimensions: "Various sizes available"
      },
      {
        image: jmwPick2,
        title: "Sonde",
        subtitle: "Table Lamp",
        category: "Lighting",
        tags: ["Lighting", "Table Lamp"],
        materials: "3D-printed mesh shade • Blown glass diffuser • Metal base",
        dimensions: "Ø35 × H40 cm"
      },
      {
        image: jmwPick1,
        title: "Cloud Bulle",
        subtitle: "Pendant",
        category: "Lighting",
        tags: ["Lighting", "Pendant"],
        materials: "Freehand blown glass • Brass fittings",
        dimensions: "Approx. Ø30 × H35 cm (each)"
      },
      {
        image: jmwPick4,
        title: "Totem",
        subtitle: "Pendant",
        category: "Lighting",
        tags: ["Lighting", "Pendant"],
        materials: "Stacked blown glass discs • Brass armature",
        dimensions: "H90 × Ø10 cm"
      },
      {
        image: jmwPick5,
        title: "Space Nugget",
        subtitle: "Side Table",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Freehand blown mirrored glass",
        dimensions: "H42 × Ø38 cm"
      },
      {
        image: jmwPick6,
        title: "Zenith",
        subtitle: "Wall Mirror",
        category: "Decorative Object",
        tags: ["Decorative Object", "Mirror"],
        materials: "Freehand blown mirrored glass",
        dimensions: "Ø55 × D18 cm"
      },
      {
        image: jmwPick8,
        title: "Gravity",
        subtitle: "Coffee Table",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Blown glass spheres • Lacquered wood top",
        dimensions: "L150 × W60 × H30 cm"
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/jmw_studio" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "jean-michel-frank",
    name: "Jean-Michel Frank",
    specialty: "Minimalist Luxury & Art Deco Pioneer",
    image: jeanMichelFrankImg,
    biography:
      "Jean-Michel Frank (1895–1941) was a legendary French interior decorator and furniture designer who pioneered the luxurious minimalist aesthetic of the Art Deco era. His work emphasized refined simplicity, using the finest materials—parchment, shagreen, straw marquetry, and bronze—to create pieces of understated elegance. Collaborating with artists like Alberto Giacometti and Christian Bérard, Frank created iconic designs that continue to influence contemporary luxury interiors.",
    notableWorks: "Table Soleil 1930, Stool 1934 (with Adolphe Chanaux), Parchment-covered furniture, Shagreen desks",
    notableWorksLink: { text: "Stool 1934", galleryIndex: 1 },
    philosophy: "Simplicity is the ultimate sophistication—luxury lies in the quality of materials and the perfection of form.",
    links: [
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "leo-sentou",
    name: "Leo Sentou",
    specialty: "Contemporary Classicist Furniture Design",
    image: leoSentouImg,
    biography:
      "French designer Leo Sentou is a contemporary classicist whose debut capsule collection pays homage to the elegance and sophistication of eighteenth-century French decorative arts. His pieces are rooted in tradition yet unequivocally modern, reducing classical forms to their essential shapes while elevating them with a refined palette of limed oak, wrought iron, bronze, mohair, linen and lacquer.",
    notableWorks: "Fauteuil L.D (oval bergère), Side Table L.A, Chair G.J, AB Armchair",
    notableWorksLink: { text: "AB Armchair", galleryIndex: 1 },
    philosophy: "Elegance means elimination. An interior ought to tell a story, with a balance between old and new, light and dark.",
    links: [
      { type: "Instagram", url: "https://www.instagram.com/leosentou" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "milan-pekar",
    name: "Milan Pekař",
    specialty: "Crystalline Glass Art & Sculptural Vessels",
    image: milanPekarImg,
    biography:
      "Milan Pekař is a Czech glass artist renowned for his mastery of crystalline glass techniques. His Crystalline Vase collection showcases his exceptional skill in creating pieces that capture and refract light in mesmerizing ways. Working in the tradition of Bohemian glassmaking while pushing contemporary boundaries, his work transforms functional vessels into sculptural art.",
    notableWorks: "Crystalline Vase Collection, Sculptural Glass Vessels",
    notableWorksLink: { text: "Crystalline Vase", galleryIndex: 3 },
    philosophy: "Glass is frozen light—my work seeks to capture that ephemeral quality in permanent form.",
    links: [
      { type: "Instagram", url: "https://instagram.com/milanpekar_glass" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "olivia-cognet",
    name: "Olivia Cognet",
    specialty: "Ceramic Artist & Designer",
    image: oliviaCognetImg,
    biography:
      "Olivia Cognet is a French ceramic artist that draws her inspiration from the South of France where she grew up and and was nourished by the brilliant masters from the school of Vallauris, from Picasso to Roger Capron. Her Vallauris floor lamp in a custom blue glazed ceramic, is a testimony of her constant search for the balance between art & design. ",
    notableWorks: "Bas Relief sculptures, Vallauris floor lamp",
    notableWorksLink: { text: "Vallauris floor lamp", galleryIndex: 1 },
    philosophy: "Blending modern brutalism with a graphic feminine sensibility.",
    links: [
      { type: "Instagram", url: "https://www.instagram.com/olivia_cognet" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "thierry-lemaire",
    name: "Thierry Lemaire",
    specialty: "Sculptural Furniture & Limited Editions",
    image: thierryLemaireImg,
    biography:
      "A French Star Architect, Interior Designer and Designer, Thierry Lemaire is known for his sculptural approach to furniture design. His pieces blend fine craftsmanship with contemporary aesthetics, creating limited edition works that are as much art as they are functional objects. His Orsay Centre Table exemplifies his signature style of elegant forms with unexpected details.",
    notableWorks:
      "Orsay Centre Table, Niko 420 Custom Sofa. \nLimited and numbered edition (12 copies).",
    notableWorksLinks: [
      { text: "Orsay Centre Table", galleryIndex: 1 },
      { text: "Niko 420 Custom Sofa", galleryIndex: 0 },
    ],
    philosophy: "Each piece is a unique statement that transforms everyday furniture into collectible design objects.",
    links: [
      { type: "Instagram", url: "https://www.instagram.com/thierrylemaire_/?hl=en" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "yves-macheret",
    name: "Yves Macheret",
    specialty: "Bronze Lighting & Artisan Foundry",
    image: yvesMacheretImg,
    biography:
      "Yves Macheret has been running the Entrelacs family foundry in central France with his brother Paul since 2015. Trained alongside his father, Yves mastered all techniques of bronze work: modelling, mould-making, casting, chasing, and patination. His vision to create minimal lighting designs at accessible prices has naturally steered him towards a timeless aesthetic that fully expresses the beauty of bronze and alabaster—materials inherited from the origins of our world, crafted into pared-down expressions.",
    notableWorks: "Bronze & Alabaster Lighting Collection, Timeless Foundry Pieces",
    philosophy: "Revealing the beauty and simplicity of bronze, making exceptional craftsmanship accessible while honoring a heritage passed down from father to son.",
    curatorPicks: [
      { 
        image: yvesMacheretPick1, 
        title: "Ghost",
        subtitle: "Wall Lamp",
        category: "Lighting",
        tags: ["Lighting", "Wall Lamp"],
        materials: "Patinated bronze • Hand-carved alabaster diffuser",
        dimensions: "H57 × W10 × D12 cm"
      },
      { 
        image: yvesMacheretPick2, 
        title: "Nomad 295",
        subtitle: "Table Lamp",
        category: "Lighting",
        tags: ["Lighting", "Table Lamp"],
        materials: "Patinated bronze base • Natural alabaster shade",
        dimensions: "H29.5 × W15 × D15 cm"
      },
      { 
        image: yvesMacheretPick3, 
        title: "Toast",
        subtitle: "Wall Lamp",
        category: "Lighting",
        tags: ["Lighting", "Wall Lamp"],
        materials: "Patinated brass • Hand-carved alabaster",
        dimensions: "H37 × W10 × D10 cm"
      },
      { 
        image: yvesMacheretPick4, 
        title: "Braun 650",
        subtitle: "Wall Lamp",
        category: "Lighting",
        tags: ["Lighting", "Wall Lamp"],
        materials: "Patinated bronze • Hand-carved alabaster diffuser",
        dimensions: "H650 × W115 × D62 mm"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/entrelacs_lightings" },
      { type: "Curators' Picks" },
    ],
  },
];

const FeaturedDesigners = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [selectedImage, setSelectedImage] = useState<{ name: string; image: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [openDesigners, setOpenDesigners] = useState<string[]>([]);
  const [curatorPicksDesigner, setCuratorPicksDesigner] = useState<typeof featuredDesigners[0] | null>(null);
  const [curatorPickIndex, setCuratorPickIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const minSwipeDistance = 50;

  // Fixed category order
  const CATEGORY_ORDER = ["Lighting", "Seating", "Storage", "Tables", "Rugs", "Decorative Object"];

  // Collect categories and subcategories from curators' picks
  const categoryMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    featuredDesigners.forEach(designer => {
      designer.curatorPicks?.forEach((pick: any) => {
        if (pick.tags && pick.tags.length >= 2) {
          const category = pick.tags[0];
          const subcategory = pick.tags[1];
          if (!map[category]) map[category] = new Set();
          map[category].add(subcategory);
        } else if (pick.tags && pick.tags.length === 1) {
          const category = pick.tags[0];
          if (!map[category]) map[category] = new Set();
        }
      });
    });
    const result: Record<string, string[]> = {};
    CATEGORY_ORDER.forEach(cat => {
      if (map[cat]) {
        result[cat] = Array.from(map[cat]).sort();
      }
    });
    // Include any categories not in the fixed order
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

  const filteredDesigners = useMemo(() => {
    let designers = featuredDesigners;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      designers = designers.filter(
        (designer) =>
          designer.name.toLowerCase().includes(query) ||
          designer.specialty.toLowerCase().includes(query) ||
          designer.curatorPicks?.some((pick: any) =>
            pick.tags?.some((tag: string) => tag.toLowerCase().includes(query)) ||
            pick.title?.toLowerCase().includes(query) ||
            pick.subtitle?.toLowerCase().includes(query)
          )
      );
    }
    if (selectedCategory || selectedSubcategory) {
      designers = designers.filter(designer =>
        designer.curatorPicks?.some((pick: any) => {
          if (selectedSubcategory) return pick.tags?.includes(selectedSubcategory);
          if (selectedCategory) return pick.tags?.includes(selectedCategory);
          return true;
        })
      );
    }
    return designers;
  }, [searchQuery, selectedCategory, selectedSubcategory]);

  const allDesignerIds = useMemo(() => filteredDesigners.map(d => d.id), [filteredDesigners]);
  const isAllExpanded = openDesigners.length === allDesignerIds.length && allDesignerIds.length > 0;

  const toggleAllDesigners = () => {
    if (isAllExpanded) {
      setOpenDesigners([]);
    } else {
      setOpenDesigners(allDesignerIds);
    }
  };

  return (
    <section ref={ref} className="py-10 px-4 md:py-24 md:px-12 lg:px-20 bg-background">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-left"
        >
          <p className="mb-2 md:mb-3 uppercase tracking-[0.2em] md:tracking-[0.3em] text-primary text-sm md:text-xl lg:text-2xl font-serif">
            THE ARTISANS
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground mb-4">
            Designers & Makers
          </h2>
          <p className="text-base md:text-lg text-muted-foreground font-body max-w-3xl">
            Discover the visionary designers and artisans whose exceptional work defines Maison Affluency. Each brings
            their unique perspective and masterful craftsmanship to create pieces that transcend ordinary furniture.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="sticky top-0 z-40 -mx-4 px-4 md:-mx-12 md:px-12 lg:-mx-20 lg:px-20 py-3 md:py-4 mb-4 bg-background/95 backdrop-blur-md border-b border-border/20"
        >
          <div className="max-w-6xl mx-auto">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search designers..."
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
            {/* Category Navigation - Carlyle Collective style */}
            <div className="flex flex-wrap items-center gap-3 md:gap-6 mt-4 border-b border-border/30 pb-3">
              <button
                onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
                className={`text-[11px] md:text-xs uppercase tracking-[0.2em] font-body transition-all duration-300 relative pb-1 ${
                  !selectedCategory
                    ? 'text-foreground'
                    : 'text-muted-foreground/60 hover:text-foreground'
                }`}
              >
                All
                {!selectedCategory && (
                  <span className="absolute bottom-0 left-0 w-full h-px bg-foreground" />
                )}
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    if (selectedCategory === cat) {
                      setSelectedCategory(null);
                      setSelectedSubcategory(null);
                    } else {
                      setSelectedCategory(cat);
                      setSelectedSubcategory(null);
                    }
                  }}
                  className={`text-[11px] md:text-xs uppercase tracking-[0.2em] font-body transition-all duration-300 relative pb-1 whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'text-foreground'
                      : 'text-muted-foreground/60 hover:text-foreground'
                  }`}
                >
                  {cat}
                  {selectedCategory === cat && (
                    <span className="absolute bottom-0 left-0 w-full h-px bg-foreground" />
                  )}
                </button>
              ))}
            </div>
            {/* Subcategories row */}
            {selectedCategory && categoryMap[selectedCategory]?.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 md:gap-5 mt-2.5">
                <button
                  onClick={() => setSelectedSubcategory(null)}
                  className={`text-[10px] md:text-[11px] uppercase tracking-[0.15em] font-body transition-all duration-300 ${
                    !selectedSubcategory
                      ? 'text-primary'
                      : 'text-muted-foreground/50 hover:text-primary'
                  }`}
                >
                  All {selectedCategory}
                </button>
                {categoryMap[selectedCategory].map(sub => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubcategory(selectedSubcategory === sub ? null : sub)}
                    className={`text-[10px] md:text-[11px] uppercase tracking-[0.15em] font-body transition-all duration-300 whitespace-nowrap ${
                      selectedSubcategory === sub
                        ? 'text-primary'
                        : 'text-muted-foreground/50 hover:text-primary'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
            {(searchQuery || selectedCategory) && (
              <p className="text-left text-[10px] text-muted-foreground/50 mt-2 font-body tracking-wider">
                {filteredDesigners.length} designer{filteredDesigners.length !== 1 ? 's' : ''} found
                {selectedSubcategory && <span> · {selectedSubcategory}</span>}
                {selectedCategory && !selectedSubcategory && <span> · {selectedCategory}</span>}
              </p>
            )}
          </div>
        </motion.div>

        <div className="flex justify-end mb-4">
          <button
            onClick={toggleAllDesigners}
            className="text-xs text-muted-foreground hover:text-primary font-body transition-colors duration-300 flex items-center gap-1"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isAllExpanded ? 'rotate-180' : ''}`} />
            <span>{isAllExpanded ? 'Collapse All' : 'Expand All'}</span>
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Accordion 
            type="multiple" 
            value={openDesigners} 
            onValueChange={(values) => {
              // Trigger haptic feedback on mobile
              if ('vibrate' in navigator) {
                navigator.vibrate(10);
              }
              // On mobile, scroll to the newly opened designer
              if (window.innerWidth < 768 && values.length > openDesigners.length) {
                const newDesigner = values.find(v => !openDesigners.includes(v));
                if (newDesigner) {
                  setTimeout(() => {
                    const element = document.querySelector(`[data-designer="${newDesigner}"]`);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }
              }
              setOpenDesigners(values);
            }} 
            className="w-full space-y-4"
          >
            {filteredDesigners.map((designer, index) => (
              <AccordionItem
                key={designer.id}
                value={designer.id}
                id={`designer-${designer.id}`}
                data-designer={designer.id}
                className="border border-border/40 rounded-lg px-4 md:px-6 bg-card/30 hover:bg-card/50 transition-colors duration-300 scroll-mt-16"
              >
                <AccordionTrigger className="hover:no-underline py-4 md:py-6 group active:scale-[0.99] touch-manipulation">
                  <div className="flex items-center gap-4 md:gap-6 text-left w-full">
                    <Dialog>
                      <DialogTrigger asChild>
                        <div
                          className="relative flex-shrink-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage({ name: designer.name, image: designer.image });
                          }}
                        >
                          <img
                            src={designer.image}
                            alt={designer.name}
                            className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover ring-2 ring-border/40 transition-all duration-300 hover:ring-primary/60 hover:scale-105 hover:shadow-lg"
                          />
                          <div className="absolute inset-0 rounded-full bg-primary/0 hover:bg-primary/10 transition-all duration-300 flex items-center justify-center">
                            <svg
                              className="w-8 h-8 text-primary opacity-0 hover:opacity-100 transition-opacity duration-300"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                              />
                            </svg>
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl" aria-describedby={undefined}>
                        <VisuallyHidden>
                          <DialogTitle>{selectedImage?.name || designer.name}</DialogTitle>
                        </VisuallyHidden>
                        <div className="relative w-full h-full">
                          <img
                            src={selectedImage?.image || designer.image}
                            alt={selectedImage?.name || designer.name}
                            className="w-full h-auto rounded-lg object-contain"
                          />
                          <p className="text-center mt-4 text-lg font-serif text-foreground">
                            {designer.founder || selectedImage?.name || designer.name}
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {designer.links?.find(l => l.type === "Instagram")?.url && (
                          <a
                            href={designer.links.find(l => l.type === "Instagram")?.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-0.5 transition-transform duration-300 hover:scale-110"
                            aria-label="Instagram"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="url(#instagram-gradient-name)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <defs>
                                <linearGradient id="instagram-gradient-name" x1="0%" y1="100%" x2="100%" y2="0%">
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
                        <h3 className="text-xl md:text-2xl font-serif text-foreground transition-colors duration-300 group-hover:text-primary">
                          {designer.name}
                        </h3>
                      </div>
                      <p className="text-sm md:text-base text-primary font-body italic transition-opacity duration-300 group-hover:opacity-80">
                        {designer.specialty}
                      </p>
                      {(designer.notableWorksLink || designer.notableWorksLinks) && (
                        <>
                          <span className="text-primary/40 text-xs tracking-[0.3em] mt-1">• • •</span>
                          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                          <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Gallery Featured:</span>
                          {designer.notableWorksLinks ? (
                            designer.notableWorksLinks.map((link, linkIdx) => (
                              <span key={linkIdx} className="flex items-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const gallerySection = document.getElementById('gallery');
                                    if (gallerySection) {
                                      gallerySection.scrollIntoView({ behavior: 'smooth' });
                                      setTimeout(() => {
                                        window.dispatchEvent(new CustomEvent('openGalleryLightbox', { 
                                          detail: { index: link.galleryIndex, sourceId: `designer-${designer.id}` } 
                                        }));
                                      }, 500);
                                    }
                                  }}
                                  className="text-xs md:text-sm text-primary/80 font-body hover:text-primary transition-colors duration-300 flex items-center gap-1 group/link touch-manipulation"
                                >
                                  <span className="underline underline-offset-2 decoration-primary/40 group-hover/link:decoration-primary">
                                    {link.text}
                                  </span>
                                  <ExternalLink className="h-3 w-3 opacity-50 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                                </button>
                                {linkIdx < designer.notableWorksLinks.length - 1 && (
                                  <span className="text-muted-foreground mx-1">•</span>
                                )}
                              </span>
                            ))
                          ) : designer.notableWorksLink && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const gallerySection = document.getElementById('gallery');
                                if (gallerySection) {
                                  gallerySection.scrollIntoView({ behavior: 'smooth' });
                                  setTimeout(() => {
                                    window.dispatchEvent(new CustomEvent('openGalleryLightbox', { 
                                      detail: { index: designer.notableWorksLink.galleryIndex, sourceId: `designer-${designer.id}` } 
                                    }));
                                  }, 500);
                                }
                              }}
                              className="text-xs md:text-sm text-primary/80 font-body hover:text-primary transition-colors duration-300 flex items-center gap-1 group/link touch-manipulation"
                            >
                              <span className="underline underline-offset-2 decoration-primary/40 group-hover/link:decoration-primary">
                                {designer.notableWorksLink.text}
                              </span>
                              <ExternalLink className="h-3 w-3 opacity-50 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          )}
                        </div>
                        </>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-6">
                  <div className="space-y-4 text-muted-foreground font-body">
                    <p className="text-sm md:text-base leading-relaxed">{designer.biography}</p>

                    <div className="pt-2 border-t border-border/30 mt-4">
                      <p className="text-sm md:text-base italic leading-relaxed text-foreground/80 mb-4">
                        "{designer.philosophy}"
                      </p>

                      {designer.links && designer.links.filter(l => l.type !== "Instagram").length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-4">
                          {designer.links.filter(l => l.type !== "Instagram").map((link, idx) => (
                            link.url ? (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body rounded-md transition-all duration-300 border bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 hover:border-primary/40"
                                aria-label={link.type}
                              >
                                <span>{link.type}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </a>
                            ) : link.type === "Curators' Picks" ? (
                              <button
                                key={idx}
                                onClick={() => setCuratorPicksDesigner(designer)}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body bg-gradient-to-r from-accent/90 to-primary/80 hover:from-accent hover:to-primary text-white rounded-md transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 cursor-pointer border border-accent/30"
                              >
                                <Star size={16} className="fill-current" />
                                <span className="font-medium">{link.type}</span>
                              </button>
                            ) : (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body bg-primary/10 text-primary rounded-md border border-primary/20"
                              >
                                {link.type}
                              </span>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* Curators' Picks Lightbox Dialog */}
        <Dialog 
          open={!!curatorPicksDesigner} 
          onOpenChange={(open) => {
            if (!open) {
              setCuratorPicksDesigner(null);
              setCuratorPickIndex(0);
            }
          }}
        >
          <DialogContent 
            className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none" 
            aria-describedby={undefined}
            onKeyDown={(e) => {
              if (!curatorPicksDesigner?.curatorPicks?.length) return;
              if (e.key === "ArrowLeft") {
                setCuratorPickIndex(prev => prev === 0 ? curatorPicksDesigner.curatorPicks.length - 1 : prev - 1);
              }
              if (e.key === "ArrowRight") {
                setCuratorPickIndex(prev => prev === curatorPicksDesigner.curatorPicks.length - 1 ? 0 : prev + 1);
              }
            }}
          >
            <VisuallyHidden>
              <DialogTitle>Curators' Picks - {curatorPicksDesigner?.name}</DialogTitle>
            </VisuallyHidden>
            {curatorPicksDesigner && (
              curatorPicksDesigner.curatorPicks && curatorPicksDesigner.curatorPicks.length > 0 ? (
                <div 
                  className="relative w-full h-full flex items-center justify-center"
                  onTouchStart={(e) => {
                    setTouchEnd(null);
                    setTouchStart(e.targetTouches[0].clientX);
                  }}
                  onTouchMove={(e) => {
                    setTouchEnd(e.targetTouches[0].clientX);
                  }}
                  onTouchEnd={() => {
                    if (!touchStart || !curatorPicksDesigner.curatorPicks?.length) return;
                    // Only handle swipe if there was actual movement
                    if (touchEnd !== null) {
                      const distance = touchStart - touchEnd;
                      if (distance > minSwipeDistance) {
                        setCuratorPickIndex(prev => prev === curatorPicksDesigner.curatorPicks.length - 1 ? 0 : prev + 1);
                      } else if (distance < -minSwipeDistance) {
                        setCuratorPickIndex(prev => prev === 0 ? curatorPicksDesigner.curatorPicks.length - 1 : prev - 1);
                      }
                    }
                  }}
                >
                  {/* Close button */}
                  <button 
                    onClick={() => {
                      setCuratorPicksDesigner(null);
                      setCuratorPickIndex(0);
                      setIsZoomed(false);
                    }} 
                    className="absolute top-4 right-4 z-50 p-2 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                    aria-label="Close lightbox"
                  >
                    <X className="h-6 w-6 text-white" />
                  </button>

                  {/* Previous button */}
                  {curatorPicksDesigner.curatorPicks.length > 1 && (
                    <button 
                      onClick={() => {
                        setCuratorPickIndex(prev => prev === 0 ? curatorPicksDesigner.curatorPicks.length - 1 : prev - 1);
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-8 w-8 text-white" />
                    </button>
                  )}

                  {/* Image container */}
                  <div className={`flex flex-col items-center justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 ${isZoomed ? 'max-h-[95vh] pb-4' : 'max-h-[85vh] pb-24'}`}>
                    <div 
                      className={`relative overflow-auto transition-all duration-300 ${isZoomed ? 'max-h-[85vh]' : ''}`}
                      onTouchEnd={(e) => {
                        // Prevent double-tap zoom if there was a swipe
                        if (touchEnd !== null) return;
                        e.stopPropagation();
                        const now = Date.now();
                        if (now - lastTapRef.current < 300) {
                          setIsZoomed(!isZoomed);
                        }
                        lastTapRef.current = now;
                      }}
                      onClick={(e) => {
                        // For desktop: double-click to zoom
                        const now = Date.now();
                        if (now - lastTapRef.current < 300) {
                          setIsZoomed(!isZoomed);
                        }
                        lastTapRef.current = now;
                      }}
                    >
                      {!isZoomed && (curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.category && (
                        <div className="text-left mb-2 flex flex-wrap gap-1.5">
                          {((curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.tags || [(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.category]).map((tag: string, i: number) => (
                            <span key={i} className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <img 
                        src={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.image} 
                        alt={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title} 
                        className={`object-contain transition-all duration-300 select-none ${isZoomed ? 'max-w-none w-[150vw] md:w-auto md:max-w-full md:max-h-[80vh]' : 'max-w-full max-h-[55vh]'}`}
                        draggable={false}
                      />
                      <button 
                        onClick={() => setIsZoomed(!isZoomed)}
                        className={`absolute bottom-24 right-3 md:bottom-3 md:right-3 p-2 bg-black/40 backdrop-blur-sm rounded-full transition-all duration-300 hover:bg-black/60 cursor-pointer ${isZoomed ? 'opacity-70' : 'opacity-70 hover:opacity-100'}`}
                        aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                      >
                        {isZoomed ? (
                          <ZoomOut className="h-5 w-5 text-white" />
                        ) : (
                          <ZoomIn className="h-5 w-5 text-white" />
                        )}
                      </button>
                    </div>
                    <div className={`mt-2 text-center transition-all duration-300 ${isZoomed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                      <h3 className="text-sm md:text-base font-serif text-white mb-1">
                        {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title}
                        {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.subtitle && (
                          <>
                            <br />
                            <span className="text-white/70 text-xs md:text-sm font-body">{(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any).subtitle}</span>
                          </>
                        )}
                        {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.materials && (
                          <span className="text-white/60 font-body text-xs md:text-sm"> ({curatorPicksDesigner.curatorPicks[curatorPickIndex].materials})</span>
                        )}
                      </h3>
                      {(curatorPicksDesigner.curatorPicks[curatorPickIndex]?.materials || curatorPicksDesigner.curatorPicks[curatorPickIndex]?.dimensions) && (
                        <div className="mt-2 max-w-xl space-y-1">
                          
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.dimensions && (
                            <p className="text-xs md:text-sm text-white/40 font-body italic">
                              {curatorPicksDesigner.curatorPicks[curatorPickIndex].dimensions}
                            </p>
                          )}
                          {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.description && (
                            <p className="text-xs md:text-sm text-white/50 font-body leading-relaxed max-w-lg mt-2">
                              {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any).description}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="mt-12 text-xs text-white font-body italic">
                        For further details, please request our catalogue at{" "}
                        <a href="mailto:concierge@myaffluency.com" className="underline hover:text-white/80 transition-colors">
                          concierge@myaffluency.com
                        </a>
                      </p>
                    </div>
                  </div>

                  {/* Thumbnail navigation bar */}
                  {curatorPicksDesigner.curatorPicks.length > 1 && (
                    <TooltipProvider delayDuration={200}>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 bg-background/30 backdrop-blur-md rounded-full">
                        {curatorPicksDesigner.curatorPicks.map((pick, idx) => (
                          <Tooltip key={idx}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  setCuratorPickIndex(idx);
                                }}
                                className={`relative w-12 h-12 md:w-14 md:h-14 rounded-md overflow-hidden transition-all duration-300 ${
                                  curatorPickIndex === idx 
                                    ? 'ring-2 ring-white scale-110' 
                                    : 'ring-1 ring-white/30 opacity-60 hover:opacity-100 hover:ring-white/60'
                                }`}
                                aria-label={`View ${pick.title}`}
                              >
                                <img 
                                  src={pick.image} 
                                  alt={pick.title} 
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-background/90 backdrop-blur-sm border-border/40">
                              <p className="font-body text-sm">{pick.title}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  )}

                  {/* Next button */}
                  {curatorPicksDesigner.curatorPicks.length > 1 && (
                    <button 
                      onClick={() => {
                        setCuratorPickIndex(prev => prev === curatorPicksDesigner.curatorPicks.length - 1 ? 0 : prev + 1);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-8 w-8 text-white" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <div className="text-center p-8">
                    <Star className="h-16 w-16 text-white/30 mx-auto mb-4" />
                    <h3 className="text-2xl font-serif text-white mb-2">
                      Curators' Picks
                    </h3>
                    <p className="text-white/70 font-body mb-2">
                      {curatorPicksDesigner.name}
                    </p>
                    <p className="text-sm text-white/50 font-body italic">
                      Curated selections coming soon
                    </p>
                  </div>
                </div>
              )
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default FeaturedDesigners;
