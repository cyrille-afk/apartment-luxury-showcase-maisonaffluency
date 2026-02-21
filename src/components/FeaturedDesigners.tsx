import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, useState, useMemo, useEffect } from "react";
import { Instagram, Search, X, ChevronDown, ExternalLink, Star, Maximize2, Minimize2, SlidersHorizontal } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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
import nathalieZieglerImg from "@/assets/designers/nathalie-ziegler.jpg";
import leoAertsAlineaImg from "@/assets/designers/leo-aerts-alinea.jpg";
import ericSchmittImg from "@/assets/designers/eric-schmitt.jpg";
import pierreBonnefulleImg from "@/assets/designers/pierre-bonnefille.jpg";
import ccTapisImg from "@/assets/designers/cc-tapis.jpg";
import haymannEditionsImg from "@/assets/designers/haymann-editions.jpg";
import theoremeEditionsImg from "@/assets/designers/theoreme-editions.jpg";
import garnierLinkerImg from "@/assets/designers/garnier-linker.jpg";
import robicaraImg from "@/assets/designers/robicara-v2.jpg";
import redaAmalouImg from "@/assets/designers/reda-amalou.jpg";
import noeDuchaufourImg from "@/assets/designers/noe-duchaufour-lawrance.jpg";
import binaBAitelImg from "@/assets/designers/bina-baitel.jpg";
import tristanAuerImg from "@/assets/designers/tristan-auer.jpg";

import manOfPartsImg from "@/assets/designers/man-of-parts.jpg";
import kerstensImg from "@/assets/designers/kerstens.jpg";
import felixAgostiniImg from "@/assets/designers/felix-agostini.jpg";
import ecartParisImg from "@/assets/designers/ecart-paris.jpg";
import kiraImg from "@/assets/designers/kira.jpg";
import kikoLopezImg from "@/assets/designers/kiko-lopez.jpg";
import maartenVrolijkImg from "@/assets/designers/maarten-vrolijk.png";
import marcantonioImg from "@/assets/designers/marcantonio-brandolini-dadda.jpg";
import matthieuGicquelImg from "@/assets/designers/matthieu-gicquel.jpg";
import rowinAtelierImg from "@/assets/designers/rowin-atelier.jpg";
import leoAertsAngeloMCollection from "@/assets/curators-picks/leo-aerts-angelo-m-collection.jpg";
import leoAertsAngeloMDining from "@/assets/curators-picks/leo-aerts-angelo-m-dining.jpg";
import leoAertsVitrineCabinet from "@/assets/curators-picks/leo-aerts-vitrine-cabinet.jpg";
import leoAertsOutdoorChair from "@/assets/curators-picks/leo-aerts-outdoor-chair.jpg";
import leoAertsTwinChairOutdoor from "@/assets/curators-picks/leo-aerts-twin-chair-outdoor.jpg";
import leoAertsAngeloMMacassar from "@/assets/curators-picks/leo-aerts-angelo-m-macassar.jpg";
import forestGiaconiaIhiLamp from "@/assets/curators-picks/forest-giaconia-ihi-floor-lamp.jpg";
import forestGiaconiaImg from "@/assets/designers/forest-giaconia.jpg";
import adamCourtsOkhaImg from "@/assets/designers/adam-courts-okha.jpg";
import adamCourtsVoidTable from "@/assets/curators-picks/adam-courts-void-table.jpg";
import adamCourtsVoidChair from "@/assets/curators-picks/adam-courts-void-chair.jpg";
import adamCourtsGeometerChair from "@/assets/curators-picks/adam-courts-geometer-chair.jpg";
import adamCourtsSofaFront from "@/assets/curators-picks/adam-courts-sofa-front.jpg";
import adamCourtsReposeSofa from "@/assets/curators-picks/adam-courts-repose-sofa.jpg";
import adamCourtsReverbSofa from "@/assets/curators-picks/adam-courts-reverb-sofa.jpg";
import adamCourtsSofaAerial from "@/assets/curators-picks/adam-courts-sofa-aerial.jpg";
import adamCourtsSideboard from "@/assets/curators-picks/adam-courts-sideboard.jpg";
import adamCourtsGeometerBench from "@/assets/curators-picks/adam-courts-geometer-bench.jpg";

// Curators' Picks images
import alexanderLamontPick1 from "@/assets/curators-picks/alexander-lamont-1.jpg";
import alexanderLamontPick2 from "@/assets/curators-picks/alexander-lamont-2.jpg";
import alexanderLamontPick3 from "@/assets/curators-picks/alexander-lamont-3.jpg";
import alexanderLamontPick4 from "@/assets/curators-picks/alexander-lamont-4.jpg";
import yvesMacheretPick1 from "@/assets/curators-picks/yves-macheret-1.jpg";
import yvesMacheretPick2 from "@/assets/curators-picks/yves-macheret-2.jpg";
import yvesMacheretPick3 from "@/assets/curators-picks/yves-macheret-3.png";
import yvesMacheretPick4 from "@/assets/curators-picks/yves-macheret-4.jpg";
import yvesMacheretPickHublo from "@/assets/curators-picks/yves-macheret-hublo.png";
import yvesMacheretPickConsole1925 from "@/assets/curators-picks/yves-macheret-console-1925.jpg";
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
import leoSentouPickJBL from "@/assets/curators-picks/leo-sentou-jbl-armchair.png";
import leoSentouPickGJ from "@/assets/curators-picks/leo-sentou-gj-chair.png";
import leoSentouPickLA from "@/assets/curators-picks/leo-sentou-side-table-la.png";
import leoSentouPickAB from "@/assets/curators-picks/leo-sentou-ab-armchair-new.png";
import leoSentouPickCS from "@/assets/curators-picks/leo-sentou-cs-sofa.png";
import leoSentouPickLD from "@/assets/curators-picks/leo-sentou-ld-armchair.png";

// Additional curator picks images
import ericSchmittChairie from "@/assets/curators-picks/eric-schmitt-chairie.jpg";
import pierreBonnefilleBronzePainting from "@/assets/curators-picks/pierre-bonnefille-bronze-painting.jpg";
import ccTapisGiudecca from "@/assets/curators-picks/cc-tapis-giudecca.jpg";
import haymannMarieLamp from "@/assets/curators-picks/haymann-marie-lamp.jpg";
import theoremeGarnierLinker from "@/assets/curators-picks/theoreme-garnier-linker.jpg";
import garnierLinkerCenterpiece from "@/assets/curators-picks/garnier-linker-centerpiece.jpg";
import robicaraSiraCredenza from "@/assets/curators-picks/robicara-sira-credenza-new.jpg";
import robicaraArmchair from "@/assets/curators-picks/robicara-armchair.jpg";
import robicaraHighbackChair from "@/assets/curators-picks/robicara-highback-chair.jpg";
import robicaraSideboard from "@/assets/curators-picks/robicara-sideboard.jpg";
import robicaraSiraNightstand from "@/assets/curators-picks/robicara-sira-nightstand.jpg";
import robicaraMarbleTable from "@/assets/curators-picks/robicara-marble-table.jpg";
import robicaraMartiniTable from "@/assets/curators-picks/robicara-martini-table.jpg";
import redaAmalouDotTable from "@/assets/curators-picks/reda-amalou-dot-table.jpg";
import noeFolioLamp from "@/assets/curators-picks/noe-folio-lamp.jpg";
import rowinNoneIILampDetail from "@/assets/curators-picks/rowin-none-ii-lamp-detail.jpg";
import matthieuGicquelGoldGeode from "@/assets/curators-picks/matthieu-gicquel-gold-geode.jpg";
import kikoLopezSilverHammer from "@/assets/curators-picks/kiko-lopez-silver-hammer.jpg";
import maartenVrolijkBloomingTerra from "@/assets/curators-picks/maarten-vrolijk-blooming-terra.jpg";
import marcantonioDetail from "@/assets/curators-picks/marcantonio-cotissi-detail.jpg";

import binaBAitelObject from "@/assets/curators-picks/bina-baitel-object.jpg";
import kerstensConsole from "@/assets/curators-picks/kerstens-console.jpg";
import kertensPick1 from "@/assets/curators-picks/kerstens-1.jpg";
import kertensPick2 from "@/assets/curators-picks/kerstens-2.jpg";
import kertensPick3 from "@/assets/curators-picks/kerstens-3.jpg";
import kertensPick4 from "@/assets/curators-picks/kerstens-4.jpg";
import kertensPick5 from "@/assets/curators-picks/kerstens-5.jpg";
import kertensPick6 from "@/assets/curators-picks/kerstens-6.jpg";
import kertensPick7 from "@/assets/curators-picks/kerstens-7.jpg";
import manOfPartsSofa from "@/assets/curators-picks/man-of-parts-sofa.jpg";
import felixAgostiniCaryatide from "@/assets/curators-picks/felix-agostini-caryatide.jpg";
import kiraToshiroLamp from "@/assets/curators-picks/kira-toshiro-lamp.jpg";

