import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect, useCallback, Fragment } from "react";
import { Instagram, ChevronDown, ExternalLink, Star, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, X, SlidersHorizontal } from "lucide-react";
import { trackCTA } from "@/lib/analytics";
import { shareProfileOnWhatsApp } from "@/lib/whatsapp-share";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";

import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

// Designer images
const atelierDemichelisImg = cloudinaryUrl("Screen_Shot_2025-12-11_at_11.44.20_PM_bj90pt", { width: 800, quality: "auto", crop: "fill" });
const kikoLopezImg = cloudinaryUrl("Screen_Shot_2025-12-12_at_1.08.35_AM_uzbbxd", { width: 800, quality: "auto", crop: "fill" });
const nathalieZieglerImg = cloudinaryUrl("Screen_Shot_2025-12-11_at_11.41.17_PM_r8vwke", { width: 800, quality: "auto", crop: "fill" });
const maartenVrolijkImg = cloudinaryUrl("Screen_Shot_2025-12-14_at_7.32.25_AM_wujvd4", { width: 800, quality: "auto", crop: "fill" });
const matthieuGicquelImg = cloudinaryUrl("Screen_Shot_2026-02-26_at_4.13.15_PM_emrclr", { width: 800, quality: "auto", crop: "fill" });

// Curators' Picks images
import demichelisPick1 from "@/assets/curators-picks/demichelis-1.jpg";
import demichelisPick2 from "@/assets/curators-picks/demichelis-2.jpg";
import demichelisPick3 from "@/assets/curators-picks/demichelis-3.jpg";
import demichelisPick4 from "@/assets/curators-picks/demichelis-4.jpg";
import matthieuGicquelGeode from "@/assets/curators-picks/matthieu-gicquel-geode.jpg";
import maartenVrolijkVessel from "@/assets/curators-picks/maarten-vrolijk-sakura.jpg";
import kikoLopezMirror from "@/assets/curators-picks/kiko-lopez-mirror.jpg";
import nathalieZieglerSnakeVessel from "@/assets/curators-picks/nathalie-ziegler-snake-vessel.jpg";
const rowinAtelierImg = cloudinaryUrl("Screen_Shot_2025-12-14_at_10.54.13_AM_r7npgu", { width: 800, quality: "auto", crop: "fill" });
import rowinNoneIiLamp from "@/assets/curators-picks/rowin-none-ii-lamp.jpg";
const marcantonioBrandoliniImg = cloudinaryUrl("Screen_Shot_2025-12-14_at_11.02.28_AM_icg7b9", { width: 800, quality: "auto", crop: "fill" });
import marcantonioCotissiVessel from "@/assets/curators-picks/marcantonio-cotissi-vessel.jpg";
const thierryLemaireImg = cloudinaryUrl("thierry-lemaire_heyrtj", { width: 800, quality: "auto", crop: "fill" });
import thierryLemaireOrsay from "@/assets/curators-picks/thierry-lemaire-orsay.jpg";
const pierreBonnefilleImg = cloudinaryUrl("pierre-bonnefille", { width: 800, quality: "auto", crop: "fill" });
import pierreBonnefilleBronzePainting from "@/assets/curators-picks/pierre-bonnefille-bronze-painting.jpg";
import pierreBonnefilleBronzePainting208 from "@/assets/curators-picks/pierre-bonnefille-bronze-painting-208.png";
const herveVanDerStraetenImg = cloudinaryUrl("Screen_Shot_2025-12-12_at_12.15.28_AM_nraulk", { width: 800, quality: "auto", crop: "fill" });
import herveMicmac from "@/assets/curators-picks/herve-vds-micmac.jpg";
const herveArthurLamp = cloudinaryUrl("Screen_Shot_2026-02-23_at_10.47.13_AM_cukmu3", { width: 1600, quality: "auto:good", crop: "fill" });
const herveBubblingLamp = cloudinaryUrl("Screen_Shot_2026-02-23_at_10.50.06_AM_caibdj", { width: 1600, quality: "auto:good", crop: "fill" });
const herveDaphnePendant = cloudinaryUrl("Screen_Shot_2026-02-23_at_10.55.49_AM_loicir", { width: 1600, quality: "auto:good", crop: "fill" });
const herveTourbillonPendant = cloudinaryUrl("Screen_Shot_2026-02-23_at_11.01.34_AM_j7dggg", { width: 1600, quality: "auto:good", crop: "fill" });
const herveFacettedPendant = cloudinaryUrl("Screen_Shot_2026-02-23_at_11.07.41_AM_lbv2zc", { width: 1600, quality: "auto:good", crop: "fill" });
const herveTumulteMirror = cloudinaryUrl("Screen_Shot_2026-02-23_at_11.10.56_AM_un5mxc", { width: 1600, quality: "auto:good", crop: "fill" });
const herveEmpileeConsole = cloudinaryUrl("Screen_Shot_2026-02-23_at_11.16.19_AM_p0jbm0", { width: 1600, quality: "auto:good", crop: "fill" });
const emmanuelBabledImg = cloudinaryUrl("Screen_Shot_2025-12-14_at_7.32.25_AM_wujvd4", { width: 800, quality: "auto", crop: "fill" });
import emmanuelBabledPick1 from "@/assets/curators-picks/emmanuel-babled-1.jpg";
import emmanuelBabledPick2 from "@/assets/curators-picks/emmanuel-babled-2.jpg";
import emmanuelBabledPick3 from "@/assets/curators-picks/emmanuel-babled-3.jpg";
import emmanuelBabledPick4 from "@/assets/curators-picks/emmanuel-babled-4.jpg";
import emmanuelBabledPick5 from "@/assets/curators-picks/emmanuel-babled-5.jpg";
import emmanuelBabledPick6 from "@/assets/curators-picks/emmanuel-babled-6.jpg";
import emmanuelBabledPick7 from "@/assets/curators-picks/emmanuel-babled-7.jpg";
const ericSchmittImg = cloudinaryUrl("Screen_Shot_2026-02-26_at_4.16.30_PM_ijgqlu", { width: 800, quality: "auto", crop: "fill" });
import ericSchmittDrageeConsole from "@/assets/curators-picks/eric-schmitt-dragee-console.jpg";
import ericSchmittSaturneTable from "@/assets/curators-picks/eric-schmitt-saturne-table.jpg";
import ericSchmittFrameTable from "@/assets/curators-picks/eric-schmitt-frame-table.jpg";
import ericSchmittAnneauLamp from "@/assets/curators-picks/eric-schmitt-anneau-lamp.jpg";
import ericSchmittDentelleConsole from "@/assets/curators-picks/eric-schmitt-dentelle-console.jpg";
import ericSchmittFloatingTable from "@/assets/curators-picks/eric-schmitt-floating-table.jpg";
import ericSchmittRocwoodTable from "@/assets/curators-picks/eric-schmitt-rocwood-table.jpg";
export const collectibleDesigners: Array<{
  id?: string;
  name: string;
  founder?: string;
  specialty: string;
  image: string;
  biography: string;
  notableWorks: string;
  notableWorksLink?: { text: string; galleryIndex: number };
  philosophy: string;
  curatorPicks: Array<{
    image: string;
    title: string;
    category: string;
    subcategory?: string;
    materials: string;
    dimensions: string;
    edition?: string;
    tags?: string[];
    description?: string;
  }>;
  links: Array<{ type: string; url?: string }>;
}> = [
  {
    id: "atelier-demichelis",
    name: "Atelier Demichelis",
    founder: "Laura Demichelis",
    specialty: "Limited Edition Lighting & Artisan Craftsmanship",
    image: atelierDemichelisImg,
    biography:
      "Atelier Demichelis is a contemporary design studio specializing in limited edition lighting fixtures. Each piece is meticulously handcrafted, combining traditional techniques with innovative design. Their Bud Table Lamp represents their commitment to creating functional art objects with exceptional attention to detail.",
    notableWorks: "Limited Edition Bud Table Lamp, Artisan Lighting Collection",
    notableWorksLink: { text: "Bud Table Lamp | Unique By Design Vignette", galleryIndex: 15 },
    philosophy: "We create lighting that elevates everyday moments into experiences of beauty and contemplation.",
    curatorPicks: [
      { image: demichelisPick1, title: "Babel Table Lamp", category: "Lighting", subcategory: "Table Lamps", materials: "Bronze • Brass • Ash wood • White fabric shade", dimensions: "Ø45 × H60.9 cm", edition: "Numbered edition of 20" },
      { image: demichelisPick4, title: "Echo Floor Lamp", category: "Lighting", subcategory: "Floor Lamps", materials: "Patinated and varnished brass", dimensions: "Ø38 × H166 cm", edition: "Numbered edition of 20" },
      { image: demichelisPick2, title: "Bud Table Lamp", category: "Lighting", subcategory: "Table Lamps", materials: "Bronze • White oak • Hand-made fabric shade", dimensions: "Ø40 × H71 cm", edition: "Numbered edition of 20" },
      { image: demichelisPick3, title: "Table d'appoint RHINO", category: "Tables", subcategory: "Side Tables", materials: "Patinated bronze • Raw brass • Brown cowhide leather top", dimensions: "H43.5 × L35 cm", edition: "Numbered edition of 8 + 2 APs" },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/atelier_demichelis" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "emmanuel-babled",
    name: "Emmanuel Babled",
    specialty: "Sculptural Glass & Marble Design",
    image: emmanuelBabledImg,
    biography: "Emmanuel Babled is a French-Italian designer renowned for his limited edition sculptural objects in glass and marble. His Osmosi Series represents the pinnacle of material exploration and artistic vision, blending organic forms with exceptional craftsmanship. Each piece is a unique work of art that pushes the boundaries of material possibilities.",
    notableWorks: "Osmosi Series Sculptured Book Cover, Glass Sculptures, Marble Objects",
    notableWorksLink: { text: "Sculptured Book Cover from the Osmosi Series", galleryIndex: 2 },
    philosophy: "I explore the boundaries between art and design, creating objects that challenge perception and celebrate material beauty.",
    curatorPicks: [
      { image: emmanuelBabledPick1, title: "Osmosi — Console", category: "Tables", subcategory: "Console", materials: "Carrara marble, Murano blown glass", dimensions: "H80 × L160 × D35 cm", edition: "" },
      { image: emmanuelBabledPick2, title: "Coral — Coffee Table", category: "Tables", subcategory: "Coffee Table", materials: "Bianco Carrara marble, plexiglass", dimensions: "L150 × W100 × H28 cm", edition: "" },
      { image: emmanuelBabledPick3, title: "Pyros Marini — Vase", category: "Decorative Object", subcategory: "Vase", materials: "Murano blown glass (Venini)", dimensions: "H45 × Ø30 cm", edition: "" },
      { image: emmanuelBabledPick4, title: "Quark Bronze — Coffee Table", category: "Tables", subcategory: "Coffee Table", materials: "Bronze", dimensions: "H30 × L122.5 × W83 cm", edition: "" },
      { image: emmanuelBabledPick5, title: "Siliceaarenaria — Vessels", category: "Decorative Object", subcategory: "Vessel", materials: "Murano blown glass (Venini)", dimensions: "Ø25 × H22 cm (each)", edition: "" },
      { image: emmanuelBabledPick6, title: "Etna Cabinet — Stripes", category: "Storage", subcategory: "Cabinet", materials: "Murano glass doors • Lava stone legs", dimensions: "H85 × L120 × D45 cm", edition: "" },
      { image: emmanuelBabledPick7, title: "Osmosi — Side Table", category: "Tables", subcategory: "Side Table", materials: "Carrara marble • Murano blown glass", dimensions: "H55 × Ø60 cm", edition: "" },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/emmanuelbabled" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "eric-schmitt-studio",
    name: "Éric Schmitt Studio",
    specialty: "Sculptural Bronze & Marble Design",
    image: ericSchmittImg,
    biography: "French designer Éric Schmitt believes that 'a piece of furniture needs to exude silence so it can be loved for a long time.' Rather than explaining his work, he prefers to let his objects speak for themselves. His sculptural forms—from the graceful arch of a marble cabinet to the enduring silhouette of a Jarre table—echo the Romanesque churches and medieval architecture of his native Burgundy region. Represented by Carpenters Workshop Gallery, his pieces blur the line between collectible design and fine art.",
    notableWorks: "Chairie (dining chair featured at Maison Affluency), Jarre Table, Marble Cabinet Series, Table Soleil",
    notableWorksLink: { text: "Chairie Dining Chair | Panoramic Cityscape Views", galleryIndex: 2 },
    philosophy: "A piece of furniture needs to exude silence so it can be loved for a long time.",
    curatorPicks: [
      { image: ericSchmittDrageeConsole, title: "Dragée Console", category: "Tables", subcategory: "Console", materials: "Bronze and lacquered polyester resin or pink marble tops", dimensions: "H 85 × L 120 cm", edition: "8 copies and 4 artist's proofs" },
      { image: ericSchmittSaturneTable, title: "Saturne Coffee Table", category: "Tables", subcategory: "Coffee Table", materials: "Two shades of patinated bronze or patinated and nickel plated bronze", dimensions: "H 45 × Ø 90 cm", edition: "24 copies and 4 artist's proofs" },
      { image: ericSchmittFrameTable, title: "Frame Table Low Side Table", category: "Tables", subcategory: "Side Table", materials: "Black patinated and polished bronze", dimensions: "L 50 × W 29 × H 40 cm", edition: "" },
      { image: ericSchmittAnneauLamp, title: "Anneau Pendant Lamp", category: "Lighting", subcategory: "Ceiling Lights", materials: "Alabaster, bronze & brass", dimensions: "Ø 70 / 80 / 90 / 100 cm", edition: "" },
      { image: ericSchmittDentelleConsole, title: "Dentelle Console", category: "Tables", subcategory: "Console", materials: "Silver plated bronze and steel", dimensions: "L 90 × W 40 × H 96 cm", edition: "4 copies and 4 artist's proofs" },
      { image: ericSchmittFloatingTable, title: "Floating Table One Foot", category: "Tables", subcategory: "Dining Table", materials: "Wood top and legs, blown glass bases", dimensions: "Ø 130 × H 75 cm", edition: "" },
      { image: ericSchmittRocwoodTable, title: "Rocwood Dining Table", category: "Tables", subcategory: "Dining Table", materials: "Patinated bronze base, black tinted walnut top", dimensions: "L 330 × W 120 × H 75 cm — Made to measure on request", edition: "24 copies and 4 artist's proofs" },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/studio_eric_schmitt_/" },
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
    notableWorksLink: { text: "Mic Mac Chandelier | A Masterful Suite", galleryIndex: 12 },
    philosophy:
      "I work with bronze as a jeweler works with precious metals—creating pieces that capture light and movement.",
    curatorPicks: [
      { image: herveEmpileeConsole, title: "Empilée Console", category: "Furniture", subcategory: "Consoles", materials: "Precariously balanced wood lacquered slabs resting on bronze wedges, characteristic of the designer's research into structure", dimensions: "L 200 x l 45 x H 85 cm - 72 kg", edition: "Edition of 20" },
      { image: herveDaphnePendant, title: "Daphne Pendant", category: "Lighting", subcategory: "Pendants", materials: "Golden-brown patinated bronze", dimensions: "Ø 100 x H 140 cm - 57kg", edition: "Edition of 40" },
      { image: herveTumulteMirror, title: "Tumulte Convex Mirror", category: "Decorative Objects", subcategory: "Mirrors", materials: "Constellation of lacquered, bubble-like pebbles in Prussian blue, set in a swirling vortex of bronze", dimensions: "W 127 x H 138 cm - 56kg", edition: "Edition of 3" },
      { image: herveArthurLamp, title: "Arthur Lamp", category: "Lighting", subcategory: "Table Lamps", materials: "Patinated bronze Vison Nuancé and Montblanc fabric lampshade", dimensions: "Ø 39 x H 51.5 cm - 8kg" },
      { image: herveBubblingLamp, title: "Bubbling Lamp", category: "Lighting", subcategory: "Table Lamps", materials: "Bronze with a golden brown patina, diffuses a soft light which is surreptitiously captured by the crystal spheres adorning its base.\nAlso available in bronze with a black or silver patina – possibility to change lampshade colour", dimensions: "Ø 32 x H 51.5 cm - 4 kg" },
      { image: herveFacettedPendant, title: "Facetted Pendant", category: "Lighting", subcategory: "Pendants", materials: "Golden brown patinated Bronze\nAlso available in large size, with patinated or lacquered bronze", dimensions: "Ø 40cm x H 155 cm - 15kg" },
      { image: herveTourbillonPendant, title: "Tourbillon Pendant", category: "Lighting", subcategory: "Pendants", materials: "Golden-brown patinated bronze", dimensions: "Ø 40 x H 129.3 cm" },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/hervevanderstraetengalerie" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "kiko-lopez",
    name: "Kiko Lopez",
    specialty: "Artisan Mirrors & Reflective Surfaces",
    image: kikoLopezImg,
    biography:
      "Kiko Lopez is a French master mirror artisan renowned for creating extraordinary reflective surfaces that blur the line between functional object and sculptural art. Using traditional techniques combined with innovative approaches to glass and metal, his mirrors transform spaces with their unique textural qualities and light-capturing properties. His Silver Glass Hammer Mirror and Shadow Drawings Mirror exemplify his distinctive style of treating mirrors as artistic statements.",
    notableWorks: "Silver Glass Hammer Mirror, Shadow Drawings Mirror, Antiqued Mirror Collection, Sculptural Reflective Surfaces",
    notableWorksLink: { text: "Silver Glass Hammer Mirror | Design Tableau", galleryIndex: 13 },
    philosophy: "A mirror is not merely a reflection—it is a portal that transforms light and space into something magical.",
    curatorPicks: [
      { image: kikoLopezMirror, title: "Shadow Drawings Mirror", category: "Decorative Object", subcategory: "Mirrors", materials: "Antiqued glass • Bronze patina frame", dimensions: "H100 × W70 cm", edition: "Unique Piece" },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/kikolumieres" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "maarten-vrolijk",
    name: "Maarten Vrolijk",
    specialty: "Contemporary Handblown Glass Art & Sculptural Vessels",
    image: maartenVrolijkImg,
    biography:
      "Maarten Vrolijk is a Dutch designer known for his sculptural approach to furniture design. His work explores the intersection of art and functionality, creating pieces that challenge conventional forms while remaining inherently practical. Each creation reflects his deep understanding of materials and his commitment to pushing the boundaries of contemporary design.",
    notableWorks: "Sakura TRP 22001, Sculptural Glass Vessels, Unique Art Pieces",
    notableWorksLink: { text: "Sakura TRP 22001 | An Inviting Lounge Area", galleryIndex: 0 },
    philosophy: "Furniture should be a conversation between form and function—each piece tells a story of material and intention.",
    curatorPicks: [
      { image: maartenVrolijkVessel, title: "Sakura TRP 22001", category: "Decorative Object", subcategory: "Vessels", materials: "Handblown & sculpted glass, unique piece with certificate", dimensions: "H 52 cm × W 40 cm × D 41 cm", edition: "Unique Piece" },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/maartenvrolijk" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "marcantonio-brandolini-dadda",
    name: "Marcantonio Brandolini D'Adda",
    specialty: "Glass Art & Sculptural Vessels",
    image: marcantonioBrandoliniImg,
    biography:
      "Marcantonio Brandolini D'Adda is an Italian glass artist whose work represents the finest traditions of Murano glassmaking combined with contemporary artistic vision. His vessels are celebrated for their organic forms and exceptional craftsmanship.",
    notableWorks: "Cotissi Vessel, Murano Glass Sculptures",
    notableWorksLink: { text: "Cotissi Vessel | The Details Make The Design", galleryIndex: 25 },
    philosophy: "Glass is a living material that captures light and transforms space into poetry.",
    curatorPicks: [
      { image: marcantonioCotissiVessel, title: "Cotissi Vessel", category: "Decorative Object", subcategory: "Vessels", materials: "Hand-blown Murano glass", dimensions: "H35 × Ø20 cm", edition: "Unique Piece" },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/marcantoniobrandolinidadda" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "matthieu-gicquel",
    name: "Matthieu Gicquel",
    specialty: "Artisan Glass & Tableware",
    image: matthieuGicquelImg,
    biography:
      "Matthieu Gicquel is a French glass artist renowned for his exceptional tableware and decorative objects that blend traditional craftsmanship with contemporary design. His signature pieces feature textured glass adorned with precious gold leaf details, creating functional art that elevates everyday dining into a refined experience.",
    notableWorks: "Texture Glass with Gold Leaf rim Géode, Artisan Tableware Collection",
    notableWorksLink: { text: "Texture Glass with Gold Leaf rim Géode | Craftsmanship At Every Corner", galleryIndex: 27 },
    philosophy: "Each piece of glass tells a story of light, texture, and the timeless beauty of artisan craftsmanship.",
    curatorPicks: [
      { image: matthieuGicquelGeode, title: "Géode Nbr 4: Texture Glass with Gold Leaf Rim", category: "Decorative Object", subcategory: "Tableware", materials: "Textured glass • 24k gold leaf rim", dimensions: "Ø32 cm", edition: "Unique Piece" },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/matthieu_gicquel/?hl=en" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "nathalie-ziegler",
    name: "Nathalie Ziegler",
    specialty: "Bespoke Glass Art & Chandeliers",
    image: nathalieZieglerImg,
    biography:
      "Nathalie Ziegler is a French glass artist known for her custom chandeliers and glass sculptures that blur the line between functional lighting and fine art. Her Saint Just Custom Glass Chandelier showcases her ability to manipulate glass into dramatic, ethereal forms that transform spaces with light and color.",
    notableWorks: "Saint Just Custom Glass Chandelier, Gold Leaves+Glass Snake Vase, Sculptural Glass Series",
    notableWorksLink: { text: "Custom Glass Chandelier", galleryIndex: 8 },
    philosophy:
      "Glass is alive—it captures and transforms light, creating an ever-changing dialogue with its environment.",
    curatorPicks: [
      { image: nathalieZieglerSnakeVessel, title: "Gold & Silver Snake Vessel", category: "Decorative Object", subcategory: "Vessels", materials: "Hand-blown glass • Gold & silver leaf accents", dimensions: "H38 cm × Diam 30 cm", edition: "Unique Piece" },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/nathaliezieglerpasqua" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "pierre-bonnefille",
    name: "Pierre Bonnefille",
    specialty: "Patinated Surfaces, Paintings & Furniture",
    image: pierreBonnefilleImg,
    biography:
      "Pierre Bonnefille is a French artist, painter, designer and 'Maître d'Art' — a title awarded by the French Ministry of Culture to masters of exceptional craft. A graduate of École Boulle and École Nationale Supérieure des Arts Décoratifs, he creates his own materials from mineral powder, limestone, lava, marble, earth, natural pigments and metallic powders. His Bronze Paintings are monumental works where material and color become inseparable.",
    notableWorks: "Bronze Painting 204 (Maison Affluency), Café Marly at the Louvre, Mineral Painting Series",
    notableWorksLink: { text: "Bronze Painting 204 | A Design Treasure Trove", galleryIndex: 11 },
    philosophy: "The material, colors and light are inseparable in my work. I create my own textures from the earth itself.",
    curatorPicks: [
      { image: pierreBonnefilleBronzePainting208, title: "Bronze Painting 208, 2024", category: "Wall Art", tags: ["Wall Art", "Art"], materials: "Mixed media on metallic mesh", dimensions: "H 225 x W 515 cm" },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/pierre_bonnefille/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "rowin-atelier",
    name: "Rochette Frederic & Winkler Hervé - RoWin' Atelier",
    specialty: "Artisan Ceramics & Sculptural Objects",
    image: rowinAtelierImg,
    biography:
      "RoWin' Atelier is a French ceramics studio renowned for creating exceptional handcrafted pieces that blend traditional techniques with contemporary design. Each creation showcases meticulous attention to detail and a deep understanding of material properties.",
    notableWorks: "None II Table Lamp",
    notableWorksLink: { text: "None II Table Lamp | Refined Details", galleryIndex: 21 },
    philosophy: "Every piece of clay holds the potential for extraordinary beauty when shaped by skilled hands.",
    curatorPicks: [
      { image: rowinNoneIiLamp, title: "None II Table Lamp", category: "Lighting", subcategory: "Table Lamps", materials: "Cippolino Verde Marble, Silver-Plated brass", dimensions: "39 cm × 22.5 cm × H 58 cm", edition: "Unique Piece" },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/rowinatelier" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "thierry-lemaire",
    name: "Thierry Lemaire",
    specialty: "Sculptural Furniture & Limited Editions",
    image: thierryLemaireImg,
    biography:
      "A French Star Architect, Interior Designer and Designer, Thierry Lemaire is known for his sculptural approach to furniture design. His pieces blend fine craftsmanship with contemporary aesthetics, creating limited edition works that are as much art as they are functional objects. His Orsay Coffee Table exemplifies his signature style of elegant forms with unexpected details.",
    notableWorks: "Orsay Coffee Table. Limited and numbered edition (12 copies).",
    notableWorksLink: { text: "Orsay Coffee Table | A Sophisticated Living Room", galleryIndex: 1 },
    philosophy: "Each piece is a unique statement that transforms everyday furniture into collectible design objects.",
    curatorPicks: [
      { image: thierryLemaireOrsay, title: "Orsay Coffee Table", category: "Tables", subcategory: "Coffee Tables", materials: "Alabastrino Travertine & Ocean Onyx", dimensions: "L 170 × P 100 × H 40 cm", edition: "Edition of 12 signed" },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/thierrylemaire_/?hl=en" },
      { type: "Curators' Picks" },
    ],
  },
];

const Collectibles = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [selectedImage, setSelectedImage] = useState<{ name: string; image: string } | null>(null);
  const [openDesigners, setOpenDesigners] = useState<string[]>([]);
  const [curatorPicksDesigner, setCuratorPicksDesigner] = useState<typeof collectibleDesigners[0] | null>(null);
  const [curatorPickIndex, setCuratorPickIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  // Deep-link handler: expand designer from URL hash
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.section !== "collectible") return;
      const designer = collectibleDesigners.find(d => d.id === detail.id || d.name === detail.id);
      if (designer) {
        const designerId = designer.id ?? designer.name;
        setOpenDesigners(prev => prev.includes(designerId) ? prev : [...prev, designerId]);
        requestAnimationFrame(() => {
          const el = document.getElementById(`collectible-${designerId}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };
    window.addEventListener("deeplink-open-profile", handler);
    return () => window.removeEventListener("deeplink-open-profile", handler);
  }, []);

  // Preload all curator pick images when lightbox opens
  useEffect(() => {
    if (!curatorPicksDesigner?.curatorPicks?.length) return;
    curatorPicksDesigner.curatorPicks.forEach(pick => {
      const img = new Image();
      img.src = pick.image;
    });
  }, [curatorPicksDesigner]);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategoryRaw] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategoryRaw] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const broadcastFilter = useCallback((cat: string | null, sub: string | null) => {
    window.dispatchEvent(new CustomEvent('syncCategoryFilter', { detail: { category: cat, subcategory: sub, source: 'collectibles' } }));
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

  useEffect(() => {
    const handleCategorySync = (e: CustomEvent) => {
      const { category, subcategory, source } = e.detail || {};
      if (source === 'collectibles') return;
      setSelectedCategoryRaw(category || null);
      setSelectedSubcategoryRaw(subcategory || null);
    };
    window.addEventListener('syncCategoryFilter', handleCategorySync as EventListener);
    return () => window.removeEventListener('syncCategoryFilter', handleCategorySync as EventListener);
  }, []);
  const lastTapRef = useRef<number>(0);
  const minSwipeDistance = 50;

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
    const extra = Object.keys(categoryMap).filter(cat => !CATEGORY_ORDER.includes(cat));
    return [...CATEGORY_ORDER, ...extra];
  }, [categoryMap]);

  const filteredDesigners = useMemo(() => {
    let designers = collectibleDesigners;
    
    const normalizeSearch = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    if (searchQuery.trim()) {
      const query = normalizeSearch(searchQuery);
      designers = designers.filter(designer => 
        normalizeSearch(designer.name).includes(query) ||
        normalizeSearch(designer.specialty).includes(query) ||
        normalizeSearch(designer.biography).includes(query)
      );
    }
    
    if (selectedCategory) {
      designers = designers.filter(designer =>
        designer.curatorPicks?.some((pick: any) => {
          if (selectedSubcategory) return pick.subcategory === selectedSubcategory;
          return pick.category === selectedCategory;
        })
      );
    }
    
    return designers;
  }, [searchQuery, selectedCategory, selectedSubcategory]);

  const allDesignerIds = filteredDesigners.map(d => d.id);
  const isAllExpanded = openDesigners.length === allDesignerIds.length && allDesignerIds.length > 0;

  const toggleAllDesigners = () => {
    if (isAllExpanded) {
      setOpenDesigners([]);
    } else {
      setOpenDesigners(allDesignerIds);
    }
  };

  const openCuratorPicks = (designer: typeof collectibleDesigners[0]) => {
    if (designer.curatorPicks && designer.curatorPicks.length > 0) {
      // Filter picks based on active category/subcategory filter
      let filteredPicks = designer.curatorPicks;
      if (selectedSubcategory) {
        filteredPicks = designer.curatorPicks.filter((pick: any) => pick.subcategory === selectedSubcategory);
      } else if (selectedCategory) {
        filteredPicks = designer.curatorPicks.filter((pick: any) => pick.category === selectedCategory);
      }
      if (filteredPicks.length > 0) {
        setCuratorPicksDesigner({ ...designer, curatorPicks: filteredPicks });
      } else {
        setCuratorPicksDesigner(designer);
      }
      setCuratorPickIndex(0);
      setIsZoomed(false);
    }
  };

  const closeCuratorPicks = () => {
    setCuratorPicksDesigner(null);
    setCuratorPickIndex(0);
    setIsZoomed(false);
  };

  const goToPreviousPick = () => {
    if (curatorPicksDesigner?.curatorPicks) {
      setCuratorPickIndex(prev => 
        prev === 0 ? curatorPicksDesigner.curatorPicks!.length - 1 : prev - 1
      );
      setIsZoomed(false);
    }
  };

  const goToNextPick = () => {
    if (curatorPicksDesigner?.curatorPicks) {
      setCuratorPickIndex(prev => 
        prev === curatorPicksDesigner.curatorPicks!.length - 1 ? 0 : prev + 1
      );
      setIsZoomed(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPreviousPick();
    if (e.key === "ArrowRight") goToNextPick();
    if (e.key === "Escape") closeCuratorPicks();
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
      goToNextPick();
    } else if (isRightSwipe) {
      goToPreviousPick();
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    if (timeSinceLastTap < 300) {
      setIsZoomed(!isZoomed);
    }
    lastTapRef.current = now;
  };

  return (
    <>
      <section id="collectibles" ref={ref} className="py-10 px-4 md:py-24 md:px-12 lg:px-20 bg-background scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="mb-12 md:mb-16 text-left"
          >
            <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-2">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground">
                Collectible Design
              </h2>
            </div>
            <p className="font-body text-sm md:text-base text-muted-foreground max-w-3xl leading-relaxed mb-4 text-justify">
              Collectible design refers to unique or limited-edition, often handmade, functional art pieces—such as furniture, lighting, and ceramics—that bridge the gap between art and utility. These items, characterized by high-level craftsmanship, storytelling, and investment potential, are often sought after for their artistic value and ability to enhance.
            </p>
            {/* A-Z alphabet jump bar + Search + Filter */}
            {(() => {
              const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
              const designerLetters = [...new Set(filteredDesigners.map(d => normalize(d.name)[0]))].sort();
              return (
                <div className="flex flex-col gap-3 mb-3">
                  <div
                    className="flex items-center gap-1 px-3 py-1.5 bg-background/90 backdrop-blur-md border border-border/40 rounded-full shadow-sm overflow-x-auto w-full"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" } as any}
                  >
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
                      const isActive = designerLetters.includes(letter);
                      return (
                        <button
                          key={letter}
                          onClick={() => {
                            if (isActive) {
                              const el = document.getElementById(`collectible-alpha-${letter}`);
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                          className={`flex-none font-serif text-sm md:text-sm leading-none px-2 py-1.5 md:px-1.5 md:py-1 rounded-full transition-all duration-200 ${
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
                  <div className="flex items-center gap-6 flex-shrink-0">
                    {searchOpen ? (
                      <div className="relative flex-1 sm:flex-none sm:w-48 animate-in slide-in-from-right-2 duration-200">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search by designer..."
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
          </motion.div>

          <div className="flex items-center justify-between mb-4">
            <button
              onClick={toggleAllDesigners}
              className="text-xs text-muted-foreground hover:text-primary font-body transition-colors duration-300 flex items-center gap-1"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isAllExpanded ? 'rotate-180' : ''}`} />
              <span>{isAllExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
            {(searchQuery || selectedCategory) ? (
              <p className="text-left text-[10px] text-muted-foreground/50 font-body tracking-wider">
                {filteredDesigners.length} designer{filteredDesigners.length !== 1 ? 's' : ''} found
                {selectedSubcategory && <span> · {selectedSubcategory}</span>}
                {selectedCategory && !selectedSubcategory && <span> · {selectedCategory}</span>}
              </p>
            ) : <div />}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {filteredDesigners.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-body">
                <p>No designers found matching "{searchQuery}"</p>
              </div>
            ) : (
              <Accordion 
                type="multiple" 
                value={openDesigners} 
                onValueChange={(values) => {
                  if ('vibrate' in navigator) {
                    navigator.vibrate(10);
                  }
                  if (window.innerWidth < 768 && values.length > openDesigners.length) {
                    const newDesigner = values.find(v => !openDesigners.includes(v));
                    if (newDesigner) {
                      setTimeout(() => {
                        const element = document.querySelector(`[data-collectible="${newDesigner}"]`);
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
                {filteredDesigners.map((designer, index) => {
                  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                  const currentLetter = normalize(designer.name)[0];
                  const prevLetter = index > 0 ? normalize(filteredDesigners[index - 1].name)[0] : null;
                  const isFirstOfLetter = currentLetter !== prevLetter;
                  return (
                <Fragment key={designer.id}>
                  {isFirstOfLetter && <div id={`collectible-alpha-${currentLetter}`} className="scroll-mt-24" />}
                <AccordionItem
                  value={designer.id}
                  id={`collectible-${designer.id}`}
                  data-collectible={designer.id}
                  className="border border-border/40 rounded-lg px-4 md:px-6 bg-card/30 hover:bg-card/50 transition-colors duration-300 scroll-mt-16"
                >
                  <AccordionTrigger className="hover:no-underline py-4 md:py-6 group active:scale-[0.99] touch-manipulation [&>svg]:hidden md:[&>svg]:block">
                    <div className="flex items-center gap-4 md:gap-6 text-left w-full">
                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 block md:hidden group-data-[state=open]:rotate-180" />
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
                              loading="lazy"
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
                        <DialogContent className="max-w-3xl [&>button]:left-3 [&>button]:right-auto md:[&>button]:left-auto md:[&>button]:right-3" aria-describedby={undefined}>
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
                              <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="none" stroke="url(#instagram-gradient-collectibles)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <defs>
                                  <linearGradient id="instagram-gradient-collectibles" x1="0%" y1="100%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#f09433" />
                                    <stop offset="25%" stopColor="#e6683c" />
                                    <stop offset="50%" stopColor="#dc2743" />
                                    <stop offset="75%" stopColor="#cc2366" />
                                    <stop offset="100%" stopColor="#bc1888" />
                                  </linearGradient>
                                </defs>
                                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                              </svg>
                            </a>
                          )}
                          <h3 className="font-serif text-xl md:text-2xl text-foreground group-hover:text-primary transition-colors duration-300">
                            {designer.name}
                          </h3>
                        </div>
                        <p className="text-sm md:text-base text-primary font-body">{designer.specialty}</p>
                        {designer.notableWorksLink && (
                          <>
                            <span className="text-primary/40 text-xs tracking-[0.3em] mt-1">• • •</span>
                            <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                              <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">Gallery Featured:</span>
                              <span
                                role="link"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const gallerySection = document.getElementById('gallery');
                                  if (gallerySection) {
                                    gallerySection.scrollIntoView({ behavior: 'smooth' });
                                    setTimeout(() => {
                                      window.dispatchEvent(new CustomEvent('openGalleryLightbox', { 
                                        detail: { index: designer.notableWorksLink!.galleryIndex, sourceId: `collectible-${designer.id}` } 
                                      }));
                                    }, 500);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const gallerySection = document.getElementById('gallery');
                                    if (gallerySection) {
                                      gallerySection.scrollIntoView({ behavior: 'smooth' });
                                      setTimeout(() => {
                                        window.dispatchEvent(new CustomEvent('openGalleryLightbox', { 
                                          detail: { index: designer.notableWorksLink!.galleryIndex, sourceId: `collectible-${designer.id}` } 
                                        }));
                                      }, 500);
                                    }
                                  }
                                }}
                                className="text-xs md:text-sm text-primary/80 font-body hover:text-primary transition-colors duration-300 inline-flex items-center gap-1 group/link touch-manipulation cursor-pointer"
                              >
                                <span className="underline underline-offset-2 decoration-primary/40 group-hover/link:decoration-primary">
                                  {designer.notableWorksLink.text}
                                </span>
                                <ExternalLink className="h-3 w-3 opacity-50 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6">
                    <div className="space-y-4 pt-2 md:pl-[calc(8rem+1.5rem)] pl-0">
                      <p className="text-sm md:text-base text-muted-foreground font-body leading-relaxed">
                        {designer.biography}
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-body italic text-primary/80">
                          "{designer.philosophy}"
                        </p>
                      </div>
                      {designer.curatorPicks && designer.curatorPicks.length > 0 && (
                        <div className="pt-2">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openCuratorPicks(designer)}
                              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body bg-gradient-to-r from-accent/90 to-primary/80 hover:from-accent hover:to-primary text-white rounded-md transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 cursor-pointer border border-accent/30"
                            >
                              <Star size={16} className="fill-current" />
                              <span className="font-medium">
                                Curators' Picks
                              </span>
                            </button>
                            {/* WhatsApp share button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    shareProfileOnWhatsApp("collectible", designer.id ?? designer.name, designer.name, designer.specialty);
                                    trackCTA.whatsapp(`Collectibles_Share_${designer.name}`);
                                  }}
                                  className="p-1.5 rounded-full bg-foreground/5 hover:bg-foreground/15 transition-all duration-300 hover:scale-110 cursor-pointer"
                                  aria-label={`Share ${designer.name} on WhatsApp`}
                                >
                                  <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                  </svg>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p>Share on WhatsApp</p></TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
              </AccordionItem>
                </Fragment>
                  );
                })}
            </Accordion>
            )}
          </motion.div>
        </div>
      </section>

      {/* Curators' Picks Dialog - Full screen dark modal like FeaturedDesigners */}
      <Dialog open={!!curatorPicksDesigner} onOpenChange={(open) => !open && closeCuratorPicks()}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none [&>button.absolute]:hidden" 
          onKeyDown={handleKeyDown}
          aria-describedby={undefined}
        >
          <VisuallyHidden>
            <DialogTitle>
              {curatorPicksDesigner?.name} - Curators' Picks
            </DialogTitle>
          </VisuallyHidden>
          
          {curatorPicksDesigner?.curatorPicks && curatorPicksDesigner.curatorPicks.length > 0 && (
            <div 
              className="relative w-full h-full flex items-center justify-center"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Close button */}
              <button 
                onClick={closeCuratorPicks} 
                className="absolute top-4 left-4 md:left-auto md:right-4 z-50 p-2 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                aria-label="Close lightbox"
              >
                <X className="h-6 w-6 text-white" />
              </button>

              {/* Previous button */}
              {curatorPicksDesigner.curatorPicks.length > 1 && (
                <button 
                  onClick={goToPreviousPick}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8 text-white" />
                </button>
              )}

              {/* Image container */}
              <div className={`flex flex-col items-center justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 ${isZoomed ? 'max-h-[95vh] pb-4' : 'max-h-[85vh] pb-4'}`}>
                <div 
                  className={`relative overflow-auto transition-all duration-300 ${isZoomed ? 'max-h-[85vh]' : ''}`}
                  onClick={handleDoubleTap}
                >
                  {!isZoomed && (curatorPicksDesigner.curatorPicks[curatorPickIndex]?.category || curatorPicksDesigner.curatorPicks[curatorPickIndex]?.edition) && (
                    <div className="flex items-center gap-2 mb-2">
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.category && (
                        <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex].category}
                        </span>
                      )}
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.edition && (
                        <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex].edition}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="relative inline-block">
                    <img 
                      key={curatorPickIndex}
                      src={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.image} 
                      alt={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title} 
                      className={`object-contain transition-all duration-300 select-none ${isZoomed ? 'max-w-none w-[150vw] md:w-auto md:max-w-full md:max-h-[80vh]' : 'max-w-full max-h-[55vh]'}`}
                      draggable={false}
                    />
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsZoomed(!isZoomed);
                      }}
                      className={`absolute bottom-2 right-2 z-10 p-2 bg-black/40 backdrop-blur-sm rounded-full transition-all duration-300 hover:bg-black/60 cursor-pointer ${isZoomed ? 'opacity-70' : 'opacity-70 hover:opacity-100'}`}
                      aria-label={isZoomed ? "Zoom out" : "Zoom in"}
                    >
                      {isZoomed ? (
                        <ZoomOut className="h-5 w-5 text-white" />
                      ) : (
                        <ZoomIn className="h-5 w-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>
                <div className={`mt-2 text-center transition-all duration-300 ${isZoomed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                  <h3 className="text-sm md:text-base font-serif text-white mb-1">
                    {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title}
                  </h3>
                  {(curatorPicksDesigner.curatorPicks[curatorPickIndex]?.materials || curatorPicksDesigner.curatorPicks[curatorPickIndex]?.dimensions) && (
                    <div className="mt-2 max-w-xl space-y-1">
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.materials && (
                        <p className="text-xs md:text-sm text-white/60 font-body">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex].materials}
                        </p>
                      )}
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.dimensions && (
                        <p className="text-xs md:text-sm text-white/40 font-body italic">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex].dimensions}
                        </p>
                      )}
                    </div>
                  )}
                  {/* Thumbnail strip — inline, above contact line */}
                  {curatorPicksDesigner.curatorPicks.length > 1 && (
                    <div className="mt-6 flex items-center gap-2 overflow-x-auto scrollbar-hide justify-center flex-wrap md:flex-nowrap">
                      {curatorPicksDesigner.curatorPicks.map((pick, idx) => (
                        <button
                          key={idx}
                          onClick={() => { setCuratorPickIndex(idx); setIsZoomed(false); }}
                          aria-label={`View ${pick.title}`}
                          className={`flex-none relative w-10 h-10 md:w-12 md:h-12 rounded overflow-hidden transition-all duration-300 ${
                            curatorPickIndex === idx
                              ? 'ring-2 ring-white scale-110 opacity-100'
                              : 'ring-1 ring-white/20 opacity-50 hover:opacity-90 hover:ring-white/50'
                          }`}
                        >
                          <img src={pick.image} alt={pick.title} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="mt-6 text-xs text-white font-body italic">
                    For further details, please contact{" "}
                    <a href="mailto:concierge@myaffluency.com" className="underline hover:text-white/80 transition-colors">
                      concierge@myaffluency.com
                    </a>
                  </p>
                </div>
              </div>

              {/* Next button */}
              {curatorPicksDesigner.curatorPicks.length > 1 && (
                <button 
                  onClick={goToNextPick}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                  aria-label="Next image"
                >
                  <ChevronRight className="h-8 w-8 text-white" />
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Collectibles;
