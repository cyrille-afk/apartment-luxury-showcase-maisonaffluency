import { motion } from "framer-motion";
import CuratorPicksLegend from "./CuratorPicksLegend";
import { GALLERY } from "@/constants/galleryIndex";
import { GALLERY_THUMBNAILS } from "@/constants/galleryThumbnails";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect, useCallback, Fragment } from "react";
import { useLightboxSwipe } from "@/hooks/useLightboxSwipe";
import { Instagram, ChevronDown, ExternalLink, Gem, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Search, X, SlidersHorizontal, MessageSquareQuote, FileDown, CornerDownRight, Scale } from "lucide-react";
import QuoteRequestDialog from "./QuoteRequestDialog";
import PinchZoomImage from "./PinchZoomImage";
import { trackCTA } from "@/lib/analytics";
import { shareProfileOnWhatsApp } from "@/lib/whatsapp-share";
import { warmCuratorPickSet } from "@/lib/curatorPickPreload";
import { scrollToSection } from "@/lib/scrollToSection";
import WhatsAppShareButton from "./WhatsAppShareButton";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { useCompare } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import { formatDesignerName } from "@/lib/nameFormat";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import CategorySidebar from "@/components/CategorySidebar";


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
const thierryLemaireNiko300 = cloudinaryUrl("Screen_Shot_2026-03-10_at_3.06.48_PM_kohqxi", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleImg = cloudinaryUrl("pierre-bonnefille", { width: 800, quality: "auto", crop: "fill" });
const pierreBonnefilleBronzePainting = cloudinaryUrl("art-master-bronze_hf6bad", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleBronzePainting208 = cloudinaryUrl("Screen_Shot_2026-02-22_at_6.27.12_PM_haymp0", { width: 1200, quality: "auto:good", crop: "fill" });
const herveVanDerStraetenImg = cloudinaryUrl("Screen_Shot_2025-12-12_at_12.15.28_AM_nraulk", { width: 800, quality: "auto", crop: "fill" });
import herveMicmac from "@/assets/curators-picks/herve-vds-micmac.jpg";
const herveArthurLamp = cloudinaryUrl("Screen_Shot_2026-02-23_at_10.47.13_AM_cukmu3", { width: 1200, quality: "auto:good", crop: "fill" });
const herveBubblingLamp = cloudinaryUrl("Screen_Shot_2026-02-23_at_10.50.06_AM_caibdj", { width: 1200, quality: "auto:good", crop: "fill" });
const herveDaphnePendant = cloudinaryUrl("Screen_Shot_2026-02-23_at_10.55.49_AM_loicir", { width: 1200, quality: "auto:good", crop: "fill" });
const herveTourbillonPendant = cloudinaryUrl("Screen_Shot_2026-02-23_at_11.01.34_AM_j7dggg", { width: 1200, quality: "auto:good", crop: "fill" });
const herveFacettedPendant = cloudinaryUrl("Screen_Shot_2026-02-23_at_11.07.41_AM_lbv2zc", { width: 1200, quality: "auto:good", crop: "fill" });
const herveTumulteMirror = cloudinaryUrl("Screen_Shot_2026-02-23_at_11.10.56_AM_un5mxc", { width: 1200, quality: "auto:good", crop: "fill" });
const herveEmpileeConsole = cloudinaryUrl("Screen_Shot_2026-02-23_at_11.16.19_AM_p0jbm0", { width: 1200, quality: "auto:good", crop: "fill" });
const emmanuelBabledImg = cloudinaryUrl("Screen_Shot_2025-12-14_at_7.32.25_AM_wujvd4", { width: 800, quality: "auto", crop: "fill" });
import emmanuelBabledPick1 from "@/assets/curators-picks/emmanuel-babled-1.jpg";
const emmanuelBabledPick2 = cloudinaryUrl("Screen_Shot_2026-03-05_at_8.08.08_PM_e3yqrd", { width: 1200, quality: "auto:good", crop: "fill" });
import emmanuelBabledPick3 from "@/assets/curators-picks/emmanuel-babled-3.jpg";
import emmanuelBabledPick4 from "@/assets/curators-picks/emmanuel-babled-4.jpg";
import emmanuelBabledPick5 from "@/assets/curators-picks/emmanuel-babled-5.jpg";
import emmanuelBabledPick6 from "@/assets/curators-picks/emmanuel-babled-6.jpg";
import emmanuelBabledPick7 from "@/assets/curators-picks/emmanuel-babled-7.jpg";
const emmanuelBabledPick8 = cloudinaryUrl("babled-osmosi-verde-cipria-_rukmyr", { width: 1200, quality: "auto:good", crop: "fill" });
const ericSchmittImg = cloudinaryUrl("Screen_Shot_2026-02-26_at_4.16.30_PM_ijgqlu", { width: 800, quality: "auto", crop: "fill" });
const ericSchmittDrageeConsole = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.45.40_PM_biri0t", { width: 1200, quality: "auto:good", crop: "fill" });
const ericSchmittSaturneTable = cloudinaryUrl("Screen_Shot_2026-03-05_at_8.31.49_PM_clsiml", { width: 1200, quality: "auto:good", crop: "fill" });
const ericSchmittFrameTable = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.51.08_PM_kwaasy", { width: 1200, quality: "auto:good", crop: "fill" });
const ericSchmittAnneauLamp = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.56.09_PM_ocju7w", { width: 1200, quality: "auto:good", crop: "fill" });
const ericSchmittDentelleConsole = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.59.30_PM_jxhhdg", { width: 1200, quality: "auto:good", crop: "fill" });
const ericSchmittFloatingTable = cloudinaryUrl("Screen_Shot_2026-02-22_at_4.00.57_PM_tkv0sz", { width: 1200, quality: "auto:good", crop: "fill" });
const ericSchmittRocwoodTable = cloudinaryUrl("Screen_Shot_2026-02-22_at_4.02.38_PM_ttd1me", { width: 1200, quality: "auto:good", crop: "fill" });
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
    hoverImage?: string;
    title: string;
    category: string;
    subcategory?: string;
    materials: string;
    dimensions: string;
    edition?: string;
    tags?: string[];
    description?: string;
    pdfUrl?: string;
    pdfFilename?: string;
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
    notableWorksLink: { text: "Bud Table Lamp", galleryIndex: GALLERY.UNIQUE_BY_DESIGN_VIGNETTE },
    philosophy: "We create lighting that elevates everyday moments into experiences of beauty and contemplation.",
    curatorPicks: [
      { image: demichelisPick1, hoverImage: "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1773313356/IMG_2556_1_uuj7c3.jpg", title: "Babel Table Lamp", category: "Lighting", subcategory: "Table Lamps", materials: "Bronze • Brass • Ash wood • White fabric shade", dimensions: "Ø45 × H60.9 cm", edition: "Numbered edition of 20" },
      { image: demichelisPick4, title: "Echo Floor Lamp", category: "Lighting", subcategory: "Floor Lamps", materials: "Patinated and varnished brass", dimensions: "Ø38 × H166 cm", edition: "Numbered edition of 20" },
      { image: demichelisPick2, hoverImage: "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772085686/bedroom-alt_yk0j0d.jpg", title: "Bud Table Lamp", category: "Lighting", subcategory: "Table Lamps", materials: "Bronze • White oak • Hand-made fabric shade", dimensions: "Ø40 × H71 cm", edition: "Numbered edition of 20" },
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
    notableWorksLink: { text: "Sculptured Book Cover from the Osmosi Series", galleryIndex: GALLERY.PANORAMIC_CITYSCAPE_VIEWS },
    philosophy: "I explore the boundaries between art and design, creating objects that challenge perception and celebrate material beauty.",
    curatorPicks: [
      { image: emmanuelBabledPick1, title: "Osmosi — Console", category: "Tables", subcategory: "Console", materials: "Carrara marble, Murano blown glass", dimensions: "H80 × L160 × D35 cm", edition: "" },
      { image: emmanuelBabledPick2, title: "Coral Coffee Table", category: "Tables", subcategory: "Coffee Table", materials: "Bianco Carrara marble, plexiglass", dimensions: "L150 × W100 × H28 cm", edition: "" },
      { image: emmanuelBabledPick3, title: "Pyros Marini — Vase", category: "Decorative Object", subcategory: "Vase", materials: "Murano blown glass (Venini)", dimensions: "H45 × Ø30 cm", edition: "" },
      { image: emmanuelBabledPick4, title: "Quark Bronze Coffee Table", category: "Tables", subcategory: "Coffee Table", materials: "Bronze", dimensions: "H30 × L122.5 × W83 cm", edition: "" },
      { image: emmanuelBabledPick5, title: "Siliceaarenaria — Vessels", category: "Decorative Object", subcategory: "Vessel", materials: "Murano blown glass (Venini)", dimensions: "Ø25 × H22 cm (each)", edition: "" },
      { image: emmanuelBabledPick6, title: "Etna Cabinet — Stripes", category: "Storage", subcategory: "Cabinet", materials: "Murano glass doors • Lava stone legs", dimensions: "H85 × L120 × D45 cm", edition: "" },
      { image: emmanuelBabledPick7, title: "Osmosi — Side Table", category: "Tables", subcategory: "Side Table", materials: "Carrara marble • Murano blown glass", dimensions: "H55 × Ø60 cm", edition: "" },
      { image: emmanuelBabledPick8, title: "OSMOSIS Series — Sculptural Book Cover", category: "Decorative Object", subcategory: "Sculptural Object", materials: "Murano blown glass", dimensions: "", edition: "" },
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
    notableWorksLink: { text: "Chairie Dining Chair", galleryIndex: GALLERY.PANORAMIC_CITYSCAPE_VIEWS },
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
    notableWorksLink: { text: "Mic Mac Chandelier", galleryIndex: GALLERY.A_MASTERFUL_SUITE },
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
      { image: "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,c_fill,f_auto/v1773196208/Screen_Shot_2026-03-11_at_10.29.03_AM_givmmu.png", title: "MicMac Chandelier", category: "Lighting", subcategory: "Chandeliers", materials: "Cage of bronze with a golden brown patina", dimensions: "70 × 70 × 55 cm / 40 kg", edition: "Edition of 40", description: "At once organic with a hint of botanical aspect, this chandelier is fashioned into a cage of bronze with a golden brown patina to diffuse a soft, warm light, creating an infinite shadow show.\n1 LED bulb 17.5 W", pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/specs%2Fmicmac-chandelier-472.pdf", pdfFilename: "MicMac-Chandelier-472-Spec.pdf" },
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
    notableWorksLink: { text: "Silver Glass Hammer Mirror", galleryIndex: GALLERY.DESIGN_TABLEAU },
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
    notableWorksLink: { text: "Sakura TRP 22001", galleryIndex: GALLERY.AN_INVITING_LOUNGE_AREA },
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
    notableWorksLink: { text: "Cotissi Vessel", galleryIndex: GALLERY.THE_DETAILS_MAKE_THE_DESIGN },
    philosophy: "Glass is a living material that captures light and transforms space into poetry.",
    curatorPicks: [
      { image: marcantonioCotissiVessel, title: "Cotissi Vessel", category: "Decorative Object", subcategory: "Vessels", materials: "Hand-blown Murano glass", dimensions: "H35 × Ø20 cm", edition: "Unique Piece" },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/marcantoniobrandolinistudio/" },
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
    notableWorksLink: { text: "Texture Glass with Gold Leaf rim Géode", galleryIndex: GALLERY.CRAFTSMANSHIP_AT_EVERY_CORNER },
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
    notableWorksLink: { text: "Custom Glass Chandelier", galleryIndex: GALLERY.A_SOPHISTICATED_BOUDOIR },
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
    notableWorksLink: { text: "Bronze Painting 204", galleryIndex: GALLERY.A_DESIGN_TREASURE_TROVE },
    philosophy: "The material, colors and light are inseparable in my work. I create my own textures from the earth itself.",
    curatorPicks: [
      { image: pierreBonnefilleBronzePainting208, title: "Bronze Painting 208, 2024", category: "Wall Art", tags: ["Wall Art", "Art"], materials: "Mixed media on metallic mesh", dimensions: "H 225 x W 515 cm" },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/pierrebonnefille/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "rowin-atelier",
    name: "RoWin' Atelier — Rochette Frederic & Winkler Hervé",
    specialty: "Artisan Ceramics & Sculptural Objects",
    image: rowinAtelierImg,
    biography:
      "RoWin' Atelier is a French ceramics studio renowned for creating exceptional handcrafted pieces that blend traditional techniques with contemporary design. Each creation showcases meticulous attention to detail and a deep understanding of material properties.",
    notableWorks: "None II Table Lamp",
    notableWorksLink: { text: "None II Table Lamp", galleryIndex: GALLERY.REFINED_DETAILS },
    philosophy: "Every piece of clay holds the potential for extraordinary beauty when shaped by skilled hands.",
    curatorPicks: [
      { image: cloudinaryUrl("Screen_Shot_2026-03-12_at_9.59.04_PM_jysfm3", { width: 800, quality: "auto", crop: "fill" }), hoverImage: cloudinaryUrl("IMG_2744_pgfojp", { width: 800, quality: "auto", crop: "fill" }), title: "None II Table Lamp", category: "Lighting", subcategory: "Table Lamps", materials: "Cippolino Verde Marble, Silver-Plated brass", dimensions: "39 cm × 22.5 cm × H 58 cm", edition: "Unique Piece" },
      
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/rowin_atelier/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "thierry-lemaire-collectible",
    name: "Thierry Lemaire",
    specialty: "Sculptural Furniture & Limited Editions",
    image: thierryLemaireImg,
    biography:
      "A French Star Architect, Interior Designer and Designer, Thierry Lemaire is known for his sculptural approach to furniture design. His pieces blend fine craftsmanship with contemporary aesthetics, creating limited edition works that are as much art as they are functional objects. His Orsay Coffee Table exemplifies his signature style of elegant forms with unexpected details.",
    notableWorks: "Orsay Coffee Table. Limited and numbered edition (12 copies).",
    notableWorksLink: { text: "Orsay Coffee Table", galleryIndex: GALLERY.A_SOPHISTICATED_LIVING_ROOM },
    philosophy: "Each piece is a unique statement that transforms everyday furniture into collectible design objects.",
    curatorPicks: [
      { image: thierryLemaireOrsay, title: "Orsay MDS Coffee Table", category: "Tables", subcategory: "Coffee Tables", materials: "Alabastrino Travertine & Ocean Onyx", dimensions: "L 170 × P 100 × H 40 cm", edition: "Edition of 12 signed" },
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
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const [selectedImage, setSelectedImage] = useState<{ name: string; image: string } | null>(null);
  const [openDesigners, setOpenDesigners] = useState<string[]>([]);
  const [curatorPicksDesigner, setCuratorPicksDesigner] = useState<typeof collectibleDesigners[0] | null>(null);
  const [curatorPickIndex, setCuratorPickIndex] = useState(0);
  const [picksHovered, setPicksHovered] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const imageZoomedRef = useRef(false);
  const picksSwipeRef = useRef<HTMLDivElement>(null);

  // Deep-link handler: expand designer from URL hash
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.section !== "collectible") return;
      const designer = collectibleDesigners.find(d => d.id === detail.id || d.name === detail.id);
      if (designer) {
        const designerId = designer.id ?? designer.name;
        setOpenDesigners(prev => prev.includes(designerId) ? prev : [...prev, designerId]);
        setTimeout(() => {
          const el = document.getElementById(`collectible-${designerId}`);
          if (el) {
            const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 64;
            const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 8;
            window.scrollTo({ top, behavior: "smooth" });
          }
        }, 400);
      }
    };
    window.addEventListener("deeplink-open-profile", handler);
    return () => window.removeEventListener("deeplink-open-profile", handler);
  }, []);

  useEffect(() => {
    const handleCuratorsPick = async (e: Event) => {
      const hash = (e as CustomEvent).detail as string;
      const match = hash.match(/#\/?curators\/([^/]+)(?:\/(\d+))?$/);
      if (!match) return;
      const designerId = match[1];
      const index = match[2] ? parseInt(match[2], 10) : 0;
      const designer = collectibleDesigners.find(d => d.id === designerId);
      if (designer && designer.curatorPicks?.length) {
        await warmCuratorPickSet(designer.curatorPicks, index);
        setCuratorPicksDesigner(designer);
        setCuratorPickIndex(index);
        setIsZoomed(false);
      }
    };
    window.addEventListener('open-curators-pick', handleCuratorsPick);
    return () => window.removeEventListener('open-curators-pick', handleCuratorsPick);
  }, []);

  // Preload all curator pick images when lightbox opens
  // Staggered preload all curator pick images when lightbox opens
  useEffect(() => {
    if (!curatorPicksDesigner?.curatorPicks?.length) return;
    warmCuratorPickSet(curatorPicksDesigner.curatorPicks, curatorPickIndex);
  }, [curatorPicksDesigner, curatorPickIndex]);

  // History state: push when lightbox opens so browser back button returns to lightbox.
  // Track whether close was initiated by popstate to avoid double history.back().
  const closedViaPopstateRef = useRef(false);

  useEffect(() => {
    if (!curatorPicksDesigner) return;

    closedViaPopstateRef.current = false;
    window.history.pushState({ curatorPicksLightbox: true }, '');

    const handlePopState = () => {
      closedViaPopstateRef.current = true;
      const shouldRestore = !!sessionStorage.getItem('__gallery_hotspot_restore');
      setCuratorPicksDesigner(null);
      setCuratorPickIndex(0);
      setIsZoomed(false);
      if (shouldRestore) {
        setTimeout(() => window.dispatchEvent(new Event('gallery-hotspot-return')), 200);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [curatorPicksDesigner]);

  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedCategory, setSelectedCategoryRaw] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategoryRaw] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const broadcastFilter = useCallback((cat: string | null, sub: string | null) => {
    window.dispatchEvent(new CustomEvent('syncCategoryFilter', { detail: { category: cat, subcategory: sub, source: 'collectibles' } }));
  }, []);

  const setSelectedCategory = useCallback((cat: string | null, skipBroadcast?: boolean) => {
    setSelectedCategoryRaw(cat);
    setSelectedSubcategoryRaw(null);
    if (!skipBroadcast) {
      broadcastFilter(cat, null);
    }
  }, [broadcastFilter]);

  const setSelectedSubcategory = useCallback((sub: string | null) => {
    setSelectedSubcategoryRaw(sub);
    broadcastFilter(selectedCategory, sub);
  }, [selectedCategory, broadcastFilter]);

  useEffect(() => {
    const handleCategorySync = (e: CustomEvent) => {
      const { category, subcategory, source } = e.detail || {};
      // Only sync from designers (Navigation mega-menu); ignore brands to avoid cross-section jumps
      if (source !== 'designers') return;
      setSelectedCategoryRaw(category || null);
      setSelectedSubcategoryRaw(subcategory || null);
    };
    window.addEventListener('syncCategoryFilter', handleCategorySync as EventListener);
    return () => window.removeEventListener('syncCategoryFilter', handleCategorySync as EventListener);
  }, []);
  // Collapse all when a filter is applied
  useEffect(() => {
    if (selectedCategory || selectedSubcategory) {
      setOpenDesigners([]);
    }
  }, [selectedCategory, selectedSubcategory]);

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

  const normalizeFilterLabel = (value?: string) => (value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(\w+?)s\b/g, "$1");

  const labelsMatch = (a?: string, b?: string) => {
    const na = normalizeFilterLabel(a);
    const nb = normalizeFilterLabel(b);
    if (!na || !nb) return false;
    return na === nb || na.includes(nb) || nb.includes(na);
  };

  /** Stricter match for top-level categories — word-boundary only */
  const categoryMatchLocal = (pickValue?: string, cat?: string) => {
    const na = normalizeFilterLabel(pickValue);
    const nb = normalizeFilterLabel(cat);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const regex = new RegExp(`(^|\\s)${nb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    return regex.test(na);
  };

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

  // Helper: check if a curator pick matches the active subcategory/category filter
  const pickMatchesFilter = useMemo(() => {
    if (!selectedSubcategory && !selectedCategory) return () => true;
    const SUB_TAGS: Record<string, string[]> = {
      "Sofas": ["Sofa"], "Armchairs": ["Armchair", "Armchairs"], "Chairs": ["Chair"],
      "Daybeds & Benches": ["Daybed", "Bench"], "Ottomans & Stools": ["Ottoman", "Stool"],
      "Bar Stools": ["Bar Stool"], "Consoles": ["Console"], "Coffee Tables": ["Coffee Table"],
      "Desks": ["Desk"], "Dining Tables": ["Dining Table"], "Side Tables": ["Side Table"],
      "Wall Lights": ["Wall Light", "Wall Lamp", "Sconce"], "Ceiling Lights": ["Ceiling Light", "Chandelier", "Pendant", "Suspension"],
      "Floor Lights": ["Floor Light", "Floor Lamp"], "Table Lights": ["Table Light", "Table Lamp", "Lantern"],
      "Bookcases": ["Bookcase"], "Cabinets": ["Cabinet"],
      "Hand-Knotted Rugs": ["Hand-Knotted Rug", "Textile"], "Hand-Tufted Rugs": ["Hand-Tufted Rug"],
      "Hand-Woven Rugs": ["Hand-Woven Rug"], "Vases & Vessels": ["Vase", "Vessel"],
      "Mirrors": ["Mirror"], "Books": ["Book"], "Candle Holders": ["Candle Holder"],
      "Decorative Objects": ["Decorative Object", "Object", "Sculpture"],
    };
    return (pick: any) => {
      if (selectedSubcategory) {
        const tags = SUB_TAGS[selectedSubcategory] || [selectedSubcategory];
        return tags.some(tag =>
          categoryMatchLocal(pick.subcategory, tag) ||
          categoryMatchLocal(pick.subcategory, selectedSubcategory) ||
          categoryMatchLocal(pick.category, tag) ||
          (pick.tags && pick.tags.some((t: string) => categoryMatchLocal(t, tag)))
        );
      }
      return categoryMatchLocal(pick.category, selectedCategory || undefined) || (pick.tags && pick.tags.some((t: string) => categoryMatchLocal(t, selectedCategory || undefined)));
    };
  }, [selectedSubcategory, selectedCategory]);

  const openCuratorPicks = (designer: typeof collectibleDesigners[0]) => {
    if (designer.curatorPicks && designer.curatorPicks.length > 0) {
      // Show all picks but start at the first matching one
      setCuratorPicksDesigner(designer);
      const firstMatch = designer.curatorPicks.findIndex((pick: any) => pickMatchesFilter(pick));
      setCuratorPickIndex(firstMatch >= 0 ? firstMatch : 0);
      setIsZoomed(false);
    }
  };

  const closeCuratorPicks = () => {
    const shouldRestore = !!sessionStorage.getItem('__gallery_hotspot_restore');
    setCuratorPicksDesigner(null);
    setCuratorPickIndex(0);
    setIsZoomed(false);
    if (!closedViaPopstateRef.current) {
      window.history.back();
    }
    if (shouldRestore) {
      setTimeout(() => window.dispatchEvent(new Event('gallery-hotspot-return')), 200);
    }
  };

  const goToPreviousPick = () => {
    if (curatorPicksDesigner?.curatorPicks) {
      setCuratorPickIndex(prev => 
        prev === 0 ? curatorPicksDesigner.curatorPicks!.length - 1 : prev - 1
      );
      setIsZoomed(false);
      setPicksHovered(false);
    }
  };

  const goToNextPick = () => {
    if (curatorPicksDesigner?.curatorPicks) {
      setCuratorPickIndex(prev => 
        prev === curatorPicksDesigner.curatorPicks!.length - 1 ? 0 : prev + 1
      );
      setIsZoomed(false);
      setPicksHovered(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPreviousPick();
    if (e.key === "ArrowRight") goToNextPick();
    if (e.key === "Escape") closeCuratorPicks();
  };

  useLightboxSwipe({
    containerRef: picksSwipeRef,
    enabled: !!curatorPicksDesigner,
    imageZoomedRef,
    onSwipeLeft: goToNextPick,
    onSwipeRight: goToPreviousPick,
  });

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
      <section id="collectibles" ref={ref} className="relative py-6 px-4 md:py-24 md:px-12 lg:px-20 bg-background scroll-mt-16">
        {/* Gradient accent band */}
        <div className="absolute top-0 left-0 right-0 h-1 md:h-1.5 bg-gradient-to-r from-secondary via-terracotta-light to-accent opacity-80" />
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="mb-12 md:mb-16 text-left"
          >
            <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-2">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif text-foreground">
                Collectible Design <span className="text-[10px] tracking-[0.2em] uppercase font-body align-middle italic text-[hsl(var(--gold))]">On View</span>
              </h2>
            </div>
            <p className="font-body text-sm md:text-base text-muted-foreground max-w-3xl leading-relaxed mb-4 text-justify">
              Collectible design refers to unique or limited-edition, often handmade, functional art pieces—such as furniture, lighting, and ceramics—that bridge the gap between art and utility. These items, characterized by high-level craftsmanship, storytelling, and investment potential, are often sought after for their artistic value and ability to enhance.
            </p>
          </motion.div>

          <div className="relative">
            {/* A-Z alphabet jump bar + Search + Filter */}
            {(() => {
              const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
              const designerLetters = [...new Set(filteredDesigners.map(d => normalize(d.name)[0]))].sort();
              return (
                <div className="flex flex-col gap-4 mb-5 md:mb-6">
                  <div
                    className="flex items-center gap-3 md:gap-4 lg:gap-5 px-1 py-4 border-t border-b border-border/30 overflow-x-auto max-w-3xl"
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
                          className={`flex-none font-serif text-base md:text-lg leading-none transition-all duration-200 ${
                            isActive
                              ? "text-foreground hover:text-primary cursor-pointer"
                              : "text-foreground/40 cursor-default"
                          }`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
                    <div className="md:hidden order-first">
                    <Popover open={filterOpen} onOpenChange={(open) => {
                          setFilterOpen(open);
                          if (!open && selectedCategory) {
                            broadcastFilter(selectedCategory, selectedSubcategory);
                            setTimeout(() => { document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
                          }
                        }}>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 px-3 h-8 rounded-full border border-[hsl(var(--gold))] bg-background shadow-sm hover:shadow-md text-foreground transition-all duration-300 relative" aria-label="Filter">
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-body uppercase tracking-[0.15em] font-semibold">Filter</span>
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
                              className="px-3 py-1 rounded-full border border-[hsl(var(--gold))] bg-white text-xs font-body font-medium text-foreground shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              Clear
                            </button>
                          )}
                          <button onClick={() => setFilterOpen(false)} className="p-1.5 rounded-full bg-muted hover:bg-muted-foreground/20 text-foreground transition-colors" aria-label="Close filter">
                            <X className="h-4 w-4" />
                          </button>
                          </div>
                        </div>
                        {(() => {
                          // Compute per-subcategory item counts scoped to collectibles only
                          const SUB_TAGS_LOCAL: Record<string, string[]> = {
                            "Sofas": ["Sofa"], "Armchairs": ["Armchair", "Armchairs"], "Chairs": ["Chair"],
                            "Daybeds & Benches": ["Daybed", "Bench"], "Ottomans & Stools": ["Ottoman", "Stool"],
                            "Bar Stools": ["Bar Stool"], "Consoles": ["Console"], "Coffee Tables": ["Coffee Table"],
                            "Desks": ["Desk"], "Dining Tables": ["Dining Table"], "Side Tables": ["Side Table"],
                            "Wall Lights": ["Wall Light", "Wall Lamp", "Sconce"], "Ceiling Lights": ["Ceiling Light", "Chandelier", "Pendant", "Suspension"],
                            "Floor Lights": ["Floor Light", "Floor Lamp"], "Table Lights": ["Table Light", "Table Lamp", "Lantern"],
                            "Bookcases": ["Bookcase"], "Cabinets": ["Cabinet"],
                            "Hand-Knotted Rugs": ["Hand-Knotted Rug", "Textile"], "Hand-Tufted Rugs": ["Hand-Tufted Rug"],
                            "Hand-Woven Rugs": ["Hand-Woven Rug"], "Vases & Vessels": ["Vase", "Vessel"],
                            "Mirrors": ["Mirror"], "Books": ["Book"], "Candle Holders": ["Candle Holder"],
                            "Decorative Objects": ["Decorative Object", "Object", "Sculpture"],
                          };
                          const subCounts: Record<string, number> = {};
                          Object.entries(SUB_TAGS_LOCAL).forEach(([sub, tags]) => {
                            let total = 0;
                            collectibleDesigners.forEach(d => {
                              d.curatorPicks?.forEach(pick => {
                                if (tags.some(tag =>
                                  categoryMatchLocal(pick.subcategory, tag) || categoryMatchLocal(pick.subcategory, sub) ||
                                  categoryMatchLocal(pick.category, tag) ||
                                  (pick.tags && pick.tags.some((t: string) => categoryMatchLocal(t, tag)))
                                )) total++;
                              });
                            });
                            subCounts[sub] = total;
                          });
                          // Compute per-category totals
                          const catCounts: Record<string, number> = {};
                          categories.forEach(cat => {
                            const subs = categoryMap[cat] || [];
                            catCounts[cat] = subs.reduce((sum, s) => sum + (subCounts[s] || 0), 0);
                          });
                          return (
                        <div className="space-y-1">
                          {categories.map((category) => (
                            <div key={category}>
                              <label className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                                <Checkbox
                                  checked={selectedCategory === category}
                                  onCheckedChange={() => {
                                    if (selectedCategory === category) {
                                      setSelectedCategory(null, true);
                                    } else {
                                      setSelectedCategory(category, true);
                                    }
                                  }}
                                />
                                <span className="text-sm text-foreground font-body">{category}</span>
                                <span className="ml-auto text-[9px] text-muted-foreground/60 font-body">{catCounts[category] || 0}</span>
                              </label>
                              {selectedCategory === category && categoryMap[category]?.length > 0 && (
                                <div className="ml-8 mt-1 mb-2 space-y-1 border-l border-border/40 pl-3">
                                  <button
                                    onClick={() => setSelectedSubcategory(null)}
                                    className={`block text-[11px] tracking-[0.15em] font-body transition-all duration-300 py-1 ${
                                      !selectedSubcategory ? 'text-primary' : 'text-foreground/60 hover:text-primary'
                                    }`}
                                  >
                                    All {category}
                                  </button>
                                  {categoryMap[category].map(sub => (
                                    <button
                                      key={sub}
                                      onClick={() => { setSelectedSubcategory(selectedSubcategory === sub ? null : sub); setFilterOpen(false); setTimeout(() => { document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150); }}
                                      className={`block text-[10px] tracking-[0.15em] font-body transition-all duration-300 py-1 ${
                                        selectedSubcategory === sub ? 'text-[hsl(var(--accent))] font-semibold' : 'text-foreground/60 hover:text-primary'
                                      }`}
                                    >
                                      {sub} <span className="text-[9px] text-muted-foreground/50">({subCounts[sub] || 0})</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                          );
                        })()}
                      </PopoverContent>
                    </Popover>
                    </div>
                    <div className="relative flex-none order-last md:order-first md:w-56">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Designer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 md:pl-9 pr-7 md:pr-8 h-8 md:h-9 text-[16px] md:text-sm bg-background border-[hsl(var(--gold))] shadow-sm rounded-full focus:border-primary/60 focus:shadow-md font-body"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => { setSearchQuery(""); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}


            {(() => {
              const SUBCATS = ["Sofas", "Armchairs", "Chairs", "Daybeds & Benches", "Ottomans & Stools", "Bar Stools",
                "Consoles", "Coffee Tables", "Desks", "Dining Tables", "Side Tables",
                "Wall Lights", "Ceiling Lights", "Floor Lights", "Table Lights",
                "Bookcases", "Cabinets", "Hand-Knotted Rugs", "Hand-Tufted Rugs", "Hand-Woven Rugs",
                "Vases & Vessels", "Mirrors", "Books", "Candle Holders", "Decorative Objects"];
              const counts: Record<string, number> = {};
              const SUB_TAGS: Record<string, string[]> = {
                "Sofas": ["Sofa"], "Armchairs": ["Armchair", "Armchairs"], "Chairs": ["Chair"],
                "Daybeds & Benches": ["Daybed", "Bench"], "Ottomans & Stools": ["Ottoman", "Stool"],
                "Bar Stools": ["Bar Stool"], "Consoles": ["Console"], "Coffee Tables": ["Coffee Table"],
                "Desks": ["Desk"], "Dining Tables": ["Dining Table"], "Side Tables": ["Side Table"],
                "Wall Lights": ["Wall Light", "Wall Lamp", "Sconce"], "Ceiling Lights": ["Ceiling Light", "Chandelier", "Pendant", "Suspension"],
                "Floor Lights": ["Floor Light", "Floor Lamp"], "Table Lights": ["Table Light", "Table Lamp", "Lantern"],
                "Bookcases": ["Bookcase"], "Cabinets": ["Cabinet"],
                "Hand-Knotted Rugs": ["Hand-Knotted Rug", "Textile"], "Hand-Tufted Rugs": ["Hand-Tufted Rug"],
                "Hand-Woven Rugs": ["Hand-Woven Rug"], "Vases & Vessels": ["Vase", "Vessel"],
                "Mirrors": ["Mirror"], "Books": ["Book"], "Candle Holders": ["Candle Holder"],
                "Decorative Objects": ["Decorative Object", "Object", "Sculpture"],
              };
              SUBCATS.forEach(sub => {
                const tags = SUB_TAGS[sub] || [sub];
                let total = 0;
                collectibleDesigners.forEach(d => {
                  d.curatorPicks?.forEach(pick => {
                    if (tags.some(tag =>
                      categoryMatchLocal(pick.subcategory, tag) || categoryMatchLocal(pick.subcategory, sub) ||
                      categoryMatchLocal(pick.category, tag) ||
                      (pick.tags && pick.tags.some((t: string) => categoryMatchLocal(t, tag)))
                    )) total++;
                  });
                });
                counts[sub] = total;
              });
              return (
                <CategorySidebar
                  activeCategory={selectedCategory}
                  activeSubcategory={selectedSubcategory}
                  onSelect={(cat, sub) => {
                    if (cat === null) {
                      setSelectedCategory(null);
                    } else {
                      setSelectedCategoryRaw(cat);
                      if (sub !== selectedSubcategory) setSelectedSubcategoryRaw(sub);
                      broadcastFilter(cat, sub);
                      setTimeout(() => {
                        document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 150);
                    }
                  }}
                  itemCounts={counts}
                  sectionLabel="Collectible Design"
                />
              );
            })()}

          {(searchQuery || selectedCategory) && (
            <p className="text-left text-[10px] text-muted-foreground/50 mb-4 font-body tracking-wider">
              {filteredDesigners.length} designer{filteredDesigners.length !== 1 ? 's' : ''} found
              {selectedSubcategory && <span> · {selectedSubcategory}</span>}
              {selectedCategory && !selectedSubcategory && <span> · {selectedCategory}</span>}
            </p>
          )}

          <div className="flex justify-start md:justify-end mb-4 md:pr-8">
            <button
              onClick={toggleAllDesigners}
              className="text-sm text-muted-foreground hover:text-primary font-body transition-colors duration-300 flex items-center gap-1.5"
            >
              <span>{isAllExpanded ? 'Collapse All' : 'Expand All'}</span>
              <ChevronDown className={`h-4.5 w-4.5 transition-transform duration-300 ${isAllExpanded ? 'rotate-180' : ''}`} />
            </button>
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
                  className="border border-border/40 rounded-lg px-4 md:px-6 bg-white md:bg-card/30 hover:bg-white/90 md:hover:bg-card/50 transition-colors duration-300 scroll-mt-16"
                >
                  <AccordionTrigger className="hover:no-underline py-4 md:py-6 group active:scale-[0.99] touch-manipulation [&>svg]:hidden md:[&>svg]:block">
                    <div className="flex flex-col w-full gap-3">
                    <div className="flex items-center gap-4 md:gap-6 text-left w-full">
                      <Dialog>
                        <DialogTrigger asChild>
                          <div
                            className="relative flex-shrink-0 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImage({ name: designer.name, image: designer.image });
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                          >
                            <img
                              src={designer.image}
                              alt={designer.name}
                              sizes="(max-width: 767px) 96px, 128px"
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
                              sizes="(max-width: 767px) 90vw, 700px"
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
                              className="p-0.5 transition-transform duration-300 hover:scale-110 relative z-10"
                              aria-label={`${designer.name} on Instagram`}
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
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
                            {(() => {
                              const fmt = formatDesignerName(designer.name);
                              return fmt.brand ? (
                                <>
                                  {fmt.brand}
                                  <span className="text-lg text-foreground/70"> — {fmt.person}</span>
                                </>
                              ) : fmt.person;
                            })()}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-sm md:text-base text-primary font-body">{designer.specialty}</p>
                        </div>
                        <div className="hidden md:flex mt-auto pt-4">
                          <WhatsAppShareButton
                            onClick={(e) => {
                              e.stopPropagation();
                              shareProfileOnWhatsApp("collectible", designer.id ?? designer.name, designer.name, designer.specialty);
                              trackCTA.whatsapp(`Collectibles_Share_${designer.name}`);
                            }}
                            label={`Share ${designer.name} on WhatsApp`}
                            variant="branded"
                            className="md:!text-sm md:!px-4 md:!py-2"
                          />
                        </div>
                      </div>
                    {/* On View thumbnails — right side */}
                    {designer.notableWorksLink && (() => {
                      const thumb = GALLERY_THUMBNAILS[designer.notableWorksLink.galleryIndex];
                      return (
                        <div className="hidden md:flex items-center gap-5 flex-shrink-0 mr-8">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider"><em>On View</em></span>
                          <div className="relative group/avatar pb-6">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('openGalleryLightbox', {
                                  detail: { index: designer.notableWorksLink!.galleryIndex, sourceId: `collectible-${designer.id}` }
                                }));
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                              className="relative w-11 h-11 md:w-14 md:h-14 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary/60 hover:scale-125 hover:z-10 transition-all duration-300 touch-manipulation"
                              aria-label={`View ${designer.notableWorksLink!.text} in gallery`}
                            >
                              {thumb && (
                                <img src={thumb} alt={designer.notableWorksLink!.text} className="w-full h-full object-cover blur-[0.5px] group-hover/avatar:blur-0 transition-[filter] duration-300" loading="lazy" />
                              )}
                            </button>
                            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex items-center gap-0.5 text-xs font-body text-muted-foreground whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                              <CornerDownRight className="w-3 h-3" /> {designer.notableWorksLink!.text}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    </div>
                    {/* Mobile: On View below header */}
                    {designer.notableWorksLink && (() => {
                      const thumb = GALLERY_THUMBNAILS[designer.notableWorksLink.galleryIndex];
                      return (
                        <>
                        <div className="flex md:hidden items-start gap-2 w-full ml-[7.5rem] -mt-0.5 pr-4">
                          <div className="w-16 h-px bg-[hsl(var(--gold)/0.4)] mt-0.5 mb-1" />
                        </div>
                        <div className="flex md:hidden items-start gap-2 w-full ml-[7.5rem] -mt-0.5 pr-4">
                          <span className="text-[10px] text-foreground uppercase tracking-wider mr-2 mt-3.5"><em>On View</em></span>
                          <div className="relative group/avatar pb-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('openGalleryLightbox', {
                                  detail: { index: designer.notableWorksLink!.galleryIndex, sourceId: `collectible-${designer.id}` }
                                }));
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                              className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-background hover:ring-primary/60 hover:scale-125 hover:z-10 transition-all duration-300 touch-manipulation"
                              aria-label={`View ${designer.notableWorksLink!.text} in gallery`}
                            >
                              {thumb && (
                                <img src={thumb} alt={designer.notableWorksLink!.text} className="w-full h-full object-cover" loading="lazy" />
                              )}
                            </button>
                            <span className="absolute left-0 top-full mt-1 flex items-center gap-0.5 text-[9px] font-body text-foreground whitespace-nowrap pointer-events-none z-50">
                              <CornerDownRight className="w-3 h-3" /> {designer.notableWorksLink!.text}
                            </span>
                          </div>
                        </div>
                        </>
                      );
                    })()}
                    <div className="flex justify-start md:hidden">
                      <ChevronDown className="h-6 w-6 shrink-0 transition-transform duration-200 text-muted-foreground group-data-[state=open]:rotate-180" />
                    </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-3">
                    <div className="space-y-2 text-muted-foreground font-body">
                      <p className="text-sm md:text-base leading-relaxed text-justify">
                        {designer.biography}
                      </p>

                      <div className="pt-2 border-t border-border/30 mt-4">
                        <p className="text-sm md:text-base italic leading-relaxed text-foreground/80 mb-4 text-justify">
                          "{designer.philosophy}"
                        </p>
                      </div>

                      {designer.links && designer.links.filter(l => l.type !== "Instagram").length > 0 && (
                        <div className="flex flex-row flex-wrap items-center gap-3 mt-4 md:flex-nowrap md:gap-3 md:pr-8">
                          {designer.links.filter(l => l.type !== "Instagram").map((link, idx) => (
                            link.url ? (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body rounded-md transition-all duration-300 border bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 hover:border-primary/40"
                                aria-label={`${designer.name} — ${link.type}`}
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
                              <Fragment key={idx}>
                              {/* Mobile: Curators' Picks standalone on first line */}
                              <button
                                onClick={() => openCuratorPicks(designer)}
                                className="inline-flex items-center gap-1.5 md:px-4 md:py-2 text-base md:text-sm font-body md:bg-accent/10 md:hover:bg-accent/20 text-foreground md:text-accent-foreground md:rounded-full transition-all duration-300 cursor-pointer md:border md:border-accent/30 md:ml-auto"
                              >
                                <Gem size={16} className="fill-accent text-accent md:w-3.5 md:h-3.5" />
                                <span className="font-semibold underline underline-offset-2 decoration-accent/40 md:font-medium md:no-underline">{link.type}</span>
                              </button>
                              {/* Logo hidden on mobile to avoid crowding */}
                              {/* Mobile: WhatsApp below Curators' Picks */}
                              <div className="flex items-center md:hidden">
                                <WhatsAppShareButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    shareProfileOnWhatsApp("collectible", designer.id ?? designer.name, designer.name, designer.specialty);
                                    trackCTA.whatsapp(`Collectibles_Share_${designer.name}`);
                                  }}
                                  label={`Share ${designer.name} on WhatsApp`}
                                  variant="prominent"
                                />
                              </div>
                              </Fragment>
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
                  </AccordionContent>
              </AccordionItem>
                </Fragment>
                  );
                })}
            </Accordion>
            )}
          </motion.div>
          </div>
        </div>
      </section>

      {/* Curators' Picks Dialog - Full screen dark modal like FeaturedDesigners */}
      <Dialog modal={false} open={!!curatorPicksDesigner} onOpenChange={(open) => !open && closeCuratorPicks()}>
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
              ref={picksSwipeRef}
              className="relative w-full h-full flex items-center justify-center overflow-x-hidden overscroll-contain"
            >
              {/* Desktop Close button moved inside image container below */}

              {/* Previous button */}
              {curatorPicksDesigner.curatorPicks.length > 1 && (
                <button 
                  onClick={goToPreviousPick}
                  className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8 text-white" />
                </button>
              )}

              {/* Image container */}
              <div
                ref={(el) => {
                  if (!el) return;
                  const indicator = el.parentElement?.querySelector('[data-scroll-indicator]') as HTMLElement | null;
                  if (!indicator) return;
                  const checkScroll = () => {
                    const hasMore = el.scrollHeight > el.clientHeight + 20;
                    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
                    indicator.style.opacity = (hasMore && !nearBottom) ? '1' : '0';
                  };
                  checkScroll();
                  el.addEventListener('scroll', checkScroll, { passive: true });
                  const observer = new MutationObserver(checkScroll);
                  observer.observe(el, { childList: true, subtree: true });
                  setTimeout(checkScroll, 500);
                }}
                className={`flex flex-col items-center justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 overflow-y-auto md:overflow-visible select-none touch-pan-y ${isZoomed ? 'max-h-[95vh] pb-4' : 'max-h-[85vh] pb-4'}`}
                style={{ WebkitUserSelect: 'none' }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}>
                <div 
                  className={`relative overflow-visible transition-all duration-300 ${isZoomed ? 'max-h-[85vh]' : ''}`}
                  onClick={handleDoubleTap}
                >
                  {!isZoomed && (curatorPicksDesigner.curatorPicks[curatorPickIndex]?.category || curatorPicksDesigner.curatorPicks[curatorPickIndex]?.edition) && (
                    <div className="flex items-center gap-2 mb-2">
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.category && (
                        <span className="hidden md:inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
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
                  <div className="relative inline-block overflow-visible"
                    onMouseEnter={() => { if (curatorPicksDesigner.curatorPicks[curatorPickIndex]?.hoverImage) setPicksHovered(true); }}
                    onMouseLeave={() => setPicksHovered(false)}
                  >
                    {/* Active filter indicator */}
                    {!isZoomed && (selectedCategory || selectedSubcategory) && (
                      <button
                        onClick={() => { setSelectedCategory(null); setSelectedSubcategoryRaw(null); broadcastFilter(null, null); }}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-white/20 backdrop-blur-sm hover:bg-black/70 transition-all duration-200 cursor-pointer"
                        aria-label="Clear filter"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>{selectedSubcategory || selectedCategory}</span>
                        <X className="w-3 h-3 ml-0.5 opacity-70" />
                      </button>
                    )}
                    {(() => {
                      const currentPick = curatorPicksDesigner.curatorPicks[curatorPickIndex];
                      const isFiltered = !pickMatchesFilter(currentPick);
                      return (
                        <>
                          <PinchZoomImage 
                            key={curatorPickIndex}
                            src={currentPick?.image} 
                            alt={currentPick?.title} 
                            className={`object-contain transition-all duration-300 select-none ${isZoomed ? 'max-w-none w-[150vw] md:w-auto md:max-w-full md:max-h-[80vh]' : 'max-w-[85vw] max-h-[55vh] md:max-w-[70vw] md:max-h-[60vh]'} ${isFiltered ? 'blur-sm opacity-40' : ''} ${picksHovered && currentPick?.hoverImage ? 'opacity-0' : 'opacity-100'}`}
                            draggable={false}
                            onZoomChange={(z) => { imageZoomedRef.current = z; }}
                          />
                          {currentPick?.hoverImage && (
                            <img
                              src={currentPick.hoverImage}
                              alt={`${currentPick?.title} - alternate view`}
                              className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 select-none pointer-events-none ${picksHovered ? 'opacity-100' : 'opacity-0'} ${isZoomed ? 'max-w-none' : ''}`}
                              draggable={false}
                            />
                          )}
                        </>
                      );
                    })()}
                    {/* Desktop hover overlay — click to enlarge hint */}
                    {!isZoomed && (
                      <div
                        className="hidden md:flex absolute inset-0 items-center justify-center transition-all duration-500 ease-out cursor-zoom-in z-[5] group"
                        onClick={(e) => { e.stopPropagation(); setIsZoomed(true); }}
                      >
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out">
                          <Search size={24} className="text-foreground drop-shadow-lg" />
                        </div>
                      </div>
                    )}
                    {/* Desktop Close button — bottom-right (outside) */}
                    <button
                      onClick={closeCuratorPicks}
                      className="hidden md:flex absolute bottom-2 -right-12 lg:-right-14 p-2.5 rounded-full bg-white/15 text-white/85 hover:text-white hover:bg-white/30 backdrop-blur-sm transition-all duration-300 z-20 border border-white/20"
                      aria-label="Close lightbox"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    {/* Mobile Pin button — bottom-left (replaces expand icon) */}
                    {!isZoomed && (() => {
                      const cp = curatorPicksDesigner.curatorPicks[curatorPickIndex];
                      const did = curatorPicksDesigner.id ?? curatorPicksDesigner.name;
                      const dn = curatorPicksDesigner.name;
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin({ pick: cp, designerName: dn, designerId: did, section: "collectibles" });
                          }}
                          className={cn(
                            "md:hidden absolute bottom-2 left-2 z-10 p-2 rounded-full backdrop-blur-sm transition-all duration-300",
                            isPinned(cp.title, did)
                              ? "bg-[hsl(var(--gold)/0.3)] border border-[hsl(var(--gold)/0.6)] text-white"
                              : "bg-black/40 text-white/70 hover:text-white hover:bg-black/60",
                            compareItems.length >= 3 && !isPinned(cp.title, did) && "opacity-40 pointer-events-none"
                          )}
                          aria-label={isPinned(cp.title, did) ? "Remove from selection" : "Pin"}
                        >
                          <Scale size={14} />
                        </button>
                      );
                    })()}
                    {/* PDF download button */}
                    {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.pdfUrl && !isZoomed && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const pick = curatorPicksDesigner.curatorPicks[curatorPickIndex];
                          try {
                            const res = await fetch(pick.pdfUrl!);
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = pick.pdfFilename || `${pick.title?.replace(/\s+/g, '_') || 'specification'}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          } catch {
                            window.open(pick.pdfUrl!, '_blank');
                          }
                        }}
                        className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-2 rounded-full bg-[#d32f2f]/80 text-white hover:bg-[#d32f2f] backdrop-blur-sm transition-all duration-300 z-10"
                        aria-label="Download PDF specification"
                      >
                        <FileDown size={14} className="md:hidden" />
                        <FileDown size={16} className="hidden md:block" />
                        <span className="text-[10px] md:text-xs font-medium leading-none">PDF</span>
                      </button>
                    )}
                    {/* Desktop Quote + Pin — stacked vertically under PDF */}
                    {!isZoomed && (() => {
                      const currentPick = curatorPicksDesigner.curatorPicks[curatorPickIndex];
                      const designerId = curatorPicksDesigner.id ?? curatorPicksDesigner.name;
                      const designerName = curatorPicksDesigner.name;
                      return (
                        <div className="hidden md:flex absolute top-full -right-20 mt-2 flex-col items-end gap-2 z-20">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuoteOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/15 text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300 cursor-pointer whitespace-nowrap"
                            aria-label="Request a Quote"
                          >
                            <MessageSquareQuote size={14} className="shrink-0" />
                            <span className="text-[10px] font-display uppercase tracking-[0.08em] leading-none">Request a Quote</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin({ pick: currentPick, designerName, designerId, section: "collectibles" });
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all duration-300 cursor-pointer whitespace-nowrap",
                              isPinned(currentPick.title, designerId)
                                ? "bg-[hsl(var(--gold)/0.2)] border-[hsl(var(--gold)/0.4)] text-white/80"
                                : "bg-white/5 border-white/15 text-white/60 hover:text-white hover:bg-white/10",
                              compareItems.length >= 3 && !isPinned(currentPick.title, designerId) && "opacity-40 pointer-events-none"
                            )}
                            aria-label={isPinned(currentPick.title, designerId) ? "Remove from selection" : "Pin your selection of 3"}
                          >
                            <Scale size={14} className="shrink-0" />
                            <span className="text-[10px] font-display uppercase tracking-[0.08em] leading-none">
                              {isPinned(currentPick.title, designerId) ? "Pinned" : "Pin your selection of 3"}
                            </span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {!isZoomed && <div className="hidden md:block h-12" aria-hidden="true" />}

                {/* Mobile: close (left) + pin + quote (right) */}
                {!isZoomed && (() => {
                  const currentPick = curatorPicksDesigner.curatorPicks[curatorPickIndex];
                  const designerId = curatorPicksDesigner.id ?? curatorPicksDesigner.name;
                  const designerName = curatorPicksDesigner.name;
                  return (
                    <div className="md:hidden flex justify-between items-center w-full mt-2 pl-2">
                      <div>
                        <button
                          onClick={closeCuratorPicks}
                          className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-300 border border-white/20"
                          aria-label="Close"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin({ pick: currentPick, designerName, designerId, section: "collectibles" });
                          }}
                          className={cn(
                            "p-1.5 rounded-full backdrop-blur-sm border transition-all duration-300",
                            isPinned(currentPick.title, designerId)
                              ? "bg-[hsl(var(--gold)/0.3)] border-[hsl(var(--gold)/0.6)] text-white"
                              : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20",
                            compareItems.length >= 3 && !isPinned(currentPick.title, designerId) && "opacity-40 pointer-events-none"
                          )}
                          aria-label={isPinned(currentPick.title, designerId) ? "Remove from selection" : "Pin"}
                        >
                          <Scale size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuoteOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 text-white hover:bg-white/25 transition-all duration-300 cursor-pointer"
                          aria-label="Request a Quote"
                        >
                          <MessageSquareQuote size={14} />
                          <span className="text-[10px] font-display font-bold uppercase tracking-[0.08em] leading-none">Quote</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className={`mt-2 transition-all duration-300 ${isZoomed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                  <CuratorPicksLegend
                    pick={curatorPicksDesigner.curatorPicks[curatorPickIndex]}
                    designerId={curatorPicksDesigner.id ?? curatorPicksDesigner.name}
                    designerName={curatorPicksDesigner.name}
                  />

                  {/* Thumbnail strip */}
                  {curatorPicksDesigner.curatorPicks.length > 1 && (
                    <div className="mt-6 flex items-center gap-2 overflow-x-auto scrollbar-hide justify-center flex-wrap md:flex-nowrap px-4">
                      {curatorPicksDesigner.curatorPicks.map((pick, idx) => {
                        const matches = pickMatchesFilter(pick);
                        return (
                        <button
                          key={idx}
                          onClick={() => { setCuratorPickIndex(idx); setIsZoomed(false); }}
                          aria-label={`View ${pick.title}`}
                          className={`flex-none relative w-10 h-10 md:w-12 md:h-12 rounded overflow-hidden transition-all duration-300 ${
                            curatorPickIndex === idx
                              ? 'ring-2 ring-white scale-110 opacity-100'
                              : 'ring-1 ring-white/20 opacity-50 hover:opacity-90 hover:ring-white/50'
                          } ${!matches ? 'blur-[2px] opacity-30' : ''}`}
                        >
                          <img src={pick.image} alt={pick.title} sizes="(max-width: 767px) 40px, 48px" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile scroll indicator */}
              {!isZoomed && (
                <div
                  data-scroll-indicator
                  className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-opacity duration-300"
                  style={{ opacity: 0 }}
                >
                  <div className="animate-bounce bg-black/40 backdrop-blur-sm rounded-full p-1.5">
                    <ChevronDown className="w-4 h-4 text-white/70" />
                  </div>
                </div>
              )}

              {/* Next button */}
              {curatorPicksDesigner.curatorPicks.length > 1 && (
                <button 
                  onClick={goToNextPick}
                  className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 bg-background/20 hover:bg-background/40 rounded-full transition-colors" 
                  aria-label="Next image"
                >
                  <ChevronRight className="h-8 w-8 text-white" />
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    <QuoteRequestDialog
      open={quoteOpen}
      onOpenChange={setQuoteOpen}
      productName={curatorPicksDesigner?.curatorPicks[curatorPickIndex]?.title}
      designerName={curatorPicksDesigner?.name}
    />
    </>
  );
};

export default Collectibles;