import tristanAuerYsaWallLightH from "@/assets/curators-picks/tristan-auer-ysa-wall-light-h.jpg";
import tristanAuerPedestalSuzanne from "@/assets/curators-picks/tristan-auer-pedestal-suzanne.jpg";
import tristanAuerTableLampH from "@/assets/curators-picks/tristan-auer-table-lamp-h.jpg";
import tristanAuerTeeFloorLamp from "@/assets/curators-picks/tristan-auer-tee-floor-lamp.jpg";
import tristanAuerEclipseWallLight from "@/assets/curators-picks/tristan-auer-eclipse-wall-light-v2.jpg";
import tristanAuerYsaWallLightVeronese from "@/assets/curators-picks/tristan-auer-ysa-wall-light-veronese.jpg";
import brunoDeMaistreLyricDesk from "@/assets/curators-picks/bruno-de-maistre-lyric-desk.jpg";
import herveVdsMicmac from "@/assets/curators-picks/herve-vds-micmac.jpg";
import thierryLemaireOrsay from "@/assets/curators-picks/thierry-lemaire-orsay.jpg";
import oliviaCognetVallauris from "@/assets/curators-picks/olivia-cognet-vallauris.jpg";
import milanPekarCrystalline from "@/assets/curators-picks/milan-pekar-crystalline.jpg";
import nathalieZieglerChandelier from "@/assets/curators-picks/nathalie-ziegler-chandelier.jpg";
import jmfStool1934 from "@/assets/curators-picks/jmf-stool-1934.jpg";
import ecartPierreChareau from "@/assets/curators-picks/ecart-pierre-chareau.jpg";
import kikoLopezMirrorImg from "@/assets/curators-picks/kiko-lopez-mirror.jpg";
import maartenVrolijkSakura from "@/assets/curators-picks/maarten-vrolijk-sakura.jpg";
import maartenVrolijkVessel from "@/assets/curators-picks/maarten-vrolijk-vessel.jpg";
import marcantonioVessel from "@/assets/curators-picks/marcantonio-cotissi-vessel.jpg";
import matthieuGicquelGeode from "@/assets/curators-picks/matthieu-gicquel-geode.jpg";
import nathalieZieglerSnakeVessel from "@/assets/curators-picks/nathalie-ziegler-snake-vessel.jpg";
import rowinNoneIILamp from "@/assets/curators-picks/rowin-none-ii-lamp.jpg";

