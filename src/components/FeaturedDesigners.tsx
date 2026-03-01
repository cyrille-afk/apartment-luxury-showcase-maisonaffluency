import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Instagram, Search, X, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Gem, Maximize2, Minimize2, SlidersHorizontal, Download } from "lucide-react";
import PinchZoomImage from "./PinchZoomImage";
import { trackCTA } from "@/lib/analytics";
import { scrollToSection } from "@/lib/scrollToSection";
import { shareProfileOnWhatsApp } from "@/lib/whatsapp-share";
import WhatsAppShareButton from "./WhatsAppShareButton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cloudinaryUrl } from "@/lib/cloudinary";

// Designer profile images — served via Cloudinary CDN
const dImg = (name: string) =>
  cloudinaryUrl(name, { width: 800, quality: "auto", crop: "fill" });

const thierryLemaireImg = dImg("thierry-lemaire_heyrtj");
const herveVanDerStraetenImg = dImg("herve-van-der-straeten");
const brunoDeMaistreImg = dImg("bruno-de-maistre_wzwqa9");
const hamreiImg = dImg("hamrei");
const atelierFevrierImg = dImg("atelier-fevrier_jjaivt");
const apparatusStudioImg = dImg("gabriel-hendifar-apparatus-studio");
const oliviaCognetImg = dImg("olivia-cognet_wzbjlx");
const jeremyMaxwellWintrebertImg = dImg("jeremy-maxwell-wintrebert_knazjz");
const alexanderLamontImg = dImg("alexander-lamont_t5j1nw");
const leoSentouImg = dImg("leo-sentou_g7g6fs");
const jeanMichelFrankImg = dImg("jean-michel-frank-new_toifde");
const emanuelleLevetStenneImg = dImg("emanuelle-levet-stenne_kuwbex");
const milanPekarImg = dImg("milan-pekar_oxase3");
const atelierPendhapaImg = dImg("atelier-pendhapa_ayovtb");
const yvesMacheretImg = dImg("yves-macheret_n0v4bm");
const nathalieZieglerImg = dImg("nathalie-ziegler_zs59x0");
const leoAertsAlineaImg = dImg("leo-aerts-alinea_f9oogs");
const pierreBonnefulleImg = dImg("pierre-bonnefille_f1qpvc");
const ccTapisImg = dImg("cc-tapis");
const haymannEditionsImg = dImg("haymann-editions");
const theoremeEditionsImg = dImg("theoreme-editions");
const garnierLinkerImg = dImg("garnier-linker_wvqg7k");
const robicaraImg = dImg("robicara_p1c2fz");
const redaAmalouImg = dImg("reda-amalou");
const noeDuchaufourImg = dImg("noe-duchaufour-lawrance");
const binaBAitelImg = dImg("bina-baitel_ujy4gj");
const tristanAuerImg = dImg("tristan-auer_iepsoy");
const manOfPartsImg = dImg("man-of-parts_kjvhqs");
const kerstensImg = dImg("kerstens_j3vvky");
const felixAgostiniImg = dImg("felix-agostini_oe5jxg");
const ecartParisImg = dImg("ecart-paris");
const kiraImg = dImg("roman-frankel");
const kikoLopezImg = dImg("kiko-lopez");
const maartenVrolijkImg = dImg("maarten-vrolijk");
const marcantonioImg = dImg("marcantonio-brandolini-dadda");
const matthieuGicquelImg = dImg("matthieu-gicquel");
const rowinAtelierImg = dImg("rowin-atelier");
const forestGiaconiaImg = dImg("forest-giaconia_ikcmkg");
const adamCourtsOkhaImg = dImg("adam-courts");

// Curator picks — migrated to Cloudinary
const noeDuchaufourMadonnaTables = cloudinaryUrl("Screen_Shot_2026-02-23_at_1.06.51_PM_ukeqij", { width: 1200, quality: "auto:good", crop: "fill" });
const noeMineralFlowerSide = cloudinaryUrl("Screen_Shot_2026-02-23_at_1.40.43_PM_b0tuc9", { width: 1200, quality: "auto:good", crop: "fill" });
const noeMineralFlowerCoffee = cloudinaryUrl("Screen_Shot_2026-02-23_at_1.42.29_PM_ryudnm", { width: 1200, quality: "auto:good", crop: "fill" });
const leoAertsAngeloMCollection = cloudinaryUrl("Screen_Shot_2026-02-18_at_10.35.13_AM_jwbivd", { width: 1200, quality: "auto:good", crop: "fill" });
const leoAertsAngeloMDining = cloudinaryUrl("Screen_Shot_2026-02-18_at_10.09.13_AM_z727ht", { width: 1200, quality: "auto:good", crop: "fill" });
const leoAertsVitrineCabinet = cloudinaryUrl("Screen_Shot_2026-02-18_at_10.07.49_AM_bj59um", { width: 1200, quality: "auto:good", crop: "fill" });
const leoAertsTwinChairOutdoor = cloudinaryUrl("Screen_Shot_2026-02-18_at_10.07.00_AM_msurq2", { width: 1200, quality: "auto:good", crop: "fill" });
const leoAertsTwinChairIndoor = cloudinaryUrl("Screen_Shot_2026-02-27_at_8.41.52_PM_wlksfq", { width: 1200, quality: "auto:good", crop: "fill" });
const leoAertsAngeloMMacassar = cloudinaryUrl("Screen_Shot_2026-02-18_at_10.06.14_AM_azdcae", { width: 1200, quality: "auto:good", crop: "fill" });
const leoAertsAngeloMO290 = cloudinaryUrl("Screen_Shot_2026-02-18_at_10.08.42_AM_xr4vun", { width: 1200, quality: "auto:good", crop: "fill" });
import forestGiaconiaIhiLamp from "@/assets/curators-picks/forest-giaconia-ihi-floor-lamp.jpg";
import forestGiaconiaConsole from "@/assets/forrest-giaconia-console.png";
import forestGiaconiaTable from "@/assets/forrest-giaconia-table.png";
import forestGiaconiaCoffee from "@/assets/forrest-giaconia-coffee.png";
const adamCourtsVoidTable = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772110305/Screen_Shot_2026-02-18_at_10.39.49_AM_noqdtn.png";
const adamCourtsVoidChair = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772110437/Screen_Shot_2026-02-18_at_10.41.11_AM_msssmi.png";
const adamCourtsGeometerChair = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772159510/Screen_Shot_2026-02-18_at_10.41.39_AM_t1lxrt.png";
const adamCourtsReposeSofa = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772159511/Screen_Shot_2026-02-18_at_10.42.26_AM_oglbl5.png";
const adamCourtsReverbSofa = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772159581/Screen_Shot_2026-02-18_at_10.42.38_AM_qvcay0.png";
const adamCourtsSideboard = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772111095/Screen_Shot_2026-02-18_at_10.43.37_AM_ynqngy.png";
const adamCourtsGeometerBench = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772159511/Screen_Shot_2026-02-18_at_10.44.15_AM_n5y58h.png";

