import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ChevronDown, Search, X, Layers, Instagram, Share2, Plus } from "lucide-react";
import { useAllDesigners, type Designer } from "@/hooks/useDesigner";
import { useParentBrandDesigners } from "@/hooks/useParentBrandDesigners";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { trackCTA } from "@/lib/analytics";

const transition = { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ─── Gallery room thumbnails (keyed by DB slug) ─────────────────────────────
const CARD_THUMBNAILS: Record<string, string[]> = {
  "adam-courts-okha": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085686/bedroom-alt_yk0j0d.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774340485/AffluencySG_030_1_pncaim.jpg"],
  "alexander-lamont": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1773206399/AffluencySG_233-resized.jpg_scnulb.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774330072/AffluencySG_160_2_1_dwsgsn.jpg"],
  "leo-aerts-alinea": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085743/dining-room_ey0bu5.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085856/intimate-lounge_tf4sm1.jpg"],
  "apparatus-studio": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085919/small-room-personality_wvxz6y.png", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085690/bedroom-second_cyfmdj.jpg"],
  "atelier-fevrier": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085716/bespoke-sofa_gxidtx.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772599861/IMG_2040_clunsw.jpg"],
  "atelier-pendhapa": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085848/intimate-dining_ux4pee.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1774342970/6C3ABF9A-8DF6-4BAB-941D-A1343031CBBA_sw6tri.jpg"],
  "bina-baitel": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087851/IMG_2133_wtxd62.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774336201/AffluencySG_191_2_jthubs.jpg"],
  "bruno-de-maistre": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085726/boudoir_ll5spn.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772177400/70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq.jpg"],
  "emmanuel-levet-stenne": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085743/dining-room_ey0bu5.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774330412/AffluencySG_107_2_s4nfeb.jpg"],
  "entrelacs-creation": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085890/small-room-bedroom_mp8mdd.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1772085802/home-office-desk_g0ywv2.png"],
  "felix-agostini": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772177400/70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_north,y_0,q_auto,f_auto/v1774348120/PHOTO-2024-11-15-15-13-10_rj8jic.jpg"],
  "robicara": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774340767/AffluencySG_178_1_esvjq2.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087460/AffluencySG_204_1_qbbpqb.jpg"],
  "forest-giaconia": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085856/intimate-lounge_tf4sm1.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087851/IMG_2133_wtxd62.jpg"],
  "garnier-linker": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772536395/AffluencySG_194-22.jpg_macpwj.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774336947/eaa39674-f12c-4297-8e77-3c4407f1dce9_oaceoq.jpg"],
  "hamrei": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085864/intimate-table-detail_aqxvvm.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772177400/70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq.jpg"],
  "jean-michel-frank": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087732/IMG_2402_y3atdm.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1774343324/IMG_2491_cirrjv.jpg"],
  "jeremy-maxwell-wintrebert": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085848/intimate-dining_ux4pee.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774338139/AffluencySG_131_1_fz2esj.jpg"],
  "leo-sentou": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087732/IMG_2402_y3atdm.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774339681/AffluencySG_191_3_1_r0dard.jpg"],
  "kira": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085726/boudoir_ll5spn.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1774342944/IMG_2498_qwza44.jpg"],
  "man-of-parts": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_north,q_auto,f_auto/v1772085907/small-room-chair_aobzyb.jpg"],
  "milan-pekar": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774338136/AffluencySG_210_1_vdtca1.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085920/small-room-vase_s3nz5o.jpg"],
  "nathalie-ziegler": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085726/boudoir_ll5spn.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1774343095/9105eaeb-d531-4e20-8efe-f1963c4e4356_n8wwgq.jpg"],
  "olivia-cognet": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085877/living-room-hero_zxfcxl.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087732/IMG_2402_y3atdm.jpg"],
  "pierre-bonnefille": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774340153/AffluencySG_073_1_m4j7uv.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085533/art-master-bronze_hf6bad.jpg"],
  "reda-amalou": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085890/small-room-bedroom_mp8mdd.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085919/small-room-personality_wvxz6y.png"],
  "thierry-lemaire": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085716/bespoke-sofa_gxidtx.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085877/living-room-hero_zxfcxl.jpg"],
  "tristan-auer": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085769/home-office-3_t39msw.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1773200000/Screen_Shot_2026-03-11_at_11.11.33_AM_p0wtix.png"],
};

