import { motion } from "framer-motion";
import { useInView, AnimatePresence } from "framer-motion";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Search, X, Instagram, ExternalLink, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Gem, Maximize2, Minimize2, Share2, FileDown } from "lucide-react";
import PinchZoomImage from "./PinchZoomImage";
import { trackCTA } from "@/lib/analytics";
import { scrollToSection } from "@/lib/scrollToSection";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { shareProfileOnWhatsApp } from "@/lib/whatsapp-share";
import WhatsAppShareButton from "./WhatsAppShareButton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
const alexanderLamontBg = cloudinaryUrl("alexander-lamont-bg_prdpsy", { width: 1200, quality: "auto:good", crop: "fill" });
const leoAertsBg = cloudinaryUrl("leo-aerts-alinea-bg_x89hrq", { width: 1200, quality: "auto:good", crop: "fill" });
const apparatusBg = cloudinaryUrl("apparatus-studio-bg_wzakjr", { width: 1200, quality: "auto:good", crop: "fill" });
const atelierFevrierBg = cloudinaryUrl("atelier-fevrier-bg_tmsgw9", { width: 1200, quality: "auto:good", crop: "fill" });
const atelierDemichelisBg = cloudinaryUrl("atelier-demichelis-bg_w8b8f7", { width: 1200, quality: "auto:good", crop: "fill" });
const emmanuelBabledBg = cloudinaryUrl("Screen_Shot_2025-12-12_at_2.16.52_PM_ueecf1", { width: 1200, quality: "auto:good", crop: "fill" });
const brunoDeMaistreBg = cloudinaryUrl("bruno-de-maistre-bg_fiazyy", { width: 1200, quality: "auto:good", crop: "fill" });
const celsoDeLemosBg = cloudinaryUrl("celso-de-lemos-bg_mokwng", { width: 1200, quality: "auto:good", crop: "fill" });
const delaEspadaBg = cloudinaryUrl("de-la-espada-bg_tkqcuu", { width: 1200, quality: "auto:good", crop: "fill" });
const damienLangloisMeurinneBg = cloudinaryUrl("damien-langlois-meurinne-bg_gmicja", { width: 1200, quality: "auto:good", crop: "fill" });
const berntPetersenBg = cloudinaryUrl("bernt-petersen-bg_t4rnoj", { width: 1200, quality: "auto:good", crop: "fill" });
const erstensBg = cloudinaryUrl("kerstens-bg_y065ji", { width: 1200, quality: "auto:good", crop: "fill" });
const ccTapisBg = cloudinaryUrl("cc-tapis-bg_gacubc", { width: 1200, quality: "auto:good", crop: "fill" });
const cristallerieSaintLouisBg = cloudinaryUrl("cristallerie-saint-louis-bg_gkrrzp", { width: 1200, quality: "auto:good", crop: "fill" });
const delcourtBg = cloudinaryUrl("delcourt-bg_whop7p", { width: 1200, quality: "auto:good", crop: "fill" });
const ecartParisBg = cloudinaryUrl("ecart-paris-bg_av3tqr", { width: 1200, quality: "auto:good", crop: "fill" });
const entrelacsBg = cloudinaryUrl("entrelacs-bg_ec6ks7", { width: 1200, quality: "auto:good", crop: "fill" });
const garnierLinkerBg = cloudinaryUrl("garnier-linker-bg", { width: 1200, quality: "auto:good", crop: "fill" });
const haymannEditionsBg = cloudinaryUrl("haymann-editions-bg", { width: 1200, quality: "auto:good", crop: "fill" });
const kiraBg = cloudinaryUrl("kira-bg_xjzhue", { width: 1200, quality: "auto:good", crop: "fill" });
const okhaBg = cloudinaryUrl("okha-bg_zdmkil", { width: 1200, quality: "auto:good", crop: "fill" });
const cazesConquetBg = cloudinaryUrl("cazes-conquet-bg_b6lzhk", { width: 1200, quality: "auto:good", crop: "fill" });
const hamreiBg = cloudinaryUrl("hamrei-bg_jpaq7k", { width: 1200, quality: "auto:good", crop: "fill" });
const ikselBg = cloudinaryUrl("iksel-bg_ihsm0u", { width: 1200, quality: "auto:good", crop: "fill" });
const kikoLopezBg = cloudinaryUrl("Screen_Shot_2025-12-12_at_1.08.35_AM_qv22mw", { width: 1200, quality: "auto:good", crop: "fill" });
const leoSentouBg = cloudinaryUrl("leo-sentou-bg_pf0dkl", { width: 1200, quality: "auto:good", crop: "fill" });
const manOfPartsBg = cloudinaryUrl("man-of-parts-bg_trrhzi", { width: 1200, quality: "auto:good", crop: "fill" });
const takayokayaBg = cloudinaryUrl("takayokaya-bg_j0lliw", { width: 1200, quality: "auto:good", crop: "fill" });
const theoremeEditionsBg = cloudinaryUrl("theoreme-editions-bg_blriy3", { width: 1200, quality: "auto:good", crop: "fill" });
const thierryLemaireBg = cloudinaryUrl("thierry-lemaire-bg_xsf0yz", { width: 1200, quality: "auto:good", crop: "fill" });
const sergeMouilleBg = cloudinaryUrl("serge-mouille-bg_cdd04d", { width: 1200, quality: "auto:good", crop: "fill" });
const robicaraBg = cloudinaryUrl("robicara-bg_nzeadp", { width: 1200, quality: "auto:good", crop: "fill" });
const peterReedBg = cloudinaryUrl("peter-reed-bg_pj2qzu", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleBg = cloudinaryUrl("pierre-bonnefille-bg_ltfqd6", { width: 1200, quality: "auto:good", crop: "fill" });
const pinton1867Bg = cloudinaryUrl("pinton-1867-bg_pa0cjy", { width: 1200, quality: "auto:good", crop: "fill" });
const ericSchmittBg = cloudinaryUrl("eric-schmitt-bg_zle4xe", { width: 1200, quality: "auto:good", crop: "fill" });
const jindrichHalabalaBg = cloudinaryUrl("jindrich-halabala-bg_pn3yfz", { width: 1200, quality: "auto:good", crop: "fill" });
const oliviaCognetBg = cloudinaryUrl("olivia-cognet-bg_dpv8v2", { width: 1200, quality: "auto:good", crop: "fill" });
const ooummBg = cloudinaryUrl("ooumm-bg_nopn7v", { width: 1200, quality: "auto:good", crop: "fill" });
const matthieuGicquelBg = cloudinaryUrl("matthieu-gicquel-bg_l1lciq", { width: 1200, quality: "auto:good", crop: "fill" });
const poltronaFrauBg = cloudinaryUrl("poltrona-frau-bg_xnbfep", { width: 1200, quality: "auto:good", crop: "fill" });
const nathalieZieglerBg = cloudinaryUrl("nathalie-ziegler-bg_ypvltb", { width: 1200, quality: "auto:good", crop: "fill" });
const seCollectionsBg = cloudinaryUrl("se-collections-bg_t6crfo", { width: 1200, quality: "auto:good", crop: "fill" });
const maisonWecraftBg = cloudinaryUrl("maison-wecraft-bg_nsa7fm", { width: 1200, quality: "auto:good", crop: "fill" });
const herveVanDerStraetenBg = cloudinaryUrl("herve-van-der-straeten-bg_titrht", { width: 1200, quality: "auto:good", crop: "fill" });
const pouenatBg = cloudinaryUrl("pouenat-bg_lw3dlo", { width: 1200, quality: "auto:good", crop: "fill" });
const valeriaNascimentoBg = cloudinaryUrl("valeria-nascimento-bg_zca4dy", { width: 1200, quality: "auto:good", crop: "fill" });
const simonCabrolBg = cloudinaryUrl("simon-cabrol-bg_dxky1d", { width: 1200, quality: "auto:good", crop: "fill" });
const andreePutmanBg = cloudinaryUrl("andree-putman-bg_uwufym", { width: 1200, quality: "auto:good", crop: "fill" });
const noomBg = cloudinaryUrl("noom-bg_xjqbb7", { width: 1200, quality: "auto:good", crop: "fill" });
const nicolasAubagnacBg = cloudinaryUrl("nicolas-aubagnac-bg_nt81k3", { width: 1200, quality: "auto:good", crop: "fill" });
const ozoneLightBg = cloudinaryUrl("ozone-light-bg_v2zneb", { width: 1200, quality: "auto:good", crop: "fill" });
const collectionParticuliereBg = cloudinaryUrl("collection-particuliere-bg_hn4jiq", { width: 1200, quality: "auto:good", crop: "fill" });
const biekeCasteleynBg = cloudinaryUrl("bieke-casteleyn-bg_wuhwso", { width: 1200, quality: "auto:good", crop: "fill" });
const galerieMcdeBg = cloudinaryUrl("galerie-mcde-bg_fxxdp6", { width: 1200, quality: "auto:good", crop: "fill" });
const gillesBoissierBg = cloudinaryUrl("gilles-boissier-bg", { width: 1200, quality: "auto:good", crop: "fill" });
const jacobHashimotoBg = cloudinaryUrl("Screen_Shot_2026-02-23_at_9.21.31_AM_ifnvmk", { width: 1200, quality: "auto:good", crop: "fill" });
const paulCocksedgeBg = cloudinaryUrl("paul-cocksedge-bg_bfw68x", { width: 1200, quality: "auto:good", crop: "fill" });
const leBerreVevaudBg = cloudinaryUrl("Screen_Shot_2026-02-23_at_9.40.24_AM_nfyg7z", { width: 1200, quality: "auto:good", crop: "fill" });
const binaBaitelBg = cloudinaryUrl("bina-baitel-bg_u0rbnn", { width: 1200, quality: "auto:good", crop: "fill" });
const charlesParisBg = cloudinaryUrl("Screen_Shot_2026-02-23_at_10.02.17_AM_tnml24", { width: 1200, quality: "auto:good", crop: "fill" });
const victoriaMagniantBg = cloudinaryUrl("victoria-magniant-bg_mykadv", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreYovanovitchBg = cloudinaryUrl("pierre-yovanovitch-bg_ctngfd", { width: 1200, quality: "auto:good", crop: "fill" });
const brunoMoinardBg = cloudinaryUrl("bruno-moinard-bg_c4qu9o", { width: 1200, quality: "auto:good", crop: "fill" });
const noeDuchaufourBg = cloudinaryUrl("noe-duchaufour-lawrance", { width: 1200, quality: "auto:good", crop: "fill" });
const ndlEditionsBg = cloudinaryUrl("ndl-editions-bg_mtpvnb", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreAugustinRoseBg = cloudinaryUrl("pierre-augustin-rose-bg_bgbcws", { width: 1200, quality: "auto:good", crop: "fill" });
const redaAmalouBg = cloudinaryUrl("reda-amalou-bg_phjirf", { width: 1200, quality: "auto:good", crop: "fill" });
const homLeXuanBg = cloudinaryUrl("hom-le-xuan-bg_q45eaa", { width: 1200, quality: "auto:good", crop: "fill" });
const frederiqueRobWhittleBg = cloudinaryUrl("frederique-rob-whittle-bg_arue3i", { width: 1200, quality: "auto:good", crop: "fill" });
const martinMasseBg = cloudinaryUrl("martin-masse-bg_js1sx7", { width: 1200, quality: "auto:good", crop: "fill" });
const mernoeBg = cloudinaryUrl("mernoe-bg_c9nn4i", { width: 1200, quality: "auto:good", crop: "fill" });
const paulinPaulinPaulinBg = cloudinaryUrl("paulin-paulin-paulin-bg_xjxo4m", { width: 1200, quality: "auto:good", crop: "fill" });
const stephaneCgBg = cloudinaryUrl("stephane-cg-bg_fgisjs", { width: 1200, quality: "auto:good", crop: "fill" });
const andreaClaireBg = cloudinaryUrl("andrea-claire-studio-bg_p9ukpu", { width: 1200, quality: "auto:good", crop: "fill" });
const michelAmarBg = cloudinaryUrl("michel-amar-studio-bg_e4da8t", { width: 1200, quality: "auto:good", crop: "fill" });
const arredoluceBg = cloudinaryUrl("arredoluce-bg_uqv7ky", { width: 1200, quality: "auto:good", crop: "fill" });
const articoloStudiosBg = cloudinaryUrl("articolo-studios-bg_b1pj4o", { width: 1200, quality: "auto:good", crop: "fill" });
const basedUponBg = cloudinaryUrl("based-upon-bg_lftlhi", { width: 1200, quality: "auto:good", crop: "fill" });
const bryanOSullivanBg = cloudinaryUrl("bryan-osullivan-bg_jpk9d9", { width: 1200, quality: "auto:good", crop: "fill" });
const christopherBootsBg = cloudinaryUrl("christopher-boots-bg_h9vynr", { width: 1200, quality: "auto:good", crop: "fill" });
const lostProfileStudioBg = cloudinaryUrl("lost-profile-studio-bg_rmah5n", { width: 1200, quality: "auto:good", crop: "fill" });
const okurayamaStudioBg = cloudinaryUrl("okurayama-studio-bg_b1l8zy", { width: 1200, quality: "auto:good", crop: "fill" });
const overgaardDyrmanBg = cloudinaryUrl("Screen_Shot_2026-02-24_at_10.27.57_PM_het6co", { width: 1200, quality: "auto:good", crop: "fill" });
const stephaneParmentierBg = cloudinaryUrl("stephane-parmentier-bg_al1rkj", { width: 1200, quality: "auto:good", crop: "fill" });
const privatiselectionemBg = cloudinaryUrl("privatiselectionem-bg_qn3lgz", { width: 1200, quality: "auto:good", crop: "fill" });
const achilleSalvagniBg = cloudinaryUrl("achille-salvagni-atelier-bg", { width: 1200, quality: "auto:good", crop: "fill" });
const valerieRostaingBg = cloudinaryUrl("valerie-rostaing-bg_y7qe57", { width: 1200, quality: "auto:good", crop: "fill" });
const mmairoBg = cloudinaryUrl("Screen_Shot_2026-02-25_at_3.10.53_AM_cuc62s", { width: 1200, quality: "auto:good", crop: "fill" });
const lobjetBg = cloudinaryUrl("Screen_Shot_2026-02-25_at_3.14.39_AM_jodm2a", { width: 1200, quality: "auto:good", crop: "fill" });
const osannaViscontiBg = cloudinaryUrl("Screen_Shot_2026-02-25_at_3.25.23_AM_psgxsu", { width: 1200, quality: "auto:good", crop: "fill" });
const laChanceParisBg = cloudinaryUrl("Screen_Shot_2026-02-25_at_3.18.38_AM_nkx1t6", { width: 1200, quality: "auto:good", crop: "fill" });
const tacchiniBg = cloudinaryUrl("Screen_Shot_2026-02-25_at_9.06.23_PM_ixc2yu", { width: 1200, quality: "auto:good", crop: "fill" });
const refractoryStudioBg = cloudinaryUrl("Screen_Shot_2026-02-25_at_9.09.20_PM_jm34g1", { width: 1200, quality: "auto:good", crop: "fill" });
const martaSalaEditionsBg = cloudinaryUrl("Screen_Shot_2026-02-26_at_7.44.59_AM_xqirha", { width: 1200, quality: "auto:good", crop: "fill" });

// Stéphane CG Curators' Picks images
const stephaneCgOrsay = cloudinaryUrl("PHOTO-2023-09-14-13-51-05_1_iyi99i", { width: 1200, quality: "auto:good", crop: "fill" });
const stephaneCgLouvre = cloudinaryUrl("PHOTO-2023-09-14-13-51-02_egaxpk", { width: 1200, quality: "auto:good", crop: "fill" });
const stephaneCgWingedVictory = cloudinaryUrl("PHOTO-2023-09-14-13-51-00_cjed3b", { width: 1200, quality: "auto:good", crop: "fill" });
const stephaneCgMiro = cloudinaryUrl("PHOTO-2023-09-14-13-51-14_qvzgzq", { width: 1200, quality: "auto:good", crop: "fill" });
const stephaneCgEyeTiger = cloudinaryUrl("Screen_Shot_2026-02-26_at_4.25.47_PM_bgjowh", { width: 1200, quality: "auto:good", crop: "fill" });
const stephaneCgSkyFreeze = cloudinaryUrl("Screen_Shot_2026-02-24_at_9.41.12_PM_lqqibv", { width: 1200, quality: "auto:good", crop: "fill" });
const stephaneCgHallway = cloudinaryUrl("Screen_Shot_2026-02-24_at_9.42.54_PM_v5mquk", { width: 1200, quality: "auto:good", crop: "fill" });

// Marta Sala Éditions Curators' Picks images (Cloudinary)
const martaSalaLaviana = cloudinaryUrl("Screen_Shot_2026-02-26_at_8.09.48_AM_saz2sv", { width: 1200, quality: "auto:good", crop: "fill" });
const martaSalaVelazquez = cloudinaryUrl("Screen_Shot_2026-02-26_at_8.09.20_AM_cm62ud", { width: 1200, quality: "auto:good", crop: "fill" });
const martaSalaRanieri = cloudinaryUrl("Screen_Shot_2026-02-26_at_8.04.52_AM_fm0uws", { width: 1200, quality: "auto:good", crop: "fill" });
const martaSalaInge = cloudinaryUrl("Screen_Shot_2026-02-26_at_8.00.51_AM_ypryzi", { width: 1200, quality: "auto:good", crop: "fill" });
const martaSalaAchille = cloudinaryUrl("Screen_Shot_2026-02-26_at_7.56.20_AM_aq4khq", { width: 1200, quality: "auto:good", crop: "fill" });
const martaSalaElisabeth = cloudinaryUrl("Screen_Shot_2026-02-26_at_7.51.46_AM_vnvbwi", { width: 1200, quality: "auto:good", crop: "fill" });
const martaSalaMurena = cloudinaryUrl("Screen_Shot_2026-02-26_at_7.48.51_AM_e0yej8", { width: 1200, quality: "auto:good", crop: "fill" });

// Ozone Light Curators' Picks image
import ozoneClassiqueV from "@/assets/curators-picks/ozone-classique-v.jpg";
import ozoneBrasiliaPl from "@/assets/curators-picks/ozone-brasilia-pl.jpg";

// Atelier-only Curators' Picks data (for brands not in FeaturedDesigners or Collectibles)
const atelierOnlyPicks: Record<string, { name: string; curatorPicks: CuratorPick[] }> = {
  "stephane-cg": {
    name: "Stéphane CG",
    curatorPicks: [
      {
        image: stephaneCgOrsay,
        title: "Orsay Abstract",
        subtitle: "Diasec on Aluminium",
        tags: ["Photography", "Abstract"],
        materials: "Multi-exposure photograph\nDiasec mount on aluminium",
        dimensions: "Various sizes available\nBespoke Dimensions upon request",
      },
      {
        image: stephaneCgLouvre,
        title: "Louvre: Passion and Artistry",
        subtitle: "Diasec on Aluminium",
        tags: ["Photography", "Abstract"],
        materials: "Multi-exposure photograph\nDiasec mount on aluminium",
        dimensions: "Various sizes available\nBespoke Dimensions upon request",
      },
      {
        image: stephaneCgWingedVictory,
        title: "Winged Victory of Samotrace",
        subtitle: "Diasec on Aluminium",
        tags: ["Photography", "Abstract"],
        materials: "Multi-exposure photograph\nDiasec mount on aluminium",
        dimensions: "Various sizes available\nBespoke Dimensions upon request",
      },
      {
        image: stephaneCgMiro,
        title: "Homage to Miro",
        subtitle: "Diasec on Aluminium",
        tags: ["Photography", "Abstract"],
        materials: "Multi-exposure photograph\nDiasec mount on aluminium",
        dimensions: "Various sizes available\nBespoke Dimensions upon request",
      },
      {
        image: stephaneCgEyeTiger,
        title: "Eye of the Tiger",
        subtitle: "Diasec on Aluminium",
        tags: ["Photography", "Wildlife"],
        materials: "Multi-exposure photograph\nDiasec mount on aluminium",
        dimensions: "Various sizes available\nBespoke Dimensions upon request",
      },
      {
        image: stephaneCgSkyFreeze,
        title: "Sky Freeze (Vancouver)",
        subtitle: "Diasec on Aluminium",
        tags: ["Photography", "Landscape"],
        materials: "Multi-exposure photograph\nDiasec mount on aluminium",
        dimensions: "Various sizes available\nBespoke Dimensions upon request",
      },
      {
        image: stephaneCgHallway,
        title: "Hallway to Heaven (Jaipur)",
        subtitle: "Diasec on Aluminium",
        tags: ["Photography", "Architecture"],
        materials: "Multi-exposure photograph\nDiasec mount on aluminium",
        dimensions: "Various sizes available\nBespoke Dimensions upon request",
      },
    ],
  },
  "marta-sala-editions": {
    name: "Marta Sala Éditions",
    curatorPicks: [
      {
        image: martaSalaLaviana,
        title: "Laviana Hexagonal",
        subtitle: "P3 Armchair",
        tags: ["Furniture", "Armchair"],
        materials: "Frame: solid and multilayer wood, elastic belts, upholstery in different densities polyurethane foam\nSlide feet or lacquered solid wood base",
        dimensions: "85 x 85 x H 110 cm\nSH 36 cm",
      },
      {
        image: martaSalaVelazquez,
        title: "Velazquez",
        subtitle: "T13 Side Table",
        tags: ["Furniture", "Side Table"],
        materials: "Canaletto Walnut or Ash Solid Wood",
        dimensions: "W 59,50 x H 40 / 63 cm",
      },
      {
        image: martaSalaRanieri,
        title: "Ranieri",
        subtitle: "T5 Side Table",
        tags: ["Furniture", "Side Table"],
        materials: "Lightened Calacatta 5mm thick gold marble top, stain-resistant treatment\nBrass or Iron Frame",
        dimensions: "Ø 80 x H 60/90/110 cm",
      },
      {
        image: martaSalaInge,
        title: "Inge",
        subtitle: "D3 Sofa",
        tags: ["Furniture", "Sofa"],
        materials: "Solid and multilayer wood, elastic belts Frame\nUpholstery in different densities polyurethane foam\nLacquered back solid wood base\nCompartmentalized feathers with removable cover cushions",
        dimensions: "210 / 270 / 330 / 390 x 69 — H 77 cm\nSH 41 cm",
      },
      {
        image: martaSalaAchille,
        title: "Achille",
        subtitle: "LTA1 Table Lamp",
        tags: ["Lighting", "Table Lamp"],
        materials: "Metal plate, laser-cut and hand-curved Frame\nPolished Calacatta gold marble, bevelled edge Base, stain-resistant treatment\nSilk with PVC lid\nE27 bulb holder",
        dimensions: "Ø 30 x 64 cm\nSilk Shade — H 30 cm",
      },
      {
        image: martaSalaElisabeth,
        title: "Elisabeth",
        subtitle: "D1 Sofa",
        tags: ["Furniture", "Sofa"],
        materials: "Solid and Multilayer Wood, Elastic Belts, Upholstery in different densities polyurethane foam Frame\nLacquered Solid Wood Back Base\nExpanded foam with removable cover Cushions",
        dimensions: "W 160 / 220 / 280 / 340 / 400 x D 110 x H 81 cm\nSH 41 cm",
      },
      {
        image: martaSalaMurena,
        title: "Murena",
        subtitle: "S2 Dining Chair",
        tags: ["Furniture", "Chair"],
        materials: "Metal laser-cut, curved, grind, hand-assembled before final finishing Frame\nSeat: multilayer wood with foam, resinated layer\nCushion: expanded foam with removable cover",
        dimensions: "55 x 51 x H 68 cm\nSH 45 cm",
      },
    ],
  },
  "ozone-light": {
    name: "Ozone Light",
    curatorPicks: [
      {
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1772453277/Screen_Shot_2026-03-02_at_8.07.31_PM_yi3hfp.png",
        title: "CLASSIQUE V",
        subtitle: "Gounot & Jähnke",
        tags: ["Lighting", "Chandelier"],
        materials: "Structures in aluminium and brass, medal bronze, mirror nickel or gun metal finish\nWhite paper diffusing material\n120 × 120 × H 12 cm – 48 kg\nSilhouette: 175 cm\nWarm white 2700K LED lighting, 230W, 11000 Lumens\n\nAvailable in multiple LED options: Warm white LED lighting 2200K, or alternatively 2700K\nOptional Dim to Warm, warm white LED lighting from 1900K (low intensity) to 2500K (high intensity), Integrated 24V converters and drivers, CE Class I",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Maison_Affluency-Classique_V.pdf",
        pdfFilename: "Maison_Affluency-Classique_V.pdf",
      },
      {
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1772452776/Screen_Shot_2026-03-02_at_7.58.48_PM_ncitni.png",
        title: "Brasilia PL",
        subtitle: "Michel Boyer",
        tags: ["Lighting", "Chandelier"],
        materials: "Structures and stem in white lacquered aluminium\nWhite paper diffusing material\n70 × 70 × H 80 cm – 22 kg\nSilhouette: 175 cm\nWarm white 2700K LED lighting, 144W, 6600 Lumens\n\nAvailable in multiple LED options: Warm white LED lighting 2200K, or alternatively 2700K\nOptional Dim to Warm, warm white LED lighting from 1900K (low intensity) to 2500K (high intensity), Integrated 24V converters and drivers, CE Class I",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Maison_Affluency-Brasilia_PL.pdf",
        pdfFilename: "Maison_Affluency-Brasilia_PL.pdf",
      },
      {
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1772452356/Screen_Shot_2026-03-02_at_7.26.56_PM_iyecho.png",
        title: "GÉLULE",
        subtitle: "Joseph Dirand",
        tags: ["Lighting", "Wall Lamp"],
        materials: "Aluminium structure\nPale gold or mirror nickel finish\n40 × 10 × H 13 cm – 4 kg\nSilhouette: 175 cm\nWarm white 2200K LED lighting, 12W, 550 Lumens\n\nAvailable in multiple LED options: Warm white LED lighting 2200K, or alternatively 2700K\nOptional Dim to Warm, warm white LED lighting from 1900K (low intensity) to 2500K (high intensity), Integrated 24V converters and drivers, CE Class I",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Maison_Affluency-Gelule.pdf",
        pdfFilename: "Maison_Affluency-Gelule.pdf",
      },
      {
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1772452374/Screen_Shot_2026-03-02_at_7.52.16_PM_ljyj4g.png",
        title: "TENNESSEE S2",
        subtitle: "Glenn Sestig",
        tags: ["Lighting", "Suspension"],
        materials: "TENNESSEE S2 48 — H 482 × 344 × 72 mm + height of the hanging structure\nTENNESSEE S2 96 — H 962 × 344 × 72 mm + height of the hanging structure\n\nAvailable in multiple LED options: Warm white LED lighting 2200K, or alternatively 2700K\nOptional Dim to Warm, warm white LED lighting from 1900K (low intensity) to 2500K (high intensity), Converter 24V non-integrated, to be placed in a distant box, CE Class III",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Maison_Affluency-Tennessee-S2.pdf",
        pdfFilename: "Maison_Affluency-Tennessee-S2.pdf",
      },
      {
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1772452984/Screen_Shot_2026-03-02_at_8.01.21_PM_m95xmw.png",
        title: "BRASILIA LP",
        subtitle: "Michel Boyer",
        tags: ["Lighting", "Table Lamp"],
        materials: "Brass, aluminium, steel\nLamp base in gloss black or polished stainless steel\nShade structure in white lacquered\nWhite paper diffusing material\n280 × 280 × H 710 mm\n\nAvailable in multiple LED options: Warm white LED lighting 2200K, or alternatively 2700K\nOptional Dim to Warm, warm white LED lighting from 1900K (low intensity) to 2500K (high intensity), Integrated 24V converters and drivers, CE Class I",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Maison_Affluency-Brasilia-LP.pdf",
        pdfFilename: "Maison_Affluency-Brasilia-LP.pdf",
      },
      {
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1772453509/Screen_Shot_2026-03-02_at_8.10.25_PM_rcj8c8.png",
        title: "LINE C",
        subtitle: "Gounot & Jähnke",
        tags: ["Lighting", "Chandelier"],
        materials: "White lacquered aluminum structure\nWhite paper diffusing material\nLINE C — 1450 × 1450 × H 150 mm\nLINE C110 — 1100 × 1100 × H 160 mm\nLINE C90 — 900 × 900 × H 120 mm\n\nAvailable in multiple LED options: Warm white 2200K LED lighting, or alternatively 2700K\nOptional Dim to Warm, warm white LED lighting from 1900K (low intensity) to 2500K (high intensity), Converter 24V non-integrated, to be placed in a distant box, CE Class III",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Maison_Affluency-Line-C.pdf",
        pdfFilename: "Maison_Affluency-Line-C.pdf",
      },
    ],
  },
};

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
    name: "Atelier BdM - Bruno de Maistre",
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
    galleryIndex: 27, // Craftsmanship At Every Corner
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
    galleryIndex: 10, // A Serene Decor
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
    galleryIndex: 8, // A Sophisticated Boudoir
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
    name: "Okha Design Studio",
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
    featured: "Gianfranco Frattini's Albero Bookcase",
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
    id: "mmairo",
    name: "MMairo",
    category: "Furniture",
    subcategory: "Tables",
    origin: "Italy",
    description: "MMairo is an Italian design studio specializing in sculptural furniture and objects crafted from rare natural stones — onyx, alabaster, and marble. Each piece celebrates the inherent beauty and translucency of the material, merging traditional stone-working mastery with bold contemporary forms to create functional works of art.",
    instagram: "https://www.instagram.com/mmairo_design/?hl=en",
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
    galleryIndex: 10, // A Serene Decor in A Personal Sanctuary
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
    id: "la-chance-paris",
    name: "La Chance Paris",
    category: "Furniture",
    subcategory: "Tables",
    origin: "France",
    description: "La Chance is a Parisian design house creating bold, collectible furniture and objects that bridge the gap between art and design. Founded on a spirit of creative daring, the house collaborates with international designers to produce distinctive pieces — from sculptural tables to statement seating — that bring personality and colour to contemporary interiors.",
    instagram: "https://www.instagram.com/lachance_paris/?hl=en",
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
    id: "lobjet",
    name: "L'Objet",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "L'Objet is a luxury design house founded by Elad Yifrach, creating exquisite tableware, home décor, and fragrances that blend artisanal craftsmanship with bold sculptural vision. Each piece — from porcelain to 24k gold-plated objets — is conceived as a work of art, elevating everyday rituals into extraordinary experiences.",
    instagram: "https://www.instagram.com/lobjet",
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
  {
    id: "frederique-rob-whittle",
    name: "Frédérique and Rob Whittle",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "Franco-British artistic duo specialising in monumental sculptural plasterwork, creating breathtaking bas-relief murals that transform architectural surfaces into immersive narrative landscapes inspired by nature and mythology.",
    instagram: "https://www.instagram.com/frederiqueetrobwhittle/?hl=en",
  },
  {
    id: "martin-masse",
    name: "Martin Massé",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "French sculptor and designer working with stone and mineral aggregates to create monumental organic forms, transforming raw geological materials into refined collectible pieces that celebrate the beauty of natural textures.",
    instagram: "https://www.instagram.com/martin_masse_/",
  },
  {
    id: "mernoe",
    name: "Mernøe",
    category: "Lighting",
    subcategory: "Pendant Lights",
    origin: "Denmark",
    description: "Danish lighting atelier crafting refined pendant and table lamps in warm natural materials — wood, brass and copper — that embody Scandinavian simplicity with exceptional artisanal quality.",
    featured: "N1 Pendant",
    instagram: "https://www.instagram.com/mernoelighting/?hl=en",
    galleryIndex: 19, // A Workspace of Distinction
  },
  {
    id: "paulin-paulin-paulin",
    name: "Paulin Paulin Paulin",
    category: "Seating",
    subcategory: "Sofas & Loveseats",
    seatType: "Sofas & Loveseats",
    origin: "France",
    description: "Custodians of Pierre Paulin's legendary design legacy, producing authorised re-editions and limited series of his iconic sculptural seating — celebrating one of the 20th century's most visionary French furniture designers.",
    instagram: "https://www.instagram.com/paulinpaulinpaulin/?hl=en",
  },
  {
    id: "stephane-cg",
    name: "Stéphane CG",
    category: "Art",
    subcategory: "Photography",
    origin: "France",
    description: "French abstract photographer whose multi-exposure Diasec works transform iconic landmarks and natural landscapes into mesmerising, painterly compositions — blurring the line between photography and fine art.",
    featured: "Orsay Abstract Diasec",
    instagram: "https://www.instagram.com/stephcgart/?hl=en",
    galleryIndex: 1, // A Sophisticated Living Room
  },
  {
    id: "andrea-claire-studio",
    name: "Andrea Claire Studio",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "United States",
    description: "Andrea Claire Studio creates hand-sculpted ceramic vessels, objects and lighting that celebrate organic form and tactile materiality — each unique piece embodies a refined, wabi-sabi sensibility rooted in craft and contemporary design.",
    instagram: "https://www.instagram.com/andreaclairestudio/?hl=en",
  },
  {
    id: "michel-amar-studio",
    name: "Michel Amar Studio",
    category: "Interior Design",
    subcategory: "Architecture & Interiors",
    origin: "France",
    description: "Michel Amar Studio is a Paris-based interior architecture practice renowned for its bold, sculptural approach to luxury residential and hospitality interiors — blending contemporary minimalism with dramatic material contrasts and bespoke craftsmanship.",
    instagram: "https://www.instagram.com/michel_amar/?hl=en",
  },
  {
    id: "arredoluce",
    name: "Arredoluce",
    category: "Lighting",
    subcategory: "Lighting",
    origin: "Italy",
    description: "Founded by Angelo Lelii in 1943 in Monza, Arredoluce is an iconic Italian lighting manufacturer celebrated for its mid-century modern masterpieces — combining sculptural brass forms with opaline glass to create timeless fixtures that defined an era of Italian design excellence.",
    instagram: "https://www.instagram.com/angelolelii/?hl=en",
  },
  {
    id: "articolo-studios",
    name: "Articolo Studios",
    category: "Lighting",
    subcategory: "Lighting",
    origin: "Australia",
    description: "Articolo Studios is a Melbourne-based lighting design house crafting refined, architectural luminaires — known for their minimalist silhouettes, premium materials like hand-blown glass and solid brass, and a quiet sophistication that elevates contemporary interiors.",
    instagram: "https://www.instagram.com/articolostudios/",
  },
  {
    id: "based-upon",
    name: "Based Upon",
    category: "Sculptural Furniture",
    subcategory: "Tables & Sculpture",
    origin: "United Kingdom",
    description: "Based Upon is a London-based studio creating sculptural furniture and art objects that fuse organic forms with precious materials — their fluid bronze and marble pieces blur the boundary between functional design and fine art.",
    instagram: "https://www.instagram.com/basedupon",
  },
  {
    id: "bryan-osullivan-studio",
    name: "Bryan O'Sullivan Studio",
    category: "Interior Design",
    subcategory: "Architecture & Interiors",
    origin: "Ireland / United Kingdom",
    description: "Bryan O'Sullivan Studio is a London and Dublin-based interior design practice known for richly layered, maximalist interiors that marry bold colour, sumptuous textures, and collectible design with a refined sense of warmth and theatricality.",
    instagram: "https://www.instagram.com/bryanosullivancollection/?hl=en",
  },
  {
    id: "christopher-boots",
    name: "Christopher Boots",
    category: "Lighting",
    subcategory: "Lighting",
    origin: "Australia",
    description: "Christopher Boots is a Melbourne-based lighting designer celebrated for his sculptural chandeliers and pendants that fuse raw natural materials — crystal, marble, and alabaster — with hand-forged metalwork, creating dramatic luminaires that bridge the organic and the architectural.",
    instagram: "https://www.instagram.com/christopherboots/",
  },
  {
    id: "lost-profile-studio",
    name: "Lost Profile Studio",
    category: "Lighting",
    subcategory: "Lighting & Sculpture",
    origin: "United Kingdom",
    description: "Lost Profile Studio creates sculptural lighting and objects that explore the interplay of light, form, and materiality — combining hand-worked alabaster, bronze, and glass into striking pieces that feel both ancient and thoroughly contemporary.",
    instagram: "https://www.instagram.com/lost_profile_studio/?hl=en",
  },
  {
    id: "okurayama-studio",
    name: "Okurayama Studio",
    category: "Sculptural Furniture",
    subcategory: "Sculpture & Furniture",
    origin: "Japan",
    description: "Okurayama Studio is a Japanese design practice creating monumental stone sculptures and furniture that draw from the primal power of natural landscapes — their raw, elemental works evoke ancient standing stones and celebrate the beauty of unrefined materiality.",
    instagram: "https://www.instagram.com/okurayamastudio.design/?hl=en",
  },
  {
    id: "osanna-visconti",
    name: "Osanna Visconti",
    category: "Furniture",
    subcategory: "Sculptural Furniture",
    origin: "Italy",
    description: "Osanna Visconti is an Italian sculptor and designer whose work in bronze transforms organic forms — branches, bamboo, coral — into extraordinary functional pieces. Her hand-cast consoles, screens, and tables blur the boundary between sculpture and furniture, each piece a celebration of nature's geometry rendered in precious metal.",
    instagram: "https://www.instagram.com/osannavisconti/?hl=en",
  },
  {
    id: "overgaard-dyrman",
    name: "Overgaard & Dyrman",
    category: "Furniture",
    subcategory: "Seating & Tables",
    origin: "Denmark",
    description: "Overgaard & Dyrman is a Danish design studio crafting precision-engineered furniture that merges traditional metalwork and leather craftsmanship with modernist sensibility — their iconic Circle Dining Chair exemplifies their mastery of sculptural form and material refinement.",
    instagram: "https://www.instagram.com/overgaard_dyrman/?hl=en",
  },
  {
    id: "stephane-parmentier",
    name: "Stéphane Parmentier",
    category: "Furniture",
    subcategory: "Tables & Seating",
    origin: "France",
    description: "Stéphane Parmentier is a Paris-based designer and artistic director creating refined furniture and objects that blend luxurious materials — leather, bronze, marble, and rare stones — with bold, architectural silhouettes rooted in a sophisticated modernist vocabulary.",
    instagram: "https://www.instagram.com/stephaneparmentier/?hl=en",
  },
  {
    id: "privatiselectionem",
    name: "Privatiselectionem",
    category: "Furniture",
    subcategory: "Tables & Objects",
    origin: "Belgium",
    description: "Privatiselectionem is a Belgian design studio creating sculptural furniture and objects defined by organic, free-form silhouettes — their work in bronze, stone, and rare materials transforms functional pieces into bold, collectible art statements.",
    instagram: "https://www.instagram.com/privatiselectionem/?hl=en",
  },
  {
    id: "achille-salvagni-atelier",
    name: "Achille Salvagni Atelier",
    category: "Lighting",
    subcategory: "Decorative Objects",
    origin: "Italy",
    description: "Achille Salvagni Atelier is a Rome-based design studio led by architect and designer Achille Salvagni, creating sculptural furniture, lighting and objects of extraordinary craftsmanship. His work draws from classical Roman forms and Baroque drama, reinterpreted through a contemporary lens with precious materials — bronze, onyx, rock crystal — resulting in pieces that are collected by the world's most discerning interiors.",
    instagram: "https://www.instagram.com/atelierachillesalvagni/",
  },
  {
    id: "valerie-rostaing",
    name: "Valérie Rostaing",
    category: "Decorative Object",
    subcategory: "Decorative Objects",
    origin: "France",
    description: "Valérie Rostaing is a Paris-based designer known for her sculptural furniture and objects that balance poetic sensibility with material experimentation. Her work — spanning ceramics, bronze, and mixed media — inhabits a space between functional design and fine art, creating pieces of quiet intensity and timeless elegance.",
    instagram: "https://www.instagram.com/valerie_rostaing/",
    photoCredit: "Olivier Marceny",
  },
  {
    id: "pierre-augustin-rose",
    name: "Pierre Augustin Rose",
    category: "Furniture",
    subcategory: "Tables",
    origin: "France",
    description: "Pierre Augustin Rose is a French design studio creating sculptural furniture defined by organic silhouettes, generous curves and a masterful interplay of natural materials — wood, stone and linen — resulting in pieces that feel both monumental and intimately refined.",
    instagram: "https://www.instagram.com/pierre_augustin_rose/",
  },
  {
    id: "tacchini",
    name: "Tacchini",
    category: "Furniture",
    subcategory: "Seating & Sofas",
    origin: "Italy",
    description: "Tacchini Italia is a Milan-based furniture house renowned for its sculptural upholstered seating that balances Italian craft tradition with contemporary design vision. Collaborating with leading international designers, Tacchini creates iconic sofas, armchairs and lounge pieces defined by generous volumes, refined tailoring and an enduring sense of comfort.",
    instagram: "https://www.instagram.com/tacchini_italia/?hl=en",
  },
  {
    id: "refractory-studio",
    name: "Refractory Studio",
    category: "Lighting",
    subcategory: "Pendant Lighting",
    origin: "International",
    description: "Refractory Studio is a design practice creating handcrafted lighting pieces that celebrate the raw beauty of hammered metals and artisanal glass. Their sculptural pendants and fixtures combine ancient metalworking techniques with contemporary form, producing luminaires of striking presence and material honesty.",
    instagram: "https://www.instagram.com/refractory.studio/",
  },
  {
    id: "marta-sala-editions",
    name: "Marta Sala Éditions",
    category: "Furniture",
    subcategory: "Seating & Tables",
    origin: "Italy",
    description: "Marta Sala Éditions is a Milan-based publishing house of collectible furniture founded by Marta Sala Noseda, championing the intersection of art, architecture and design. Each limited-edition piece is conceived with leading architects and designers, crafted by master Italian artisans using noble materials — from hand-patinated metals to richly upholstered volumes — resulting in furnishings of sculptural presence and enduring elegance.",
    instagram: "https://www.instagram.com/martasalaeditions/?hl=en",
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
  "Atelier BdM - Bruno de Maistre": brunoDeMaistreBg,
  "Bina Baitel Studio": binaBaitelBg,
  "Celso de Lemos": celsoDeLemosBg,
  
  "Garnier & Linker": garnierLinkerBg,
  "Haymann Editions": haymannEditionsBg,
  "Made in Kira": kiraBg,
  "Okha Design Studio": okhaBg,
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
  "NDL Editions": ndlEditionsBg,
  "Hom Le Xuan": homLeXuanBg,
  "Frédérique and Rob Whittle": frederiqueRobWhittleBg,
  "Martin Massé": martinMasseBg,
  "Mernøe": mernoeBg,
  "Paulin Paulin Paulin": paulinPaulinPaulinBg,
  "Stéphane CG": stephaneCgBg,
  "Andrea Claire Studio": andreaClaireBg,
  "Michel Amar Studio": michelAmarBg,
  "Arredoluce": arredoluceBg,
  "Articolo Studios": articoloStudiosBg,
  "Based Upon": basedUponBg,
  "Bryan O'Sullivan Studio": bryanOSullivanBg,
  "Christopher Boots": christopherBootsBg,
  "Lost Profile Studio": lostProfileStudioBg,
  "Okurayama Studio": okurayamaStudioBg,
  "Overgaard & Dyrman": overgaardDyrmanBg,
  "Stéphane Parmentier": stephaneParmentierBg,
  "Privatiselectionem": privatiselectionemBg,
  "Achille Salvagni Atelier": achilleSalvagniBg,
  "Valérie Rostaing": valerieRostaingBg,
  "MMairo": mmairoBg,
  "L'Objet": lobjetBg,
  "La Chance Paris": laChanceParisBg,
  "Osanna Visconti": osannaViscontiBg,
  "Pierre Augustin Rose": pierreAugustinRoseBg,
  "Tacchini": tacchiniBg,
  "Refractory Studio": refractoryStudioBg,
  "Marta Sala Éditions": martaSalaEditionsBg,
};

// Mapping from consolidated brand names to FeaturedDesigners IDs for Curators' Picks navigation
const brandToDesignerMap: Record<string, string> = {
  "Alexander Lamont": "alexander-lamont",
  "Alinea Design Objects": "leo-aerts-alinea",
  "Apparatus Studio": "apparatus-studio",
  "Atelier Février": "atelier-fevrier",
  "Atelier Pendhapa": "atelier-pendhapa",
  "Babled Studio": "emmanuel-babled",
  "Atelier BdM - Bruno de Maistre": "bruno-de-maistre",
  "Bina Baitel Studio": "bina-baitel",
  "Ecart Paris": "jean-michel-frank",
  "Eric Schmitt Studio": "eric-schmitt-studio",
  "Garnier & Linker": "garnier-linker",
  "Hamrei": "hamrei",
  "Hervé van der Straeten": "herve-van-der-straeten",
  "Kerstens": "kerstens",
  "Kiko Lopez": "kiko-lopez",
  "Leo Sentou": "leo-sentou",
  "Made in Kira": "roman-frankel",
  "Man of Parts": "man-of-parts",
  "Nathalie Ziegler": "nathalie-ziegler",
  "Okha Design Studio": "adam-courts-okha",
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
  "Stéphane CG": "stephane-cg",
  "Marta Sala Éditions": "marta-sala-editions",
  "Ozone Light": "ozone-light",
};

// ─── Horizontal scroll strip for one letter group ───────────────────────────
type ConsolidatedBrand = {
  name: string;
  origin: string;
  description: string;
  instagram: string;
  categories: string[];
  featuredItems: Array<{ featured?: string; galleryIndex?: number; category: string }>;
  photoCredit?: string;
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

  // Deep-link: expand the matching card in this strip
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.section !== "atelier") return;
      const matchedBrand = brands.find(b => b.name.replace(/\s+/g, "-").toLowerCase() === detail.id);
      if (matchedBrand) {
        setExpandedCard(matchedBrand.name);
        // Scroll the strip to show the matched card
        const idx = brands.indexOf(matchedBrand);
        if (idx >= 0) scrollTo(idx);
      }
    };
    window.addEventListener("deeplink-open-profile", handler);
    return () => window.removeEventListener("deeplink-open-profile", handler);
  }, [brands, scrollTo]);

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
              role="button"
              tabIndex={0}
              aria-expanded={expandedCard === brand.name}
              aria-label={`${brand.name} — ${brand.origin}`}
              onClick={() => setExpandedCard(expandedCard === brand.name ? null : brand.name)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedCard(expandedCard === brand.name ? null : brand.name); } }}
              className={`group flex-none w-[80vw] md:w-[340px] snap-start border border-border/40 rounded-lg hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden p-5 md:p-6 ${expandedCard === brand.name ? "min-h-[280px] md:min-h-[300px]" : "h-[280px] md:h-[300px]"}`}
            >
              {/* Lazy-loaded background image */}
              {bg && (
                <img
                  src={bg}
                  alt={`${brand.name} background`}
                  loading="lazy"
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full pointer-events-none select-none"
                  style={{
                    objectFit: "cover",
                    objectPosition: brand.name === "Jindrich Halabala" ? "center center" : brand.name === "Eric Schmitt Studio" ? "center 30%" : brand.name === "Dagmar London" ? "center 45%" : brand.name === "Robicara" ? "center 45%" : brand.name === "Okha Design Studio" ? "center 30%" : brand.name === "Sé Collections" ? "center center" : brand.name === "Andrée Putman" ? "center 60%" : "center top",
                  }}
                />
              )}
              <div className={`absolute inset-0 transition-all duration-300 ${hasBg ? "bg-black/35 group-hover:bg-black/25" : "bg-card/50 group-hover:bg-card/80"}`} />
              {brand.photoCredit && (
                <p className="absolute bottom-2 right-2 z-10 text-[9px] text-white/40 font-body tracking-wider">
                  Photo: {brand.photoCredit}
                </p>
              )}
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-2">
                    {brand.instagram && (
                      <a
                        href={brand.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 -m-1 touch-manipulation flex-shrink-0 mt-0.5 group/insta"
                        onClick={(e) => { e.stopPropagation(); trackCTA.instagram("Ateliers", brand.name); }}
                        aria-label={`${brand.name} on Instagram`}
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



               {/* Bottom bar: Expand (left on mobile, right on desktop) | Curators' Picks (center) | Share (right on mobile, left of expand on desktop) */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
                {/* Expand/collapse — left on mobile, right on desktop */}
                <div className={`md:order-3 transition-all duration-300 ${expandedCard === brand.name ? "rotate-180" : ""}`}>
                  <div className={`rounded-full p-1.5 backdrop-blur-sm ${hasBg ? "bg-white/20 text-white" : "bg-foreground/10 text-foreground"}`}>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>

                {/* Curators' Picks — center */}
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenPicks(brand.name); }}
                  className="md:order-1 flex items-center gap-2 md:gap-1.5 text-sm md:text-xs tracking-wider font-body group/picks touch-manipulation transition-all duration-300 text-white whitespace-nowrap"
                >
                  <Gem className="h-4 w-4 md:h-3 md:w-3 flex-shrink-0 fill-current" />
                  <span className="group-hover/picks:underline underline-offset-2">
                    Curators' Picks
                  </span>
                </button>

                {/* WhatsApp share — right on mobile, center-ish on desktop */}
                <WhatsAppShareButton
                  onClick={(e) => {
                    e.stopPropagation();
                    const featuredText = brand.featuredItems.find(i => i.featured)?.featured;
                    shareProfileOnWhatsApp("atelier", brand.name.replace(/\s+/g, "-").toLowerCase(), brand.name, featuredText);
                    trackCTA.whatsapp(`Ateliers_Share_${brand.name}`);
                  }}
                  label={`Share ${brand.name} on WhatsApp`}
                  size="sm"
                  variant={hasBg ? "glass" : "solid"}
                  className="md:order-2"
                />
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
  // Deep-link handler: scroll to brand card and click to expand
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.section !== "atelier") return;
      requestAnimationFrame(() => {
        const card = document.getElementById(`brand-${detail.id}`);
        if (card) {
          // Click to expand the card (triggers the AlphaStrip onClick)
          card.click();
          // Scroll into view after a brief delay to let expansion render
          setTimeout(() => {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            card.classList.add('ring-2', 'ring-primary');
            setTimeout(() => card.classList.remove('ring-2', 'ring-primary'), 3000);
          }, 100);
        }
      });
    };
    window.addEventListener("deeplink-open-profile", handler);
    return () => window.removeEventListener("deeplink-open-profile", handler);
  }, []);

  // Curators' Picks lightbox state
  const [picksDesignerName, setPicksDesignerName] = useState<string | null>(null);
  const [picksIndex, setPicksIndex] = useState(0);
  const [picksZoomed, setPicksZoomed] = useState(false);
  const [picksImageLoaded, setPicksImageLoaded] = useState(false);
  const [picksTouchStart, setPicksTouchStart] = useState<number | null>(null);
  const [picksTouchEnd, setPicksTouchEnd] = useState<number | null>(null);
  const imageZoomedRef = useRef(false);
  const closedViaPopstateRef = useRef(false);

  // History state: push when lightbox opens so browser back button closes it
  useEffect(() => {
    if (!picksDesignerName) return;

    closedViaPopstateRef.current = false;
    window.history.pushState({ picksLightbox: true }, '');

    const handlePopState = () => {
      closedViaPopstateRef.current = true;
      setPicksDesignerName(null);
      setPicksIndex(0);
      setPicksZoomed(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [picksDesignerName]);
  // Brands that should use FeaturedDesigners data instead of Collectibles
  const preferFeatured = new Set(["Pierre Bonnefille"]);

  const picksDesigner = useMemo(() => {
    if (!picksDesignerName) return null;
    const designerId = brandToDesignerMap[picksDesignerName];
    if (!designerId) return null;
    // Check atelier-only picks first
    if (atelierOnlyPicks[designerId]) return atelierOnlyPicks[designerId] as any;
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
    setPicksImageLoaded(false);
  }, []);

  // Reset image loaded state when switching picks
  useEffect(() => {
    setPicksImageLoaded(false);
  }, [picksIndex]);

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
          photoCredit: (brand as any).photoCredit,
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
    scrollToSection('gallery');
    setTimeout(() => {
      sessionStorage.setItem('openGalleryIndex', galleryIndex.toString());
      sessionStorage.setItem('gallerySourceId', `brand-${brandName.replace(/\s+/g, '-').toLowerCase()}`);
    }, 600);
  };

  return (
    <section ref={ref} className="py-10 px-4 md:py-24 md:px-12 lg:px-20 bg-muted/30 scroll-mt-24">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-left"
        >
          <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-2">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground">
              Ateliers & Partners
            </h2>
            <span className="text-sm md:text-base text-foreground font-body mb-1 md:mb-1.5">
              {totalBrands}
            </span>
          </div>
          <p className="text-sm md:text-base text-muted-foreground font-body max-w-3xl leading-relaxed mb-4 text-justify">
            We collaborate with the world's most distinguished furniture houses, textile ateliers, and artisan workshops 
            to bring exceptional pieces to discerning collectors and design professionals.
          </p>
          {/* A-Z alphabet jump bar + Search + Filter */}
          {(() => {
            const activeLettersArr = alphaGroups.map(([l]) => l);
            return (
              <div className="flex flex-col gap-3 mb-5 md:mb-6">
                <div
                  className="flex items-center gap-1 px-3 py-1.5 bg-background/90 backdrop-blur-md border border-border/40 rounded-full shadow-sm overflow-x-auto w-full"
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
                        className={`flex-none font-serif text-sm md:text-sm leading-none px-2 py-1.5 md:px-1.5 md:py-1 rounded-full transition-all duration-200 ${
                          isActive
                            ? "text-foreground/70 hover:text-primary hover:bg-primary/10 cursor-pointer"
                            : "text-foreground/30 cursor-default"
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
              if (!closedViaPopstateRef.current) window.history.back();
            }
          }}
        >
          <DialogContent
            hideClose
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
                  onTouchStart={(e) => { if (imageZoomedRef.current) return; setPicksTouchEnd(null); setPicksTouchStart(e.targetTouches[0].clientX); }}
                  onTouchMove={(e) => { if (imageZoomedRef.current) return; setPicksTouchEnd(e.targetTouches[0].clientX); }}
                  onTouchEnd={() => {
                    if (imageZoomedRef.current) return;
                    if (!picksTouchStart || !picksDesigner.curatorPicks?.length) return;
                    if (picksTouchEnd !== null) {
                      const distance = picksTouchStart - picksTouchEnd;
                      if (distance > 50) setPicksIndex(prev => prev === picksDesigner.curatorPicks.length - 1 ? 0 : prev + 1);
                      else if (distance < -50) setPicksIndex(prev => prev === 0 ? picksDesigner.curatorPicks.length - 1 : prev - 1);
                    }
                  }}
                >
                  {/* Close button moved inside image container below */}

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
                    className={`flex flex-col items-center justify-start md:justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 overflow-y-auto ${picksZoomed ? 'max-h-[95vh] pb-4' : 'max-h-[85vh] pb-4'}`}>
                    <div className="relative inline-flex flex-col items-center">
                      {(() => {
                        const pick = picksDesigner.curatorPicks[picksIndex] as any;
                        const tags: string[] = pick?.tags?.length > 0 ? pick.tags : pick?.category ? [pick.category] : [];
                        const specialTags = tags.filter((t: string) => /couture|edition|limited/i.test(t));
                        const hasEdition = !!pick?.edition;
                        return (specialTags.length > 0 || hasEdition) && !picksZoomed ? (
                          <div className="absolute top-2 right-2 z-20 flex flex-wrap gap-1.5 justify-end">
                            {specialTags.map((tag: string, i: number) => (
                              <span key={i} className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-black/20 backdrop-blur-sm">
                                {tag}
                              </span>
                            ))}
                            {pick?.edition && (
                              <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-black/20 backdrop-blur-sm">
                                {pick.edition}
                              </span>
                            )}
                          </div>
                        ) : null;
                      })()}
                      <div className="relative inline-block">
                        {picksDesigner.curatorPicks[picksIndex]?.image ? (
                          <>
                            {!picksImageLoaded && (
                              <div className={`flex items-center justify-center ${picksZoomed ? 'max-h-[88vh] max-w-[90vw]' : 'max-w-[85vw] max-h-[55vh] md:max-w-[70vw] md:max-h-[60vh]'} w-64 h-64 animate-pulse`}>
                                <div className="w-full h-full bg-white/5 rounded-lg flex items-center justify-center">
                                  <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                                </div>
                              </div>
                            )}
                            <PinchZoomImage
                              key={picksIndex}
                              src={picksDesigner.curatorPicks[picksIndex]?.image}
                              alt={picksDesigner.curatorPicks[picksIndex]?.title}
                              className={`object-contain select-none transition-all duration-300 ${picksImageLoaded ? '' : 'absolute opacity-0 pointer-events-none'} ${picksZoomed ? 'max-h-[88vh] max-w-[90vw]' : 'max-w-[85vw] max-h-[55vh] md:max-w-[70vw] md:max-h-[60vh]'}`}
                              draggable={false}
                              decoding="sync"
                              loading="eager"
                              fetchPriority="high"
                              onLoad={() => setPicksImageLoaded(true)}
                              onZoomChange={(z) => { imageZoomedRef.current = z; }}
                            />
                            {/* Desktop hover overlay — click to enlarge/minimize */}
                            <div
                              className={`hidden md:flex absolute inset-0 items-center justify-center transition-all duration-500 ease-out z-[5] group ${picksZoomed ? 'cursor-zoom-out' : 'bg-white/0 hover:bg-white/10 hover:backdrop-blur-[2px] cursor-zoom-in'}`}
                              onClick={() => setPicksZoomed(!picksZoomed)}
                            >
                              {!picksZoomed && (
                                <Maximize2 size={28} className="text-white/0 group-hover:text-white/70 transition-all duration-500 ease-out drop-shadow-lg" />
                              )}
                            </div>
                            {/* Preload adjacent images */}
                            {picksDesigner.curatorPicks.length > 1 && [
                              picksDesigner.curatorPicks[(picksIndex + 1) % picksDesigner.curatorPicks.length]?.image,
                              picksDesigner.curatorPicks[(picksIndex - 1 + picksDesigner.curatorPicks.length) % picksDesigner.curatorPicks.length]?.image,
                            ].filter(Boolean).map((src, i) => (
                              <img key={`preload-${i}`} src={src!} alt="" className="hidden" loading="eager" />
                            ))}
                          </>
                        ) : (
                          <div className="flex items-center justify-center max-w-full max-h-[55vh] w-64 h-64 bg-white/5 border border-white/10 rounded-lg">
                            <span className="text-white/40 font-serif text-lg text-center px-4">{picksDesigner.curatorPicks[picksIndex]?.title}</span>
                          </div>
                        )}
                        {picksDesigner.curatorPicks[picksIndex]?.photoCredit && (
                          <p className="absolute bottom-2 left-2 z-10 text-[10px] text-white/50 font-body tracking-wider flex items-center gap-1">
                            Photo: <a href="https://www.instagram.com/lucabonnefille/?hl=en" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white/80 transition-colors" onClick={e => e.stopPropagation()} aria-label={`${picksDesigner.curatorPicks[picksIndex].photoCredit} on Instagram`}><Instagram className="w-3 h-3" aria-hidden="true" />{picksDesigner.curatorPicks[picksIndex].photoCredit}</a>
                          </p>
                        )}
                        {/* Desktop close button — bottom-right (outside) */}
                        <button
                          onClick={() => { setPicksDesignerName(null); setPicksIndex(0); setPicksZoomed(false); if (!closedViaPopstateRef.current) window.history.back(); }}
                          className="hidden md:flex absolute bottom-2 -right-12 lg:-right-14 p-2.5 rounded-full bg-white/15 text-white/85 hover:text-white hover:bg-white/30 backdrop-blur-sm transition-all duration-300 z-20 border border-white/20"
                          aria-label="Close lightbox"
                        >
                          <X className="h-5 w-5" />
                        </button>
                        {(picksDesigner.curatorPicks[picksIndex] as any)?.pdfUrl && (
                          <button
                            className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-2 bg-[#d32f2f]/80 backdrop-blur-sm rounded-full hover:bg-[#d32f2f] transition-colors cursor-pointer"
                            aria-label="Download PDF"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const pick = picksDesigner.curatorPicks[picksIndex] as any;
                              const url = pick.pdfUrl as string;
                              const filename = pick.pdfFilename || `Maison_Affluency-${(pick.title as string).replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
                              try {
                                const res = await fetch(url);
                                const blob = await res.blob();
                                const blobUrl = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                URL.revokeObjectURL(blobUrl);
                              } catch {
                                window.open(url, '_blank');
                              }
                            }}
                          >
                            <FileDown size={14} className="md:hidden text-white" />
                            <FileDown size={16} className="hidden md:block text-white" />
                            <span className="text-[10px] md:text-xs font-medium leading-none text-white">PDF</span>
                          </button>
                        )}
                        <button
                          onClick={() => setPicksZoomed(!picksZoomed)}
                          className="md:hidden absolute bottom-2 left-2 z-10 bg-black/40 backdrop-blur-sm p-2 rounded-full hover:bg-black/60 transition-colors cursor-pointer"
                          aria-label={picksZoomed ? "Minimize image" : "Maximize image"}
                        >
                          {picksZoomed ? <Minimize2 size={16} className="text-white" /> : <Maximize2 size={16} className="text-white" />}
                        </button>
                      </div>
                    </div>

                    {/* Mobile close button — outside, below-left of image */}
                    {!picksZoomed && (
                      <div className="md:hidden flex justify-start w-full mt-2">
                        <button
                          onClick={() => { setPicksDesignerName(null); setPicksIndex(0); setPicksZoomed(false); if (!closedViaPopstateRef.current) window.history.back(); }}
                          className="p-2 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-300 border border-white/20"
                          aria-label="Close"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    {picksDesigner.curatorPicks.length > 1 && !picksZoomed && (
                      <div className="flex items-center gap-2 mt-3">
                        {picksDesigner.curatorPicks.map((_: CuratorPick, idx: number) => (
                          <button key={idx} aria-label={`Go to image ${idx + 1}`} onClick={() => { setPicksIndex(idx); setPicksZoomed(false); }}
                            className={`rounded-full transition-all duration-300 ${picksIndex === idx ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`} />
                        ))}
                      </div>
                    )}

                    {!picksZoomed && (
                      <div className="text-center mt-4 max-w-lg relative">
                        <p className="font-brand text-base md:text-lg text-white tracking-wide">
                          {picksDesigner.curatorPicks[picksIndex]?.title}
                          {(picksDesigner.curatorPicks[picksIndex] as any)?.subtitle && (
                            <span className="text-white/60"> — {(picksDesigner.curatorPicks[picksIndex] as any).subtitle}</span>
                          )}
                        </p>
                        {picksDesigner.curatorPicks[picksIndex]?.materials && (() => {
                          const mat = picksDesigner.curatorPicks[picksIndex].materials!;
                          const ledIdx = mat.indexOf("\n\nAvailable in multiple LED options:");
                          if (ledIdx === -1) {
                            return (
                              <p className="text-xs text-white/50 font-body mt-1 whitespace-pre-line">
                                {mat}
                              </p>
                            );
                          }
                          const before = mat.slice(0, ledIdx);
                          const after = mat.slice(ledIdx + 2); // skip the \n\n
                          return (
                            <>
                              <p className="text-xs text-white/50 font-body mt-1 whitespace-pre-line">
                                {before}
                              </p>
                              <p className="text-xs text-white/50 font-body mt-3 whitespace-pre-line text-justify">
                                {after}
                              </p>
                            </>
                          );
                        })()}
                        {((picksDesigner.curatorPicks[picksIndex] as any)?.dimensions || (picksDesigner.curatorPicks[picksIndex] as any)?.weight) && (
                          <p className="text-xs text-white/40 font-body mt-0.5 whitespace-pre-line">
                            {(picksDesigner.curatorPicks[picksIndex] as any)?.dimensions}
                            {(picksDesigner.curatorPicks[picksIndex] as any)?.dimensions && (picksDesigner.curatorPicks[picksIndex] as any)?.weight && ' – '}
                            {(picksDesigner.curatorPicks[picksIndex] as any)?.weight}
                          </p>
                        )}
                        {(picksDesigner.curatorPicks[picksIndex] as any)?.description && (
                          <p className="text-xs text-white/50 font-body mt-2 leading-relaxed text-justify md:text-center">
                            {(picksDesigner.curatorPicks[picksIndex] as any).description}
                          </p>
                        )}

                        {picksDesigner.curatorPicks.length > 1 && (
                          <div className="mt-6 flex items-center gap-2 overflow-x-auto scrollbar-hide justify-center flex-wrap md:flex-nowrap">
                            {picksDesigner.curatorPicks.map((pick: CuratorPick, idx: number) => (
                              <button key={idx} onClick={() => { setPicksIndex(idx); setPicksZoomed(false); }} aria-label={`View ${pick.title}`}
                                className={`flex-shrink-0 rounded-md overflow-hidden border-2 transition-all duration-200 ${picksIndex === idx ? 'border-white/80 scale-105' : 'border-transparent opacity-50 hover:opacity-80'}`}>
                                {pick.image ? (
                                  <img src={pick.image} alt={pick.title} className="w-12 h-12 md:w-14 md:h-14 object-cover" loading="lazy" decoding="async" />
                                ) : (
                                  <div className="w-12 h-12 md:w-14 md:h-14 bg-white/10 flex items-center justify-center">
                                    <span className="text-white/40 text-[6px] text-center leading-tight px-0.5">{pick.title}</span>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-white/40 font-body mt-4">
                          For further details, please contact{" "}
                          <a href="mailto:concierge@myaffluency.com" className="underline hover:text-white/80 transition-colors">concierge@myaffluency.com</a>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Mobile scroll indicator */}
                  {!picksZoomed && (
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

                  {/* Desktop prev/next arrows */}
                  {picksDesigner.curatorPicks.length > 1 && !picksZoomed && (
                    <>
                      <button
                        onClick={() => setPicksIndex(prev => prev === 0 ? picksDesigner.curatorPicks.length - 1 : prev - 1)}
                        className="hidden md:flex absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                        aria-label="Previous"
                      >
                        <ChevronLeft size={32} />
                      </button>
                      <button
                        onClick={() => setPicksIndex(prev => prev === picksDesigner.curatorPicks.length - 1 ? 0 : prev + 1)}
                        className="hidden md:flex absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                        aria-label="Next"
                      >
                        <ChevronRight size={32} />
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative flex items-center justify-center w-full h-full">
                  <button
                    onClick={() => { setPicksDesignerName(null); setPicksIndex(0); setPicksZoomed(false); if (!closedViaPopstateRef.current) window.history.back(); }}
                    className="absolute top-4 left-4 md:left-auto md:right-4 z-50 p-1.5 bg-background/20 hover:bg-background/40 rounded-full backdrop-blur-sm transition-colors"
                    aria-label="Close lightbox"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                  <div className="text-center p-8">
                     <Gem className="h-16 w-16 text-white/30 mx-auto mb-4" />
                    <h3 className="text-2xl font-serif text-white mb-2">Curators' Picks</h3>
                    <p className="text-white/70 font-body mb-2">{picksDesigner.name}</p>
                    <p className="text-sm text-white/50 font-body italic">Curated selections coming soon</p>
                  </div>
                </div>
              )
            ) : (
              <div className="relative flex items-center justify-center w-full h-full">
                <button
                  onClick={() => { setPicksDesignerName(null); setPicksIndex(0); setPicksZoomed(false); if (!closedViaPopstateRef.current) window.history.back(); }}
                  className="absolute top-4 left-4 md:left-auto md:right-4 z-50 p-1.5 bg-background/20 hover:bg-background/40 rounded-full backdrop-blur-sm transition-colors"
                  aria-label="Close lightbox"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
                <div className="text-center p-8">
                  <Gem className="h-16 w-16 text-white/30 mx-auto mb-4" />
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