// Curators' Picks images
const alexanderLamontPick1 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772160682/Ondas-Sconce-Clear_07_alexander-lamont_1_t6ygbc.jpg";
const alexanderLamontPick2 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772160682/Galea-Lantern-Rock_Crystal_01_alexander-lamont_1_rhpxsg.jpg";
const alexanderLamontPick3 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772160681/Casque-Bar-Cabinet_10_alexander-lamont_1_ydnjp2.jpg";
const alexanderLamontPick4 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772160682/Dais-Lounge-Chair_06_alexander-lamont_1_fuodom.jpg";
const alexanderLamontPick5 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772160703/Corteza-Console-Table-Dark_03_alexander-lamont_r2ubvz.jpg";
const alexanderLamontPick6 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772161289/Barbican-Cabinet_13_alexander-lamont_2_hyp2sd.jpg";
const alexanderLamontPick7 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772161406/Koi-Carp_01_alexander-lamont_1_kxayax.jpg";
import yvesMacheretPick1 from "@/assets/curators-picks/yves-macheret-1.jpg";
import yvesMacheretPick2 from "@/assets/curators-picks/yves-macheret-2.jpg";
import yvesMacheretPick3 from "@/assets/curators-picks/yves-macheret-3.png";
import yvesMacheretPick4 from "@/assets/curators-picks/yves-macheret-4.jpg";
import yvesMacheretPickHublo from "@/assets/curators-picks/yves-macheret-hublo.png";
import yvesMacheretPickConsole1925 from "@/assets/curators-picks/yves-macheret-console-1925.jpg";
const apparatusPick1 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772162190/Screen_Shot_2026-02-27_at_11.14.28_AM_skwebb.png";
const apparatusPick2 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772162191/Screen_Shot_2026-02-27_at_11.16.07_AM_qjfogh.png";
const apparatusPick3 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772162190/Screen_Shot_2026-02-27_at_11.14.45_AM_n1pxgg.png";
const apparatusPick4 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772162191/Screen_Shot_2026-02-27_at_11.15.22_AM_uxqz3z.png";
const apparatusPick5 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772161859/Screen_Shot_2026-02-22_at_1.58.18_PM_cnfmnc.png";
const apparatusPick6 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772161859/Screen_Shot_2026-02-22_at_2.16.45_PM_t3d8xk.png";
const apparatusPick7 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772106126/Screen_Shot_2026-02-22_at_2.36.04_PM_ivwy5t.png";
const pendhapaPick1 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772165712/Screen_Shot_2026-02-27_at_12.11.36_PM_qed4qj.png";
const pendhapaPick2 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772165616/Screen_Shot_2026-02-27_at_12.10.47_PM_nkmbmx.png";
const pendhapaPick3 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772165598/Screen_Shot_2026-02-27_at_12.04.23_PM_wlvkcx.png";
const pendhapaPick4 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772165597/Screen_Shot_2026-02-27_at_12.11.56_PM_sw0yoc.png";
const pendhapaPick5 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772165614/Screen_Shot_2026-02-27_at_12.09.33_PM_npn6eb.png";
const pendhapaPick6 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772165978/Screen_Shot_2026-02-27_at_12.19.05_PM_dodant.png";
const pendhapaPick7 = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good,f_auto/v1772165720/Screen_Shot_2026-02-27_at_12.13.12_PM_jpr8qh.png";
const atelierFevrierPick1 = cloudinaryUrl("Screen_Shot_2026-02-16_at_10.00.02_AM_lfndej", { width: 1200, quality: "auto:good", crop: "fill" });
const atelierFevrierPick2 = cloudinaryUrl("Screen_Shot_2026-02-16_at_9.37.27_AM_jgmxg5.png", { width: 1200, quality: "auto:good", crop: "fill" });
const atelierFevrierPick3 = cloudinaryUrl("Screen_Shot_2026-02-16_at_9.38.45_AM_sqcvog", { width: 1200, quality: "auto:good", crop: "fill" });
const atelierFevrierPick4 = cloudinaryUrl("Screen_Shot_2026-02-16_at_9.41.04_AM_sy9grh", { width: 1200, quality: "auto:good", crop: "fill" });
const atelierFevrierPick5 = cloudinaryUrl("Screen_Shot_2026-02-27_at_11.47.18_AM_o3qliv", { width: 1200, quality: "auto:good", crop: "fill" });
const atelierFevrierPick6 = cloudinaryUrl("Screen_Shot_2026-02-27_at_11.46.17_AM_c5irzd", { width: 1200, quality: "auto:good", crop: "fill" });
const atelierFevrierPick7 = cloudinaryUrl("Screen_Shot_2026-02-27_at_11.46.48_AM_saicfe", { width: 1200, quality: "auto:good", crop: "fill" });
import emmanuelLevetStennePick1 from "@/assets/curators-picks/emmanuel-levet-stenne-1.jpg";
import emmanuelLevetStennePick2 from "@/assets/curators-picks/emmanuel-levet-stenne-2.jpg";
import emmanuelLevetStennePick3 from "@/assets/curators-picks/emmanuel-levet-stenne-3.jpg";
import emmanuelLevetStennePick4 from "@/assets/curators-picks/emmanuel-levet-stenne-4.jpg";
import emmanuelLevetStennePick5 from "@/assets/curators-picks/emmanuel-levet-stenne-5.jpg";
const emmanuelLevetStennePick6 = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.23.51_PM_gyeqne", { width: 1200, quality: "auto:good", crop: "fill" });
const emmanuelLevetStennePick7 = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.29.54_PM_cfncv6", { width: 1200, quality: "auto:good", crop: "fill" });
import hamreiPick1 from "@/assets/curators-picks/hamrei-1.jpg";
import hamreiPick2 from "@/assets/curators-picks/hamrei-2.jpg";
import hamreiPick3 from "@/assets/curators-picks/hamrei-3.jpg";
import hamreiPick4 from "@/assets/curators-picks/hamrei-4.jpg";
import hamreiPick5 from "@/assets/curators-picks/hamrei-5.jpg";
import hamreiPick6 from "@/assets/curators-picks/hamrei-6.jpg";
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
const pierreBonnefilleBronzePainting = cloudinaryUrl("art-master-bronze_hf6bad", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleBronzePainting208 = cloudinaryUrl("Screen_Shot_2026-02-22_at_6.27.12_PM_haymp0", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleMetamorphosisLamps = cloudinaryUrl("Screen_Shot_2026-02-22_at_8.04.36_PM_wwoocz", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleMetamorphosisPolygone = cloudinaryUrl("Screen_Shot_2026-02-22_at_8.14.02_PM_pmlpmu", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleTabouretsStone = cloudinaryUrl("Screen_Shot_2026-02-22_at_8.21.03_PM_kyvd2j", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleStoneD = cloudinaryUrl("Screen_Shot_2026-02-22_at_8.25.11_PM_gctcgf", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleEnfiladeBloc = cloudinaryUrl("Screen_Shot_2026-02-22_at_8.33.49_PM_ivior2", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleBlocSideboardII = cloudinaryUrl("Screen_Shot_2026-02-22_at_8.47.27_PM_zmyb0m", { width: 1200, quality: "auto:good", crop: "fill" });
const pierreBonnefilleStoneFloorLamp = cloudinaryUrl("Screen_Shot_2026-02-22_at_8.52.01_PM_lnerox", { width: 1200, quality: "auto:good", crop: "fill" });
import ccTapisGiudecca from "@/assets/curators-picks/cc-tapis-giudecca.jpg";
import haymannMarieLamp from "@/assets/curators-picks/haymann-marie-lamp.jpg";
import theoremeGarnierLinker from "@/assets/curators-picks/theoreme-garnier-linker.jpg";
import garnierLinkerCenterpiece from "@/assets/curators-picks/garnier-linker-centerpiece.jpg";
import garnierLinkerEratoPendant from "@/assets/curators-picks/garnier-linker-erato-pendant.png";
import garnierLinkerBoraSconce from "@/assets/curators-picks/garnier-linker-bora-sconce.png";
import garnierLinkerCallistoPendant from "@/assets/curators-picks/garnier-linker-callisto-pendant.png";
import garnierLinkerCalliopeChandelier from "@/assets/curators-picks/garnier-linker-calliope-chandelier.png";
import garnierLinkerOrionPendant from "@/assets/curators-picks/garnier-linker-orion-pendant.png";
import garnierLinkerLipariPendant from "@/assets/curators-picks/garnier-linker-lipari-pendant.png";
import robicaraSiraCredenza from "@/assets/curators-picks/robicara-sira-credenza-new.jpg";
import robicaraArmchair from "@/assets/curators-picks/robicara-armchair.jpg";
import robicaraHighbackChair from "@/assets/curators-picks/robicara-highback-chair.jpg";
import robicaraSideboard from "@/assets/curators-picks/robicara-sideboard.jpg";
import robicaraSiraNightstand from "@/assets/curators-picks/robicara-sira-nightstand.jpg";
import robicaraMarbleTable from "@/assets/curators-picks/robicara-marble-table.jpg";
import robicaraMartiniTable from "@/assets/curators-picks/robicara-martini-table.jpg";
import redaAmalouDotTable from "@/assets/curators-picks/reda-amalou-dot-table.jpg";
import redaAmalouLadybug from "@/assets/curators-picks/reda-amalou-ladybug.png";
import redaAmalouEgg from "@/assets/curators-picks/reda-amalou-egg.png";
import redaAmalouOoma from "@/assets/curators-picks/reda-amalou-ooma.png";
import redaAmalouTara from "@/assets/curators-picks/reda-amalou-tara.png";
import redaAmalouIce from "@/assets/curators-picks/reda-amalou-ice.png";
import redaAmalouSteeltop from "@/assets/curators-picks/reda-amalou-steeltop.png";
import redaAmalouMuse from "@/assets/curators-picks/reda-amalou-muse.png";
import noeFolioLamp from "@/assets/curators-picks/noe-folio-lamp.jpg";
import rowinNoneIILampDetail from "@/assets/curators-picks/rowin-none-ii-lamp-detail.jpg";
import matthieuGicquelGoldGeode from "@/assets/curators-picks/matthieu-gicquel-gold-geode.jpg";
import kikoLopezSilverHammer from "@/assets/curators-picks/kiko-lopez-silver-hammer.jpg";
import maartenVrolijkBloomingTerra from "@/assets/curators-picks/maarten-vrolijk-blooming-terra.jpg";
import marcantonioDetail from "@/assets/curators-picks/marcantonio-cotissi-detail.jpg";

import binaBAitelObject from "@/assets/curators-picks/bina-baitel-object.jpg";
const binaBaitelPick1 = cloudinaryUrl("Screen_Shot_2026-02-22_at_2.58.25_PM_ljahkg", { width: 1200, quality: "auto:good", crop: "fill" });
const binaBaitelPick2 = cloudinaryUrl("Screen_Shot_2026-02-26_at_8.07.08_PM_eyfjvf", { width: 1200, quality: "auto:good", crop: "fill" });
const binaBaitelPick3 = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.01.30_PM_fkyyx2", { width: 1200, quality: "auto:good", crop: "fill" });
const binaBaitelPick4 = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.04.26_PM_vnrscy", { width: 1200, quality: "auto:good", crop: "fill" });
const binaBaitelPick5 = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.10.14_PM_hbhaap", { width: 1200, quality: "auto:good", crop: "fill" });
const binaBaitelPick6 = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.16.37_PM_mydp38", { width: 1200, quality: "auto:good", crop: "fill" });
const binaBaitelPick7 = cloudinaryUrl("Screen_Shot_2026-02-22_at_3.18.36_PM_nngssk", { width: 1200, quality: "auto:good", crop: "fill" });
const kerstensConsole = cloudinaryUrl("Screen_Shot_2026-02-19_at_11.46.35_AM_mzs6dg", { width: 1200, quality: "auto:good", crop: "fill" });
const kertensPick1 = cloudinaryUrl("Screen_Shot_2026-02-19_at_11.46.35_AM_mzs6dg", { width: 1200, quality: "auto:good", crop: "fill" });
const kertensPick2 = cloudinaryUrl("Screen_Shot_2026-02-19_at_11.50.12_AM_com6lf", { width: 1200, quality: "auto:good", crop: "fill" });
const kertensPick3 = cloudinaryUrl("Screen_Shot_2026-02-19_at_11.51.18_AM_lgqgzk", { width: 1200, quality: "auto:good", crop: "fill" });
const kertensPick4 = cloudinaryUrl("Screen_Shot_2026-02-19_at_11.52.56_AM_cdyd73", { width: 1200, quality: "auto:good", crop: "fill" });
const kertensPick5 = cloudinaryUrl("Screen_Shot_2026-02-19_at_11.53.40_AM_kkfe0w", { width: 1200, quality: "auto:good", crop: "fill" });
const kertensPick6 = cloudinaryUrl("Screen_Shot_2026-02-19_at_11.55.13_AM_qdmapy", { width: 1200, quality: "auto:good", crop: "fill" });
const kertensPick7 = cloudinaryUrl("Screen_Shot_2026-02-19_at_11.56.39_AM_vyjgky", { width: 1200, quality: "auto:good", crop: "fill" });
import manOfPartsSofa from "@/assets/curators-picks/man-of-parts-sofa.jpg";
import manOfPartsSideChair from "@/assets/curators-picks/man-of-parts-side-chair.png";
import manOfPartsLoungeChair from "@/assets/curators-picks/man-of-parts-lounge-chair.png";
import manOfPartsFloorLamp from "@/assets/curators-picks/man-of-parts-floor-lamp.png";
import manOfPartsRuaLeblon from "@/assets/curators-picks/man-of-parts-rua-leblon.png";
import manOfPartsBondStreetStool from "@/assets/curators-picks/man-of-parts-bond-street-stool.png";
import manOfPartsSandyCoveSofa from "@/assets/curators-picks/man-of-parts-sandy-cove-sofa.png";
import manOfPartsCoffeeTable from "@/assets/curators-picks/man-of-parts-coffee-table.png";
import manOfPartsCocktailTable from "@/assets/curators-picks/man-of-parts-cocktail-table.png";
import felixAgostiniCaryatide from "@/assets/curators-picks/felix-agostini-caryatide.jpg";
import felixAgostiniTaureauFD from "@/assets/curators-picks/felix-agostini-taureau-lamp.png";
import felixAgostiniSocleFD from "@/assets/curators-picks/felix-agostini-socle-lamp.png";
import felixAgostiniEtrierFD from "@/assets/curators-picks/felix-agostini-etrier.png";
import felixAgostiniArcheoptryxFD from "@/assets/curators-picks/felix-agostini-archeoptryx.png";
import felixAgostiniConsoleChevalFD from "@/assets/curators-picks/felix-agostini-console-cheval.png";
import felixAgostiniConsoleInsituFD from "@/assets/curators-picks/felix-agostini-console-insitu.png";
import kiraToshiroLamp from "@/assets/curators-picks/kira-toshiro-lamp.jpg";

import tristanAuerYsaWallLightH from "@/assets/curators-picks/tristan-auer-ysa-wall-light-h.jpg";
import tristanAuerPedestalSuzanne from "@/assets/curators-picks/tristan-auer-pedestal-suzanne.jpg";
import tristanAuerTableLampH from "@/assets/curators-picks/tristan-auer-table-lamp-h.jpg";
import tristanAuerTeeFloorLamp from "@/assets/curators-picks/tristan-auer-tee-floor-lamp.jpg";
import tristanAuerEclipseWallLight from "@/assets/curators-picks/tristan-auer-eclipse-wall-light-v2.jpg";
import tristanAuerYsaWallLightVeronese from "@/assets/curators-picks/tristan-auer-ysa-wall-light-veronese.jpg";
import seCollectionsGlassDisc from "@/assets/curators-picks/se-collections-1.jpg";
import seCollectionsGreenPendant from "@/assets/curators-picks/se-collections-2.jpg";
import seCollectionsDarkPendant from "@/assets/curators-picks/se-collections-3.jpg";
import seCollectionsMarbleTable from "@/assets/curators-picks/se-collections-4.jpg";
import brunoDeMaistreLyricDesk from "@/assets/curators-picks/bruno-de-maistre-lyric-desk.jpg";
import herveVdsMicmac from "@/assets/curators-picks/herve-vds-micmac.jpg";
import thierryLemaireOrsay from "@/assets/curators-picks/thierry-lemaire-orsay.jpg";
import oliviaCognetVallauris from "@/assets/curators-picks/olivia-cognet-vallauris.jpg";
import oliviaCognetRedTravertine from "@/assets/curators-picks/olivia-cognet-red-travertine.png";
import oliviaCognetCeramicRelief from "@/assets/curators-picks/olivia-cognet-ceramic-relief.png";
import oliviaCognetVallaurisLamps from "@/assets/curators-picks/olivia-cognet-vallauris-lamps.png";
import oliviaCognetLeSudVessels from "@/assets/curators-picks/olivia-cognet-le-sud-vessels.png";
import oliviaCognetCurveXxl from "@/assets/curators-picks/olivia-cognet-curve-xxl.png";
import oliviaCognetTotemSeries from "@/assets/curators-picks/olivia-cognet-totem-series.png";
import oliviaCognetRetrofutureTable from "@/assets/curators-picks/olivia-cognet-retrofuture-table.png";
import milanPekarCrystalline from "@/assets/curators-picks/milan-pekar-crystalline.jpg";
import milanPekarCrystallineVase from "@/assets/curators-picks/milan-pekar-crystalline-vase.jpg";
import milanPekarCrystallineV2 from "@/assets/curators-picks/milan-pekar-crystalline-v2.jpg";
import milanPekarCrystallineSmall from "@/assets/curators-picks/milan-pekar-crystalline-small.jpg";
import milanPekarCrystallineXL from "@/assets/curators-picks/milan-pekar-crystalline-xl.jpg";
import milanPekarCrystallineSeries from "@/assets/curators-picks/milan-pekar-crystalline-series.jpg";
import milanPekarMetallicVase from "@/assets/curators-picks/milan-pekar-metallic-vase.jpg";
import nathalieZieglerChandelier from "@/assets/curators-picks/nathalie-ziegler-chandelier.jpg";
import jmfStool1934 from "@/assets/curators-picks/jmf-stool-1934.jpg";
import jmfCroisillonLamp from "@/assets/curators-picks/jmf-croisillon-lamp.jpg";
import jmfSoleilTable1 from "@/assets/curators-picks/jmf-soleil-table-1.jpg";
import jmfSoleilTable2 from "@/assets/curators-picks/jmf-soleil-table-2.jpg";
import jmfElephantArmchair from "@/assets/curators-picks/jmf-elephant-armchair.jpg";
import jmfRoundTable1 from "@/assets/curators-picks/jmf-round-table-1.jpg";
import jmfRoundTable2 from "@/assets/curators-picks/jmf-round-table-2.jpg";
import jmfPresidentDesk1 from "@/assets/curators-picks/jmf-president-desk-1.jpg";
import jmfPresidentDesk2 from "@/assets/curators-picks/jmf-president-desk-2.jpg";
import jmfUpholsteredBackSofa from "@/assets/curators-picks/jmf-upholstered-back-sofa.jpg";
import jmfXStoolRound from "@/assets/curators-picks/jmf-x-stool-round.jpg";
import ecartPierreChareau from "@/assets/curators-picks/ecart-pierre-chareau.jpg";
import kikoLopezMirrorImg from "@/assets/curators-picks/kiko-lopez-mirror.jpg";
import maartenVrolijkSakura from "@/assets/curators-picks/maarten-vrolijk-sakura.jpg";
import maartenVrolijkVessel from "@/assets/curators-picks/maarten-vrolijk-vessel.jpg";
import marcantonioVessel from "@/assets/curators-picks/marcantonio-cotissi-vessel.jpg";
import matthieuGicquelGeode from "@/assets/curators-picks/matthieu-gicquel-geode.jpg";
import nathalieZieglerSnakeVessel from "@/assets/curators-picks/nathalie-ziegler-snake-vessel.jpg";
import rowinNoneIILamp from "@/assets/curators-picks/rowin-none-ii-lamp.jpg";

type DesignerLink = { type: string; url?: string };
export type CuratorPick = { image?: string; title: string; subtitle?: string; category?: string; subcategory?: string; tags?: string[]; materials?: string; dimensions?: string; description?: string; photoCredit?: string; edition?: string; pdfUrl?: string; pdfFilename?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const featuredDesigners: (Record<string, any> & { curatorPicks: CuratorPick[]; links?: DesignerLink[] })[] = [
  {
    id: "adam-courts-okha",
    name: "Okha Design Studio - Adam Courts",
    specialty: "Collectible Furniture & Contemporary African Design",
    image: adamCourtsOkhaImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_9.45.50_AM_ejpdtg.png",
    biography: "Adam Courts is the founder and creative director of Okha, a Johannesburg-based design studio at the vanguard of contemporary collectible furniture. Drawing on the rich material culture and craft traditions of southern Africa, Courts creates pieces of sculptural authority and refined restraint. His work — spanning seating, cabinetry, tables and lighting — is distinguished by its precision joinery, architect's rigour and a deep sensitivity to texture and form. Okha is represented in landmark private collections and leading design galleries internationally.",
    notableWorks: "Tectra Coffee Table, Void Dining Chair, Geometer Chair, BNVO Dining Chair, Repose Sofa, OVD Server",
    notableWorksLinks: [
      { text: "Villa Pedestal Nightstand", galleryIndex: 15 },
    ],
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/OKHA_CoffeeTable_Tectra2_2.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/OKHA_DiningChair_BNVO_2.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/OKHA_Sofas_ReposeA.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/OKHA_DiningChair_Void_2.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/OKHA_Sofas_Reverb_1.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/OKHA_Server_OVD_2.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/OKHA_OtherSeating_BenchBed_1.pdf",
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
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_9.47.49_AM_zwwb1l.png",
    biography:
      "Alexander Lamont is a British designer based in Bangkok whose eponymous brand has become synonymous with exceptional craftsmanship and the innovative use of traditional materials. Working with bronze, shagreen, straw marquetry, lacquer and gold leaf, his pieces marry East and West influences with a distinct sculptural presence. Winner of multiple UNESCO Awards for Excellence in Craftsmanship, his work graces prestigious interiors worldwide.",
    notableWorks: "Hammered Bowls (UNESCO Award), Brancusi Spiral Table, River Ledge Credenza, Agata Cabinet, Lune Mirrors",
    notableWorksLinks: [
      { text: "Corteza Console Table", galleryIndex: 25 },
      { text: "Hammered Bowls", galleryIndex: 3 },
    ],
    philosophy: "Objects have power: they connect us to our most intimate selves and to the people, places, stories and memories of our lives.",
    curatorPicks: [
      { 
        image: alexanderLamontPick3, 
        title: "Casque",
        subtitle: "Bar Cabinet",
        category: "Storage",
        tags: ["Couture Collection", "Storage", "Cabinet"],
        materials: "Straw marquetry • Hammered bronze handles • Lacquered interior",
        dimensions: "H110 × W120 × D45 cm",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Casque_Bar_Cabinet_-_Amethyst_Ombre_Havana.pdf",
        pdfFilename: "Alexander_Lamont-Casque_Bar_Cabinet.pdf"
      },
      { 
        image: alexanderLamontPick1, 
        title: "Ondas Sconce",
        subtitle: "Clear",
        category: "Lighting",
        tags: ["Couture Collection", "Lighting", "Sconce"],
        materials: "Hand-cast bronze with clear glass diffuser",
        dimensions: "H45 × W12 × D14 cm",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Ondas_Sconce.pdf",
        pdfFilename: "Alexander_Lamont-Ondas_Sconce.pdf"
      },
      { 
        image: alexanderLamontPick4, 
        title: "Dais",
        subtitle: "Lounge Chair",
        category: "Seating",
        tags: ["Couture Collection", "Seating", "Chair"],
        materials: "Bouclé upholstery • Shagreen leather • Straw marquetry accents",
        dimensions: "H75 × W80 × D85 cm",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Dais_Lounge_Chair.pdf",
        pdfFilename: "Alexander_Lamont-Dais_Lounge_Chair.pdf"
      },
      { 
        image: alexanderLamontPick2, 
        title: "Galea Lantern",
        subtitle: "Rock Crystal",
        category: "Lighting",
        tags: ["Couture Collection", "Lighting", "Lantern"],
        materials: "Hammered bronze base • Rock crystal & frosted glass shades",
        dimensions: "H28 × W18 × D18 cm",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Galea_Lantern.pdf",
        pdfFilename: "Alexander_Lamont-Galea_Lantern.pdf"
      },
      { 
        image: alexanderLamontPick5, 
        title: "Corteza Console Table",
        subtitle: "Natural Distress",
        category: "Tables",
        tags: ["Couture Collection", "Tables", "Console"],
        materials: "Natural distressed wood • Bronze detailing",
        dimensions: "H85 × W140 × D40 cm",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Corteza_Console_Table.pdf",
        pdfFilename: "Alexander_Lamont-Corteza_Console_Table.pdf"
      },
      { 
        image: alexanderLamontPick6, 
        title: "Barbican Cabinet",
        subtitle: "",
        category: "Storage",
        tags: ["Couture Collection", "Storage", "Cabinet"],
        materials: "Hand-painted lacquer • Gold leaf accents",
        dimensions: "H90 × W60 × D12 cm",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Barbican_Cabinet.pdf",
        pdfFilename: "Alexander_Lamont-Barbican_Cabinet.pdf"
      },
      {
        image: alexanderLamontPick7,
        title: "Koi Carps",
        subtitle: "Wall Art",
        category: "Decorative",
        tags: ["Decorative", "Wall Art"],
        materials: "Bronze Koi carp appear to swim naturally across surfaces large and small. We can advise on arrangements for the wall and floor.",
        dimensions: "FG000139 W 7.5 × L 36 cm – 1.2 kg  ·  FG000140 W 8.5 × L 40 cm – 1.5 kg\nFG000141 W 11.5 × L 43.5 cm – 2.4 kg  ·  FG000142 W 12 × L 47.5 cm – 2.5 kg  ·  FG000145 W 6.5 × L 34 cm – 1 kg",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Koi_Carps.pdf",
        pdfFilename: "Alexander_Lamont-Koi_Carps_Wall_Art.pdf"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/alexanderlamont" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "leo-aerts-alinea",
    name: "Alinéa Design Objects - Léo Aerts",
    specialty: "Stone Furniture & Design Objects",
    image: leoAertsAlineaImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_9.50.29_AM_pngvay.png",
    biography: "Léo Aerts is a Belgian designer and the founder of Alinea Design Objects, a studio renowned for its mastery of natural stone and its ability to transform one of the earth's oldest materials into contemporary design objects of exceptional refinement. Each piece is conceived as a sculptural statement: monolithic yet precise, elemental yet deeply considered. Working closely with Belgian and Italian quarries, Aerts selects his stones for their geological character, ensuring that every table, shelf and object carries the unique signature of its material. His Angelo series has earned international recognition for its fusion of natural stone with solid American walnut.",
    notableWorks: "Angelo M/R Dining Table, Angelo M/O 290, Angelo M Side Table Collection, Angelo W Limited Edition, Visible M Horizontal Display Cabinet, Twin Chair",
    notableWorksLinks: [
      { text: "Custom Angelo M 110 Dining Table", galleryIndex: 2 },
      { text: "Angelo M/SR 55 Side Table", galleryIndex: 7 },
    ],
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
        description: "The Angelo M/R 130 dining table is Léo Aerts' most celebrated work. Award-winning design table: Good Design Award – Chicago, USA (2018), People's Choice, AZ Award – Toronto, Canada (2019), German Design Award – Frankfurt, Germany (2020)."
      },
      {
        image: leoAertsAngeloMO290,
        title: "Angelo M/O 290",
        subtitle: "Project: Olivier Lempereur, Amandine & Jules",
        category: "Tables",
        tags: ["Tables", "Dining Table"],
        materials: "Natural stone top & base • Solid American walnut",
        dimensions: "L 290 × H 75 cm",
        description: "The Angelo M/O 290 is a monumental oval dining table commissioned for a project by Olivier Lempereur — its elongated stone surface creating a sculptural centrepiece that anchors the room with quiet authority."
      },
      {
        image: leoAertsAngeloMDining,
        title: "Angelo M Side Table Collection",
        subtitle: "Three Heights",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Natural stone • Solid American walnut",
        dimensions: "M/SR 45: Ø45 × 62cm H — M/SR 55: Ø55 × 48cm H — M/SR 80: Ø80 × 36cm H",
        description: "Available in three complementary heights, the Angelo M Side Table Collection offers a family of stone objects that work independently or together — their geological variation making each a unique specimen."
      },
      {
        image: leoAertsVitrineCabinet,
        title: "Visible M Horizontal",
        subtitle: "Display Cabinet",
        category: "Storage",
        tags: ["Storage", "Cabinet"],
        materials: "Bottom part in natural stone with aluminium frame",
        dimensions: "VHS/M 120-45/60 glass: 120 × 45 × 45/60 cm\nVHS/M 120-60 glass: 120 × 45 × 60 cm\nVHS/M 150-45/60 glass: 150 × 45 × 45/60 cm",
        description: "Visible M conveys the story behind each object to its collector and admirer and adds a personal touch to the interior. Via this way, the collector can express his identity and cherish memories associated with the exposed objects."
      },
      {
        image: leoAertsTwinChairOutdoor,
        title: "Twin Chair",
        subtitle: "Outdoor",
        category: "Seating",
        tags: ["Seating", "Chair", "Outdoor"],
        materials: "Weather-resistant materials",
        dimensions: "W52 × D55 × H76 cm",
        description: "The Twin Outdoor Chair extends Alinea's material sensibility to the exterior — its robust construction and considered proportions making it as much at home on a terrace as in an interior."
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
      {
        image: leoAertsTwinChairIndoor,
        title: "Twin Chair Indoor",
        subtitle: "Leather Seat — Ash Bleached",
        category: "Seating",
        tags: ["Seating", "Chair"],
        materials: "Upholstered leather seat • Ash bleached frame\n(Also available in ashwood light gray, ashwood mid gray, ashwood dark brown, ashwood black, walnut)",
        dimensions: "W52 × D55 × H76 cm",
        description: "The Twin Indoor Chair in leather and bleached ash — its considered proportions and refined materiality making it a quietly sculptural presence in any interior."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/alinea_design_objects/?hl=en" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "apparatus-studio",
    name: "Apparatus Studio - Gabriel Hendifar",
    founder: "Gabriel Hendifar",
    specialty: "Contemporary Lighting & Industrial Design",
    image: apparatusStudioImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.57.35_AM_yilszh.png",
    biography:
      "Apparatus Studio is a New York-based design studio founded by Gabriel Hendifar and Jeremy Anderson. Known for their sculptural approach to lighting and furniture, their work combines industrial materials with refined aesthetics. The Metronome Reading Floor Lamp showcases their ability to create pieces that are both functional and sculptural.",
    notableWorks: "Lantern Table Lamp, Metronome Reading Floor Lamp, Sculptural Lighting Series",
    notableWorksLinks: [
      { text: "Lantern Table Lamp", galleryIndex: 13 },
      { text: "Median 3 Surface Alabaster Lights", galleryIndex: 0 },
      { text: "Metronome Reading Floor Lamp", galleryIndex: 10 }
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
        image: apparatusPick5, 
        title: "Segment",
        subtitle: "Console Table",
        category: "Furniture",
        tags: ["Furniture", "Console"],
        materials: "Hand-Cast Resin Legs • Lacquer or Sand-Blasted Ash Table Surface",
        dimensions: "W 147 × D 45 × H 84 cm"
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
        image: apparatusPick6, 
        title: "Pars",
        subtitle: "Cocktail Table",
        category: "Furniture",
        tags: ["Furniture", "Table"],
        materials: "Brass Armature • Stone • Hand-Cut Leather",
        dimensions: "Ø 31 × H 61 cm",
        description: "Also available in Noir Saint-Laurent Marble Top, Ebene Leather and Oil-Rubbed Bronze"
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
      { 
        image: apparatusPick7, 
        title: "Portal",
        subtitle: "Dining Lamp",
        category: "Furniture",
        tags: ["Furniture", "Table"],
        materials: "Nero Kinatra Marble",
        dimensions: "Ø 137 × H 74 cm",
        description: "Available in various Marbles, Travertine and Bleached Ash Wood"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/apparatusstudio" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "atelier-fevrier",
    name: "Atelier Fevrier - Isha Mukhia Pretet & Florian Pretet",
    specialty: "Hand-knotted Rugs & Textile Art",
    image: atelierFevrierImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.13.10_AM_tgc7kd.png",
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
      { 
        image: atelierFevrierPick5, 
        title: "Echo",
        subtitle: "Hand-knotted Rug",
        category: "Rugs",
        tags: ["Rugs", "Textile"],
        materials: "80% wool, 20% silk — 100 knots/sq. inch",
        dimensions: "Custom dimensions available",
        description: "Created in collaboration with Francois Mascarello of Mascarello Studio."
      },
      { 
        image: atelierFevrierPick6, 
        title: "Ricky",
        subtitle: "Hand-knotted Rug",
        category: "Rugs",
        tags: ["Rugs", "Textile"],
        materials: "90% wool, 10% silk — 125 knots/sq.inch",
        dimensions: "Custom dimensions available",
        description: "Ricky is inspired by Japanese engraving. Symbolizing a cloud and its lining, the details are focused around the edges with various layers and levels of cutting."
      },
      { 
        image: atelierFevrierPick7, 
        title: "Ribbon",
        subtitle: "Hand-knotted Rug",
        category: "Rugs",
        tags: ["Rugs", "Textile"],
        materials: "60% wool, 40% silk — 100 knots/sq. inch",
        dimensions: "Custom dimensions available",
        description: "Inspired by the timeless work of Léon Bakst, the Ribbon rug is the result of a close collaboration between Atelier Février and de Gournay."
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/atelierfevrier" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "atelier-pendhapa",
    name: "Atelier Pendhapa - Antonin Hautefort & Ignatio Tenggara",
    specialty: "Bespoke Furniture & Indonesian Craftsmanship",
    image: atelierPendhapaImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.10.52_AM_eabe8v.png",
    biography:
      "Atelier Pendhapa is an Indonesian design atelier specializing in bespoke furniture that celebrates the rich tradition of Indonesian woodworking and craftsmanship. Their Deepah custom table exemplifies their philosophy of creating pieces that honor traditional techniques while embracing contemporary design sensibilities. Each piece is handcrafted by master artisans using sustainably sourced materials.",
    notableWorks: "Astra Dining Table, Bespoke Dining Collection",
    notableWorksLink: { text: "Astra Dining Table", galleryIndex: 5 },
    philosophy: "We create furniture that bridges the gap between ancient Indonesian craft traditions and contemporary global design.",
    curatorPicks: [
      { 
        image: pendhapaPick1, 
        title: "Mangala",
        subtitle: "Coffee Table",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Natural teak • Raku blanc écru tabletop\nL190 × W180 × H35 cm\nProduction lead time: 14-16 weeks",
        dimensions: "All pieces are handmade to order.\nBespoke finishes and dimensions upon request.",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Atelier_Pendhapa-Mangala_Coffee_Table.pdf",
        pdfFilename: "Atelier_Pendhapa-Mangala_Coffee_Table.pdf"
      },
      { 
        image: pendhapaPick2, 
        title: "Akar",
        subtitle: "Dining Chair",
        category: "Seating",
        tags: ["Seating", "Chair"],
        materials: "Brown oak • Alpilles Camargue Trente by Elitis upholstery\nL49 × W52 × H85 cm\nProduction lead time: 10-12 weeks",
        dimensions: "All pieces are handmade to order.\nBespoke finishes and dimensions upon request.",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Atelier_Pendhapa-Akar_Dining_Chair.pdf",
        pdfFilename: "Atelier_Pendhapa-Akar_Dining_Chair.pdf"
      },
      { 
        image: pendhapaPick3, 
        title: "Gingko",
        subtitle: "Side Table",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Natural oak • White lacquer tabletop\nL75 × W48 × H50 cm\nProduction lead time: 12-14 weeks",
        dimensions: "All pieces are handmade to order.\nBespoke finishes and dimensions upon request."
      },
      { 
        image: pendhapaPick4, 
        title: "Anemos",
        subtitle: "Coffee Table",
        category: "Tables",
        tags: ["Tables", "Coffee Table"],
        materials: "Black oak • Black lacquer tabletop\nL110 × W80 × H35 cm\nProduction lead time: 14-16 weeks",
        dimensions: "All pieces are handmade to order.\nBespoke finishes and dimensions upon request.",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Atelier_Pendhapa-Anemos_Coffee_Table.pdf",
        pdfFilename: "Atelier_Pendhapa-Anemos_Coffee_Table.pdf"
      },
      { 
        image: pendhapaPick5, 
        title: "Deepah",
        subtitle: "Side Table - pictured in green onyx",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Ø40 x H50 cm\nProduction lead time: 8-10 weeks",
        dimensions: "All pieces are handmade to order.\nBespoke finishes and dimensions upon request.",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Atelier_Pendhapa-Deepah_Side_Table.pdf",
        pdfFilename: "Atelier_Pendhapa-Deepah_Side_Table.pdf"
      },
      { 
        image: pendhapaPick6, 
        title: "Astra",
        subtitle: "Dining Table - pictured in natural oak with an oxide red lacquer edging and a Laguetta marble tabletop",
        category: "Tables",
        tags: ["Tables", "Dining Table"],
        materials: "L250 x W120 x H74 cm\nProduction lead time: 12-14 weeks",
        dimensions: "All pieces are handmade to order.\nBespoke finishes and dimensions upon request.",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Atelier_Pendhapa-Astra_Dining_Table.pdf",
        pdfFilename: "Atelier_Pendhapa-Astra_Dining_Table.pdf"
      },
      { 
        image: pendhapaPick7, 
        title: "Akar",
        subtitle: "Desk/Console - pictured in black teak body with Tanya White marble tabletop",
        category: "Tables",
        tags: ["Tables", "Console"],
        materials: "L120 x W65 x H80 cm\nProduction lead time: 12-14 weeks",
        dimensions: "All pieces are handmade to order.\nBespoke finishes and dimensions upon request.",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Atelier_Pendhapa-Akar_Desk_Console.pdf",
        pdfFilename: "Atelier_Pendhapa-Akar_Desk_Console.pdf"
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
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.17.48_AM_rkjerk.png",
    biography: "Bina Baitel Studio creates interior and industrial design projects as well as unique creations in collaboration with museums and galleries. The Paris-based studio conducts a global creative approach ranging from artistic direction to technical studies, with a constant focus on timeless projects and a search for innovation. Bina Baitel's work has been exhibited at the Grand Palais, Milan Design Week, and leading design galleries worldwide.",
    notableWorks: "Sublime Collection (Mobilier National), Design Objects for Galleries and Museums",
    philosophy: "Design is always about finding the right balance between tradition and innovation, between the handmade and the industrial.",
    curatorPicks: [
      {
        image: binaBaitelPick1,
        title: "Tremblay",
        subtitle: "Console",
        category: "Furniture",
        tags: ["Furniture", "Console"],
        materials: "Arabescato Corchia Honed marble and handmade transparent wavy glass",
        dimensions: "L 144 × W 46 × H 76 cm",
        description: "Bespoke materials and dimensions upon request"
      },
      {
        image: binaBaitelPick2,
        title: "Premonitions",
        subtitle: "Bench",
        category: "Furniture",
        tags: ["Seating", "Bench"],
        materials: "Brushed brass structure • Cushions upholstered here in Terrazzo Acqua fabric from Rubelli",
        dimensions: "W 150 × D 53 × H 47 cm",
        description: "Bespoke fabrics upon request"
      },
      {
        image: binaBaitelPick3,
        title: "Sela",
        subtitle: "Sofa",
        category: "Furniture",
        tags: ["Seating", "Sofa"],
        materials: "Sofa upholstered here in Atom fabric by Raf Simons from Kvadrat",
        dimensions: "L 210 × W 115 × H 72 cm",
        description: "Bespoke fabrics upon request"
      },
      {
        image: binaBaitelPick4,
        title: "ZigZag",
        subtitle: "Bench",
        category: "Furniture",
        tags: ["Seating", "Bench"],
        materials: "Bench upholstered here in Atom fabric by Raf Simons from Kvadrat",
        dimensions: "W 160 × D 77 × H 40 cm",
        description: "Bespoke fabrics upon request"
      },
      {
        image: binaBaitelPick5,
        title: "Sublime",
        subtitle: "Ottomans S & M & Bench",
        category: "Furniture",
        tags: ["Seating", "Ottoman"],
        materials: "Curved and grooved three-layer laminated glass structure • Upholstered here in Curly Ivory fabric from Casal (Ottoman S), in Divin fabric from Lelièvre Paris and in Louison fabric from Maison Pierre Frey (Ottoman M) and in Oskar Paglia fabric from Rubelli (Bench)",
        dimensions: "S: W 54 × 45 × 42 cm · M: W 72 × 45 × 42 cm · Bench: W 120 × 45 × 42 cm",
        description: "Bespoke fabrics upon request"
      },
      {
        image: binaBaitelPick6,
        title: "ZigZag",
        subtitle: "Side Table",
        category: "Furniture",
        tags: ["Furniture", "Table"],
        materials: "Verde Guatemala marble",
        dimensions: "L 45 × W 43 × H 45 cm",
        description: "Bespoke materials and dimensions upon request"
      },
      {
        image: binaBaitelPick7,
        title: "NAIA",
        subtitle: "Sofa",
        category: "Furniture",
        tags: ["Seating", "Sofa"],
        materials: "Sofa upholstered here in Caroube Lichen fabric from Métaphores",
        dimensions: "W 300 × D 106 × H 76 cm",
        description: "Bespoke fabrics upon request"
      },
    ],
    notableWorksLinks: [
      { text: "Sublime Ottoman M in Métaphores Fabric", galleryIndex: 7 },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/binabaitel/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "bruno-de-maistre",
    name: "Atelier BdM - Bruno de Maistre",
    specialty: "Contemporary Furniture Design",
    image: brunoDeMaistreImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.20.04_AM_j1zeee.png",
    biography:
      "Bruno de Maistre is a French designer known for his poetic approach to furniture design. His Lyrical Desk demonstrates his ability to create pieces that are both functional and emotionally resonant, with flowing lines and thoughtful proportions that inspire creativity and contemplation.",
    notableWorks: "Lyric Desk, Contemporary Furniture Series",
    notableWorksLink: { text: "Lyric Desk", galleryIndex: 8 },
    philosophy: "Furniture should not just serve the body, but also nourish the soul and inspire the mind.",
    curatorPicks: [],
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
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/ELS-LOGO_ilayvb.png",
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
        subtitle: "Rectangular Dining Table (Wood)",
        category: "Tables",
        tags: ["Tables", "Dining Table"],
        materials: "Oak or Walnut top and base",
        dimensions: "L 280 × l 120 × H 74 cm"
      },
      {
        image: emmanuelLevetStennePick6,
        title: "Night Cup",
        subtitle: "Lamp",
        category: "Lighting",
        tags: ["Lighting", "Table Light"],
        materials: "Patinated or Polished Brass and Alabaster",
        dimensions: "L 29 × l 22 × H 33 cm"
      },
      {
        image: emmanuelLevetStennePick7,
        title: "Dress Up",
        subtitle: "Console",
        category: "Tables",
        tags: ["Tables", "Console", "Edition of 50"],
        materials: "Grafite / Marquina marble top, patinated bronze base",
        dimensions: "L 150 × l 45 × H 80 cm"
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/emanuellelevetstenne" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "entrelacs-creation",
    name: "Entrelacs Creation - Yves Macheret",
    specialty: "Bronze Lighting & Artisan Foundry",
    image: yvesMacheretImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.38.58_AM_cdno9k.png",
    biography:
      "Founded by the Macheret family in central France, Entrelacs is an artisan foundry where bronze and alabaster—materials inherited from the origins of our world—are crafted into timeless, pared-down expressions. Yves Macheret, who has been running the foundry with his brother Paul since 2015, trained alongside his father to master all techniques of bronze work: modelling, mould-making, casting, chasing, and patination. His vision to create minimal lighting designs at accessible prices has naturally steered him towards a timeless aesthetic that fully expresses the beauty and simplicity of these noble materials.",
    notableWorks: "Bronze & Alabaster Lighting Collection, Martell Wall Lamp",
    notableWorksLink: { text: "Martell Wall Lamp", galleryIndex: 16 },
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
    id: "felix-agostini",
    name: "Charles Paris - Felix Agostini",
    specialty: "Figural Bronze Lighting & Decorative Objects",
    image: felixAgostiniImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.42.43_AM_tsqocc.png",
    biography: "Felix Agostini is a mid-twentieth century French designer renowned for his highly refined figural bronze lighting, created under the Charles Paris imprint. Working primarily in the 1950s and 1960s, his Grande Caryatide sconces and candelabra draw on the classical tradition of architectural figural sculpture while expressing a distinctly French post-war elegance. His pieces are now highly sought after by collectors and museums worldwide.",
    notableWorks: "Grande Caryatide Sconce (Charles Paris), Figural Bronze Candelabra, Table Lamps",
    notableWorksLink: { text: "Etrier Bronze Table Lamp", galleryIndex: 9 },
    philosophy: "The figure has always been at the heart of decorative art — my work honors that tradition with modern sensibility.",
    curatorPicks: [
      { image: felixAgostiniTaureauFD, title: "Taureau Floor Lamp", category: "Lighting", tags: ["Lighting", "Floor Lamps"], materials: "Bronze base, Silk lamp shade", dimensions: "W 23 × D 20 × H 131 cm" },
      { image: felixAgostiniSocleFD, title: "Socle Table Lamp", category: "Lighting", tags: ["Lighting", "Table Lamps"], materials: "Bronze base, Silk lamp shade", dimensions: "W 15.5 × D 11 × H 57 cm" },
      { image: felixAgostiniEtrierFD, title: "Etrier", category: "Lighting", tags: ["Lighting", "Table Lamps"], materials: "Bronze", dimensions: "W 15 × D 15 × H 71 cm" },
      { image: felixAgostiniArcheoptryxFD, title: "Archeoptryx Double Skin", category: "Lighting", tags: ["Lighting", "Wall Lights"], materials: "Bronze & Parchemin", dimensions: "W 135.3 × D 24.6 × H 30 cm" },
      { image: felixAgostiniConsoleChevalFD, title: "Console Cheval", category: "Tables", tags: ["Tables", "Console"], materials: "Bronze, Cast Glass Top", dimensions: "W 150 × D 40.5 × H 91 cm" },
      { image: felixAgostiniConsoleInsituFD, title: "Console Cheval — In Situ", category: "Tables", tags: ["Tables", "Console"], materials: "Bronze, Cast Glass Top", dimensions: "W 150 × D 40.5 × H 91 cm" },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/maisoncharlesparis/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "robicara",
    name: "Robicara - Francesco Caracciolo di Marano",
    mobileNameLines: ["Robicara", "Francesco Caracciolo di Marano"],
    specialty: "Italian-crafted Luxury Furniture",
    image: robicaraImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/robicara_ehwubx.jpg",
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
    name: "Forest & Giaconia - Frédéric Forest & Clémentine Giaconia",
    specialty: "Contemporary Furniture & Lighting Design",
    image: forestGiaconiaImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Sans-titre-1_ct3lmz.gif",
    biography: "Forest & Giaconia is a French design duo known for their refined approach to contemporary furniture and lighting. Their work combines natural materials — notably walnut wood — with innovative technical elements such as PMMA, resulting in pieces of sculptural clarity and tactile warmth. The IHI Floor Lamp exemplifies their ability to create objects that are simultaneously minimal and deeply considered.",
    notableWorks: "IHI Floor Lamp (walnut & PMMA), Contemporary Furniture Collection",
    notableWorksLink: { text: "BOB Armchair - Delcourt Collection", galleryIndex: 6 },
    philosophy: "We design objects that inhabit space with quiet presence — functional forms that reward close attention.",
    curatorPicks: [
      {
        image: forestGiaconiaConsole,
        title: "Marble Console.01",
        subtitle: "for Archimobilier",
        category: "Consoles",
        tags: ["Consoles", "Marble"],
        materials: "Other finish on request",
        dimensions: "L 140 × 75 cm",
        edition: "Edition of 10",
        description: "The Marble Console.01 by Forest & Giaconia for Archimobilier is a sculptural statement piece featuring bold geometric forms in polished marble."
      },
      {
        image: forestGiaconiaTable,
        title: "Table.03",
        subtitle: "for Archimobilier",
        category: "Tables",
        tags: ["Tables", "Dining Tables"],
        materials: "Carrara Marble",
        dimensions: "L 260 × 75 cm",
        edition: "Edition of 6+2 AP",
        description: "Table.03 by Forest & Giaconia for Archimobilier is an impressive dining table carved from Carrara Marble with a sculptural pedestal base."
      },
      {
        image: forestGiaconiaCoffee,
        title: "Coffee.03",
        subtitle: "for Archimobilier",
        category: "Tables",
        tags: ["Tables", "Coffee Tables"],
        materials: "Wood & Lacquer",
        dimensions: "L 110 × 42 cm",
        edition: "Edition of 10",
        description: "Coffee.03 by Forest & Giaconia for Archimobilier is a geometric coffee table combining wood and lacquer in a modular, grid-inspired design."
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/forest.giaconia/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "garnier-linker",
    name: "Garnier & Linker - Guillaume Garnier & Florent Linker",
    specialty: "Lost-Wax Crystal & Sculptural Glass Objects",
    image: garnierLinkerImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.45.53_AM_xuwt7r.png",
    biography: "Guillaume Garnier and Florent Linker are two French creators based in Paris. Their work is about giving a contemporary design to rare materials and savoir-faire. All pieces are handmade in small series by French master craftsmen. As designers, they draw inspiration from both decorative arts and sculpture to create pure-shaped forms that reveal their materiality. With their background in interior design, they offer objects that are as comfortable in a gallery as in a private home.",
    notableWorks: "Lost-Wax Crystal Centerpiece for Théorème Éditions (Maison Affluency), Sculptural Crystal Vessels",
    notableWorksLink: { text: "Crystal Centerpiece - Théorème Editions", galleryIndex: 1 },
    philosophy: "Crystal is the most unforgiving of materials — it demands complete mastery and rewards it with unmatched luminosity.",
    curatorPicks: [
      { image: garnierLinkerEratoPendant, title: "Erato Pendant Large", category: "Lighting", tags: ["Lighting", "Pendants"], materials: "White alabaster or white alabaster with brown veins. Patinas: light bronze, dark bronze, blackened bronze or black matt", dimensions: "Without pendant stem (to order): Ø 16 x H 35 cm. Also available in Ø 12 x H 24 cm and Ø 12 x H 33 cm" },
      { image: garnierLinkerLipariPendant, title: "Lipari Pendant", category: "Lighting", tags: ["Lighting", "Pendants"], materials: "Volcanic Stone, Grey Travertine or Navona Travertine, Patinated Brass Details. Stainless steel cables or patinated brass tubes. Each piece is numbered and signed", dimensions: "Ø 8 x length on request up to 250 cm, adjustable height" },
      { image: garnierLinkerBoraSconce, title: "Bora Sconce Uplight", category: "Lighting", tags: ["Lighting", "Sconces"], materials: "Sconce in lost-wax cast glass, patinated brass structure. Each piece is numbered and signed", dimensions: "W 12 x D 17 x H 24 cm" },
      { image: garnierLinkerCallistoPendant, title: "Callisto Pendant x 4", category: "Lighting", tags: ["Lighting", "Pendants"], materials: "Pendant in alabaster, patinated brass structure. Each piece is numbered and signed", dimensions: "Without suspension stem (to order): Ø 16 x H 52 cm" },
      { image: garnierLinkerOrionPendant, title: "Orion Pendant", category: "Lighting", tags: ["Lighting", "Pendants"], materials: "Pendant in alabaster and patinated brass. Each piece is numbered and signed", dimensions: "Ø 11 x L 200 cm. Also exists in length 150 cm" },
      { image: garnierLinkerCalliopeChandelier, title: "Calliope Medium Chandelier", category: "Lighting", tags: ["Lighting", "Chandeliers"], materials: "Chandelier in alabaster, patinated brass structure. Each piece is numbered and signed", dimensions: "Without suspension stem (to order): Ø 56 x H 28 cm. Also available in Ø 67 x H 36 cm" },
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
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/v1772270538/Screen_Shot_2026-02-28_at_5.21.50_PM_skmljz.png",
    biography:
      "Hamrei brings a playful yet sophisticated approach to contemporary design. Their Pépé Chair showcases their signature style of combining comfort with unexpected visual delight. Each piece demonstrates a mastery of form and craftsmanship while maintaining a sense of joy and personality.",
    notableWorks: "Pépé Chair, Whimsical Furniture Collection",
    notableWorksLink: { text: "Pépé Chair", galleryIndex: 4 },
    philosophy:
      "Design should bring joy and surprise to daily life while maintaining the highest standards of craftsmanship.",
    curatorPicks: [
      {
        image: hamreiPick4,
        title: "MIRRA Side Table",
        category: "Tables",
        tags: ["Tables", "Side Table"],
        materials: "Textured blackened brass, solid Murano glass top (Ocean Blue)",
        dimensions: "Ø36 × H48 cm (glass Ø32 cm)"
      },
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
        image: hamreiPick5,
        title: "TRIO Dining Table",
        category: "Tables",
        tags: ["Tables", "Dining Table"],
        materials: "Hand-chiseled stone top, textured earthenware ceramic base",
        dimensions: "Ø120 × H75 cm (customisable)"
      },
      {
        image: hamreiPick6,
        title: "TRIO Dining Table & Pépé Chair Composition",
        category: "Tables & Seating",
        tags: ["Tables", "Dining Table", "Chairs"],
        materials: "Hand-chiseled stone top, textured earthenware ceramic base, brass chair frame with woven upholstery",
      },
    ],
    links: [
      { type: "Instagram", url: "https://instagram.com/hamrei" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "jean-michel-frank",
    name: "ECART Re-Edition - Jean-Michel Frank",
    specialty: "Minimalist Luxury & Art Deco Pioneer",
    image: jeanMichelFrankImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/v1772270649/Screen_Shot_2026-02-28_at_5.23.19_PM_widtwe.png",
    imagePosition: "center 20%",
    biography:
      "Jean-Michel Frank (1895–1941) was a legendary French interior decorator and furniture designer who pioneered the luxurious minimalist aesthetic of the Art Deco era. His work emphasized refined simplicity, using the finest materials—parchment, shagreen, straw marquetry, and bronze—to create pieces of understated elegance. Collaborating with artists like Alberto Giacometti and Christian Bérard, Frank created iconic designs that continue to influence contemporary luxury interiors.",
    notableWorks: "Soleil Coffee Table 1930, Stool 1934 (with Adolphe Chanaux), Parchment-covered furniture, Shagreen desks",
    notableWorksLinks: [
      { text: "Soleil (Straw) Coffee Table 1930", galleryIndex: 3 },
      { text: "X-Stool 1934", galleryIndex: 1 },
    ],
    philosophy: "Simplicity is the ultimate sophistication—luxury lies in the quality of materials and the perfection of form.",
    curatorPicks: [
      {
        image: jmfUpholsteredBackSofa,
        title: "Upholstered Back 3-Seater Sofa",
        subtitle: "1932",
        category: "Furniture",
        tags: ["Furniture", "Sofa"],
        materials: "Varnished Solid Oak • Leather",
        dimensions: "L 230 × P 89 × H 81 cm",
        description: "Available in 2-seater: L 160 × P 89 × H 81 cm"
      },
      {
        image: jmfCroisillonLamp,
        title: "Croisillon Lamp",
        subtitle: "1928",
        category: "Lighting",
        tags: ["Lighting", "Table Lamp"],
        materials: "Varnished Solid Oak Base • Patinated Brass • Cotton Lamp Shade",
        dimensions: "Ø 34 × H 51 cm",
        description: "Also available with a solid Walnut, Golden Brass or Black Patinated Brass base"
      },
      {
        image: jmfSoleilTable1,
        title: "Soleil Coffee Table",
        subtitle: "1930",
        category: "Furniture",
        tags: ["Furniture", "Coffee Table"],
        materials: "Straw Marquetry",
        dimensions: "Ø 85 × H 35 cm"
      },
      {
        image: jmfSoleilTable2,
        title: "Soleil Coffee Table",
        subtitle: "1930 — Close-Up",
        category: "Furniture",
        tags: ["Furniture", "Coffee Table"],
        materials: "Straw Marquetry",
        dimensions: "Ø 85 × H 35 cm"
      },
      {
        image: jmfElephantArmchair,
        title: "Elephant Armchair",
        subtitle: "1939",
        category: "Furniture",
        tags: ["Furniture", "Armchair"],
        materials: "Smooth Solid Oak Frame • Fabric",
        dimensions: "L 87 × D 100 × H 73 cm",
        description: "Various Oak and Walnut finishes available on request"
      },
      {
        image: jmfRoundTable1,
        title: "Round Table",
        subtitle: "1935",
        category: "Furniture",
        tags: ["Furniture", "Dining Table"],
        materials: "Sandblasted Oak Marquetry • Deep Sandblasted Oak",
        dimensions: "Ø 150 × H 75 cm"
      },
      {
        image: jmfRoundTable2,
        title: "Round Table",
        subtitle: "1935 — Close-Up",
        category: "Furniture",
        tags: ["Furniture", "Dining Table"],
        materials: "Sandblasted Oak Marquetry • Deep Sandblasted Oak",
        dimensions: "Ø 150 × H 75 cm"
      },
      {
        image: jmfPresidentDesk2,
        title: "President Desk",
        subtitle: "1930 — Fully Opened",
        category: "Furniture",
        tags: ["Furniture", "Desk"],
        materials: "Varnished Oak • Patinated Brass",
        dimensions: "L 272 × P 85 × H 75 cm (L 160 once closed)"
      },
      {
        image: jmfXStoolRound,
        title: "X Stool (Round)",
        subtitle: "1934",
        category: "Furniture",
        tags: ["Furniture", "Stool"],
        materials: "Sandblasted Varnished Oak • Foal Hide",
        dimensions: "Ø 55 × H 43 cm"
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
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.51.56_AM_aukfkk.png",
    biography:
      "Born in Paris and raised in Western Africa, Jeremy Maxwell Wintrebert is a glass artist of French and North American heritage who established JMW Studio in 2015 beneath the historic Viaduc des Arts in Paris. After apprenticing with masters including Dale Chihuly in Seattle and Davide Salvadore in Venice, he developed his signature freehand glassblowing technique. Winner of the 2019 Prix Bettencourt pour l'Intelligence de la Main, his work graces the collections of the Victoria & Albert Museum, Palais de Tokyo, and MusVerre.",
    notableWorks: "Cloud Bulle Pendants, Autumn Light Pendants, Space Nugget Side Table, Sonde Chandelier, Dark Matter Installation",
    notableWorksLink: { text: "Cloud Bulle Pendants", galleryIndex: 4 },
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
    imagePosition: "center 20%",
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/kerstens_logo_symbol_white_square_pbwx6z.jpg",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Kerstens_Mono_STS-Large.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Kerstens_Mono_CLS-1600.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Kerstens_Rift_CTW-1800.pdf",
        description: ""
      },
      {
        image: kertensPick5,
        title: "Rift CTS",
        subtitle: "White washed oak, brown travertine",
        category: "Tables",
        tags: ["Tables", "Open Edition + 2 AP"],
        materials: "",
        dimensions: "W 108 × D 108 × H 28 cm – 254 kg",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Kerstens_Rift_CTS-1080.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Kerstens_Yoma_CLW-2550.pdf",
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
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/Kerstens_Yoma_CLW-2550.pdf",
        description: ""
      },
    ],
    links: [
      { type: "Instagram", url: "https://www.instagram.com/_kerstens/" },
      { type: "Curators' Picks" },
    ],
  },
  {
    id: "leo-sentou",
    name: "Leo Sentou",
    specialty: "Contemporary Classicist Furniture Design",
    image: leoSentouImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_10.59.56_AM_ehkyal.png",
    biography:
      "French designer Leo Sentou is a contemporary classicist whose debut capsule collection pays homage to the elegance and sophistication of eighteenth-century French decorative arts. His pieces are rooted in tradition yet unequivocally modern, reducing classical forms to their essential shapes while elevating them with a refined palette of limed oak, wrought iron, bronze, mohair, linen and lacquer.",
    notableWorks: "Fauteuil L.D (oval bergère), Side Table L.A, Chair G.J, AB Armchair",
    notableWorksLink: { text: "AB Armchair", galleryIndex: 3 },
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
    name: "Made in Kira - Roman Frankel",
    specialty: "Hand-crafted Ceramic Lamps & Objects",
    image: kiraImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Kira_v3ivdj.jpg",
    biography: "Kira is primarily the expression, in a character object, of an identity and a history, that of a child of Japan in search of a fair balance. In the subtlety of a line and the intensity of a color, Roman Akira Frankel praises the shadow through a collection of lacquered lamps.\n\nFounded in 2022 in Paris, Kira oscillates between tradition and modernity, lightness and depth, design and sculpture, to create objects filled with meaning and significance. Drawing on Japan's aesthetic vocabulary, the collection invites contemplation.",
    notableWorks: "Toshiro Lamp (Maison Affluency), Hand-thrown Ceramic Collection",
    notableWorksLink: { text: "Toshiro Lamp", galleryIndex: 8 },
    philosophy: "Each piece is a unique conversation between the hand, the clay and the fire — no two are ever alike.",
    curatorPicks: [],
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
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_11.17.03_AM_vrfoan.png",
    biography: "Man of Parts is a Hamburg-based design brand founded by Stephan Weishaupt, co-founder of the design magazine Wallpaper*. The brand commissions furniture and objects from leading international designers — including Yabu Pushelberg, Sebastian Herkner, and Osvaldo Tenório — producing pieces of exceptional quality that bridge the gallery and the home. Each collection reflects a distinct design vision united by the pursuit of craft excellence.",
    notableWorks: "Lombard Street Sofa (Yabu Pushelberg), Mainkai Lamp (Sebastian Herkner), Rua Tucumã Tables",
    notableWorksLinks: [
      { text: "Yabu Pushelberg's Park Place Bar/Counter Stool", galleryIndex: 19 },
    ],
    philosophy: "We believe in furniture made with integrity — pieces conceived by great designers and realized by the best craftspeople in the world.",
    curatorPicks: [
      { image: manOfPartsCoffeeTable, title: "Praia da Granja Coffee Table", subtitle: "by Sebastian Herkner", category: "Tables", materials: "A mixed textured stone top with a solid walnut or oak base", dimensions: "W 125 × D 40 × H 34 cm" },
      { image: manOfPartsLoungeChair, title: "Frenchmen Street Lounge Chair", subtitle: "by Sebastian Herkner", category: "Armchair", materials: "Solid oak frame, Fully upholstered in fabric or leather", dimensions: "W 82 × D 77 × H 73 cm — SH 40 cm" },
      { image: manOfPartsFloorLamp, title: "Cinnamon Gardens Floor Lamp", subtitle: "by Yabu Pushelberg", category: "Lighting", materials: "Solid Ash Wood, Esprit Nuvola — 100% Linen Shade", dimensions: "D 55 × H 156 cm" },
      { image: manOfPartsRuaLeblon, title: "Rua Leblon", subtitle: "by Yabu Pushelberg", category: "Armchair", materials: "Upholstered in fabric or leather with return swivel. Powder coated black steel with walnut or anthracite base", dimensions: "W 90 × D 92 × H 76 cm — SH 44 cm" },
      { image: manOfPartsBondStreetStool, title: "Bond Street Stool", subtitle: "by Yabu Pushelberg", category: "Stool", materials: "Full upholstery in fabric or leather with a Powdercoat Bronze swivel base", dimensions: "W 62.5 × D 46 × H 63.5 cm — SH 49.3 cm" },
      { image: manOfPartsSandyCoveSofa, title: "Sandy Cove Sofa", subtitle: "by Sebastian Herkner", category: "Sofa", materials: "Full upholstered in fabric or leather", dimensions: "W 190 × D 108 × H 70 cm — SH 40 cm" },
      { image: manOfPartsCocktailTable, title: "Madison Avenue Cocktail Table", subtitle: "by Yabu Pushelberg", category: "Side Table", materials: "Marble top with aged brass base", dimensions: "Ø 40.5 × H 47 cm" },
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
    imagePosition: "center 30%",
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_11.18.21_AM_blwg7a.png",
    biography:
      "Milan Pekař is a Czech glass artist renowned for his mastery of crystalline glass techniques. His Crystalline Vase collection showcases his exceptional skill in creating pieces that capture and refract light in mesmerizing ways. Working in the tradition of Bohemian glassmaking while pushing contemporary boundaries, his work transforms functional vessels into sculptural art.",
    notableWorks: "Crystalline Vase Collection, Crystalline Volume Series, Sculptural Glass Vessels",
    notableWorksLinks: [
      { text: "Crystalline Vase — Volume 5", galleryIndex: 18 },
      { text: "Crystalline Vase — Volume 3", galleryIndex: 5 },
    ],
    
    philosophy: "Glass is frozen light—my work seeks to capture that ephemeral quality in permanent form.",
    curatorPicks: [
      { image: milanPekarCrystallineSeries, title: "Crystalline Volume Series", category: "Decorative Object", tags: ["Decorative Object", "Collection"], materials: "Hand-blown crystalline glass — Bohemian technique" },
      { image: milanPekarCrystallineVase, title: "Crystalline Vase", category: "Decorative Object", tags: ["Decorative Object", "Vessel"], materials: "Hand-blown crystalline glass — Bohemian technique", dimensions: "Ø 16 × H 36 cm", description: "Milan Pekař's Crystalline vases are the result of an extraordinarily demanding glassblowing process that produces spontaneous crystal formations on the surface of the glass. No two pieces are alike — each is a unique collaboration between the artist's hand and the alchemy of fire and mineral." },
      { image: milanPekarCrystallineV2, title: "Crystalline Volume 2 Vase", category: "Decorative Object", tags: ["Decorative Object", "Vessel"], materials: "Hand-blown crystalline glass — Bohemian technique", dimensions: "Ø 15 × H 24 cm" },
      { image: milanPekarCrystallineSmall, title: "Crystalline Small Vase", category: "Decorative Object", tags: ["Decorative Object", "Vessel"], materials: "Hand-blown crystalline glass — Bohemian technique", dimensions: "Ø 10 × H 15 cm" },
      { image: milanPekarCrystallineXL, title: "Crystalline XL Vase", category: "Decorative Object", tags: ["Decorative Object", "Vessel"], materials: "Hand-blown crystalline glass — Bohemian technique", dimensions: "Ø 22 × H 36 cm" },
      { image: milanPekarMetallicVase, title: "Volume Metallic Vase", category: "Decorative Object", tags: ["Decorative Object", "Vessel"], materials: "Metallic glaze with triangle spinel crystal — based on ancient Chinese Tenmoku glaze from the 12th century", description: "This metallic glaze with triangle crystal is based on the ancient Chinese glaze Tenmoku from the 12th century. The most interesting aspect of this process is the crystallisation of metal oxides in triangle shapes (spinel crystal), a most unusual formation in ceramic glazes." },
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
    notableWorksLink: { text: "Custom Glass Chandelier", galleryIndex: 8 },
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
    name: "NDL Editions - Noé Duchaufour Lawrance",
    specialty: "Organic Furniture & Crystal Design",
    image: noeDuchaufourImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_1.03.34_PM_p6ne46.png",
    biography: "Noé Duchaufour-Lawrance is a French designer based in Paris known for his organic, biomorphic approach to furniture and objects. His work explores the intersection of natural forms and industrial materials, creating pieces of rare tactile and visual poetry. He has collaborated with Saint-Louis crystal, Bernhardt Design, and leading European manufacturers. His Amber Folia Portable Lamp for Cristallerie Saint-Louis — featured at Maison Affluency — showcases his mastery of translucent materials and organic form.",
    notableWorks: "Amber Folia Portable Lamp for Saint-Louis (Maison Affluency), Refine Console, Steinway Collaboration",
    notableWorksLink: { text: "Amber Folia Lamp for Cristallerie Saint-Louis", galleryIndex: 26 },
    philosophy: "Nature has already designed everything. My role is to find those forms and translate them into objects that resonate with the human hand and eye.",
    curatorPicks: [
      {
        image: noeMineralFlowerCoffee,
        title: "Mineral Flower Coffee Table",
        subtitle: "",
        category: "Tables",
        tags: ["Tables", "Coffee Tables"],
        edition: "Edition of 12 + 4 AP",
        materials: "Marble",
        dimensions: "W 121 × D 114 × H 46,5 cm – 180 kg",
        description: "The Mineral Flower Coffee Table by Noé Duchaufour-Lawrance is a monumental marble coffee table composed of sweeping, overlapping stone petals. Its sculptural silhouette transforms raw marble into a fluid, flower-inspired centrepiece of extraordinary presence.",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/NDL_Editions-Mineral_Flower_Coffee_Table.pdf",
        pdfFilename: "NDL-Edition_Mineral Flower Coffee Table_2019.pdf"
      },
      {
        image: noeDuchaufourMadonnaTables,
        title: "Madonna Del Monte Coffee & Side Table",
        subtitle: "",
        category: "Tables",
        tags: ["Tables", "Coffee Tables", "Side Tables"],
        edition: "Edition of 18 + 2 AP",
        materials: "Glass & Aluminium",
        dimensions: "Side Table: W 50 × D 50 × H 60 cm – 33 kg\nTable M: W 70 × D 70 × H 33 cm – 45 kg\nTable L: W 90 × D 90 × H 35 cm – 66 kg",
        description: "The Madonna Del Monte collection by Noé Duchaufour-Lawrance features a series of round tables in glass and aluminium, available in three sizes. Their sculpted glass tops evoke organic water ripple forms, combining biomorphic design with industrial precision.",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/NDL_Editions-Madonna_Del_Monte-Round_Coffee_Table_L_1.pdf",
        pdfFilename: "NDL Editions-Madonna Del Monte-Round Coffee Table L.pdf"
      },
      {
        image: noeMineralFlowerSide,
        title: "Mineral Flower Side Table II",
        subtitle: "",
        category: "Tables",
        tags: ["Tables", "Side Tables"],
        edition: "Edition of 12 + 4 AP",
        materials: "Marble",
        dimensions: "W 47,8 × D 61,5 × H 53 cm – 50 kg",
        description: "The Mineral Flower Side Table II by Noé Duchaufour-Lawrance is a sculptural marble side table whose interlocking petal-like forms evoke natural stone erosion. Each piece is carved from a single block, celebrating the raw beauty of marble through organic, biomorphic geometry.",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/NDL_Editions-Mineral_Flower_Side_Table_II.pdf"
      },
      {
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good/v1772192484/Screen_Shot_2026-02-27_at_7.40.07_PM_pyyf8x.png",
        title: "Whisper Large Sofa",
        subtitle: "",
        category: "Seating",
        tags: ["Seating", "Sofas"],
        edition: "Edition of 12 + 4 AP",
        materials: "",
        dimensions: "H 84 × L 392 × D 100 cm – 120 kg\nProduction lead time: 12 weeks",
        description: "",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/NDL-Editions_Whisper_Large_Sofa_1.pdf",
        pdfFilename: "NDL-Editions_Whisper_Large_Sofa_1.pdf"
      },
      {
        image: "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,q_auto:good/v1772193015/Screen_Shot_2026-02-27_at_7.49.36_PM_xtpnov.png",
        title: "Nazaré Suspension II Pendant Lamp",
        subtitle: "",
        category: "Lighting",
        tags: ["Lighting", "Pendant Lamps"],
        edition: "Edition of 12",
        materials: "Bronze",
        dimensions: "W 146 × D 146 × H 100 cm – 80 kg\nProduction lead time: 16 weeks",
        description: "",
        pdfUrl: "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/pdfs/NDL_Editions_Nazare_Lamp_II_1.pdf",
        pdfFilename: "NDL_Editions_Nazare_Lamp_II_1.pdf"
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
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_1.05.50_PM_bmnfjc.png",
    biography:
      "Olivia Cognet is a French ceramic artist that draws her inspiration from the South of France where she grew up and and was nourished by the brilliant masters from the school of Vallauris, from Picasso to Roger Capron. Her Vallauris floor lamp in a custom blue glazed ceramic, is a testimony of her constant search for the balance between art & design. ",
    notableWorks: "Bas Relief sculptures, Vallauris floor lamp",
    notableWorksLink: { text: "Blue Glazed Vallauris Floor Lamp", galleryIndex: 3 },
    philosophy: "Blending modern brutalism with a graphic feminine sensibility.",
    curatorPicks: [
      { image: oliviaCognetRedTravertine, title: "Custom Bas Relief", category: "Wall Art", tags: ["Wall Art", "Sculpture"], materials: "Red Travertine", dimensions: "285 × 175 cm" },
      { image: oliviaCognetVallaurisLamps, title: "Vallauris Floor Lamp", category: "Lighting", tags: ["Lighting", "Floor Lamps"], materials: "Ceramic base", dimensions: "H 60–75 cm Ø 70–80 cm · Shade: Ø 40 × 100 cm" },
      { image: oliviaCognetCeramicRelief, title: "Custom Bas Relief", category: "Wall Art", tags: ["Wall Art", "Sculpture"], materials: "Ceramic", dimensions: "140 × 80 cm" },
      { image: oliviaCognetLeSudVessels, title: "Mediterranean Glazed Vessels", category: "Objects", tags: ["Objects", "Vessels", "Le Sud Serie"], materials: "Glazed Ceramic", dimensions: "Medium: 30–40 cm · Large: 50 cm" },
      { image: oliviaCognetCurveXxl, title: "Curve XXL Chandelier", category: "Lighting", tags: ["Lighting", "Chandeliers"], materials: "Ceramic", dimensions: "W 120 × D 75 × H 40 cm" },
      { image: oliviaCognetTotemSeries, title: "Totem Series", category: "Sculpture", tags: ["Sculpture", "Objects"], materials: "Ceramic, Steel base", dimensions: "Small: 170 cm · Medium: 190 cm · Large: 220 cm" },
      { image: oliviaCognetRetrofutureTable, title: "Retrofuture Coffee Table", category: "Tables", tags: ["Tables", "Coffee Tables"], materials: "Ceramic", dimensions: "L 130 × W 60 × H 45 cm" },
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
    notableWorks: "Bronze Painting 204, 2023 (130 x 130 cm), Café Marly at the Louvre, Mineral Painting Series",
    notableWorksLink: { text: "Bronze Painting 204, 2023", galleryIndex: 11 },
    philosophy: "The material, colors and light are inseparable in my work. I create my own textures from the earth itself.",
    curatorPicks: [
      { image: pierreBonnefilleMetamorphosisLamps, title: "Metamorphosis Lamps A&B", category: "Lighting", subcategory: "Table Lamps", tags: ["Lighting", "Table Lamps"], materials: "Table lamp in mixed media on wood. Patinated brass with burnished bronze or burnished copper finish\nBespoke Dimensions and Colours upon request", dimensions: "W 16 × D 30 × H 59 cm / Lampshade Ø 30 × H 25 cm", photoCredit: "Luca Bonnefille" },
      { image: pierreBonnefilleMetamorphosisPolygone, title: "Metamorphosis Polygone 1", category: "Tables", subcategory: "Dining Tables", tags: ["Tables", "Dining Tables"], materials: "Mixed media on wood. Burnished carbon base. Also available in copper.\nBespoke Dimensions and Colours upon request", dimensions: "W 240 × D 100 × H 72 cm", edition: "Edition of 8 + 2 AP", photoCredit: "Luca Bonnefille" },
      { image: pierreBonnefilleBlocSideboardII, title: "Bloc Sideboard II", category: "Storage", subcategory: "Sideboards", tags: ["Storage", "Sideboards"], materials: "Mixed media on wood, patinated steel\nBespoke Dimensions and Colours upon request", dimensions: "W 200 × D 45 × H 75 cm", edition: "Edition of 20 + 4 AP", photoCredit: "Luca Bonnefille" },
      { image: pierreBonnefilleTabouretsStone, title: "3 Stone Stools", category: "Seating", subcategory: "Stools", tags: ["Seating", "Stool"], materials: "Stool in mixed material, mixture of natural pigments, mineral and metallic powders applied on a wooden structure\nBespoke Dimensions and Colours upon request", dimensions: "A. 41 × 39 × 29 cm / B. 41 × 41 × 25 cm / C. 41 × 37 × 28 cm", photoCredit: "Luca Bonnefille" },
      { image: pierreBonnefilleStoneD, title: "Stone D (Medium) Limonite D'Eau Coffee Table", category: "Tables", subcategory: "Coffee Tables", tags: ["Tables", "Coffee Tables"], materials: "Tabletop in mixed material, mixture of natural pigments, mineral and metallic powders applied on a wooden structure\nBespoke Dimensions and Colours upon request", dimensions: "W 130 × D 118 × H 41 cm\n(Also available in W 105 × D 96 × H 41 cm and W 176 × D 160 × H 41 cm)", edition: "Edition of 8 + 2 AP", photoCredit: "Luca Bonnefille" },
      { image: pierreBonnefilleEnfiladeBloc, title: "Enfilade Bloc - Partition Bronze", category: "Storage", subcategory: "Sideboards", tags: ["Storage", "Sideboards"], materials: "Mixed media on wood, patinated brass\nBespoke Dimensions and Colours upon request", dimensions: "W 236 × D 43 × H 83 cm", edition: "Edition of 8 + 2 AP", photoCredit: "Luca Bonnefille" },
      { image: pierreBonnefilleStoneFloorLamp, title: "Stone Floor Lamp", category: "Lighting", subcategory: "Floor Lamps", tags: ["Lighting", "Floor Lamps"], materials: "Mixed media on wood\nBespoke Dimensions and Colours upon request", dimensions: "Ø 42 × H 142 cm", photoCredit: "Luca Bonnefille" },
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
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_1.13.56_PM_ylsods.png",
    biography: "Reda Amalou is a French architect and designer who founded the architectural agency AW2 over 25 years ago with the ambition of transcending the boundaries between architecture and design. A true creator of experiences, his work spans luxury hospitality architecture (Six Senses, Coucoo Cabanes) to collectible furniture editions. His DOT side table — a perfect geometric sphere in lacquered wood — has become one of the most recognized pieces in contemporary French design.",
    notableWorks: "DOT Side Table (Maison Affluency), Eggshell Collection, AW2 Hospitality Projects",
    notableWorksLink: { text: "DOT Side Table", galleryIndex: 17 },
    philosophy: "Architecture and design are the same discipline — both are about creating places that stimulate the mind and mobilize the senses.",
    curatorPicks: [
      {
        image: redaAmalouLadybug,
        title: "Lady Bug Side Table",
        subtitle: "",
        materials: "Base with hammered bronze finish, Wooden top covered with gauze and varnished",
        dimensions: "Ø40 x H45 cm",
      },
      {
        image: redaAmalouIce,
        title: "ICE Pendant Light",
        subtitle: "for Véronèse",
        materials: "Murano glass, Aluminium structure col.Bronze",
        dimensions: "9 x 80 / 120 / 160 / 200 x H24 cm",
      },
      {
        image: redaAmalouSteeltop,
        title: "STEELTOP Bookcase",
        subtitle: "",
        materials: "Black Steel and American walnut",
        dimensions: "110 / 150 x 40 x H210 cm",
      },
      {
        image: redaAmalouEgg,
        title: "EGG Coffee Table",
        subtitle: "",
        materials: "Solid wood. Available finishes: American walnut, natural oak or stained oak",
        dimensions: "80 x 60 x H40 cm",
      },
      {
        image: redaAmalouMuse,
        title: "MUSE Rug",
        subtitle: "for Toulemonde Bochart",
        materials: "Hand-tufted, vegetable silk and wool",
        dimensions: "250 x 350 cm",
      },
      {
        image: redaAmalouOoma,
        title: "OOMA Dining Table",
        subtitle: "",
        materials: "Double top in wood and marble. Wooden base. Wood finish: American walnut, stained oak, or natural oak. Marble finish: Carrara White, Emperador, Nero Marquina, or Sahara",
        dimensions: "160 x 160 x 75 cm and 180 x 180 x 75 cm",
      },
      {
        image: redaAmalouTara,
        title: "TARA Desk",
        subtitle: "",
        materials: "Base in American walnut or black stained oak. Hand-lacquered top, glossy or matte finish. 19 colours available. Drawer, leather interior",
        dimensions: "120 / 140 / 160 x 61 x H72 cm",
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
    specialty: "Sculptural Furniture & Unique Pieces",
    image: thierryLemaireImg,
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_1.21.03_PM_hzotke.png",
    biography:
      "A French Star Architect, Interior Designer and Designer, Thierry Lemaire is known for his sculptural approach to furniture design. His pieces blend fine craftsmanship with contemporary aesthetics, creating limited edition works that are as much art as they are functional objects. His Orsay Centre Table exemplifies his signature style of elegant forms with unexpected details.",
    notableWorks:
      "Niko 420 Custom Sofa. \nLimited and numbered edition (12 copies).",
    notableWorksLinks: [
      { text: "Niko 420 Custom Sofa", galleryIndex: 0 },
    ],
    philosophy: "Each piece is a unique statement that transforms everyday furniture into collectible design objects.",
    curatorPicks: [],
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
    logoUrl: "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,q_auto,f_auto/Screen_Shot_2026-02-28_at_1.21.57_PM_z2fdnp.png",
    biography: "Tristan Auer is a Paris-based interior architect and designer who trained at ESAG Paris before collaborating with Christian Liaigre and Philippe Starck on landmark international projects. In 2002 he founded his own agency, going on to design the lobbies of leading luxury hotels across Europe. His Veronese furniture collection — produced by the prestigious French manufacturer of the same name — distils his signature aesthetic: architectural rigour, noble materials, and a quietly bold luxury.",
    notableWorks: "Veronese Furniture Collection, Hotel Wilson — Paris, Les Ambassadeurs — Paris",
    notableWorksLink: { text: "YSA Wall Lamp for Véronèse", galleryIndex: 22 },
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
  const [selectedCategory, setSelectedCategoryRaw] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategoryRaw] = useState<string | null>(null);
  const categorySourceRef = useRef<string | null>(null);

  const broadcastFilter = useCallback((cat: string | null, sub: string | null) => {
    window.dispatchEvent(new CustomEvent('syncCategoryFilter', { detail: { category: cat, subcategory: sub, source: 'designers' } }));
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

  const [showSearch, setShowSearch] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openDesigners, setOpenDesigners] = useState<string[]>([]);
  const [curatorPicksDesigner, setCuratorPicksDesigner] = useState<typeof featuredDesigners[0] | null>(null);
  const [curatorPickIndex, setCuratorPickIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const imageZoomedRef = useRef(false);
  const [imageLoaded, setImageLoaded] = useState(true);

  // Deep-link handler: expand designer from URL hash
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.section !== "designer") return;
      const designer = featuredDesigners.find(d => d.id === detail.id);
      if (designer) {
        setOpenDesigners(prev => prev.includes(designer.id) ? prev : [...prev, designer.id]);
        // Scroll to the specific designer after accordion opens
        requestAnimationFrame(() => {
          const el = document.getElementById(`designer-${designer.id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };
    window.addEventListener("deeplink-open-profile", handler);
    return () => window.removeEventListener("deeplink-open-profile", handler);
  }, []);

  // Preload adjacent curator pick images for smooth transitions
  useEffect(() => {
    if (!curatorPicksDesigner?.curatorPicks?.length) return;
    const picks = curatorPicksDesigner.curatorPicks;
    const toPreload = [curatorPickIndex - 1, curatorPickIndex + 1].filter(
      i => i >= 0 && i < picks.length
    );
    toPreload.forEach(i => {
      const img = new Image();
      img.src = picks[i].image;
    });
  }, [curatorPickIndex, curatorPicksDesigner]);

  // Also preload all images when lightbox opens
  useEffect(() => {
    if (!curatorPicksDesigner?.curatorPicks?.length) return;
    curatorPicksDesigner.curatorPicks.forEach(pick => {
      if (pick.image) {
        const img = new Image();
        img.src = pick.image;
      }
    });
  }, [curatorPicksDesigner]);

  // History state: push when lightbox opens so browser back button returns to lightbox
  useEffect(() => {
    if (!curatorPicksDesigner) return;

    window.history.pushState({ curatorPicksLightbox: true }, '');

    const handlePopState = () => {
      setCuratorPicksDesigner(null);
      setCuratorPickIndex(0);
      setIsZoomed(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [curatorPicksDesigner]);

  // Helper: check if a curator pick matches the active subcategory/category filter
  const pickMatchesFilter = useMemo(() => {
    if (!selectedSubcategory && !selectedCategory) return () => true;
    const SUB_TAGS: Record<string, string[]> = {
      "Sofas": ["Sofa"], "Armchairs": ["Armchair", "Armchairs"], "Chairs": ["Chair"],
      "Daybeds & Benches": ["Daybed", "Bench"], "Ottomans & Stools": ["Ottoman", "Stool"],
      "Bar Stools": ["Bar Stool"], "Consoles": ["Console"], "Coffee Tables": ["Coffee Table"],
      "Desks": ["Desk"], "Dining Tables": ["Dining Table"], "Side Tables": ["Side Table"],
      "Wall Lights": ["Wall Light", "Sconce"], "Ceiling Lights": ["Ceiling Light", "Chandelier", "Pendant"],
      "Floor Lights": ["Floor Light", "Floor Lamp"], "Table Lights": ["Table Light", "Table Lamp", "Lantern"],
      "Bookcases": ["Bookcase"], "Cabinets": ["Cabinet"],
      "Hand-Knotted Rugs": ["Hand-Knotted Rug", "Textile"], "Hand-Tufted Rugs": ["Hand-Tufted Rug"],
      "Hand-Woven Rugs": ["Hand-Woven Rug"], "Vases & Vessels": ["Vase", "Vessel"],
      "Mirrors": ["Mirror"], "Books": ["Book"], "Candle Holders": ["Candle Holder"],
      "Decorative Objects": ["Decorative Object", "Object", "Sculpture"],
      "Centre Tables": ["Centre Table"],
    };
    return (pick: any) => {
      if (selectedSubcategory) {
        const tags = SUB_TAGS[selectedSubcategory] || [selectedSubcategory];
        return tags.some(tag => pick.subcategory === tag || pick.category === tag || (pick.tags && pick.tags.some((t: string) => t.toLowerCase() === tag.toLowerCase())));
      }
      return pick.category === selectedCategory || (pick.tags && pick.tags.includes(selectedCategory));
    };
  }, [selectedSubcategory, selectedCategory]);
  const minSwipeDistance = 50;

  useEffect(() => {
    const handleCategorySync = (e: CustomEvent) => {
      const { category, subcategory, source } = e.detail || {};
      if (source === 'designers') return;
      setSelectedCategoryRaw(category || null);
      setSelectedSubcategoryRaw(subcategory || null);
    };
    const handleDesignerCategory = (e: CustomEvent) => {
      const { category, subcategory } = e.detail || {};
      setSelectedCategoryRaw(category || null);
      setSelectedSubcategoryRaw(subcategory || null);
      // Also broadcast to other sections
      window.dispatchEvent(new CustomEvent('syncCategoryFilter', { detail: { category: category || null, subcategory: subcategory || null, source: 'designers' } }));
    };
    window.addEventListener('syncCategoryFilter', handleCategorySync as EventListener);
    window.addEventListener('setDesignerCategory', handleDesignerCategory as EventListener);
    return () => {
      window.removeEventListener('syncCategoryFilter', handleCategorySync as EventListener);
      window.removeEventListener('setDesignerCategory', handleDesignerCategory as EventListener);
    };
  }, []);

  // Fixed category order
  const CATEGORY_ORDER = ["Seating", "Tables", "Lighting", "Storage", "Rugs", "Décor"];

  // Collect categories and subcategories from curators' picks
  // Use the same subcategory names as the All Categories navigation
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
      // Map nav subcategory names to tag values used in data
      const SUBCATEGORY_TO_TAGS: Record<string, string[]> = {
        "Sofas": ["Sofa"],
        "Armchairs": ["Armchair", "Armchairs"],
        "Chairs": ["Chair"],
        "Daybeds & Benches": ["Daybed", "Bench"],
        "Ottomans & Stools": ["Ottoman", "Stool"],
        "Bar Stools": ["Bar Stool"],
        "Consoles": ["Console"],
        "Coffee Tables": ["Coffee Table"],
        "Desks": ["Desk"],
        "Dining Tables": ["Dining Table"],
        "Side Tables": ["Side Table"],
        "Wall Lights": ["Wall Light", "Sconce"],
        "Ceiling Lights": ["Ceiling Light", "Chandelier", "Pendant"],
        "Floor Lights": ["Floor Light", "Floor Lamp"],
        "Table Lights": ["Table Light", "Table Lamp", "Lantern"],
        "Bookcases": ["Bookcase"],
        "Cabinets": ["Cabinet"],
        "Hand-Knotted Rugs": ["Hand-Knotted Rug", "Textile"],
        "Hand-Tufted Rugs": ["Hand-Tufted Rug"],
        "Hand-Woven Rugs": ["Hand-Woven Rug"],
        "Vases & Vessels": ["Vase", "Vessel"],
        "Mirrors": ["Mirror"],
        "Books": ["Book"],
        "Candle Holders": ["Candle Holder"],
        "Decorative Objects": ["Decorative Object", "Object", "Sculpture"],
      };
      designers = designers.filter(designer =>
        designer.curatorPicks?.some((pick: any) => {
          if (selectedSubcategory) {
            const mappedTags = SUBCATEGORY_TO_TAGS[selectedSubcategory];
            if (mappedTags) {
              const matchesTags = pick.tags?.some((tag: string) => mappedTags.some(mt => tag.toLowerCase() === mt.toLowerCase()));
              const matchesCategory = mappedTags.some(mt => pick.category?.toLowerCase() === mt.toLowerCase());
              return matchesTags || matchesCategory;
            }
            return pick.tags?.includes(selectedSubcategory) || pick.category === selectedSubcategory;
          }
          if (selectedCategory) return pick.tags?.includes(selectedCategory) || pick.category === selectedCategory;
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
    <section ref={ref} id="curators-picks" className="py-10 px-4 md:py-24 md:px-12 lg:px-20 bg-background scroll-mt-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-12 md:mb-16 text-left"
        >
          <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-2">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground">
              Designers & Makers <span className="text-[10px] tracking-[0.2em] uppercase font-body align-middle">In Situ</span>
            </h2>
          </div>
          <p className="text-sm md:text-base text-muted-foreground font-body max-w-3xl leading-relaxed mb-4 text-justify">
            Discover the visionary designers whose exceptional work defines Maison Affluency. Each brings
            their unique perspective and masterful craftsmanship to create pieces that transcend ordinary furniture. Presented in situ at our showroom.
          </p>
          {/* A-Z alphabet jump bar + Search + Filter */}
          <div className="flex flex-col gap-4 mb-5 md:mb-6">
            <div
              className="flex items-center gap-1 px-3 py-1.5 bg-background/90 backdrop-blur-md border border-border/40 rounded-full shadow-sm overflow-x-auto w-full"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" } as any}
            >
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
                const isActive = activeLetters.includes(letter);
                return (
                  <button
                    key={letter}
                    onClick={() => {
                      if (isActive) {
                        const el = document.getElementById(`designer-alpha-${letter}`);
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
              {!showSearch ? (
                <button
                  onClick={() => setShowSearch(true)}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                  aria-label="Open search"
                >
                  <span className="text-sm font-body uppercase tracking-wider">Search</span>
                  <Search className="h-5.5 w-5.5" />
                </button>
              ) : (
                <div className="relative flex-1 sm:flex-none sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by designer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 h-9 text-sm bg-background/90 backdrop-blur-md border-border/40 rounded-full focus:border-primary/60 font-body"
                    autoFocus
                  />
                  <button
                    onClick={() => { setSearchQuery(""); setShowSearch(false); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground hover:text-primary transition-colors relative flex-none flex items-center gap-1.5" aria-label="Filter">
                  <span className="text-sm font-body uppercase tracking-wider">Filter</span>
                  <SlidersHorizontal className="h-5.5 w-5.5" />
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
        </motion.div>

        {(searchQuery || selectedCategory) && (
          <p className="text-left text-[10px] text-muted-foreground/50 mb-4 font-body tracking-wider">
            {filteredDesigners.length} designer{filteredDesigners.length !== 1 ? 's' : ''} found
            {selectedSubcategory && <span> · {selectedSubcategory}</span>}
            {selectedCategory && !selectedSubcategory && <span> · {selectedCategory}</span>}
          </p>
        )}

        <div className="flex justify-start mb-4 md:justify-end md:pr-8">
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
                  <span className="font-serif text-lg text-muted-foreground">{letter}</span>
                </div>
                {designers.map((designer, index) => (
              <AccordionItem
                key={designer.id}
                value={designer.id}
                id={`designer-${designer.id}`}
                data-designer={designer.id}
                className="border border-border/40 rounded-lg px-4 md:px-6 bg-card/30 hover:bg-card/50 transition-colors duration-300 scroll-mt-16"
              >
                <AccordionTrigger className="hover:no-underline py-4 md:py-6 group active:scale-[0.99] touch-manipulation [&>svg]:hidden md:[&>svg]:block">
                  <div className="flex flex-col w-full gap-3">
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
                          onPointerDown={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                        >
                          <img
                            src={designer.image}
                            alt={designer.name}
                            sizes="(max-width: 767px) 96px, 128px"
                            className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover ring-2 ring-border/40 transition-all duration-300 hover:ring-primary/60 hover:scale-105 hover:shadow-lg"
                            style={(designer as any).imagePosition ? { objectPosition: (designer as any).imagePosition } : undefined}
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
                          {/* Mobile chevron — bottom-right of picture */}
                          <div className="absolute -bottom-1 -right-1 md:hidden">
                            <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 text-muted-foreground group-data-[state=open]:rotate-180 bg-background rounded-full p-0.5 shadow-sm ring-1 ring-border/40" />
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[90vh] [&>button]:top-3 [&>button]:left-3 [&>button]:right-auto md:[&>button]:left-auto md:[&>button]:right-3 [&>button]:p-2 [&>button]:bg-foreground/10 [&>button]:backdrop-blur-sm [&>button]:rounded-full [&>button]:opacity-100 [&>button>svg]:h-5 [&>button>svg]:w-5" aria-describedby={undefined}>
                        <VisuallyHidden>
                          <DialogTitle>{selectedImage?.name || designer.name}</DialogTitle>
                        </VisuallyHidden>
                        <div className="relative w-full h-full">
                          <img
                            src={selectedImage?.image || designer.image!}
                            alt={selectedImage?.name || designer.name}
                            sizes="(max-width: 767px) 90vw, 700px"
                            className="w-full h-auto rounded-lg object-contain max-h-[75vh]"
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
                            className="p-0.5 transition-transform duration-300 hover:scale-110 relative z-10"
                            aria-label={`${designer.name} on Instagram`}
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); trackCTA.instagram("Featured Designers", designer.name); window.open(designer.links!.find(l => l.type === "Instagram")!.url!, '_blank', 'noopener,noreferrer'); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => { e.stopPropagation(); }}
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
                          <span className="hidden md:inline">
                            {((designer as any).displayName || designer.name).includes(' - ') ? (
                              <>
                                {((designer as any).displayName || designer.name).split(' - ')[0]}
                                <span className="text-lg text-foreground/70"> - {((designer as any).displayName || designer.name).split(' - ').slice(1).join(' - ')}</span>
                              </>
                            ) : (
                              (designer as any).displayName || designer.name
                            )}
                          </span>
                          <span className="md:hidden">
                            {(designer as any).mobileNameLines ? (
                              <>
                                {(designer as any).mobileNameLines[0]}
                                <br />
                                <span className="text-lg">{(designer as any).mobileNameLines[1]}</span>
                              </>
                            ) : ((designer as any).displayName || designer.name).includes(' - ') ? (
                              <>
                                {((designer as any).displayName || designer.name).split(' - ')[0]}
                                <br />
                                <span className="text-lg">{((designer as any).displayName || designer.name).split(' - ').slice(1).join(' - ')}</span>
                              </>
                            ) : (
                              (designer as any).displayName || designer.name
                            )}
                          </span>
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
                                    scrollToSection('gallery');
                                    setTimeout(() => {
                                      window.dispatchEvent(new CustomEvent('openGalleryLightbox', { 
                                        detail: { index: link.galleryIndex, sourceId: `designer-${designer.id}` } 
                                      }));
                                    }, 500);
                                  }}
                                  className="text-xs md:text-sm text-primary/80 font-body hover:text-primary transition-colors duration-300 flex items-center gap-1 group/link touch-manipulation"
                                >
                                  <span className="underline underline-offset-2 decoration-primary/40 group-hover/link:decoration-primary">
                                    {link.text}
                                  </span>
                                  <ExternalLink className="h-3 w-3 opacity-50 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                                </button>
                                {linkIdx < designer.notableWorksLinks.length - 1 && (
                                  <span className="text-muted-foreground mx-1 hidden md:inline">•</span>
                                )}
                              </span>
                            ))
                          ) : designer.notableWorksLink && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const gallerySection = document.getElementById('gallery');
                                scrollToSection('gallery');
                                if (gallerySection) {
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
                    {/* WhatsApp share + Logo */}
                    <div className="hidden md:flex items-center gap-6 flex-shrink-0 mr-8">
                      <WhatsAppShareButton
                            onClick={(e) => {
                              e.stopPropagation();
                              shareProfileOnWhatsApp("designer", designer.id, designer.name, designer.specialty);
                              trackCTA.whatsapp(`FeaturedDesigners_Share_${designer.name}`);
                            }}
                            label={`Share ${designer.name} on WhatsApp`}
                          />
                      <div className="flex items-center justify-center w-24 h-24 border border-border/40 rounded-sm">
                        {(designer as any).logoUrl && (
                          <img
                            src={(designer as any).logoUrl}
                            alt={`${(designer as any).displayName || designer.name} logo`}
                            sizes="96px"
                            className="max-w-full max-h-full object-contain aspect-square"
                          />
                        )}
                      </div>
                    </div>
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
                        <div className="flex flex-wrap gap-3 mt-4 md:pr-8">
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
                              <React.Fragment key={idx}>
                              <button
                                onClick={() => {
                                  setCuratorPicksDesigner(designer);
                                  const allPicks = designer.curatorPicks || [];
                                  if (selectedSubcategory) {
                                    const SUB_TAGS: Record<string, string[]> = {
                                      "Sofas": ["Sofa"], "Armchairs": ["Armchair", "Armchairs"], "Chairs": ["Chair"],
                                      "Daybeds & Benches": ["Daybed", "Bench"], "Ottomans & Stools": ["Ottoman", "Stool"],
                                      "Bar Stools": ["Bar Stool"], "Consoles": ["Console"], "Coffee Tables": ["Coffee Table"],
                                      "Desks": ["Desk"], "Dining Tables": ["Dining Table"], "Side Tables": ["Side Table"],
                                      "Wall Lights": ["Wall Light", "Sconce"], "Ceiling Lights": ["Ceiling Light", "Chandelier", "Pendant"],
                                      "Floor Lights": ["Floor Light", "Floor Lamp"], "Table Lights": ["Table Light", "Table Lamp", "Lantern"],
                                      "Bookcases": ["Bookcase"], "Cabinets": ["Cabinet"],
                                      "Hand-Knotted Rugs": ["Hand-Knotted Rug", "Textile"], "Hand-Tufted Rugs": ["Hand-Tufted Rug"],
                                      "Hand-Woven Rugs": ["Hand-Woven Rug"], "Vases & Vessels": ["Vase", "Vessel"],
                                      "Mirrors": ["Mirror"], "Books": ["Book"], "Candle Holders": ["Candle Holder"],
                                      "Decorative Objects": ["Decorative Object", "Object", "Sculpture"],
                                    };
                                    const mapped = SUB_TAGS[selectedSubcategory];
                                    const firstMatch = allPicks.findIndex((pick: any) => {
                                      if (mapped) return pick.tags?.some((tag: string) => mapped.some(mt => tag.toLowerCase() === mt.toLowerCase()));
                                      return pick.tags?.includes(selectedSubcategory);
                                    });
                                    setCuratorPickIndex(firstMatch >= 0 ? firstMatch : 0);
                                  } else if (selectedCategory) {
                                    const firstMatch = allPicks.findIndex((pick: any) => pick.tags?.includes(selectedCategory));
                                    setCuratorPickIndex(firstMatch >= 0 ? firstMatch : 0);
                                  } else {
                                    setCuratorPickIndex(0);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-body bg-accent/10 hover:bg-accent/20 text-accent-foreground rounded-full transition-all duration-300 cursor-pointer border border-accent/30 md:ml-auto"
                              >
                                <Gem size={14} className="fill-accent text-accent" />
                                <span className="font-medium">{link.type}</span>
                              </button>
                              <WhatsAppShareButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  shareProfileOnWhatsApp("designer", designer.id, designer.name, designer.specialty);
                                  trackCTA.whatsapp(`FeaturedDesigners_Share_${designer.name}`);
                                }}
                                label={`Share ${designer.name} on WhatsApp`}
                                hideOn="desktop"
                              />
                              </React.Fragment>
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
        </div>

        {/* Curators' Picks Lightbox Dialog */}
        <Dialog
          open={!!curatorPicksDesigner}
          onOpenChange={(open) => {
            if (!open) {
              setCuratorPicksDesigner(null);
              setCuratorPickIndex(0);
              setIsZoomed(false);
              window.history.back();
            }
          }}
        >
          <DialogContent
            className="max-w-[100vw] max-h-[100dvh] w-screen h-[100dvh] p-0 border-none bg-black/95 overflow-hidden flex items-center justify-center [&>button]:hidden"
            hideClose
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
            <DialogTitle>
              <VisuallyHidden>Curators&apos; Picks</VisuallyHidden>
            </DialogTitle>
            {curatorPicksDesigner && (
              curatorPicksDesigner.curatorPicks && curatorPicksDesigner.curatorPicks.length > 0 ? (
                <div 
                  className="relative w-full h-full flex items-center justify-center"
                  onTouchStart={(e) => {
                    if (imageZoomedRef.current) return;
                    setTouchEnd(null);
                    setTouchStart(e.targetTouches[0].clientX);
                  }}
                  onTouchMove={(e) => {
                    if (imageZoomedRef.current) return;
                    setTouchEnd(e.targetTouches[0].clientX);
                  }}
                  onTouchEnd={() => {
                    if (imageZoomedRef.current) return;
                    if (!touchStart || !curatorPicksDesigner.curatorPicks?.length) return;
                    if (touchEnd !== null) {
                      const distance = touchStart - touchEnd;
                      if (distance > minSwipeDistance) {
                        setCuratorPickIndex(prev => prev === curatorPicksDesigner.curatorPicks.length - 1 ? 0 : prev + 1);
                      } else if (distance < -minSwipeDistance) {
                        setCuratorPickIndex(prev => prev === 0 ? curatorPicksDesigner.curatorPicks.length - 1 : prev - 1);
                      }
                    }
                    setTouchStart(null);
                    setTouchEnd(null);
                  }}
                >
                  <div className={`flex flex-col items-center justify-center max-w-[90vw] px-4 md:px-16 transition-all duration-300 ${isZoomed ? 'max-h-[95vh] pb-4' : 'max-h-[85vh] pb-4'}`}>
                    <div className="relative">
                      {!isZoomed && ((curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.category || ((curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.tags?.length > 0) || curatorPicksDesigner.curatorPicks[curatorPickIndex]?.edition) && (
                        <div className="text-center mb-2 flex flex-wrap gap-1.5 justify-center">
                          {((curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.tags?.length > 0 ? (curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.tags : [(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.category]).map((tag: string, i: number) => (
                            <span key={i} className="hidden md:inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-white/10 text-white/80 rounded-full border border-white/20">
                              {tag}
                            </span>
                          ))}
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.edition && (
                            <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-accent/20 text-accent rounded-full border border-accent/30">
                              {curatorPicksDesigner.curatorPicks[curatorPickIndex].edition}
                            </span>
                          )}
                        </div>
                      )}
                      <img
                        src={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.image}
                        alt={curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title || "Curator's pick"}
                        sizes="(max-width: 767px) 90vw, (max-width: 1024px) 80vw, 60vw"
                        className={`rounded-lg shadow-2xl cursor-zoom-in transition-all duration-300 ${isZoomed ? 'max-h-[90vh] max-w-[90vw] object-contain' : 'max-h-[55vh] md:max-h-[60vh] max-w-full object-contain'}`}
                        decoding="sync"
                        loading="eager"
                        fetchPriority="high"
                        onClick={() => setIsZoomed(!isZoomed)}
                      />
                      {/* Photo credit overlay */}
                      {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.photoCredit && !isZoomed && (
                        <span className="absolute bottom-2 left-2 text-[9px] text-white/50 font-body tracking-wide">
                          {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any).photoCredit}
                        </span>
                      )}
                      {/* Close buttons */}
                      <button
                        onClick={() => {
                          setCuratorPicksDesigner(null);
                          setCuratorPickIndex(0);
                          setIsZoomed(false);
                          window.history.back();
                        }}
                        className="absolute top-3 left-2 p-2 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 z-10 md:hidden"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setCuratorPicksDesigner(null);
                          setCuratorPickIndex(0);
                          setIsZoomed(false);
                          window.history.back();
                        }}
                        className="hidden md:flex absolute bottom-2 -right-12 lg:-right-14 p-2.5 rounded-full bg-white/15 text-white/85 hover:text-white hover:bg-white/30 backdrop-blur-sm transition-all duration-300 z-20 border border-white/20"
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      {/* PDF download button */}
                      {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.pdfUrl && !isZoomed && (
                        <button
                          onClick={async () => {
                            const pick = curatorPicksDesigner.curatorPicks[curatorPickIndex] as any;
                            try {
                              const res = await fetch(pick.pdfUrl);
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
                              window.open(pick.pdfUrl, '_blank');
                            }
                          }}
                          className="absolute bottom-2 right-2 md:right-10 p-2 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 z-10"
                          aria-label="Download PDF specification"
                        >
                          <Download size={16} />
                        </button>
                      )}
                      {/* Maximize / Minimize button — rightmost at bottom */}
                      {!isZoomed ? (
                        <button
                          onClick={() => setIsZoomed(true)}
                          className="absolute bottom-2 left-2 md:left-auto md:right-2 p-2 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 z-10"
                          aria-label="Expand image"
                        >
                          <Maximize2 size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsZoomed(false)}
                          className="absolute bottom-2 left-2 md:left-auto md:right-2 p-2 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 backdrop-blur-sm transition-all duration-300 z-10"
                          aria-label="Minimize image"
                        >
                          <Minimize2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Scroll dots — directly under the image */}
                    {curatorPicksDesigner.curatorPicks.length > 1 && !isZoomed && (
                      <div className="flex items-center gap-2 mt-3">
                        {curatorPicksDesigner.curatorPicks.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCuratorPickIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === curatorPickIndex ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/60'}`}
                            aria-label={`View pick ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Legend */}
                    {!isZoomed && (
                      <div className="text-center mt-4 max-w-lg">
                        <p className="font-brand text-base md:text-lg text-white tracking-wide">
                          {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.title}
                          {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.subtitle && (
                            <span className="text-white/60"> — {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any).subtitle}</span>
                          )}
                        </p>
                        {curatorPicksDesigner.curatorPicks[curatorPickIndex]?.materials && (
                          <p className="text-xs text-white/50 font-body mt-1 whitespace-pre-line">
                            {curatorPicksDesigner.curatorPicks[curatorPickIndex].materials}
                          </p>
                        )}
                        {((curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.dimensions || (curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.weight) && (
                          <p className="text-xs text-white/40 font-body mt-0.5">
                            {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.dimensions}
                            {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.dimensions && (curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.weight && ' – '}
                            {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.weight}
                          </p>
                        )}
                        {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any)?.description && (
                          <p className="text-xs text-white/50 font-body mt-2 leading-relaxed">
                            {(curatorPicksDesigner.curatorPicks[curatorPickIndex] as any).description}
                          </p>
                        )}

                        {/* Thumbnail strip — inline, above contact line */}
                        {curatorPicksDesigner.curatorPicks.length > 1 && (
                          <div className="mt-6 flex items-center gap-2 overflow-x-auto scrollbar-hide justify-center flex-wrap md:flex-nowrap">
                            {curatorPicksDesigner.curatorPicks.map((pick, idx) => (
                              <button
                                key={idx}
                                onClick={() => setCuratorPickIndex(idx)}
                                className={`flex-shrink-0 rounded-md overflow-hidden border-2 transition-all duration-200 ${idx === curatorPickIndex ? 'border-white/80 scale-105' : 'border-transparent opacity-50 hover:opacity-80'}`}
                              >
                                <img
                                  src={pick.image}
                                  alt={pick.title || `Pick ${idx + 1}`}
                                  sizes="(max-width: 767px) 48px, 56px"
                                  className="w-12 h-12 md:w-14 md:h-14 object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-white/40 font-body mt-4">
                          For further details, please contact{" "}
                          <a
                            href="mailto:concierge@myaffluency.com"
                            className="underline hover:text-white/70 transition-colors"
                          >
                            concierge@myaffluency.com
                          </a>
                        </p>
                      </div>
                    )}
                  </div>


                  {/* Nav arrows */}
                  {curatorPicksDesigner.curatorPicks.length > 1 && !isZoomed && (
                    <>
                      <button
                        onClick={() => setCuratorPickIndex(prev => prev === 0 ? curatorPicksDesigner.curatorPicks.length - 1 : prev - 1)}
                        className="hidden md:flex absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                        aria-label="Previous"
                      >
                        <ChevronLeft size={32} />
                      </button>
                      <button
                        onClick={() => setCuratorPickIndex(prev => prev === curatorPicksDesigner.curatorPicks.length - 1 ? 0 : prev + 1)}
                        className="hidden md:flex absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                        aria-label="Next"
                      >
                        <ChevronRight size={32} />
                      </button>
                    </>
                  )}

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-white/60 gap-3 p-8">
                  <Gem className="h-10 w-10 text-white/30" />
                  <h3 className="text-xl font-serif text-white">Curators' Picks</h3>
                  <p className="font-body text-sm italic text-white/50">Coming soon</p>
                  <button
                    onClick={() => {
                      setCuratorPicksDesigner(null);
                      window.history.back();
                    }}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              )
            )}
          </DialogContent>
        </Dialog>
    </section>
  );
};

export default FeaturedDesigners;