// ─── Instagram links (keyed by DB slug) ─────────────────────────────────────
const INSTAGRAM_LINKS: Record<string, string> = {
  // Single designers
  "adam-courts-okha": "https://www.instagram.com/__okha/",
  "alexander-lamont": "https://instagram.com/alexanderlamont",
  "leo-aerts-alinea": "https://www.instagram.com/alinea_design_objects/",
  "apparatus-studio": "https://instagram.com/apparatusstudio",
  "atelier-fevrier": "https://instagram.com/atelierfevrier",
  "atelier-pendhapa": "https://instagram.com/pendhapa.architects",
  "bina-baitel": "https://www.instagram.com/binabaitel/",
  "bruno-de-maistre": "https://instagram.com/bruno_de_maistre_bdm",
  "emmanuel-levet-stenne": "https://instagram.com/emanuellelevetstenne",
  "entrelacs-creation": "https://instagram.com/entrelacs_lightings",
  "felix-agostini": "https://www.instagram.com/maisoncharlesparis/",
  "robicara": "https://www.instagram.com/robicaradesign/",
  "forest-giaconia": "https://www.instagram.com/forest.giaconia/",
  "garnier-linker": "https://www.instagram.com/garnieretlinker/",
  "hamrei": "https://instagram.com/hamrei",
  "jeremy-maxwell-wintrebert": "https://www.instagram.com/jmw_studio",
  "leo-sentou": "https://www.instagram.com/leosentou",
  "kira": "https://www.instagram.com/madeinkira/",
  "man-of-parts": "https://www.instagram.com/manofparts/",
  "milan-pekar": "https://www.instagram.com/pekarmilan/",
  "nathalie-ziegler": "https://instagram.com/nathaliezieglerpasqua",
  "olivia-cognet": "https://www.instagram.com/olivia_cognet",
  "pierre-bonnefille": "https://www.instagram.com/pierrebonnefille/",
  "reda-amalou": "https://www.instagram.com/redaamaloudesign/",
  "thierry-lemaire": "https://www.instagram.com/thierrylemaire_/",
  "tristan-auer": "https://www.instagram.com/tristanauer/",
  // Parent brands
  "ecart": "https://instagram.com/ecart.paris",
  "cc-tapis": "https://instagram.com/cc_tapis",
  "veronese": "https://www.instagram.com/veronese_/",
  "theoreme-editions": "https://instagram.com/theoreme_editions",
  "ozone-light": "https://www.instagram.com/ozone_light/",
  "la-chance": "https://www.instagram.com/lachance_paris/",
  "marta-sala-editions": "https://www.instagram.com/martasalaeditions/",
  "mmairo": "https://www.instagram.com/mmairo_design/",
  "pouenat": "https://www.instagram.com/pouenat.official/",
  "de-la-espada": "https://www.instagram.com/delaespada/",
  "delcourt-collection": "https://instagram.com/delcourtcollection",
  "collection-particuliere": "https://www.instagram.com/collection_particuliere/",
  "entrelacs": "https://www.instagram.com/entrelacs_lightings/",
  "haymann-editions": "https://instagram.com/haymanneditions",
  "achille-salvagni-atelier": "https://www.instagram.com/achillesalvagniatelier/",
  "atelier-demichelis": "https://instagram.com/atelier_demichelis",
  "okha": "https://instagram.com/__okha",
  "arredoluce": "https://www.instagram.com/angelolelii/",
};

/** Parse names into [displayName, parentLabel] for correct card rendering */
function parseDesignerDisplayName(item: Designer): { displayName: string; parentLabel: string | null } {
  // If DB has explicit founder that differs from name → use it as parent
  if (item.founder && item.founder !== item.name) {
    return { displayName: item.display_name || item.name, parentLabel: item.founder };
  }
  // If display_name is set and differs from name → name is the parent/atelier
  if (item.display_name && item.display_name !== item.name) {
    return { displayName: item.display_name, parentLabel: item.name };
  }
  // If name contains " - " separator, split into atelier + designer(s)
  const dashIdx = item.name.indexOf(" - ");
  if (dashIdx > 0) {
    const atelier = item.name.substring(0, dashIdx).trim();
    const designer = item.name.substring(dashIdx + 3).trim();
    return { displayName: item.display_name || designer, parentLabel: atelier };
  }
  return { displayName: item.display_name || item.name, parentLabel: null };
}