type DesignerLink = { type: string; url?: string };
type CuratorPick = { image: string; title: string; subtitle?: string; category?: string; tags?: string[]; materials?: string; dimensions?: string; description?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const featuredDesigners: (Record<string, any> & { curatorPicks: CuratorPick[]; links?: DesignerLink[] })[] = [
  {
    id: "adam-courts-okha",
    name: "Adam Courts - Okha Design Studio",
    specialty: "Collectible Furniture & Contemporary African Design",
    image: adamCourtsOkhaImg,
    biography: "Adam Courts is the founder and creative director of Okha, a Johannesburg-based design studio at the vanguard of contemporary collectible furniture. Drawing on the rich material culture and craft traditions of southern Africa, Courts creates pieces of sculptural authority and refined restraint. His work — spanning seating, cabinetry, tables and lighting — is distinguished by its precision joinery, architect's rigour and a deep sensitivity to texture and form. Okha is represented in landmark private collections and leading design galleries internationally.",
    notableWorks: "Tectra Coffee Table, Void Dining Chair, Geometer Chair, BNVO Dining Chair, Repose Sofa, OVD Server",
    philosophy: "Good design is fearless. It should command a room without shouting — and reward the hand that touches it.",
    curatorPicks: [
      {
        image: adamCourtsVoidTable,
        title: "Tectra 2",
        subtitle: "Gun Metal Base & Custom Stone Top",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "",
        dimensions: "166.5W × 147.5D × 38H cm",
        description: ""
      },
      {
        image: adamCourtsVoidChair,
        title: "BNVO",
        subtitle: "Carbon Ash Frame & Custom Fabric Upholstery",
        category: "Seating",
        tags: ["Seating", "Chair"],
        materials: "",
        dimensions: "65.5W × 58D × 79H cm · Seat Height: 47 cm",
        description: ""
      },
      {
        image: adamCourtsReposeSofa,
        title: "Repose Sofa A",
        subtitle: "With Ottoman",
        category: "Seating",
        tags: ["Seating", "Sofa"],
        materials: "",
        dimensions: "L240 × D95 × H72 cm",
        description: ""
      },
      {
        image: adamCourtsGeometerChair,
        title: "VOID",
        subtitle: "Natural Walnut",
        category: "Seating",
        tags: ["Seating", "Chair"],
        materials: "",
        dimensions: "47W × 50.5D × 81H cm · Seat Height: 47 cm",
        description: ""
      },
      {
        image: adamCourtsReverbSofa,
        title: "REVERB",
        subtitle: "Brushed Brass Plinth & Custom Fabric",
        category: "Seating",
        tags: ["Seating", "Sofa"],
        materials: "",
        dimensions: "288.5W × 178.5D × 72H cm · Seat Height: 41 cm",
        description: ""
      },
      {
        image: adamCourtsSideboard,
        title: "OVD",
        subtitle: "Natural Ash Veneer",
        category: "Storage",
        tags: ["Storage", "Sideboard"],
        materials: "",
        dimensions: "140W × 46.6D × 70H cm",
        description: ""
      },
      {
        image: adamCourtsGeometerBench,
        title: "BENCH BED",
        subtitle: "Natural Ash & Custom Leather",
        category: "Seating",
        tags: ["Seating", "Bench"],
        materials: "",
        dimensions: "179.3W × 38D × 41H cm",
        description: ""
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/__okha/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "alexander-lamont",
    name: "Alexander Lamont",
    specialty: "Artisan Furniture & Luxury Craftsmanship",
    image: alexanderLamontImg,
    biography:
      "Alexander Lamont is a British designer based in Bangkok whose eponymous brand has become synonymous with exceptional craftsmanship and the innovative use of traditional materials. Working with bronze, shagreen, straw marquetry, lacquer and gold leaf, his pieces marry East and West influences with a distinct sculptural presence. Winner of multiple UNESCO Awards for Excellence in Craftsmanship, his work graces prestigious interiors worldwide.",
    notableWorks: "Hammered Bowls (UNESCO Award), Brancusi Spiral Table, River Ledge Credenza, Agata Cabinet, Lune Mirrors",
    notableWorksLink: { text: "Corteza Console Table | Natural Distress", galleryIndex: 19 },
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
    id: "bina-baitel",
    name: "Bina Baitel",
    specialty: "Product Design & Sculptural Objects",
    image: binaBAitelImg,
    biography: "Bina Baitel Studio creates interior and industrial design projects as well as unique creations in collaboration with museums and galleries. The Paris-based studio conducts a global creative approach ranging from artistic direction to technical studies, with a constant focus on timeless projects and a search for innovation. Bina Baitel's work has been exhibited at the Grand Palais, Milan Design Week, and leading design galleries worldwide.",
    notableWorks: "Sublime Collection (Mobilier National), Design Objects for Galleries and Museums",
    philosophy: "Design is always about finding the right balance between tradition and innovation, between the handmade and the industrial.",
    curatorPicks: [
      {
        image: binaBAitelObject,
        title: "Sculptural Vessel",
        subtitle: "Collectible Edition",
        category: "Decorative Object",
        tags: ["Decorative Object", "Vessel"],
        materials: "Unglazed ceramic — hand-built",
        dimensions: "H35 × W25 cm (approx.)",
        description: "This sculptural vessel by Bina Baitel exemplifies her practice of exploring the boundary between design and fine art. Hand-built in unglazed ceramic, its flowing organic form combines classical technique with a distinctly contemporary sensibility."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/binabaitelstudio/" },
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
    curatorPicks: [
      {
        image: brunoDeMaistreLyricDesk,
        title: "Lyric",
        subtitle: "Writing Desk",
        category: "Tables",
        tags: ["Tables", "Desk"],
        materials: "Ebonized oak with straw marquetry inlay",
        dimensions: "L140 × W70 × H76 cm",
        description: "Bruno de Maistre's Lyric desk is a poetic meditation on the art of writing. Its surface of intricate straw marquetry inlay brings warmth and craft to a form of understated elegance — a piece conceived as much for contemplation as for work."
      },
    ],
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
    id: "entrelacs-creation",
    name: "Yves Macheret - Entrelacs Creation",
    specialty: "Bronze Lighting & Artisan Foundry",
    image: yvesMacheretImg,
    biography:
      "Founded by the Macheret family in central France, Entrelacs is an artisan foundry where bronze and alabaster—materials inherited from the origins of our world—are crafted into timeless, pared-down expressions. Yves Macheret, who has been running the foundry with his brother Paul since 2015, trained alongside his father to master all techniques of bronze work: modelling, mould-making, casting, chasing, and patination. His vision to create minimal lighting designs at accessible prices has naturally steered him towards a timeless aesthetic that fully expresses the beauty and simplicity of these noble materials.",
    notableWorks: "Bronze & Alabaster Lighting Collection, Martell Wall Lamp",
    notableWorksLink: { text: "Martell Wall Lamp", galleryIndex: 12 },
    philosophy: "Revealing the beauty and simplicity of bronze, making exceptional craftsmanship accessible while honoring a heritage passed down from father to son.",
    curatorPicks: [
      { 
        image: yvesMacheretPick1, 
        title: "Ghost",
        subtitle: "Wall Lamp",
        category: "Lighting",
        tags: ["Lighting", "Wall Lamp"],
        materials: "Patinated bronze • Hand-carved alabaster diffuser",
        dimensions: "H57 × W13 × D6 cm",
        description: "The Ghost wall lamp distils the art of bronze lighting to its purest expression. Cast in patinated bronze with a hand-carved alabaster diffuser, its slender, almost ethereal silhouette seems to float against the wall—hence its name. Designed by Yves Macheret, it embodies the Entrelacs philosophy: revealing the inherent beauty of noble materials through restrained, timeless forms."
      },
      { 
        image: yvesMacheretPick2, 
        title: "Nomad 295",
        subtitle: "Table Lamp",
        category: "Lighting",
        tags: ["Lighting", "Table Lamp"],
        materials: "Patinated bronze base • Natural alabaster shade",
        dimensions: "H29.5 × Ø16.9 cm",
        description: "Compact yet sculptural, the Nomad 295 is a portable table lamp that pairs a patinated cast-bronze base with a natural alabaster shade. Its dimmable light, adjusted by a simple knob, casts a warm, diffused glow through the veined stone. Available in three heights, the Nomad collection is designed to move effortlessly from room to room—a nomadic light rooted in artisan tradition."
      },
      { 
        image: yvesMacheretPick3, 
        title: "Toast",
        subtitle: "Wall Lamp",
        category: "Lighting",
        tags: ["Lighting", "Wall Lamp"],
        materials: "Patinated brass • Hand-carved alabaster",
        dimensions: "H57 × W11 × D8 cm",
        description: "The Toast wall lamp celebrates the warmth of patinated brass paired with hand-carved alabaster. Its gently rounded form evokes a raised glass—a quiet gesture of conviviality. Crafted entirely by hand at the Entrelacs foundry in central France, each piece carries the subtle variations that distinguish true artisan work from industrial production."
      },
      { 
        image: yvesMacheretPick4, 
        title: "Braun 650",
        subtitle: "Wall Lamp",
        category: "Lighting",
        tags: ["Lighting", "Wall Lamp"],
        materials: "Patinated bronze • Hand-carved alabaster diffuser",
        dimensions: "H65 × W11.5 × D6.2 cm",
        description: "The Braun 650 is a vertical wall lamp whose clean, elongated lines recall the rigour of mid-century industrial design. Cast in patinated bronze with an alabaster diffuser, it projects a soft, ambient light that accentuates the natural veining of the stone. Designed by Yves Macheret, it is fitted with a replaceable LED module for lasting, sustainable use."
      },
      {
        image: yvesMacheretPickHublo,
        title: "Hublot 600",
        subtitle: "Mirror",
        category: "Lighting",
        tags: ["Lighting", "Mirror"],
        materials: "Patinated bronze • Alabaster diffuser",
        dimensions: "Ø60 × D3 cm",
        description: "The Hublot is a luminous mirror inspired by the porthole motif. Hand-cast in patinated bronze with a hand-carved alabaster diffuser, it combines lighting and reflection in a single sculptural object. Available in multiple bronze patinas and alabaster vein options, it is dimmable and IP44 rated."
      },
      {
        image: yvesMacheretPickConsole1925,
        title: "Console 1925",
        category: "Tables",
        tags: ["Tables", "Console"],
        materials: "Patinated cast bronze • Calacatta Oro marble",
        dimensions: "L160 × D35 × H81 cm",
        description: "Designed by Arnaud Leman for Entrelacs, the Console 1925 is a refined tribute to early twentieth-century decorative arts. Its slender cast-bronze frame supports a Calacatta Oro marble top, blending structural elegance with the warmth and weight of natural stone. Also available in custom sizes and alternative marble finishes."
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/entrelacs_lightings" },
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
    notableWorksLink: { text: "Chairie dining chair", galleryIndex: 2 },
    philosophy: "A piece of furniture needs to exude silence so it can be loved for a long time.",
    curatorPicks: [
      {
        image: "",
        title: "Chairie",
        subtitle: "Dining Chair",
        category: "Seating",
        tags: ["Seating", "Dining Chair"],
        materials: "Patinated bronze — solid cast",
        dimensions: "H90 × W55 × D55 cm",
        description: "Éric Schmitt's Chairie is a patinated bronze dining chair of extraordinary sculptural presence. Cast entirely in solid bronze, its organic flowing form softens the material's inherent weight, creating a piece that is simultaneously monumental and intimate."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/studio_eric_schmitt_/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "felix-agostini",
    name: "Felix Agostini - Charles Paris",
    specialty: "Figural Bronze Lighting & Decorative Objects",
    image: felixAgostiniImg,
    biography: "Felix Agostini is a mid-twentieth century French designer renowned for his highly refined figural bronze lighting, created under the Charles Paris imprint. Working primarily in the 1950s and 1960s, his Grande Caryatide sconces and candelabra draw on the classical tradition of architectural figural sculpture while expressing a distinctly French post-war elegance. His pieces are now highly sought after by collectors and museums worldwide.",
    notableWorks: "Grande Caryatide Sconce (Charles Paris), Figural Bronze Candelabra, Table Lamps",
    philosophy: "The figure has always been at the heart of decorative art — my work honors that tradition with modern sensibility.",
    curatorPicks: [
      {
        image: felixAgostiniCaryatide,
        title: "Grande Caryatide",
        subtitle: "Wall Sconce — Charles Paris",
        category: "Lighting",
        materials: "Patinated gilded bronze — hand-cast",
        dimensions: "H70 × W35 × D20 cm",
        description: "The Grande Caryatide is Felix Agostini's most iconic creation — a wall sconce featuring a full-figure female caryatid in patinated gilded bronze. Each piece is hand-cast and finished, representing the pinnacle of mid-century French decorative bronzework."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/maisoncharlesparis/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "robicara",
    name: "Francesco Caracciolo di Marano - Robicara",
    specialty: "Italian-crafted Luxury Furniture",
    image: robicaraImg,
    biography: "Robicara was founded by Sam Robin, an interior architect, and Francesco Caracciolo, an Italian furniture designer — a transatlantic creative partnership uniting her flair for bespoke residential interiors with his deep expertise in Italian luxury furniture manufacturing. The brand combines the finest Italian craftsmanship with a modern aesthetic sensibility, producing pieces that express sophisticated restraint through exceptional materials and precision construction.",
    notableWorks: "Sira Credenza (Maison Affluency), Dama Coffee Table, CS1 Sofa Collection",
    notableWorksLink: { text: "Sira Credenza", galleryIndex: 1 },
    philosophy: "We believe true luxury lies in the integrity of craft — in the quality of materials and the precision of execution.",
    curatorPicks: [
      {
        image: robicaraArmchair,
        title: "Roxi Chair",
        category: "Seating",
        tags: ["Seating", "Armchairs"],
        materials: "Bronze patinated feet • Fabric upholstered",
        dimensions: "W 86.4 × D 92.7 × H 78.7 cm — Seat H 40.6 cm — COM 6.4 M",
        description: "The Roxi Chair combines sculptural bronze patinated feet with generous fabric upholstery, offering a refined balance of material contrast and comfort."
      },
      {
        image: robicaraSiraCredenza,
        title: "Sira Credenza",
        subtitle: "5 Doors",
        category: "Storage",
        tags: ["Storage", "Sideboards"],
        materials: "Patinated metal legs • Wood panels • Marble top",
        dimensions: "W 213.4 × D 48.2 × H 81.1 cm (5 doors) — Also available: W 172.4 × D 48.2 × H 81.1 cm (4 doors) · W 340.2 × D 48.2 × H 76.0 cm (6 doors)",
        description: "The Sira Credenza pairs sculptural patinated metal legs with richly grained wood panel doors and a dramatic marble top. Available in 4, 5, or 6-door configurations to suit any scale of interior."
      },
      {
        image: robicaraHighbackChair,
        title: "RC Club Chair",
        subtitle: "Limited Edition 23 of 23",
        category: "Seating",
        tags: ["Seating", "Limited Edition"],
        materials: "Brass legs • Hand-worked fabric with reproduction of Gregory Robin's Primordial Vibration Painting",
        dimensions: "W 86.4 × D 86.4 × H 103.9 cm",
        description: "A rare limited edition of 23 pieces — each chair is a wearable painting, its fabric hand-worked to reproduce Gregory Robin's Primordial Vibration, an abstract canvas of layered pigment and movement. Mounted on polished brass legs, the RC Club Chair stands as a singular intersection of furniture and fine art."
      },
      {
        image: robicaraSiraNightstand,
        title: "Sira Nightstand",
        subtitle: "",
        category: "Storage",
        tags: ["Storage", "Nightstands"],
        materials: "Solid metal patina • Laser-cut solid metal decorative handles • Interiors and door in special metal liquid lacquer or wood",
        dimensions: "SIN30 W 76 × D 45.7 × H 55.8 cm · SIN42 W 106.5 × D 45.7 × H 60.8 cm · SIN50 W 126.8 × D 55.8 × H 76 cm",
        description: "The Sira Nightstand is defined by its precision-cut solid metal handles and a body finished in a rich metal liquid lacquer or wood. Available in three sizes — SIN30, SIN42, and SIN50 — each version maintains the same refined material language while scaling elegantly to suit the room."
      },
      {
        image: robicaraMarbleTable,
        title: "Enzo Side Table",
        subtitle: "",
        category: "Tables",
        tags: ["Tables", "Side Tables"],
        materials: "Sculptural marble or wood top • Metal patina support • Available in all Robicara metal finishes",
        dimensions: "ENZ26 W 65.9 × D 40.6 × H 50.7 cm",
        description: "A symphony of sculptural marble or wood, the Enzo Side Table pairs a richly veined or grained top with a refined metal patina support. Available in the full range of Robicara metal finishes, each piece is a unique dialogue between natural material and artisanal metalwork."
      },
      {
        image: robicaraMartiniTable,
        title: "Ara Side Table",
        subtitle: "",
        category: "Tables",
        tags: ["Tables", "Side Tables"],
        materials: "Moulded shagreen liquid metal • Bronzed finish • Fiber",
        dimensions: "ARA20 D 50.8 × H 91.3 cm · ARA23 D 60 × H 60 cm",
        description: "The Ara Side Table is a study in material transformation — moulded shagreen liquid metal takes on the texture and depth of natural hide, finished in a warm bronzed patina over a fiber-reinforced form. Available in two proportions, from a slender tall pedestal to a more generous low table."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/robicaradesign/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "forest-giaconia",
    name: "Forest & Giaconia",
    specialty: "Contemporary Furniture & Lighting Design",
    image: forestGiaconiaImg,
    biography: "Forest & Giaconia is a French design duo known for their refined approach to contemporary furniture and lighting. Their work combines natural materials — notably walnut wood — with innovative technical elements such as PMMA, resulting in pieces of sculptural clarity and tactile warmth. The IHI Floor Lamp exemplifies their ability to create objects that are simultaneously minimal and deeply considered.",
    notableWorks: "IHI Floor Lamp (walnut & PMMA), Contemporary Furniture Collection",
    notableWorksLink: { text: "BOB Armchair - Delcourt Collection", galleryIndex: 5 },
    philosophy: "We design objects that inhabit space with quiet presence — functional forms that reward close attention.",
    curatorPicks: [
      {
        image: forestGiaconiaIhiLamp,
        title: "IHI - Delcourt Collection",
        subtitle: "Floor Lamp",
        category: "Lighting",
        tags: ["Lighting", "Floor Lamp"],
        materials: "Walnut wood • PMMA",
        dimensions: "40 × 40 × H187 cm",
        description: "The IHI Floor Lamp by Forest & Giaconia pairs the natural warmth of solid walnut with a PMMA diffuser to create a striking yet understated floor lamp. Its precise geometry and material contrast make it a standout piece in any interior."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/forest.giaconia/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "garnier-linker",
    name: "Garnier & Linker",
    specialty: "Lost-Wax Crystal & Sculptural Glass Objects",
    image: garnierLinkerImg,
    biography: "Guillaume Garnier and Florent Linker are two French creators based in Paris. Their work is about giving a contemporary design to rare materials and savoir-faire. All pieces are handmade in small series by French master craftsmen. As designers, they draw inspiration from both decorative arts and sculpture to create pure-shaped forms that reveal their materiality. With their background in interior design, they offer objects that are as comfortable in a gallery as in a private home.",
    notableWorks: "Lost-Wax Crystal Centerpiece for Théorème Éditions (Maison Affluency), Sculptural Crystal Vessels",
    notableWorksLink: { text: "Crystal Centerpiece - Théorème Editions", galleryIndex: 1 },
    philosophy: "Crystal is the most unforgiving of materials — it demands complete mastery and rewards it with unmatched luminosity.",
    curatorPicks: [
      {
        image: garnierLinkerCenterpiece,
        category: "Decorative Object",
        title: "Lost-Wax Crystal Centerpiece",
        subtitle: "For Théorème Éditions",
        materials: "Lost-wax cast crystal",
        dimensions: "Diameter 30 cm",
        tags: ["Decorative Object"],
        description: "This extraordinary centerpiece was created by Garnier & Linker for Théorème Éditions using the ancient lost-wax casting technique applied to crystal — a remarkable technical feat that results in a piece of unsurpassed clarity and precision. Each piece is unique, bearing the subtle marks of the hand that shaped it.",
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/garnieretlinker/" },
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
    curatorPicks: [
      {
        image: herveVdsMicmac,
        title: "MicMac",
        subtitle: "Chandelier",
        category: "Lighting",
        tags: ["Lighting", "Chandelier"],
        materials: "Patinated bronze • Frosted glass globes",
        dimensions: "Ø80 × H70 cm (approx.)",
        description: "The MicMac chandelier is Hervé van der Straeten's most celebrated lighting design — an explosion of bronze branches tipped with frosted glass globes that recalls both organic growth and haute couture jewelry. Each piece is hand-crafted at his Paris atelier."
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/hervevanderstraetengalerie" },
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
    curatorPicks: [
      {
        image: jmfStool1934,
        title: "Stool",
        subtitle: "1934 — with Adolphe Chanaux",
        category: "Seating",
        tags: ["Seating", "Stool"],
        materials: "Parchment-covered wood • Brass sabots",
        dimensions: "H45 × Ø35 cm",
        description: "Jean-Michel Frank's 1934 stool, created in collaboration with Adolphe Chanaux, is among the most iconic pieces of the Art Deco period. Covered in natural parchment and finished with brass sabots, its understated luxury encapsulates Frank's revolutionary philosophy: that refined simplicity is the highest form of elegance. Now produced under Écart Paris reissue."
      },
    ],
    links: [
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "jeremy-maxwell-wintrebert",
    name: "Jeremy Maxwell Wintrebert",
    specialty: "Freehand Glassblown Lights & Sculptures",
    image: jeremyMaxwellWintrebertImg,
    biography:
      "Born in Paris and raised in Western Africa, Jeremy Maxwell Wintrebert is a glass artist of French and North American heritage who established JMW Studio in 2015 beneath the historic Viaduc des Arts in Paris. After apprenticing with masters including Dale Chihuly in Seattle and Davide Salvadore in Venice, he developed his signature freehand glassblowing technique. Winner of the 2019 Prix Bettencourt pour l'Intelligence de la Main, his work graces the collections of the Victoria & Albert Museum, Palais de Tokyo, and MusVerre.",
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
    id: "kerstens",
    name: "Andy Kerstens",
    displayName: "Kerstens",
    specialty: "Architectural Furniture & Objects",
    image: kerstensImg,
    biography: "Kerstens is a multidisciplinary design studio founded by Andy Kerstens in Antwerp, Belgium, in 2015. A graduate of the University of Antwerp in interior architecture, Andy Kerstens combines a thorough architectural design language with a passion for craftsmanship and the atmospheric qualities of materials. The studio's work spans furniture, objects and interiors — always defined by aesthetic purity, refined proportion and true artisan quality.",
    notableWorks: "Stone & Steel Console, Architectural Furniture Collection",
    philosophy: "We strive for a refined, timeless and architectural approach, with a desire for craftsmanship and affinity for the atmospheric — creating pieces that improve with age.",
    curatorPicks: [
      {
        image: kertensPick1,
        title: "Mono Collection",
        subtitle: "Available in White Onyx, Grand Antique Marble, Muschel Type 'S' and Brown Travertine",
        category: "Tables",
        tags: ["Tables"],
        materials: "",
        dimensions: "",
        description: ""
      },
      {
        image: kertensPick2,
        title: "Mono STS",
        subtitle: "Brown Travertine",
        category: "Tables",
        tags: ["Tables", "Side Table", "open edition + 1 CP + 3 AP"],
        materials: "Available in White Onyx, Grand Antique Marble, Muschel Type 'S'",
        dimensions: "42 × 32 × H 44 cm — 75 kg",
        description: ""
      },
      {
        image: kertensPick3,
        title: "Mono CLS",
        subtitle: "Grand Antique Marble",
        category: "Tables",
        tags: ["Tables", "Console", "Open edition + 1 AP"],
        materials: "",
        dimensions: "160 × 42 × H 80 cm — 383 kg",
        description: ""
      },
      {
        image: kertensPick4,
        title: "Rift CTW",
        subtitle: "Ebonised oak",
        category: "Tables",
        tags: ["Tables", "Coffee Table", "open edition + 1 AP"],
        materials: "",
        dimensions: "180 × 82 × H 28 cm",
        description: ""
      },
      {
        image: kertensPick5,
        title: "Rift CTS",
        subtitle: "White washed oak, brown travertine",
        category: "Tables",
        tags: ["Tables", "Open Edition + 2 AP"],
        materials: "",
        dimensions: "",
        description: ""
      },
      {
        image: kertensPick6,
        title: "Yoma CLW",
        subtitle: "Bleach Oak, Patinated Bronze, Brown Travertine",
        category: "Storage",
        tags: ["Storage", "Cabinet", "limited edition of 20 + 1 CP + 1 AP"],
        materials: "",
        dimensions: "255 × 70 × H 100 cm — 810 kg",
        description: ""
      },
      {
        image: kertensPick7,
        title: "Yoma CLW (Details)",
        subtitle: "Bleach Oak, Patinated Bronze, Brown Travertine",
        category: "Storage",
        tags: ["Storage", "Cabinet", "limited edition of 20 + 1 CP + 1 AP"],
        materials: "",
        dimensions: "255 × 70 × H 100 cm — 810 kg",
        description: ""
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/_kerstens/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "leo-aerts-alinea",
    name: "Léo Aerts - Alinea Design Objects",
    specialty: "Stone Furniture & Design Objects",
    image: leoAertsAlineaImg,
    biography: "Léo Aerts is a Belgian designer and the founder of Alinea Design Objects, a studio renowned for its mastery of natural stone and its ability to transform one of the earth's oldest materials into contemporary design objects of exceptional refinement. Each piece is conceived as a sculptural statement: monolithic yet precise, elemental yet deeply considered. Working closely with Belgian and Italian quarries, Aerts selects his stones for their geological character, ensuring that every table, shelf and object carries the unique signature of its material. His Angelo series has earned international recognition for its fusion of natural stone with solid American walnut.",
    notableWorks: "Angelo M/R Dining Table, Angelo M Side Table Collection, Angelo W Limited Edition, Visible M Horizontal Display Cabinet, Twin Chair",
    philosophy: "Stone is the slowest material on earth. That patience is what I bring to every design.",
    curatorPicks: [
      {
        image: leoAertsAngeloMCollection,
        title: "Angelo M/R 130",
        subtitle: "Dining Table + Twin Indoor Leather Seat",
        category: "Tables",
        tags: ["Tables", "Dining Table"],
        materials: "Natural stone top & base • Solid American walnut",
        dimensions: "Angelo M/R 130: Ø 130 × 75 cm H — Twin Indoor: 52 × 51 × 74 cm H",
        description: "The Angelo M/R 130 dining table is Léo Aerts' most celebrated work — a circular form in natural stone whose monolithic presence is softened by precise joinery and the warmth of solid American walnut. Shown here with the Twin Indoor Leather Seat."
      },
      {
        image: leoAertsAngeloMDining,
        title: "Angelo M Side Table Collection",
        subtitle: "Three Heights",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Natural stone • Solid American walnut",
        dimensions: "Angelo M/SR 45: Ø 45 × 62 cm H — Angelo M/SR 55: Ø 55 × 48 cm H — Angelo M/SR 80: Ø 80 × 36 cm H",
        description: "Available in three complementary heights, the Angelo M Side Table Collection offers a family of stone objects that work independently or together — their geological variation making each a unique specimen."
      },
      {
        image: leoAertsVitrineCabinet,
        title: "Visible M Horizontal",
        subtitle: "Display Cabinet",
        category: "Storage",
        tags: ["Storage", "Cabinet"],
        materials: "Natural stone • Solid walnut",
        dimensions: "Custom dimensions available",
        description: "The Visible M Horizontal display cabinet is a study in material honesty — its stone surfaces and walnut structure creating a piece that showcases objects as beautifully as it stores them."
      },
      {
        image: leoAertsOutdoorChair,
        title: "Twin Chair",
        subtitle: "Outdoor",
        category: "Seating",
        tags: ["Seating", "Chair", "Outdoor"],
        materials: "Weather-resistant materials • Stone base",
        dimensions: "W52 × D55 × H76 cm",
        description: "The Twin Outdoor Chair extends Alinea's material sensibility to the exterior — its robust construction and considered proportions making it as much at home on a terrace as in an interior."
      },
      {
        image: leoAertsTwinChairOutdoor,
        title: "Twin Chair",
        subtitle: "Indoor Detail",
        category: "Seating",
        tags: ["Seating", "Chair"],
        materials: "Natural stone base • Upholstered seat",
        dimensions: "W52 × D55 × H76 cm",
        description: "A detail view of the Twin Indoor Chair reveals the quality of Alinea's stonework — the precise cuts, the geological variation, the weight of material that grounds every piece."
      },
      {
        image: leoAertsAngeloMMacassar,
        title: "Angelo W",
        subtitle: "Limited Edition of 7",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Macassar ebony veneer • Natural stone",
        dimensions: "Custom",
        description: "The Angelo W is a strictly limited edition of seven pieces — its Macassar ebony veneer surface paired with a natural stone base to create a collectible of extraordinary rarity and beauty."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/alinea.design.objects/" },
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
    curatorPicks: [
      {
        image: leoSentouPickJBL,
        title: "Fauteuil J.B.L",
        category: "Seating",
        tags: ["Seating", "Armchair"],
        materials: "Bleached & brushed solid oak • Upholstery",
        dimensions: "W70 × H91.5 × D63.9 cm — SH 47 cm",
        description: "The Fauteuil J.B.L takes its inspiration from an elegant yet unusual armchair by Maître Ebeniste Jean Baptiste Lelarge (1743-1802). The design is an echo of classical canons treated in a contemporary manner. Entirely handcrafted by a team of skilled artisans, the original \"ecusson\" back, typical arched armrests and bolsters found in Louis XVI furniture have been simplified, thus becoming sculptural."
      },
      {
        image: leoSentouPickLA,
        title: "Console J.P.D",
        category: "Tables",
        tags: ["Tables", "Console"],
        materials: "Oak • Lacquer",
        dimensions: "W120 × H80 × D45 cm",
        description: "The guéridon and console J.P.D are a contemporary reinterpretation of an 18th-century oval side table by master cabinetmaker Jean-Pierre Dusautoy (mastered in 1779). Entirely handcrafted in oak or lacquered wood, their deceptively simple forms blend historical reference with modern craftsmanship subtly exploring the interplay between structure and surface."
      },
      {
        image: leoSentouPickGJ,
        title: "Chair G.J",
        category: "Seating",
        tags: ["Seating", "Chair"],
        materials: "Cerused oak frame • Cheyenne by Pierre Frey upholstery",
        dimensions: "W45 × H92 × L54 cm",
        description: "Inspired by the works of Maître Ebeniste (master cabinet maker) Jean Baptiste Boulard (1725-1789), the dining chair J.B.B is a contemporary reinterpretation of a montgolfiere shaped base and square back chair; both quintessential motifs of late eighteenth century French design."
      },
      {
        image: leoSentouPickAB,
        title: "Fauteuil A.B",
        category: "Seating",
        tags: ["Seating", "Armchair"],
        materials: "Full upholstery • Solid oak or cast gouged patinated brass feet",
        dimensions: "W90 × H70 × L93 cm",
        description: "The Fauteuil A.B draws inspiration from an elegant \"bergère en gondole,\" crafted by Parisian menuisier Antoine Bonnemain (received master in 1753). Expertly handcrafted in Europe by skilled artisans, this armchair boasts full upholstery and rests on four solid oak or gouged bronze feet. Its signature backrest medallion—an emblem of Louis XVI furniture—has been reinterpreted within the plush upholstery, offering a sculptural, modern tribute to the timeless elegance of French design."
      },
      {
        image: leoSentouPickCS,
        title: "Canapé C.S",
        category: "Seating",
        tags: ["Seating", "Sofa"],
        materials: "Plush upholstery • Oak feet",
        dimensions: "W240–320 × H70 × D95 cm",
        description: "The canapé C.S is a reinterpretation of a canapé droit by master menuisier Jean-Baptiste Claude Sené (1748–1803). Meticulously handcrafted by a team of skilled artisans, its silhouette explores the interplay between straight and curvaceous lines, creating a balanced, contemporary profile."
      },
      {
        image: leoSentouPickLD,
        title: "Fauteuil L.D",
        category: "Seating",
        tags: ["Seating", "Armchair"],
        materials: "Plush upholstery • Oak or bronze feet",
        dimensions: "W90 × H80 × D81 cm",
        description: "The Fauteuil L.D takes its inspiration from an elegant oval bergère by Parisian master menuisier Louis Delanois (1731 - 1792). Made entirely by hand in Europe by a team of skilled artisans, the seat is upholstered in mohair, and rests on a set of four gauged bronze feet. The original medallion and arm bolsters found in classical Louis XVI furniture, have been simplified as part of the armchairs plush upholstery, thus becoming a sculptural contemporary echo of what over two centuries has come to define the iconic French style."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/leosentou" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "kira",
    name: "Roman Frankel - Made in Kira",
    specialty: "Hand-crafted Ceramic Lamps & Objects",
    image: kiraImg,
    biography: "Kira is primarily the expression, in a character object, of an identity and a history, that of a child of Japan in search of a fair balance. In the subtlety of a line and the intensity of a color, Roman Akira Frankel praises the shadow through a collection of lacquered lamps.\n\nFounded in 2022 in Paris, Kira oscillates between tradition and modernity, lightness and depth, design and sculpture, to create objects filled with meaning and significance. Drawing on Japan's aesthetic vocabulary, the collection invites contemplation.",
    notableWorks: "Toshiro Lamp (Maison Affluency), Hand-thrown Ceramic Collection",
    notableWorksLink: { text: "Toshiro Lamp", galleryIndex: 6 },
    philosophy: "Each piece is a unique conversation between the hand, the clay and the fire — no two are ever alike.",
    curatorPicks: [
      {
        image: kiraToshiroLamp,
        title: "Toshiro",
        subtitle: "Ceramic Table Lamp",
        category: "Lighting",
        tags: ["Lighting", "Table Lamp"],
        materials: "Hand-thrown ceramic — custom glaze",
        dimensions: "H60 × Ø30 cm (approx.)",
        description: "The Toshiro is Made in Kira's signature piece — a hand-thrown ceramic table lamp whose layered glazes create rich tonal variations that shift with the light. Every Toshiro is unique, reflecting the particular moment and hand that shaped it."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/madeinkira/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "man-of-parts",
    name: "Man of Parts",
    specialty: "Curated Contemporary Furniture Collections",
    image: manOfPartsImg,
    biography: "Man of Parts is a Hamburg-based design brand founded by Stephan Weishaupt, co-founder of the design magazine Wallpaper*. The brand commissions furniture and objects from leading international designers — including Yabu Pushelberg, Sebastian Herkner, and Osvaldo Tenório — producing pieces of exceptional quality that bridge the gallery and the home. Each collection reflects a distinct design vision united by the pursuit of craft excellence.",
    notableWorks: "Lombard Street Sofa (Yabu Pushelberg), Mainkai Lamp (Sebastian Herkner), Rua Tucumã Tables",
    philosophy: "We believe in furniture made with integrity — pieces conceived by great designers and realized by the best craftspeople in the world.",
    curatorPicks: [
      {
        image: manOfPartsSofa,
        title: "Lombard Street",
        subtitle: "Sofa — Yabu Pushelberg for Man of Parts",
        category: "Seating",
        tags: ["Seating", "Sofa"],
        materials: "Premium upholstery — solid oak legs",
        dimensions: "L270 × D95 × H75 cm (standard)",
        description: "Designed by Yabu Pushelberg for Man of Parts, the Lombard Street sofa combines generous proportions with exceptional upholstery quality. Its clean silhouette and solid oak legs give it an architectural presence suited to the most discerning residential interiors."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/manofparts/" },
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
    notableWorksLink: { text: "Crystalline Vase", galleryIndex: 14 },
    
    philosophy: "Glass is frozen light—my work seeks to capture that ephemeral quality in permanent form.",
    curatorPicks: [
      {
        image: milanPekarCrystalline,
        title: "Crystalline",
        subtitle: "Sculptural Vase",
        category: "Decorative Object",
        tags: ["Decorative Object", "Vessel"],
        materials: "Hand-blown crystalline glass — Bohemian technique",
        dimensions: "H35 × Ø18 cm (approx.)",
        description: "Milan Pekař's Crystalline vases are the result of an extraordinarily demanding glassblowing process that produces spontaneous crystal formations on the surface of the glass. No two pieces are alike — each is a unique collaboration between the artist's hand and the alchemy of fire and mineral."
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/milanpekar_glass" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "nathalie-ziegler",
    name: "Nathalie Ziegler",
    specialty: "Bespoke Glass Art & Chandeliers",
    image: nathalieZieglerImg,
    biography: "Nathalie Ziegler is a French glass artist who creates bespoke chandeliers and glass sculptures that blur the line between functional lighting and fine art. Drawing on traditional Murano and Saint-Just glassmaking techniques, she manipulates light through hand-blown glass to create dramatic, ethereal forms that transform spaces. Her chandeliers and vessels are entirely unique — each a one-of-a-kind commission conceived in close collaboration with her clients.",
    notableWorks: "Saint Just Custom Glass Chandelier (Maison Affluency), Gold Leaves+Glass Snake Vase, Sculptural Glass Lighting",
    notableWorksLink: { text: "Custom Glass Chandelier", galleryIndex: 6 },
    philosophy: "Glass holds light the way memory holds experience — transforming it into something luminous and lasting.",
    curatorPicks: [
      {
        image: nathalieZieglerChandelier,
        title: "Custom Chandelier",
        subtitle: "Bespoke Commission",
        category: "Lighting",
        tags: ["Lighting", "Chandelier"],
        materials: "Hand-blown glass • Custom gold leaf inclusions",
        dimensions: "Bespoke — dimensions upon commission",
        description: "Each chandelier by Nathalie Ziegler is entirely unique, conceived as a bespoke commission. Her signature technique involves hand-blowing individual glass elements that are then assembled into dramatic sculptural compositions, where light plays through amber, gold and translucent tones."
      },
      {
        image: nathalieZieglerSnakeVessel,
        title: "Snake Vessel",
        subtitle: "Gold Leaves + Glass",
        category: "Decorative Object",
        tags: ["Decorative Object", "Vessel"],
        materials: "Hand-blown glass • 24k gold leaf",
        dimensions: "H55 × Ø20 cm (approx.)",
        description: "The Snake Vessel is a signature work by Nathalie Ziegler — a sinuous, hand-blown glass form with 24k gold leaf inclusions that catch and diffuse light in ever-changing ways. Each piece is unique and unrepeatable."
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/nathaliezieglerpasqua" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "noe-duchaufour-lawrance",
    name: "Noé Duchaufour Lawrance",
    specialty: "Organic Furniture & Crystal Design",
    image: noeDuchaufourImg,
    biography: "Noé Duchaufour-Lawrance is a French designer based in Paris known for his organic, biomorphic approach to furniture and objects. His work explores the intersection of natural forms and industrial materials, creating pieces of rare tactile and visual poetry. He has collaborated with Saint-Louis crystal, Bernhardt Design, and leading European manufacturers. His Amber Folio Portable Lamp for Cristallerie Saint-Louis — featured at Maison Affluency — showcases his mastery of translucent materials and organic form.",
    notableWorks: "Amber Folio Portable Lamp for Saint-Louis (Maison Affluency), Refine Console, Steinway Collaboration",
    notableWorksLink: { text: "Amber Folio Lamp for Cristallerie Saint-Louis", galleryIndex: 20 },
    philosophy: "Nature has already designed everything. My role is to find those forms and translate them into objects that resonate with the human hand and eye.",
    curatorPicks: [
      {
        image: noeFolioLamp,
        title: "Folio",
        subtitle: "Portable Lamp — Amber • Cristallerie Saint-Louis",
        category: "Lighting",
        tags: ["Lighting", "Table Lamp"],
        materials: "Mouth-blown amber crystal — Saint-Louis",
        dimensions: "H28 × Ø14 cm",
        description: "Created by Noé Duchaufour-Lawrance for the prestigious Cristallerie Saint-Louis, the Folio portable lamp takes the form of an unfurling leaf in mouth-blown amber crystal. When lit, the amber glass radiates a warm, intimate glow — simultaneously a light source and a sculptural object."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/noeduchaufourlawrance/" },
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
    curatorPicks: [
      {
        image: oliviaCognetVallauris,
        title: "Vallauris",
        subtitle: "Ceramic Floor Lamp",
        category: "Lighting",
        tags: ["Lighting", "Floor Lamp"],
        materials: "Hand-thrown ceramic — custom blue glaze",
        dimensions: "H165 × Ø30 cm (approx.)",
        description: "Olivia Cognet's Vallauris floor lamp in custom blue glazed ceramic is a testament to her search for balance between art and design. Hand-thrown in the tradition of the Vallauris masters — from Picasso to Roger Capron — it transforms a functional object into a sculptural statement."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/olivia_cognet" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "pierre-bonnefille",
    name: "Pierre Bonnefille",
    specialty: "Patinated Surfaces, Paintings & Furniture",
    image: pierreBonnefulleImg,
    biography: "Pierre Bonnefille is a French artist, painter, designer and 'Maître d'Art' — a title awarded by the French Ministry of Culture to masters of exceptional craft. A graduate of École Boulle and École Nationale Supérieure des Arts Décoratifs, he creates his own materials from mineral powder, limestone, lava, marble, earth, natural pigments and metallic powders. His Bronze Paintings are monumental works where material and color become inseparable. His collaboration with Olivier Gagnère on the Café Marly at the Musée du Louvre first brought him widespread international attention.",
    notableWorks: "Bronze Painting 204 (Maison Affluency), Café Marly at the Louvre, Mineral Painting Series",
    notableWorksLink: { text: "Bronze Painting 204", galleryIndex: 8 },
    philosophy: "The material, colors and light are inseparable in my work. I create my own textures from the earth itself.",
    curatorPicks: [
      {
        image: pierreBonnefilleBronzePainting,
        title: "Bronze Painting",
        subtitle: "Mineral pigments on canvas",
        category: "Decorative Object",
        tags: ["Decorative Object", "Art"],
        materials: "Mineral powder, limestone, lava, metallic pigments on canvas",
        dimensions: "Various — bespoke commissions available",
        description: "Pierre Bonnefille's Bronze Paintings are unique works where he creates his own materials from mineral powder, limestone, lava, earth, natural and metallic pigments. The result is a surface of extraordinary depth and luminosity — simultaneously painting, relief and material exploration."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/pierre_bonnefille/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "reda-amalou",
    name: "Reda Amalou",
    specialty: "Architecture & Collectible Furniture Design",
    image: redaAmalouImg,
    biography: "Reda Amalou is a French architect and designer who founded the architectural agency AW2 over 25 years ago with the ambition of transcending the boundaries between architecture and design. A true creator of experiences, his work spans luxury hospitality architecture (Six Senses, Coucoo Cabanes) to collectible furniture editions. His DOT side table — a perfect geometric sphere in lacquered wood — has become one of the most recognized pieces in contemporary French design.",
    notableWorks: "DOT Side Table (Maison Affluency), Eggshell Collection, AW2 Hospitality Projects",
    notableWorksLink: { text: "DOT Side Table", galleryIndex: 12 },
    philosophy: "Architecture and design are the same discipline — both are about creating places that stimulate the mind and mobilize the senses.",
    curatorPicks: [
      {
        image: redaAmalouDotTable,
        title: "DOT",
        subtitle: "Side Table — Eggshell",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Lacquered wood — eggshell finish",
        dimensions: "Ø45 × H45 cm",
        description: "The DOT side table is Reda Amalou's most celebrated design object — a perfect geometric sphere in lacquered wood with an eggshell finish. Its flawless form and tactile surface make it simultaneously a functional table and a sculptural collectible."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/redaamalou/" },
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
    curatorPicks: [
      {
        image: thierryLemaireOrsay,
        title: "Orsay",
        subtitle: "Centre Table — Limited Edition (12 copies)",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Lacquered wood • Solid bronze base",
        dimensions: "L140 × W70 × H35 cm",
        description: "The Orsay Centre Table is Thierry Lemaire's most celebrated collectible design — a sculptural coffee table produced in a strictly limited and numbered edition of 12 copies. Its organic lacquered surface rests on a solid bronze base, embodying his philosophy of transforming functional furniture into lasting works of art."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/thierrylemaire_/?hl=en" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "tristan-auer",
    name: "Tristan Auer",
    specialty: "Interior Architecture & Luxury Furniture",
    image: tristanAuerImg,
    biography: "Tristan Auer is a Paris-based interior architect and designer who trained at ESAG Paris before collaborating with Christian Liaigre and Philippe Starck on landmark international projects. In 2002 he founded his own agency, going on to design the lobbies of leading luxury hotels across Europe. His Veronese furniture collection — produced by the prestigious French manufacturer of the same name — distils his signature aesthetic: architectural rigour, noble materials, and a quietly bold luxury.",
    notableWorks: "Veronese Furniture Collection, Hotel Wilson — Paris, Les Ambassadeurs — Paris",
    notableWorksLink: { text: "YSA Wall Lamp for Véronèse", galleryIndex: 17 },
    philosophy: "Luxury is not about excess. It's about the perfect choice of material, proportion and light — doing more with less.",
    curatorPicks: [
      {
        image: tristanAuerYsaWallLightVeronese,
        title: "YSA Wall Light",
        subtitle: "for Véronèse",
        category: "Lighting",
        tags: ["Lighting", "Wall Lights"],
        materials: "Polished mirror frame • Streaked frosted crystal • Smoked glass with stripe motif • Mirror application glass",
        dimensions: "W40 × D15 × H52 cm",
        description: "The YSA Wall Light for Véronèse by Tristan Auer is an extraordinary essay in Murano glass craftsmanship. Layers of streaked frosted crystal, smoked glass and mirrored glass are held within a polished mirror frame, creating a luminaire of exceptional material depth and luminous complexity."
      },
      {
        image: tristanAuerYsaWallLightH,
        title: "Wall Light H",
        subtitle: "for Pouenat",
        category: "Lighting",
        tags: ["Lighting", "Wall Lights"],
        materials: "Patinated steel • Alabaster",
        dimensions: "L21 × P9 × H50 cm",
        description: "The Wall Light H for Pouenat is designed by Tristan Auer, combining patinated steel with sculpted alabaster to create a luminaire of quiet architectural power. The alabaster diffuses light with a warm, mineral glow that speaks to Auer's mastery of material and proportion."
      },
      {
        image: tristanAuerPedestalSuzanne,
        title: "Pedestal Suzanne",
        subtitle: "for Pouenat",
        category: "Tables",
        tags: ["Tables", "Side Tables"],
        materials: "Mirror-polished stainless steel • Copper • Copper tray • Turquoise patinated brass",
        dimensions: "L70 × P60 × H63 cm",
        description: "The Pedestal Suzanne for Pouenat by Tristan Auer is a tour de force in material contrasts — mirror-polished stainless steel meets a weathered copper surface and turquoise patinated brass accents. The result is a side table of sculptural boldness, where industrial precision and artisanal oxidation coexist."
      },
      {
        image: tristanAuerTableLampH,
        title: "Table Lamp H",
        subtitle: "for Pouenat",
        category: "Lighting",
        tags: ["Lighting", "Table Lamps"],
        materials: "Patinated steel • Copper leaf hammered steel • Alabaster",
        dimensions: "L28 × P18 × H50 cm",
        description: "The Table Lamp H for Pouenat by Tristan Auer marries patinated steel with copper leaf hammered steel and alabaster diffusers, creating a luminaire of rare material depth. When lit, the alabaster emits a warm glow that highlights the textured copper interior — a sculptural object as much as a light source."
      },
      {
        image: tristanAuerTeeFloorLamp,
        title: "Tee Floor Lamp",
        subtitle: "for Pouenat",
        category: "Lighting",
        tags: ["Lighting", "Limited Edition 16/100"],
        materials: "Brushed brass • Marble • Scala silk lamp shade",
        dimensions: "D50 × H170 cm",
        description: "The Tee Floor Lamp for Pouenat by Tristan Auer is a limited edition piece (16/100) that combines brushed brass, sculptural marble and a custom Scala silk shade. Its refined material layering — warm brass base, tactile marble column, crisp silk shade — embodies Auer's philosophy of doing more with less."
      },
      {
        image: tristanAuerEclipseWallLight,
        title: "Eclipse Wall Light",
        subtitle: "for Pouenat — 100/30/31/32/33",
        category: "Lighting",
        tags: ["Lighting", "Wall Lights"],
        materials: "Gunmetal patinated steel • Shiny varnish",
        dimensions: "L27 × P9 × H27 cm",
        description: "The Eclipse Wall Light for Pouenat by Tristan Auer is a sculptural study in circular geometry — a brushed copper disc framing a deep painted steel recess. Its minimal, planetary form generates a warm, grazing light that animates the wall surface with shadow and material depth."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/tristanauer/" },
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
  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openDesigners, setOpenDesigners] = useState<string[]>([]);
  const [curatorPicksDesigner, setCuratorPicksDesigner] = useState<typeof featuredDesigners[0] | null>(null);
  const [curatorPickIndex, setCuratorPickIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  // Listen for category filter from navigation
  useEffect(() => {
    const handleDesignerCategory = (e: CustomEvent) => {
      const { category, subcategory } = e.detail || {};
      setSelectedCategory(category || null);
      setSelectedSubcategory(subcategory || null);
    };
    window.addEventListener('setDesignerCategory', handleDesignerCategory as EventListener);
    return () => window.removeEventListener('setDesignerCategory', handleDesignerCategory as EventListener);
  }, []);

  // Fixed category order
  const CATEGORY_ORDER = ["Seating", "Tables", "Lighting", "Storage", "Rugs", "Décor"];

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
      // Normalize accents so "Eric" matches "Éric", "ateliers" matches "Ateliers", etc.
      const normalize = (s: string) =>
        s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const query = normalize(searchQuery.trim());
      // Escape special regex characters in the query, then match whole words only
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordRegex = new RegExp(`\\b${escapedQuery}`, "i");
      const matchesWord = (s: string) => wordRegex.test(normalize(s));
      designers = designers.filter(
        (designer) =>
          matchesWord(designer.name) ||
          matchesWord(designer.specialty) ||
          (designer.biography && matchesWord(designer.biography)) ||
          (designer.notableWorks && matchesWord(designer.notableWorks)) ||
          designer.curatorPicks?.some((pick: any) =>
            pick.tags?.some((tag: string) => matchesWord(tag)) ||
            (pick.title && matchesWord(pick.title)) ||
            (pick.subtitle && matchesWord(pick.subtitle)) ||
            (pick.description && matchesWord(pick.description))
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

  // Group filtered designers by first letter for A-Z navigation
  const designerAlphaGroups = useMemo(() => {
    const groups: Record<string, typeof filteredDesigners> = {};
    filteredDesigners.forEach(d => {
      const letter = d.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(d);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredDesigners]);

  const activeLetters = useMemo(() => designerAlphaGroups.map(([l]) => l), [designerAlphaGroups]);

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
          <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-2">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground">
              Designers & Makers
            </h2>
          </div>
          {/* A-Z alphabet jump bar + Search + Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
            <div
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-background/90 backdrop-blur-md border border-border/40 rounded-full shadow-sm overflow-x-auto"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {activeLetters.map((letter) => (
                <button
                  key={letter}
                  onClick={() => {
                    const el = document.getElementById(`designer-alpha-${letter}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="flex-none font-serif text-xs md:text-sm leading-none px-2 py-1 rounded-full transition-all duration-200 text-foreground/60 hover:text-primary hover:bg-primary/10 cursor-pointer"
                >
                  {letter}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by designer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 h-9 text-sm bg-background/90 backdrop-blur-md border-border/40 rounded-full focus:border-primary/60 font-body"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-primary transition-colors relative flex-none flex items-center gap-1.5" aria-label="Filter">
                  <SlidersHorizontal className="h-5 w-5" />
                  <span className="text-xs font-body uppercase tracking-wider">Filter</span>
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
                  {selectedCategory && (
                    <button
                      onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); }}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Clear
                    </button>
                  )}
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
          <p className="text-base md:text-lg text-muted-foreground font-body max-w-3xl">
            Discover the visionary designers and artisans whose exceptional work defines Maison Affluency. Each brings
            their unique perspective and masterful craftsmanship to create pieces that transcend ordinary furniture.
          </p>
        </motion.div>

        {(searchQuery || selectedCategory) && (
          <p className="text-left text-[10px] text-muted-foreground/50 mb-4 font-body tracking-wider">
            {filteredDesigners.length} designer{filteredDesigners.length !== 1 ? 's' : ''} found
            {selectedSubcategory && <span> · {selectedSubcategory}</span>}
            {selectedCategory && !selectedSubcategory && <span> · {selectedCategory}</span>}
          </p>
        )}

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
            {designerAlphaGroups.map(([letter, designers]) => (
              <div key={letter}>
                <div id={`designer-alpha-${letter}`} className="scroll-mt-32 pt-4 pb-2">
                  <span className="font-serif text-lg text-foreground/30">{letter}</span>
                </div>
                {designers.map((designer, index) => (
              <AccordionItem
                key={designer.id}
                value={designer.id}
                id={`designer-${designer.id}`}
                data-designer={designer.id}
                className="border border-border/40 rounded-lg px-4 md:px-6 bg-card/30 hover:bg-card/50 transition-colors duration-300 scroll-mt-16"
              >
                <AccordionTrigger className="hover:no-underline py-4 md:py-6 group active:scale-[0.99] touch-manipulation">
                  <div className="flex items-center gap-4 md:gap-6 text-left w-full">
                    {designer.image ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <div
                          className="relative flex-shrink-0 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage({ name: designer.name, image: designer.image! });
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
                            src={selectedImage?.image || designer.image!}
                            alt={selectedImage?.name || designer.name}
                            className="w-full h-auto rounded-lg object-contain"
                          />
                          <p className="text-center mt-4 text-lg font-serif text-foreground">
                            {designer.founder || selectedImage?.name || designer.name}
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                    ) : (
                    <div className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-full bg-muted ring-2 ring-border/40 flex items-center justify-center">
                      <span className="text-2xl font-serif text-muted-foreground">{designer.name.charAt(0)}</span>
                    </div>
                    )}
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
                            <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 24 24" fill="none" stroke="url(#instagram-gradient-name)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                          {(designer as any).displayName || designer.name}
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
                                onClick={() => {
                                  // Filter curator picks by active subcategory/category
                                  let filteredPicks = designer.curatorPicks || [];
                                  if (selectedSubcategory) {
                                    filteredPicks = filteredPicks.filter((pick: any) => pick.tags?.includes(selectedSubcategory));
                                  } else if (selectedCategory) {
                                    filteredPicks = filteredPicks.filter((pick: any) => pick.tags?.includes(selectedCategory));
                                  }
                                  if (filteredPicks.length > 0) {
                                    setCuratorPicksDesigner({ ...designer, curatorPicks: filteredPicks } as any);
                                  } else {
                                    setCuratorPicksDesigner(designer);
                                  }
                                  setCuratorPickIndex(0);
                                }}
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
              </div>
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
              setIsZoomed(false);
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

                  {/* Image container */}
                  <div className={`flex flex-col items-center justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 ${isZoomed ? 'max-h-[95vh] pb-4' : 'max-h-[85vh] pb-4'}`}>
                    <div className="relative">
                      {!isZoomed && ((curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.category || ((curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.tags?.length > 0)) && (
                        <div className="text-center mb-2 flex flex-wrap gap-1.5 justify-center">
                          {((curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.tags?.length > 0 ? (curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.tags : [(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.category]).map((tag: string, i: number) => (
                            <span key={i} className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="relative inline-block">
                        {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.image && (
                          <img 
                            src={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.image} 
                            alt={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title} 
                            className={`object-contain select-none transition-all duration-300 ${isZoomed ? 'max-h-[88vh] max-w-[90vw]' : 'max-w-full max-h-[55vh]'}`}
                            draggable={false}
                          />
                        )}
                        {/* Maximize/Minimize icon — clickable, top-right */}
                        <button
                          onClick={() => setIsZoomed(!isZoomed)}
                          className="absolute bottom-2 right-2 z-10 bg-black/40 backdrop-blur-sm p-1.5 rounded-full hover:bg-black/60 transition-colors cursor-pointer"
                          aria-label={isZoomed ? "Minimize image" : "Maximize image"}
                        >
                          {isZoomed
                            ? <Minimize2 className="w-3.5 h-3.5 text-white" />
                            : <Maximize2 className="w-3.5 h-3.5 text-white" />
                          }
                        </button>
                      </div>
                    </div>

                    {/* Scroll dots — directly under the image */}
                    {curatorPicksDesigner.curatorPicks.length > 1 && !isZoomed && (
                      <div className="flex items-center gap-2 mt-3">
                        {curatorPicksDesigner.curatorPicks.map((_, idx) => (
                          <button
                            key={idx}
                            aria-label={`Go to image ${idx + 1}`}
                            onClick={() => { setCuratorPickIndex(idx); setIsZoomed(false); }}
                            className={`rounded-full transition-all duration-300 ${
                              curatorPickIndex === idx
                                ? 'w-4 h-2 bg-white'
                                : 'w-2 h-2 bg-white/30 hover:bg-white/60'
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    <div className={`mt-3 text-center transition-all duration-300 ${isZoomed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                      <h3 className="text-sm md:text-base font-serif text-white mb-1">
                        {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title}
                        {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.subtitle && (
                          <span className="font-serif"> {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any).subtitle}</span>
                        )}
                      </h3>
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.materials && (
                        <p className="text-white/60 font-body text-xs md:text-sm mb-1">{curatorPicksDesigner.curatorPicks[curatorPickIndex].materials}</p>
                      )}
                      {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.dimensions && (
                        <div className="mt-2 max-w-xl space-y-1 mx-auto text-center">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.dimensions && (
                            <p className="text-xs md:text-sm text-white/40 font-body italic">
                              {curatorPicksDesigner.curatorPicks[curatorPickIndex].dimensions}
                            </p>
                          )}
                          {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.description && (
                            <p className="text-xs md:text-sm text-white/50 font-body leading-relaxed max-w-lg mt-2 mx-auto text-center">
                              {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any).description}
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
                              <img src={pick.image} alt={pick.title} className="w-full h-full object-cover" />
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