// ─── Sub-Designers Grid (for parent brands) ──────────────────────────────────
function ParentSubGrid({ parentName, onClose }: { parentName: string; onClose: () => void }) {
  const { data: designers = [] } = useParentBrandDesigners(parentName);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden col-span-full"
    >
      <div className="pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-body text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
            {parentName} Designers
          </span>
          <span className="font-body text-[10px] text-muted-foreground/50">({designers.length})</span>
          <div className="flex-1 h-px bg-border/30" />
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted/50 transition-colors" aria-label="Close">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        {designers.length === 0 ? (
          <div className="text-center py-6">
            <span className="font-body text-xs text-muted-foreground/50">Loading…</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 md:gap-3">
            {designers.map((d) => {
              const igUrl = d.instagramUrl || INSTAGRAM_LINKS[d.slug];
              return (
              <Link
                key={d.slug}
                to={`/designers/${d.slug}`}
                className="group/sub rounded-lg overflow-hidden border border-border hover:border-foreground/30 hover:shadow-lg transition-all"
              >
                <div className="aspect-[3/4] relative bg-muted/10 overflow-hidden">
                  {d.image ? (
                    <img src={d.image} alt={d.name} className="w-full h-full object-cover transition-transform duration-500 group-hover/sub:scale-110" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/5">
                      <span className="font-display text-xl text-muted-foreground/20">{d.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/sub:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="font-body text-[9px] text-white uppercase tracking-[0.15em]">View</span>
                  </div>
                  {igUrl && (
                    <a
                      href={igUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 z-10 p-1 rounded-full bg-black/40 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/60 transition-all"
                    >
                      <Instagram className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
                <div className="px-2 py-1.5 bg-background text-center">
                  <p className="font-body text-[10px] md:text-[11px] text-foreground leading-tight line-clamp-1">{d.name}</p>
                  <p className="font-body text-[8px] text-muted-foreground/60 uppercase tracking-[0.1em] mt-0.5 line-clamp-1">{parentName}</p>
                </div>
              </Link>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Parent Brand Card (landscape, homepage-style) ───────────────────────────
function ParentBrandCard({
  item,
  isOpen,
  onToggle,
  designerCount,
}: {
  item: Designer;
  isOpen: boolean;
  onToggle: () => void;
  designerCount: number;
}) {
  const instagramLink = INSTAGRAM_LINKS[item.slug] || (item.links as any[])?.find((l: any) => l.type === "Instagram" || l.type === "instagram")?.url;

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const bridgeUrl = buildShareUrl(item.slug);
    const text = `${item.display_name || item.name} — Maison Affluency`;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `https://wa.me/?text=${encodeURIComponent(`${text}\n${bridgeUrl}`)}`;
    } else {
      navigator.clipboard.writeText(`${text}: ${bridgeUrl}`);
      import("sonner").then(({ toast }) => toast.success("Link copied"));
    }
    trackCTA.whatsapp(`Directory_Share_${item.name}`);
  };

  return (
    <div className="col-span-2 md:col-span-2">
      <div className="group relative rounded-xl overflow-hidden border border-primary/40 ring-1 ring-primary/20 hover:border-primary/60 hover:shadow-xl transition-all duration-300 cursor-pointer h-[240px] md:h-[280px]">
        {/* Background image */}
        {(item.hero_image_url || item.image_url) && (
          <img
            src={item.hero_image_url || item.image_url}
            alt={item.name}
            loading="lazy"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none select-none object-cover"
          />
        )}
        <div className={`absolute inset-0 transition-all duration-300 ${
          (item.hero_image_url || item.image_url) ? "bg-black/25 group-hover:bg-black/15" : "bg-card/80"
        }`} />

        {/* Logo badge — top-left */}
        <div className="absolute top-3 left-3 w-14 h-14 md:w-16 md:h-16 bg-foreground flex items-center justify-center p-1.5 overflow-hidden z-10">
          {item.logo_url ? (
            <img src={item.logo_url} alt={item.name} className="w-full h-full object-contain" />
          ) : (
            <span className="font-display text-[7px] md:text-[8px] text-background text-center leading-tight uppercase tracking-[0.12em]">
              {item.display_name || item.name}
            </span>
          )}
        </div>

        {/* Origin label under badge */}
        {item.source && (
          <p className="absolute top-[calc(0.75rem+3.5rem+0.25rem)] md:top-[calc(0.75rem+4rem+0.25rem)] left-3 w-14 md:w-16 z-10 font-body text-[9px] md:text-[10px] text-white/70 uppercase tracking-widest text-center">
            {item.source}
          </p>
        )}

        {/* Instagram icon — top-right */}
        {instagramLink && (
          <a
            href={instagramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 right-3 z-10 p-1 hover:opacity-70 transition-opacity"
            onClick={(e) => e.stopPropagation()}
            aria-label={`${item.name} on Instagram`}
          >
            <Instagram className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </a>
        )}

        {/* Bottom-right: Designers toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(); }}
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 text-white hover:bg-white/25 transition-all"
        >
          <Layers className="h-3 w-3" />
          <span className="font-body text-[9px] uppercase tracking-[0.12em]">
            Designers{designerCount > 0 ? ` (${designerCount})` : ""}
          </span>
          <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Bottom-left: Share */}
        <button
          onClick={handleShare}
          className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-white hover:opacity-70 transition-opacity"
          aria-label={`Share ${item.name}`}
        >
          <Share2 className="h-3 w-3" />
          <span className="font-body text-[9px] uppercase tracking-[0.12em]">Share</span>
        </button>

        {/* Hover overlay — View Profile */}
        <Link
          to={`/designers/${item.slug}`}
          className="absolute inset-0 z-[6] flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white font-body text-[10px] uppercase tracking-[0.15em] hover:bg-white/20 transition-colors">
            View Profile
          </span>
        </Link>
      </div>
    </div>
  );
}

// ─── Share helper — uses bridge file for WhatsApp OG previews ────────────────
function buildShareUrl(slug: string): string {
  return `https://www.maisonaffluency.com/designers/${slug}-og.html?v=20260329&t=${Date.now()}`;
}

function handleDesignerShare(e: React.MouseEvent, item: Designer, displayName: string) {
  e.stopPropagation();
  e.preventDefault();
  const bridgeUrl = buildShareUrl(item.slug);
  const text = `${displayName} — Maison Affluency`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = `https://wa.me/?text=${encodeURIComponent(`${text}\n${bridgeUrl}`)}`;
  } else {
    navigator.clipboard.writeText(`${text}: ${bridgeUrl}`);
    import("sonner").then(({ toast }) => toast.success("Link copied"));
  }
  trackCTA.whatsapp(`Directory_Share_${item.name}`);
}

// ─── Single Designer Card (portrait, with optional parent attribution) ───────
function SingleDesignerCard({ item }: { item: Designer }) {
  const { displayName, parentLabel } = parseDesignerDisplayName(item);
  const thumbs = CARD_THUMBNAILS[item.slug] || [];
  const instagramLink = INSTAGRAM_LINKS[item.slug] || (item.links as any[])?.find((l: any) => l.type === "Instagram" || l.type === "instagram")?.url;

  return (
    <Link
      to={`/designers/${item.slug}`}
      className="group block rounded-xl overflow-hidden border border-border hover:border-foreground/30 transition-all hover:shadow-xl bg-background"
    >
      <div className="aspect-[3/4] bg-muted/20 overflow-hidden relative">
        {/* Instagram icon — top-right */}
        {instagramLink && (
          <a
            href={instagramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 right-3 z-10 p-1 hover:opacity-70 transition-opacity"
            onClick={(e) => e.stopPropagation()}
            aria-label={`${item.name} on Instagram`}
          >
            <Instagram className="h-5 w-5 md:h-6 md:w-6 text-white drop-shadow-md" />
          </a>
        )}
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.65]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/10 group-hover:bg-muted/20 transition-colors">
            <span className="font-display text-3xl text-muted-foreground/20">
              {item.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Name overlay — top */}
        <div className="absolute inset-x-0 top-0 px-3 pr-10 pb-10 pt-2.5 bg-gradient-to-b from-black/60 via-black/25 to-transparent">
          <p className="font-display text-xs md:text-sm text-white tracking-wide leading-tight drop-shadow-sm">
            {displayName}
          </p>
          {parentLabel && (
            <p className="font-body text-[10px] text-white/70 mt-0.5 tracking-wide">
              {parentLabel}
            </p>
          )}
        </div>

        {/* Share button — bottom-left fallback when no thumbs */}
        {thumbs.length === 0 && (
          <button
            onClick={(e) => handleDesignerShare(e, item, displayName)}
            className="absolute bottom-3 left-3 z-10 flex items-center gap-1 text-white/80 hover:text-white transition-opacity"
            aria-label={`Share ${displayName}`}
          >
            <Share2 className="h-3 w-3" />
            <span className="font-body text-[8px] uppercase tracking-[0.12em]">Share</span>
          </button>
        )}

        {/* Gallery room thumbnails — bottom-right with "on view" label above & share icon left */}
        {thumbs.length > 0 && (
          <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1 z-10">
            <span className="font-body text-[8px] uppercase tracking-[0.15em] text-white/90 drop-shadow-md">
              ON VIEW
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => handleDesignerShare(e, item, displayName)}
                className="flex items-center justify-center text-white/80 hover:text-white transition-opacity"
                aria-label={`Share ${displayName}`}
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
              {thumbs.slice(0, 2).map((src, i) => (
                <div
                  key={i}
                  className="relative w-14 h-14 md:w-16 md:h-16 rounded overflow-hidden border-2 border-white/90 shadow-md"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <span className="absolute top-0.5 left-0.5 flex items-center justify-center w-3 h-3 rounded-full bg-black/70 border border-primary/70 pointer-events-none">
                    <Plus className="w-2 h-2 text-white" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-3">
          {item.specialty && (
            <p className="font-body text-[10px] text-white/85 text-center leading-relaxed line-clamp-3 mb-3 max-w-[90%]">
              {item.specialty}
            </p>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white font-body text-[9px] uppercase tracking-[0.15em] hover:bg-white/20 transition-colors">
            View Profile
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Letter Group with scroll-reveal ─────────────────────────────────────────

function LetterGroup({
  letter,
  designers,
  forceOpen,
}: {
  letter: string;
  designers: Designer[];
  forceOpen?: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sentinelRef, { margin: "200px 0px 200px 0px", once: true });
  const isRevealed = forceOpen || isInView;
  const [openParent, setOpenParent] = useState<string | null>(null);

  return (
    <div id={`alpha-${letter}`} className="scroll-mt-32 mb-6">
      <div ref={sentinelRef} />

      {/* Letter heading */}
      <div className="flex items-center gap-3 mb-4 px-1">
        <span className="font-serif text-2xl md:text-3xl text-foreground">{letter}</span>
        <div className="flex-1 h-px bg-border/40" />
        <span className="font-body text-[10px] text-muted-foreground/50 tracking-widest uppercase">
          {designers.length}
        </span>
      </div>

      <AnimatePresence>
        {isRevealed ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
              {designers.map((item) => {
                const isAtelier = item.founder === item.name;

                if (isAtelier) {
                  return (
                    <React.Fragment key={item.slug}>
                      <ParentBrandCardWrapper
                        item={item}
                        openParent={openParent}
                        setOpenParent={setOpenParent}
                      />
                      {/* Sub-grid spans full width, placed right after parent in DOM = right below in grid */}
                      <AnimatePresence>
                        {openParent === item.name && (
                          <div className="col-span-2 md:col-span-3 lg:col-span-5">
                            <ParentSubGrid
                              key={item.name}
                              parentName={item.name}
                              onClose={() => setOpenParent(null)}
                            />
                          </div>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                }

                return <SingleDesignerCard key={item.slug} item={item} />;
              })}
            </div>
          </motion.div>
        ) : (
          <div
            className="flex items-center justify-center py-12 text-muted-foreground/30"
            style={{ minHeight: `${Math.ceil(designers.length / 5) * 280}px` }}
          >
            <span className="font-body text-xs tracking-widest uppercase">
              {designers.length} designer{designers.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Wrapper to handle designer count fetching for parent brands
// Hides parent landscape card when ≤1 sub-designer (the sub already shows as portrait)
function ParentBrandCardWrapper({
  item,
  openParent,
  setOpenParent,
}: {
  item: Designer;
  openParent: string | null;
  setOpenParent: (name: string | null) => void;
}) {
  const { data: subDesigners = [] } = useParentBrandDesigners(item.name);
  const isOpen = openParent === item.name;

  // Skip landscape card for single-designer brands — portrait card handles it
  if (subDesigners.length <= 1) return null;

  return (
    <ParentBrandCard
      item={item}
      isOpen={isOpen}
      onToggle={() => setOpenParent(isOpen ? null : item.name)}
      designerCount={subDesigners.length}
    />
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
const PublicDesigners = () => {
  const { data: allDesigners = [], isLoading } = useAllDesigners();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const [forcedLetters, setForcedLetters] = useState<Set<string>>(new Set());
  const letterBarRef = useRef<HTMLDivElement>(null);

  // Jump to letter from URL param
  useEffect(() => {
    const letter = searchParams.get("letter")?.toUpperCase();
    if (letter && LETTERS.includes(letter)) {
      setForcedLetters(new Set([letter]));
      setTimeout(() => {
        document.getElementById(`alpha-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [searchParams]);

  const items = useMemo(
    () =>
      allDesigners
        .filter((d) => d.is_published)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allDesigners]
  );

  // Search filtering
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return items.filter((d) => {
      const name = d.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const specialty = (d.specialty || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const founder = (d.founder || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return name.includes(q) || specialty.includes(q) || founder.includes(q);
    });
  }, [items, searchQuery]);

  // Group by first letter
  const alphaGroups = useMemo(() => {
    const groups: Record<string, Designer[]> = {};
    filteredItems.forEach((d) => {
      const letter = d.name[0]?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(d);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const activeLetters = useMemo(() => new Set(alphaGroups.map(([l]) => l)), [alphaGroups]);

  const jumpToLetter = useCallback((letter: string) => {
    if (!activeLetters.has(letter)) return;
    setForcedLetters((prev) => new Set(prev).add(letter));
    setTimeout(() => {
      document.getElementById(`alpha-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [activeLetters]);

  // When searching, force-open all groups
  useEffect(() => {
    if (searchQuery.trim()) {
      setForcedLetters(new Set(alphaGroups.map(([l]) => l)));
    }
  }, [searchQuery, alphaGroups]);

  const totalCount = filteredItems.length;

  return (
    <>
      <Helmet>
        <title>Designers & Ateliers — Maison Affluency</title>
        <meta
          name="description"
          content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting."
        />
        <link rel="canonical" href="https://www.maisonaffluency.com/designers" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta property="og:url" content="https://www.maisonaffluency.com/designers" />
        <meta property="og:title" content="Designers & Ateliers — Maison Affluency" />
        <meta property="og:description" content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Designers & Ateliers — Maison Affluency" />
        <meta name="twitter:description" content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="max-w-7xl mx-auto px-6 md:px-12 pt-28 pb-20">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
            className="mb-8"
          >
            <div className="flex flex-wrap items-end gap-3 mb-2">
              <h1 className="font-display text-3xl md:text-4xl tracking-wide">
                Designers & Ateliers
              </h1>
              <span className="font-body text-sm text-muted-foreground mb-1">
                {totalCount}
              </span>
            </div>
            <p className="font-body text-sm text-muted-foreground max-w-2xl">
              A curated directory of the ateliers and independent designers whose work defines our collection.
            </p>
          </motion.div>

          {/* Sticky A-Z bar + Search */}
          <div className="sticky top-16 z-20 bg-background pb-3 pt-2 border-b border-border/30 mb-6">
            <div
              ref={letterBarRef}
              className="flex items-center gap-2 md:gap-3 lg:gap-4 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as any}
            >
              {LETTERS.map((letter) => {
                const isActive = activeLetters.has(letter);
                return (
                  <button
                    key={letter}
                    onClick={() => jumpToLetter(letter)}
                    className={`flex-none font-serif text-base md:text-lg leading-none transition-all duration-200 ${
                      isActive
                        ? "text-foreground hover:text-primary cursor-pointer"
                        : "text-foreground/25 cursor-default"
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            <div className="relative max-w-xs mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search designers…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm bg-background border-border rounded-full focus:border-primary/60 font-body"
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
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-32">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {/* Empty */}
          {!isLoading && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <p className="font-body text-sm text-muted-foreground">
                {searchQuery ? "No designers match your search." : "Content coming soon — we're curating this collection."}
              </p>
            </div>
          )}

          {/* A-Z Groups */}
          {!isLoading && alphaGroups.length > 0 && (
            <div>
              {alphaGroups.map(([letter, designers]) => (
                <LetterGroup
                  key={letter}
                  letter={letter}
                  designers={designers}
                  forceOpen={forcedLetters.has(letter)}
                />
              ))}
            </div>
          )}

          {/* Trade CTA */}
          <div className="mt-16 text-center">
            <Link
              to="/trade"
              className="inline-flex items-center gap-2 px-8 py-3 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-md hover:opacity-90 transition-opacity"
            >
              Join Our Trade Program
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default PublicDesigners;
