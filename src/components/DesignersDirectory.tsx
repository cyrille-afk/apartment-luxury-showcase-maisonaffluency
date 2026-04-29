import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search, X, Layers, Share2, Plus, SlidersHorizontal, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useAllDesigners, type Designer } from "@/hooks/useDesigner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";
import { useParentBrandDesigners } from "@/hooks/useParentBrandDesigners";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import CategorySidebar from "@/components/CategorySidebar";
import { trackCTA } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_ORDER, SUBCATEGORY_MAP, normalizeCategory, normalizeSubcategory } from "@/lib/productTaxonomy";
import { withOgCacheBust } from "@/lib/whatsapp-share";
import { GALLERY_THUMBNAILS } from "@/constants/galleryThumbnails";
import { GALLERY } from "@/constants/galleryIndex";
import { scrollToSection } from "@/lib/scrollToSection";
import { getDesignersDirectoryAnchor, getDesignersDirectoryAnchorId } from "@/lib/designersDirectoryAnchors";
import { getDesignersDirectoryLayout } from "@/lib/designersDirectoryAnchors";
import { getCategoryHero } from "@/constants/categoryHeroes";
import { categoryUrl } from "@/lib/categorySlugs";
import { readPendingCategoryFilter } from "@/lib/pendingCategoryFilter";
import { cleanBrandLine, composeTitle } from "@/lib/curatorPickLegend";

// ─── Reverse-map: extract Cloudinary public ID from URL → flat gallery index ─
function extractCloudinaryId(url: string): string | null {
  const withVersion = url.match(/\/v\d+\/(.+?)(?:\.\w+)?$/);
  if (withVersion?.[1]) return withVersion[1];
  const withoutVersion = url.match(/\/upload\/[^/]+\/(.+?)(?:\.\w+)?$/);
  return withoutVersion?.[1] || null;
}

const normalizeCloudinaryId = (id: string) => id.replace(/\.(jpg|jpeg|png|webp|avif)$/i, "");
const cloudinaryIdBasename = (id: string) => normalizeCloudinaryId(id).split("/").pop() || normalizeCloudinaryId(id);

const THUMBNAIL_TO_GALLERY_INDEX: Map<string, number> = (() => {
  const idToIndex = new Map<string, number>();
  for (const [idx, thumbUrl] of Object.entries(GALLERY_THUMBNAILS)) {
    const id = extractCloudinaryId(thumbUrl);
    if (!id) continue;
    const normalized = normalizeCloudinaryId(id);
    idToIndex.set(normalized, Number(idx));
    idToIndex.set(cloudinaryIdBasename(normalized), Number(idx));
  }
  return idToIndex;
})();

function resolveThumbToGalleryIndex(thumbUrl: string): number | null {
  const id = extractCloudinaryId(thumbUrl);
  if (!id) return null;
  const normalized = normalizeCloudinaryId(id);
  return THUMBNAIL_TO_GALLERY_INDEX.get(normalized) ?? THUMBNAIL_TO_GALLERY_INDEX.get(cloudinaryIdBasename(normalized)) ?? null;
}

const LETTERS = [...("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")), "#"];

const normalizeDesignerKey = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const IMAGE_IDENTIFIER_TO_INDEX: Record<string, number> = {
  "An Inviting Lounge Area": GALLERY.AN_INVITING_LOUNGE_AREA,
  "A Sophisticated Living Room": GALLERY.A_SOPHISTICATED_LIVING_ROOM,
  "Panoramic Cityscape Views": GALLERY.PANORAMIC_CITYSCAPE_VIEWS,
  "A Sun Lit Reading Corner": GALLERY.A_SUN_LIT_READING_CORNER,
  "A Dreamy Tuscan Landscape": GALLERY.A_DREAMY_TUSCAN_LANDSCAPE,
  "A Highly Customised Dining Room": GALLERY.A_HIGHLY_CUSTOMISED_DINING_ROOM,
  "A Relaxed Setting": GALLERY.A_RELAXED_SETTING,
  "A Colourful Nook": GALLERY.A_COLOURFUL_NOOK,
  "A Sophisticated Boudoir": GALLERY.A_SOPHISTICATED_BOUDOIR,
  "A Jewelry Box Like Setting": GALLERY.A_JEWELRY_BOX_LIKE_SETTING,
  "A Serene Decor": GALLERY.A_SERENE_DECOR,
  "A Design Treasure Trove": GALLERY.A_DESIGN_TREASURE_TROVE,
  "A Masterful Suite": GALLERY.A_MASTERFUL_SUITE,
  "Design Tableau": GALLERY.DESIGN_TABLEAU,
  "A Venitian Cocoon": GALLERY.A_VENITIAN_COCOON,
  "Unique By Design Vignette": GALLERY.UNIQUE_BY_DESIGN_VIGNETTE,
  "An Artistic Statement": GALLERY.AN_ARTISTIC_STATEMENT,
  "Compact Elegance": GALLERY.COMPACT_ELEGANCE,
  "Yellow Crystalline": GALLERY.YELLOW_CRYSTALLINE,
  "Golden Hour": GALLERY.GOLDEN_HOUR,
  "A Workspace of Distinction": GALLERY.A_WORKSPACE_OF_DISTINCTION,
  "Refined Details": GALLERY.REFINED_DETAILS,
  "Light & Focus": GALLERY.LIGHT_AND_FOCUS,
  "Design & Fine Art Books Corner": GALLERY.DESIGN_AND_FINE_ART_BOOKS_CORNER,
  "Curated Vignette": GALLERY.CURATED_VIGNETTE,
  "The Details Make The Design": GALLERY.THE_DETAILS_MAKE_THE_DESIGN,
  "Light & Texture": GALLERY.LIGHT_AND_TEXTURE,
  "Craftsmanship At Every Corner": GALLERY.CRAFTSMANSHIP_AT_EVERY_CORNER,
};

// ─── Gallery room thumbnails (keyed by DB slug) ─────────────────────────────
const CARD_THUMBNAILS: Record<string, string[]> = {
  "okha": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085686/bedroom-alt_yk0j0d.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774340485/AffluencySG_030_1_pncaim.jpg"],
  "alexander-lamont": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085716/bespoke-sofa_gxidtx.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085533/art-master-bronze_hf6bad.jpg"],
  "leo-aerts-alinea": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085743/dining-room_ey0bu5.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085856/intimate-lounge_tf4sm1.jpg"],
  "apparatus-studio": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085919/small-room-personality_wvxz6y.png", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085690/bedroom-second_cyfmdj.jpg"],
  "atelier-fevrier": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085716/bespoke-sofa_gxidtx.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772599861/IMG_2040_clunsw.jpg"],
  "atelier-pendhapa": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085848/intimate-dining_ux4pee.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1774342970/6C3ABF9A-8DF6-4BAB-941D-A1343031CBBA_sw6tri.jpg"],
  "bina-baitel": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087851/IMG_2133_wtxd62.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774336201/AffluencySG_191_2_jthubs.jpg"],
  "bruno-de-maistre": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085726/boudoir_ll5spn.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772177400/70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq.jpg"],
  "emmanuel-levet-stenne": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085743/dining-room_ey0bu5.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774330412/AffluencySG_107_2_s4nfeb.jpg"],
  "entrelacs-creation": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774855454/AffluencySG_094-Bloom_35_color_gimp_correction_okyphd.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1772085802/home-office-desk_g0ywv2.png"],
  "felix-agostini": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772177400/70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_north,y_0,q_auto,f_auto/v1774348120/PHOTO-2024-11-15-15-13-10_rj8jic.jpg"],
  "robicara": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774340767/AffluencySG_178_1_esvjq2.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087460/AffluencySG_204_1_qbbpqb.jpg"],
  "forest-giaconia": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085856/intimate-lounge_tf4sm1.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087851/IMG_2133_wtxd62.jpg"],
  "garnier-linker": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772536395/AffluencySG_194-22.jpg_macpwj.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774336947/eaa39674-f12c-4297-8e77-3c4407f1dce9_oaceoq.jpg"],
  "hamrei": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085864/intimate-table-detail_aqxvvm.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772177400/70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq.jpg"],
  "jean-michel-frank": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085877/living-room-hero_zxfcxl.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1774343324/IMG_2491_cirrjv.jpg"],
  "jeremy-maxwell-wintrebert": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085848/intimate-dining_ux4pee.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774338139/AffluencySG_131_1_fz2esj.jpg"],
  "leo-sentou": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774842687/IMG_2402-resized_swt5iy.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085877/living-room-hero_zxfcxl.jpg"],
  "kira": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085726/boudoir_ll5spn.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1774342944/IMG_2498_qwza44.jpg"],
  "man-of-parts": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_north,q_auto,f_auto/v1772085907/small-room-chair_aobzyb.jpg"],
  "milan-pekar": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774338136/AffluencySG_210_1_vdtca1.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085920/small-room-vase_s3nz5o.jpg"],
  "nathalie-ziegler": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085726/boudoir_ll5spn.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/v1774343095/9105eaeb-d531-4e20-8efe-f1963c4e4356_n8wwgq.jpg"],
  "olivia-cognet": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085877/living-room-hero_zxfcxl.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772087732/IMG_2397-resized_rufbef.jpg"],
  "pierre-bonnefille": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774340153/AffluencySG_073_1_m4j7uv.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085533/art-master-bronze_hf6bad.jpg"],
  "reda-amalou": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1774855454/AffluencySG_094-Bloom_35_color_gimp_correction_okyphd.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085919/small-room-personality_wvxz6y.png"],
  "thierry-lemaire": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085716/bespoke-sofa_gxidtx.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085877/living-room-hero_zxfcxl.jpg"],
  "tristan-auer": ["https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1772085769/home-office-3_t39msw.jpg", "https://res.cloudinary.com/dif1oamtj/image/upload/w_200,h_200,c_fill,g_auto,q_auto,f_auto/v1773200000/Screen_Shot_2026-03-11_at_11.11.33_AM_p0wtix.png"],
};

// ─── Instagram links (keyed by DB slug) ─────────────────────────────────────
const INSTAGRAM_LINKS: Record<string, string> = {
  // okha: see entry below (deduplicated)
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
  
  "reda-amalou": "https://www.instagram.com/redaamaloudesign/",
  "thierry-lemaire": "https://www.instagram.com/thierrylemaire_/",
  "tristan-auer": "https://www.instagram.com/tristanauer/",
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
  "jean-michel-frank": "https://www.instagram.com/ecart.paris/",
};

// ─── Hook: fetch designer→category mapping from curator picks ────────────────
function useDesignerCategories() {
  return useQuery({
    queryKey: ["designer-category-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_curator_picks_public")
        .select("designer_id, category, subcategory, tags");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Hook: fetch fallback gallery indices per designer from gallery hotspots ──
function useDesignerHotspotFallbacks() {
  return useQuery({
    queryKey: ["designer-hotspot-fallbacks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_hotspots")
        .select("designer_name, image_identifier")
        .not("designer_name", "is", null)
        .not("image_identifier", "is", null);

      if (error) throw error;

      const countsByDesigner: Record<string, Record<number, number>> = {};
      for (const row of data || []) {
        const designerName = (row as { designer_name?: string }).designer_name;
        const imageIdentifier = (row as { image_identifier?: string }).image_identifier;
        if (!designerName || !imageIdentifier) continue;

        const index = IMAGE_IDENTIFIER_TO_INDEX[imageIdentifier];
        if (index === undefined) continue;

        const key = normalizeDesignerKey(designerName);
        if (!countsByDesigner[key]) countsByDesigner[key] = {};
        countsByDesigner[key][index] = (countsByDesigner[key][index] || 0) + 1;
      }

      const rankedByDesigner: Record<string, number[]> = {};
      for (const [designerKey, countMap] of Object.entries(countsByDesigner)) {
        rankedByDesigner[designerKey] = Object.entries(countMap)
          .sort((a, b) => b[1] - a[1])
          .map(([idx]) => Number(idx));
      }

      return rankedByDesigner;
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Hook: fetch full curator picks for product card rendering ───────────────
type PickItem = {
  id: string;
  designer_id: string;
  image_url: string;
  hover_image_url?: string | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  subcategory: string | null;
  tags: string[] | null;
  materials: string | null;
  dimensions: string | null;
  description?: string | null;
  pdf_url?: string | null;
  pdf_urls?: any | null;
  designer_name?: string;
  designer_slug?: string;
};

function useFullCuratorPicks(enabled: boolean) {
  return useQuery({
    queryKey: ["full-curator-picks-directory"],
    queryFn: async () => {
      const [{ data: picks }, { data: designers }] = await Promise.all([
        supabase
          .from("designer_curator_picks_public")
          .select("id, designer_id, image_url, hover_image_url, title, subtitle, category, subcategory, tags, materials, dimensions, description, pdf_url, pdf_urls"),
        supabase
          .from("designers")
          .select("id, name, slug"),
      ]);
      if (!picks) return [];
      const designerMap = new Map((designers || []).map((d: any) => [d.id, { name: d.name, slug: d.slug }]));
      return (picks as any[]).map((p): PickItem => ({
        ...p,
        designer_name: designerMap.get(p.designer_id)?.name || "Unknown",
        designer_slug: designerMap.get(p.designer_id)?.slug || "",
      }));
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Parse names into [displayName, parentLabel] for correct card rendering */
function parseDesignerDisplayName(item: Designer): { displayName: string; parentLabel: string | null } {
  if (item.founder && item.founder !== item.name) {
    return { displayName: item.display_name || item.name, parentLabel: item.founder };
  }
  if (!item.founder && item.display_name && item.display_name !== item.name) {
    return { displayName: item.display_name, parentLabel: item.name };
  }
  const dashIdx = item.name.indexOf(" - ");
  if (dashIdx > 0) {
    const atelier = item.name.substring(0, dashIdx).trim();
    const designer = item.name.substring(dashIdx + 3).trim();
    return { displayName: item.display_name || designer, parentLabel: atelier };
  }
  return { displayName: item.display_name || item.name, parentLabel: null };
}

// ─── Sub-Designers Grid ──────────────────────────────────────────────────────
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
                      <span className="absolute bottom-1.5 left-2 z-10 font-body text-[7px] text-white/50 tracking-wide drop-shadow-sm">
                        @{igUrl.replace(/\/+$/, '').split('/').pop()}
                      </span>
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

// ─── Share helper ────────────────────────────────────────────────────────────
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

// ─── Parent Brand Card ───────────────────────────────────────────────────────
function ParentBrandCard({ item, isOpen, onToggle, designerCount, hasIgPosts }: { item: Designer; isOpen: boolean; onToggle: () => void; designerCount: number; hasIgPosts?: boolean }) {
  const instagramLink = hasIgPosts ? undefined : (INSTAGRAM_LINKS[item.slug] || (item.links as any[])?.find((l: any) => l.type === "Instagram" || l.type === "instagram")?.url);

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
      <div className="group relative rounded-xl overflow-hidden border border-primary/40 ring-1 ring-primary/20 hover:border-primary/60 hover:shadow-xl transition-all duration-300 cursor-pointer aspect-[11/7]">
        {item.name === 'Apparatus' ? (
          <div className="absolute inset-0 bg-black" />
        ) : (
          <>
            {(item.hero_image_url || item.image_url) && (
              <img src={item.hero_image_url || item.image_url} alt={item.name} loading="lazy" aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none select-none object-cover" />
            )}
            <div className={`absolute inset-0 transition-all duration-300 ${(item.hero_image_url || item.image_url) ? "bg-black/25 group-hover:bg-black/15" : "bg-card/80"}`} />
            <div className="absolute top-3 left-3 w-14 h-14 md:w-16 md:h-16 bg-foreground flex items-center justify-center p-1.5 overflow-hidden z-10">
              <span className="font-display text-[7px] md:text-[8px] text-background text-center leading-tight uppercase tracking-[0.12em]">{item.display_name || item.name}</span>
            </div>
          </>
        )}
        {instagramLink && (
          <a href={instagramLink} target="_blank" rel="noopener noreferrer" className="absolute top-3 right-3 z-10 font-body text-[9px] text-white/60 hover:text-white tracking-wide transition-colors drop-shadow-sm" onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(instagramLink, '_blank', 'noopener,noreferrer'); }} aria-label={`${item.name} on Instagram`}>
            @{instagramLink.split('?')[0].replace(/\/+$/, '').split('/').pop()}
          </a>
        )}
        <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(); }} className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 text-white hover:bg-white/25 transition-all">
          <Layers className="h-3 w-3" />
          <span className="font-body text-[9px] uppercase tracking-[0.12em]">Designers{designerCount > 0 ? ` (${designerCount})` : ""}</span>
          <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
        </button>
        <button onClick={handleShare} className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-white hover:opacity-70 transition-opacity" aria-label={`Share ${item.name}`}>
          <Share2 className="h-3 w-3" />
          <span className="font-body text-[9px] uppercase tracking-[0.12em]">Share</span>
        </button>
        <Link to={`/designers/${item.slug}`} className="absolute inset-0 z-[6] flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white font-body text-[10px] uppercase tracking-[0.15em] hover:bg-white/20 transition-colors">View Profile</span>
        </Link>
      </div>
    </div>
  );
}

// ─── Single Designer Card ────────────────────────────────────────────────────
function SingleDesignerCard({ item, fallbackGalleryIndexByDesigner, hasIgPosts }: { item: Designer; fallbackGalleryIndexByDesigner?: Record<string, number[]>; hasIgPosts?: boolean }) {
  const { displayName, parentLabel } = parseDesignerDisplayName(item);
  const { toast } = useToast();
  const thumbs = CARD_THUMBNAILS[item.slug] || [];
  const instagramLinks: string[] = hasIgPosts ? [] : (() => {
    const hardcoded = INSTAGRAM_LINKS[item.slug];
    if (hardcoded) return [hardcoded];
    const fromDb = (item.links as any[])?.filter((l: any) => (l.type === "Instagram" || l.type === "instagram") && l.url).map((l: any) => l.url as string) || [];
    return fromDb;
  })();
  const instagramLink = instagramLinks[0];
  const fallbackGalleryIndices = fallbackGalleryIndexByDesigner?.[normalizeDesignerKey(item.name)] ?? [];
  const getPositionalFallbackIndex = (thumbPosition: number) => {
    if (fallbackGalleryIndices.length === 0) return null;
    return fallbackGalleryIndices[thumbPosition] ?? fallbackGalleryIndices[0] ?? null;
  };

  return (
    <Link id={`designer-card-${item.slug}`} to={`/designers/${item.slug}`} className="group block rounded-xl overflow-hidden border border-border hover:border-foreground/30 transition-all hover:shadow-xl bg-background">
      <div className="aspect-[3/4] bg-muted/20 overflow-hidden relative">
        {item.name === 'Apparatus' ? (
          <div className="w-full h-full bg-black" />
        ) : item.image_url ? (
          <img src={item.image_url} alt={item.name} draggable={false} className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-[0.65]" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/10 group-hover:bg-muted/20 transition-colors">
            <span className="font-display text-3xl text-muted-foreground/20">{item.name.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 px-3 pr-10 pb-10 pt-2.5 bg-gradient-to-b from-black/60 via-black/25 to-transparent">
          <p className={`font-display text-white tracking-wide leading-tight drop-shadow-sm ${displayName.length > 20 ? "text-[11px] md:text-xs" : "text-xs md:text-sm"}`}>{displayName}</p>
          {parentLabel && <p className="font-body text-[10px] text-white/70 mt-0.5 tracking-wide">{parentLabel}</p>}
        </div>
        {thumbs.length === 0 && (
          <>
            <button onClick={(e) => handleDesignerShare(e, item, displayName)} className="absolute bottom-3 left-3 z-10 flex items-center gap-1 text-white/80 hover:text-white transition-opacity" aria-label={`Share ${displayName}`}>
              <Share2 className="h-3 w-3" />
              <span className="font-body text-[8px] uppercase tracking-[0.12em]">Share</span>
            </button>
            {instagramLinks.length > 0 && (
              <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-0.5">
                {instagramLinks.map((igUrl, i) => {
                  const handle = '@' + igUrl.split('?')[0].replace(/\/+$/, '').split('/').pop();
                  return (
                    <a key={i} href={igUrl} target="_blank" rel="noopener noreferrer" className="font-body text-[9px] text-white/50 hover:text-white tracking-wide transition-colors drop-shadow-sm" onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(igUrl, '_blank', 'noopener,noreferrer'); }} aria-label={`${item.name} on Instagram`}>
                      {handle}
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}
        {thumbs.length > 0 && (
          <>
            <button onClick={(e) => handleDesignerShare(e, item, displayName)} className="absolute bottom-3 left-3 z-10 flex items-center gap-1 text-white/80 hover:text-white transition-opacity" aria-label={`Share ${displayName}`}>
              <Share2 className="h-3.5 w-3.5" />
              <span className="font-body text-[8px] uppercase tracking-[0.12em]">Share</span>
            </button>
            <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1.5">
              <div className="flex flex-col items-center gap-1.5">
                <span className="font-body text-[10px] uppercase tracking-[0.18em] text-white/90 drop-shadow-md font-medium">ON VIEW</span>
                <div className="flex gap-1.5">
                  {thumbs.slice(0, 2).map((src, i) => {
                    const mappedGalleryIdx = resolveThumbToGalleryIndex(src);
                    const resolvedGalleryIdx = mappedGalleryIdx ?? getPositionalFallbackIndex(i);
                    return (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (resolvedGalleryIdx !== null) {
                            sessionStorage.setItem('openGalleryIndex', String(resolvedGalleryIdx));
                            sessionStorage.setItem('gallerySourceId', `designer-card-${item.slug}`);
                            sessionStorage.setItem('galleryFilterDesigner', item.name);
                            const galleryEl = document.getElementById('gallery');
                            if (galleryEl) {
                              galleryEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('openGalleryLightbox', {
                                detail: {
                                  index: resolvedGalleryIdx,
                                  sourceId: `designer-card-${item.slug}`,
                                  filterDesigner: item.name,
                                },
                              }));
                            }, 600);
                          } else {
                            const galleryEl = document.getElementById('gallery');
                            if (galleryEl) {
                              galleryEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                            toast({ title: `Viewing ${item.name} in gallery`, description: "Scroll to explore their featured pieces" });
                          }
                        }}
                        className="relative w-14 h-14 md:w-16 md:h-16 rounded overflow-hidden border-2 border-white/90 shadow-md hover:border-primary/80 transition-colors cursor-pointer"
                      >
                        <img src={src} alt="" draggable={false} className="w-full h-full object-cover" loading="lazy" />
                        <span className="absolute top-0.5 left-0.5 flex items-center justify-center w-3 h-3 rounded-full bg-black/70 border border-primary/70 pointer-events-none">
                          <Plus className="w-2 h-2 text-white" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {instagramLinks.length > 0 && instagramLinks.map((igUrl, i) => {
                const handle = '@' + igUrl.split('?')[0].replace(/\/+$/, '').split('/').pop();
                return (
                  <a key={i} href={igUrl} target="_blank" rel="noopener noreferrer" className="font-body text-[8px] text-white/40 hover:text-white tracking-wide transition-colors drop-shadow-sm" onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open(igUrl, '_blank', 'noopener,noreferrer'); }} aria-label={`${item.name} on Instagram`}>
                    {handle}
                  </a>
                );
              })}
            </div>
          </>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white font-body text-[9px] uppercase tracking-[0.15em] hover:bg-white/20 transition-colors">View Portrait</span>
        </div>
      </div>
    </Link>
  );
}

// ─── Carousel Dots ───────────────────────────────────────────────────────────
function CarouselDots({ count, selected, onSelect }: { count: number; selected: number; onSelect: (i: number) => void }) {
  if (count <= 1) return null;
  return (
    <div className="flex justify-center gap-1.5 mt-3">
      {Array.from({ length: count }).map((_, i) => (
        <button key={i} onClick={() => onSelect(i)} className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${i === selected ? "bg-foreground scale-125" : "bg-foreground/25 hover:bg-foreground/40"}`} aria-label={`Go to page ${i + 1}`} />
      ))}
    </div>
  );
}

// ─── Letter Group ────────────────────────────────────────────────────────────
function LetterGroup({
  letter,
  anchorId,
  designers,
  forceOpen,
  parentDesignerCountByName,
  fallbackGalleryIndexByDesigner,
  initialExpand,
  designersWithIgPosts,
}: {
  letter: string;
  anchorId: string;
  designers: Designer[];
  forceOpen?: boolean;
  parentDesignerCountByName: Record<string, number>;
  fallbackGalleryIndexByDesigner: Record<string, number[]>;
  initialExpand?: string;
  designersWithIgPosts?: Set<string>;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sentinelRef, { margin: "200px 0px 200px 0px", once: true });
  const isRevealed = forceOpen || isInView;
  const matchesExpand = initialExpand && designers.some((d) => d.name === initialExpand || d.founder === initialExpand);
  const [openParent, setOpenParent] = useState<string | null>(matchesExpand ? initialExpand! : null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const needsCarousel = designers.length > (isMobile ? 2 : 5);

  return (
    <div id={anchorId} data-alpha-letter={letter} className="scroll-mt-32 mb-6">
      <div ref={sentinelRef} />
      <div className="flex items-center gap-3 mb-4 px-1">
        <span className="font-serif text-2xl md:text-3xl text-foreground">{letter}</span>
        <div className="flex-1 h-px bg-border/40" />
        <span className="font-body text-[10px] text-muted-foreground/50 tracking-widest uppercase">{designers.length}</span>
      </div>
      <AnimatePresence>
        {isRevealed ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
            {needsCarousel ? (
              <LetterCarousel
                letter={letter}
                designers={designers}
                openParent={openParent}
                setOpenParent={setOpenParent}
                parentDesignerCountByName={parentDesignerCountByName}
                fallbackGalleryIndexByDesigner={fallbackGalleryIndexByDesigner}
                designersWithIgPosts={designersWithIgPosts}
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
                {designers.map((item) => {
                  const designerCount = parentDesignerCountByName[item.name] ?? 0;
                  const isParentBrand = item.founder === item.name && designerCount > 0;
                  if (isParentBrand) {
                    const isOpen = openParent === item.name;
                    return (
                      <React.Fragment key={item.slug}>
                        <ParentBrandCard item={item} isOpen={isOpen} onToggle={() => setOpenParent(isOpen ? null : item.name)} designerCount={designerCount} hasIgPosts={designersWithIgPosts?.has(item.id)} />
                        <AnimatePresence>
                          {isOpen && (
                            <div className="col-span-2 md:col-span-3 lg:col-span-5">
                              <ParentSubGrid key={item.name} parentName={item.name} onClose={() => setOpenParent(null)} />
                            </div>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  }
                  return <SingleDesignerCard key={item.slug} item={item} fallbackGalleryIndexByDesigner={fallbackGalleryIndexByDesigner} hasIgPosts={designersWithIgPosts?.has(item.id)} />;
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground/30" style={{ minHeight: `${Math.ceil(designers.length / (typeof window !== "undefined" && window.innerWidth < 768 ? 2 : 5)) * 280}px` }}>
            <span className="font-body text-xs tracking-widest uppercase">{designers.length} designer{designers.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Letter Carousel ─────────────────────────────────────────────────────────
function LetterCarousel({ letter, designers, openParent, setOpenParent, parentDesignerCountByName, fallbackGalleryIndexByDesigner, designersWithIgPosts }: { letter: string; designers: Designer[]; openParent: string | null; setOpenParent: (name: string | null) => void; parentDesignerCountByName: Record<string, number>; fallbackGalleryIndexByDesigner: Record<string, number[]>; designersWithIgPosts?: Set<string> }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [slotsPerPage, setSlotsPerPage] = useState(() => {
    if (typeof window === "undefined") return 5;
    if (window.innerWidth >= 1024) return 5;
    if (window.innerWidth >= 768) return 3;
    return 2;
  });
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const didDragRef = useRef(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setSlotsPerPage(5);
      else if (window.innerWidth >= 768) setSlotsPerPage(3);
      else setSlotsPerPage(2);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const pages = useMemo(() => {
    const getSlotCost = (item: Designer) => {
      const isParentBrand = item.founder === item.name && (parentDesignerCountByName[item.name] ?? 0) > 0;
      return isParentBrand ? 2 : 1;
    };
    const pool = [...designers];
    const builtPages: Designer[][] = [];
    while (pool.length > 0) {
      const page: Designer[] = [];
      let usedSlots = 0;
      while (usedSlots < slotsPerPage && pool.length > 0) {
        const remaining = slotsPerPage - usedSlots;
        const nextIndex = pool.findIndex((candidate) => getSlotCost(candidate) <= remaining);
        if (nextIndex === -1) break;
        const [picked] = pool.splice(nextIndex, 1);
        if (!picked) break;
        page.push(picked);
        usedSlots += getSlotCost(picked);
      }
      if (page.length > 0) builtPages.push(page);
      else break;
    }
    return builtPages;
  }, [designers, parentDesignerCountByName, slotsPerPage]);

  useEffect(() => {
    setActivePage((prev) => Math.min(prev, Math.max(0, pages.length - 1)));
  }, [pages.length]);

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextPage = Math.round(viewport.scrollLeft / Math.max(1, viewport.clientWidth));
    setActivePage(Math.min(Math.max(nextPage, 0), Math.max(0, pages.length - 1)));
  }, [pages.length]);

  const scrollToPage = useCallback((index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ left: viewport.clientWidth * index, behavior: "smooth" });
    setActivePage(index);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Only block drag-start from interactive controls on mouse.
    // On touch, cards are links, so we must allow drag start for mobile swipe.
    if (e.pointerType === "mouse" && target.closest("a,button,input,textarea,select,[role='button']")) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    setIsDragging(true);
    didDragRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartScrollLeftRef.current = viewport.scrollLeft;
    viewport.setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const delta = e.clientX - dragStartXRef.current;
    if (Math.abs(delta) > 4) didDragRef.current = true;
    viewport.scrollLeft = dragStartScrollLeftRef.current - delta;
  }, [isDragging]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    viewportRef.current?.releasePointerCapture?.(e.pointerId);
    setIsDragging(false);
  }, [isDragging]);

  const handleClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!didDragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    didDragRef.current = false;
  }, []);

  const openParentItem = openParent ? designers.find((d) => d.name === openParent && d.founder === d.name && (parentDesignerCountByName[d.name] ?? 0) > 0) : null;
  const goPrev = useCallback(() => { if (activePage > 0) scrollToPage(activePage - 1); }, [activePage, scrollToPage]);
  const goNext = useCallback(() => { if (activePage < pages.length - 1) scrollToPage(activePage + 1); }, [activePage, pages.length, scrollToPage]);

  return (
    <div>
      <div className="relative group/carousel">
        {pages.length > 1 && activePage > 0 && (
          <button onClick={goPrev} className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full bg-background/90 border border-border shadow-md hover:bg-accent transition-colors" aria-label="Previous page">
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
        )}
        {pages.length > 1 && activePage < pages.length - 1 && (
          <button onClick={goNext} className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full bg-background/90 border border-border shadow-md hover:bg-accent transition-colors" aria-label="Next page">
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        )}
        <div ref={viewportRef} onScroll={handleScroll} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={endDrag} onClickCapture={handleClickCapture} className={`overflow-x-auto snap-x snap-mandatory scrollbar-hide select-none touch-pan-x ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}>
          <div className="flex">
            {pages.map((page, pageIndex) => (
              <div key={`page-${pageIndex}`} className="flex-none w-full snap-start">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
                  {page.map((item) => {
                    const designerCount = parentDesignerCountByName[item.name] ?? 0;
                    const isParentBrand = item.founder === item.name && designerCount > 0;
                    if (isParentBrand) {
                      const isOpen = openParent === item.name;
                      return <ParentBrandCard key={item.slug} item={item} isOpen={isOpen} onToggle={() => setOpenParent(isOpen ? null : item.name)} designerCount={designerCount} hasIgPosts={designersWithIgPosts?.has(item.id)} />;
                    }
                    return <SingleDesignerCard key={item.slug} item={item} fallbackGalleryIndexByDesigner={fallbackGalleryIndexByDesigner} hasIgPosts={designersWithIgPosts?.has(item.id)} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <CarouselDots count={pages.length} selected={activePage} onSelect={scrollToPage} />
      <AnimatePresence onExitComplete={() => {
        if (!openParent) {
          const el = getDesignersDirectoryAnchor(letter);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }}>
        {openParentItem && openParent && <ParentSubGrid key={openParent} parentName={openParent} onClose={() => setOpenParent(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Subcategory tag matching helper ─────────────────────────────────────────
const SUBCATEGORY_TO_TAGS: Record<string, string[]> = {
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

// ─── Product Pick Card (shown when category filter is active) ────────────────
function pickSlugify(s: string) {
  return s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const PickCard = ({ pick, onFavorite, isFavorited }: { pick: PickItem; onFavorite?: (id: string) => void; isFavorited?: boolean }) => {
  const navigate = useNavigate();
  const productSlug = pickSlugify(pick.title + (pick.subtitle ? `-${pick.subtitle}` : ""));
  return (
    <button
      type="button"
      onClick={() => {
        if (pick.designer_slug) {
          navigate(`/designers/${pick.designer_slug}/${productSlug}`, {
            state: { from: window.location.pathname + window.location.search },
          });
        }
      }}
      className="group block w-full text-left rounded-xl overflow-hidden border border-border hover:border-foreground/30 transition-all hover:shadow-xl bg-background"
    >
      <div className="aspect-[4/5] bg-muted/20 overflow-hidden relative">
        {pick.subtitle && /re-?edition$/i.test(pick.subtitle.trim()) && (
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <span className="inline-block font-body text-[10px] uppercase tracking-[0.14em] text-background bg-foreground/75 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
              {pick.subtitle}
            </span>
          </div>
        )}
        {pick.image_url ? (
          <>
            <img
              src={pick.image_url}
              alt={pick.title}
              className={cn(
                "w-full h-full object-cover object-center transition-all duration-700 group-hover:scale-[1.03]",
                pick.hover_image_url && "group-hover:opacity-0"
              )}
              loading="lazy"
            />
            {pick.hover_image_url && (
              <img
                src={pick.hover_image_url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover object-center opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/10 group-hover:bg-muted/20 transition-colors">
            <span className="font-display text-3xl text-muted-foreground/20">{pick.title.charAt(0)}</span>
          </div>
        )}
        {/* Description overlay on hover */}
        {pick.description && (
          <div className="absolute left-3 right-3 top-12 z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-background/90 backdrop-blur-sm rounded-lg shadow-lg px-3.5 py-2.5 border border-border/30">
              <p className="font-body text-xs text-foreground leading-relaxed line-clamp-3">
                {pick.description}
              </p>
            </div>
          </div>
        )}
        {/* Hover action icons */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onFavorite?.(pick.id); }}
            className={cn(
              "p-1.5 rounded-full backdrop-blur-sm transition-colors",
              isFavorited
                ? "bg-white text-red-500"
                : "bg-black/40 text-white hover:bg-black/60"
            )}
            title={isFavorited ? "Remove from favorites" : "Save to favorites"}
          >
            <Heart className={cn("w-3.5 h-3.5", isFavorited && "fill-current")} />
          </span>
        </div>
      </div>
      {/* Info below the card */}
      <div className="px-3 py-3 text-center">
        {(() => {
          const sub = pick.subtitle?.trim() || "";
          const isForPattern = / for /i.test(sub);
          const isYear = /^\d{4}$/.test(sub);
          const isReEdition = /re-?edition$/i.test(sub);
          const brandLine = isForPattern ? sub : cleanBrandLine(pick.designer_name);
          const composed = (!isYear && !isForPattern && !isReEdition)
            ? composeTitle(pick.title, sub)
            : { title: pick.title, remainingSubtitle: undefined as string | undefined };
          const showSubtitleBelow = !!composed.remainingSubtitle && !isYear && !isForPattern && !isReEdition;
          return (
            <>
              <p className="font-body text-[10px] text-primary uppercase tracking-[0.12em] mb-0.5">
                {brandLine}
              </p>
              <p className="font-display text-sm tracking-wide leading-tight">
                {composed.title}{isYear ? ` (${sub})` : ''}
              </p>
              {showSubtitleBelow && (
                <p className="font-body text-[11px] text-muted-foreground mt-0.5">{composed.remainingSubtitle}</p>
              )}
            </>
          );
        })()}
        <p className="font-display text-sm mt-1 text-foreground/70">
          Price on request
        </p>
      </div>
    </button>
  );
};

// ─── Main Directory Component ────────────────────────────────────────────────
interface DesignersDirectoryProps {
  initialLetter?: string;
  initialExpand?: string;
  showHeader?: boolean;
  showTradeCTA?: boolean;
  /**
   * "designers" → filters narrow the alphabetical designer cards (no product grid).
   * "products"  → filters switch the view to a product grid (PickCard).
   * Defaults to "designers" so the standalone /designers page never shows products.
   */
  mode?: "designers" | "products";
}

const DesignersDirectory: React.FC<DesignersDirectoryProps> = ({
  initialLetter,
  initialExpand,
  showHeader = true,
  showTradeCTA = true,
  mode = "designers",
}) => {
  const location = useLocation();
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const { data: allDesigners = [], isLoading } = useAllDesigners();
  const { data: curatorPicksData = [] } = useDesignerCategories();
  const { data: fallbackGalleryIndexByDesigner = {} } = useDesignerHotspotFallbacks();
  const { data: designersWithIgPosts = new Set<string>() } = useQuery({
    queryKey: ["designers-with-ig-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designer_instagram_posts")
        .select("designer_id")
        .eq("hidden", false);
      if (!data) return new Set<string>();
      return new Set(data.map((r: any) => r.designer_id as string));
    },
    staleTime: 1000 * 60 * 10,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [forcedLetters, setForcedLetters] = useState<Set<string>>(new Set());
  const letterBarRef = useRef<HTMLDivElement>(null);

  // Category/subcategory filter state — initialize from URL params if present
  const [selectedCategory, setSelectedCategoryRaw] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("category") || null;
  });
  const [selectedSubcategory, setSelectedSubcategoryRaw] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("subcategory") || null;
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── Public favorites (localStorage-backed) with auth gate ───
  const { user } = useAuth();
  const { requireAuth, gateOpen, gateAction, closeGate } = useAuthGate();
  const [favIds, setFavIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("public_favorites");
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  const toggleFavorite = useCallback((id: string) => {
    requireAuth(() => {
      setFavIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        localStorage.setItem("public_favorites", JSON.stringify([...next]));
        window.dispatchEvent(new Event("public_favorites_changed"));
        return next;
      });
    }, "save pieces to your favorites");
  }, [requireAuth]);

  const { data: fullPicks = [] } = useFullCuratorPicks(mode === "products" && !!(selectedCategory || selectedSubcategory));

  // In "products" mode, when a filter is active we switch to a product grid view.
  // In "designers" mode (default, used on /designers), filteredPicks is always
  // null — the alphabetical designer cards remain and are narrowed via filteredItems.
  const filteredPicks = useMemo<PickItem[] | null>(() => {
    if (mode !== "products") return null;
    if (!selectedCategory && !selectedSubcategory) return null;
    
    const normSub = selectedSubcategory ? normalizeSubcategory(selectedSubcategory) : null;
    const normCat = selectedCategory ? normalizeCategory(selectedCategory) : null;
    return fullPicks.filter((p) => {
      if (selectedSubcategory) {
        const pickSub = normalizeSubcategory(p.subcategory || undefined) || normalizeSubcategory(p.category || undefined);
        if (pickSub === normSub) return true;
        return !!(p.tags && p.tags.some((t: string) => normalizeSubcategory(t) === normSub));
      }
      const pickCat = normalizeCategory(p.category || undefined, p.subcategory || undefined);
      if (pickCat === normCat) return true;
      return !!(p.tags && p.tags.some((t: string) => normalizeCategory(t) === normCat));
    });
  }, [selectedCategory, selectedSubcategory, fullPicks]);

  // (Product pages handle detail view — no lightbox needed here)

  const broadcastFilter = useCallback((cat: string | null, sub: string | null) => {
    window.dispatchEvent(new CustomEvent('syncCategoryFilter', { detail: { category: cat, subcategory: sub, source: 'designers' } }));
  }, []);

  const syncUrlParams = useCallback((cat: string | null, sub: string | null) => {
    // In "designers" mode, never rewrite the URL — keep the user on /designers
    // so the Designers nav item stays highlighted.
    if (mode === "designers") return;
    // If a category is selected, push the slug URL. Otherwise return to homepage.
    const target = cat ? categoryUrl(cat, sub) : "/";
    const current = window.location.pathname + window.location.search;
    if (current !== target) {
      window.history.pushState({}, "", target);
    }
  }, [mode]);

  const setSelectedCategory = useCallback((cat: string | null, skipBroadcast?: boolean) => {
    setSelectedCategoryRaw(cat);
    setSelectedSubcategoryRaw(null);
    if (!skipBroadcast) broadcastFilter(cat, null);
    syncUrlParams(cat, null);
  }, [broadcastFilter, syncUrlParams]);

  const setSelectedSubcategory = useCallback((sub: string | null) => {
    setSelectedSubcategoryRaw(sub);
    broadcastFilter(selectedCategory, sub);
    syncUrlParams(selectedCategory, sub);
  }, [selectedCategory, broadcastFilter, syncUrlParams]);

  // React to URL param changes (initial mount)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get("category");
    const sub = params.get("subcategory");
    if (cat || sub) {
      setSelectedCategoryRaw(cat || null);
      setSelectedSubcategoryRaw(sub || null);
      setSidebarOpen(false);
      broadcastFilter(cat || null, sub || null);
    }
  }, [location.search, broadcastFilter]);

  // Listen for external filter sync
  useEffect(() => {
    // Hydrate on mount from URL/global pending filter.
    const pending = readPendingCategoryFilter();
    if (pending && (pending.category || pending.subcategory)) {
      setSelectedCategoryRaw(pending.category);
      setSelectedSubcategoryRaw(pending.subcategory);
      setSidebarOpen(false);
    }

    const handleSync = (e: CustomEvent) => {
      const { category, subcategory, source } = e.detail || {};
      if (source === 'designers') return;
      setSelectedCategoryRaw(category || null);
      setSelectedSubcategoryRaw(subcategory || null);
    };
    const handleDesignerCategory = (e: CustomEvent) => {
      const { category, subcategory } = e.detail || {};
      setSelectedCategoryRaw(category || null);
      setSelectedSubcategoryRaw(subcategory || null);
      requestAnimationFrame(() => setSidebarOpen(false));
      broadcastFilter(category || null, subcategory || null);
    };
    window.addEventListener('syncCategoryFilter', handleSync as EventListener);
    window.addEventListener('setDesignerCategory', handleDesignerCategory as EventListener);
    return () => {
      window.removeEventListener('syncCategoryFilter', handleSync as EventListener);
      window.removeEventListener('setDesignerCategory', handleDesignerCategory as EventListener);
    };
  }, [broadcastFilter]);

  // Build designer→category mapping from curator picks
  const designerIdsByCategory = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    const subMap: Record<string, Set<string>> = {};

    for (const pick of curatorPicksData) {
      const did = pick.designer_id;
      const cat = pick.category;
      if (cat) {
        if (!map[cat]) map[cat] = new Set();
        map[cat].add(did);
      }
      // Match subcategory by tags, category, or subcategory field
      const tags = (pick.tags as string[]) || [];
      const pickSub = (pick.subcategory as string) || "";
      for (const [subName, matchTags] of Object.entries(SUBCATEGORY_TO_TAGS)) {
        const matches = tags.some(t => matchTags.some(mt => t.toLowerCase() === mt.toLowerCase())) ||
          matchTags.some(mt => cat?.toLowerCase() === mt.toLowerCase()) ||
          pickSub.toLowerCase() === subName.toLowerCase() ||
          matchTags.some(mt => pickSub.toLowerCase() === mt.toLowerCase());
        if (matches) {
          if (!subMap[subName]) subMap[subName] = new Set();
          subMap[subName].add(did);
        }
      }
    }
    return { byCategory: map, bySubcategory: subMap };
  }, [curatorPicksData]);

  // Subcategory item counts
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [sub, ids] of Object.entries(designerIdsByCategory.bySubcategory)) {
      counts[sub] = ids.size;
    }
    return counts;
  }, [designerIdsByCategory]);

  const categories = useMemo(() => {
    const ordered = CATEGORY_ORDER.filter(cat => SUBCATEGORY_MAP[cat]);
    const extra = Object.keys(SUBCATEGORY_MAP).filter(cat => !CATEGORY_ORDER.includes(cat));
    return [...ordered, ...extra];
  }, []);

  // Jump to letter
  useEffect(() => {
    const letter = initialLetter?.toUpperCase();
    if (letter && LETTERS.includes(letter)) {
      setForcedLetters(new Set([letter]));
      requestAnimationFrame(() => {
        scrollToSection(getDesignersDirectoryAnchorId(letter));
      });
    }
  }, [initialLetter]);

  const items = useMemo(
    () => allDesigners.filter((d) => d.is_published).sort((a, b) => a.name.localeCompare(b.name)),
    [allDesigners]
  );

  const parentNames = useMemo(() => new Set(items.map((d) => d.name)), [items]);

  // Apply text search
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return items.filter((d) => {
      const name = d.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const specialty = (d.specialty || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const founder = (d.founder || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const displayName = (d.display_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return name.includes(q) || displayName.includes(q) || specialty.includes(q) || founder.includes(q);
    });
  }, [items, searchQuery]);

  // Include child designers in the A-Z list so they're findable by their own
  // initial. They still appear nested under their parent atelier's expandable
  // card; the child card here shows the atelier as its parentLabel for context.
  const topLevelItems = useMemo(() => searchFiltered, [searchFiltered]);

  // Apply category/subcategory filter
  const filteredItems = useMemo(() => {
    if (!selectedCategory && !selectedSubcategory) return topLevelItems;

    // Get designer IDs that match
    let matchingIds: Set<string> | null = null;

    if (selectedSubcategory) {
      matchingIds = designerIdsByCategory.bySubcategory[selectedSubcategory] || new Set();
    } else if (selectedCategory) {
      matchingIds = designerIdsByCategory.byCategory[selectedCategory] || new Set();
    }

    if (!matchingIds) return topLevelItems;

    return topLevelItems.filter((d) => matchingIds!.has(d.id));
  }, [topLevelItems, selectedCategory, selectedSubcategory, designerIdsByCategory]);

  const alphaGroups = useMemo(() => {
    const groups: Record<string, Designer[]> = {};
    filteredItems.forEach((d) => {
      const { displayName } = parseDesignerDisplayName(d);
      const firstChar = (displayName || d.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0];
      const letter = firstChar?.toUpperCase() || "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(d);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  const activeLetters = useMemo(() => new Set(alphaGroups.map(([l]) => l)), [alphaGroups]);

  const parentDesignerCountByName = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of items) {
      const founder = d.founder;
      if (!founder || founder === d.name) continue;
      counts[founder] = (counts[founder] || 0) + 1;
    }
    return counts;
  }, [items]);

  // Ref to cancel in-flight jump animations when a new letter is tapped
  const jumpSessionRef = useRef(0);


  const jumpToLetter = useCallback((letter: string) => {
    if (!activeLetters.has(letter)) return;
    setForcedLetters((prev) => new Set(prev).add(letter));


    // Increment session so any in-flight settle loop from a previous tap aborts
    const session = ++jumpSessionRef.current;

    const getY = () => {
      const el = getDesignersDirectoryAnchor(letter);
      if (!el) return null;
      const nav = document.querySelector("nav");
      const navHeight = nav?.getBoundingClientRect().height ?? 96;
      return Math.max(0, el.getBoundingClientRect().top + window.scrollY - navHeight - 8);
    };

    // Use window.scrollTo(x, y) for maximum mobile Safari compatibility
    // (behavior: "instant" is not supported on older iOS versions)
    const jumpTo = (y: number) => window.scrollTo(0, y);

    // Instant-jump to force content-visibility sections to render,
    // then settle with correction passes.
    const firstY = getY();
    if (firstY === null) return;
    jumpTo(firstY);

    let passes = 0;
    let prevY = firstY;
    const settle = () => {
      // Abort if a newer tap has started
      if (jumpSessionRef.current !== session) return;
      const nextY = getY();
      if (nextY === null) return;
      const delta = Math.abs(nextY - prevY);
      prevY = nextY;
      if (delta > 2 && passes < 12) {
        jumpTo(nextY);
        passes++;
        setTimeout(() => requestAnimationFrame(settle), 80);
      } else {
        // Final position
        if (jumpSessionRef.current === session) {
          jumpTo(nextY);
        }
      }
    };
    // Give AnimatePresence time to render on mobile before settling
    setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(settle)), 120);
  }, [activeLetters]);


  useEffect(() => {
    if (searchQuery.trim()) {
      setForcedLetters(new Set(alphaGroups.map(([l]) => l)));
    }
  }, [searchQuery, alphaGroups]);

  const totalCount = filteredItems.length;

  return (
    <>
    <div ref={sectionRef} className="relative py-6 px-4 md:py-24 md:px-12 lg:px-20 bg-background scroll-mt-16">
      {/* Gradient accent band */}
      <div className="absolute top-0 left-0 right-0 h-1 md:h-1.5 bg-gradient-to-r from-jade via-jade-light to-accent opacity-80" />

      <div className="mx-auto max-w-6xl">
        {/* Section Header — default OR category-specific hero when a filter is active */}
        {showHeader && (() => {
          const filterActive = !!(selectedCategory || selectedSubcategory);
          const hero = filterActive ? getCategoryHero(selectedCategory, selectedSubcategory) : null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8 }}
              className="mb-12 md:mb-16 text-left"
            >
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-center">
                <div className="hidden md:block w-[320px] flex-shrink-0 aspect-[4/3] bg-muted/20 rounded-lg overflow-hidden">
                  <img
                    src={hero ? hero.image : "https://res.cloudinary.com/dif1oamtj/image/upload/w_640,q_auto,f_auto,c_fill/v1774537853/02travel-look-samuel-tmagArticle_ocja5c.jpg"}
                    alt={hero ? hero.title : "Designers & Makers"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-end gap-3 md:gap-4 mb-2">
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif text-foreground">
                      {hero ? hero.title : "Designers & Makers"}
                    </h2>
                  </div>
                  <p className="text-sm md:text-base text-muted-foreground font-body max-w-3xl leading-relaxed mb-4 text-justify">
                    {hero
                      ? hero.summary
                      : "Discover the visionary designers whose exceptional work currently defines Maison Affluency Singapore. Each brings their unique perspective and masterful craftsmanship to create pieces that transcend ordinary furniture."}
                  </p>
                  <button
                    onClick={() => {
                      const shareUrl = withOgCacheBust("https://www.maisonaffluency.com/designers-og.html");
                      const text = `${hero ? hero.title : "Designers & Makers On View"} — Maison Affluency\n${shareUrl}`;
                      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
                      window.open(wa, "_blank", "noopener");
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-body text-foreground hover:text-primary transition-colors"
                    aria-label="Share section"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}

        <div className="relative">
          {/* Mobile: Search + Filter row */}
          <div className="flex flex-col gap-4 mb-5 md:mb-6 md:hidden">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="order-first">
                <Popover open={filterOpen} onOpenChange={(open) => {
                  setFilterOpen(open);
                  if (!open && selectedCategory) broadcastFilter(selectedCategory, selectedSubcategory);
                }}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 h-8 rounded-full border border-[hsl(var(--gold))] bg-background shadow-sm hover:shadow-md text-foreground transition-all duration-300 relative" aria-label="Filter">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-body uppercase tracking-[0.15em] font-semibold">Filter</span>
                      {selectedCategory && (
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] w-4 h-4 flex items-center justify-center rounded-full">1</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[260px] p-4 max-h-[400px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-serif text-sm text-foreground flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5" /> Filter</h4>
                      <div className="flex items-center gap-2">
                        {selectedCategory && (
                          <button onClick={() => setSelectedCategory(null)} className="px-3 py-1 rounded-full border border-[hsl(var(--gold))] bg-white text-xs font-body font-medium text-foreground shadow-sm hover:shadow-md transition-all duration-200">Clear</button>
                        )}
                        <button onClick={() => setFilterOpen(false)} className="p-1.5 rounded-full bg-muted hover:bg-muted-foreground/20 text-foreground transition-colors" aria-label="Close filter">
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
                                if (selectedCategory === category) setSelectedCategory(null, true);
                                else setSelectedCategory(category, true);
                              }}
                            />
                            <span className="text-sm text-foreground font-body">{category}</span>
                          </label>
                          {selectedCategory === category && SUBCATEGORY_MAP[category]?.length > 0 && (
                            <div className="ml-8 mt-1 mb-2 space-y-1 border-l border-border/40 pl-3">
                              <button
                                onClick={() => setSelectedSubcategory(null)}
                                className={`block text-[11px] tracking-[0.15em] font-body transition-all duration-300 py-1 ${!selectedSubcategory ? 'text-primary' : 'text-foreground/60 hover:text-primary'}`}
                              >
                                All {category}
                              </button>
                              {SUBCATEGORY_MAP[category].map(sub => (
                                <button
                                  key={sub}
                                  onClick={() => { setSelectedSubcategory(selectedSubcategory === sub ? null : sub); setFilterOpen(false); }}
                                  className={`block text-[10px] tracking-[0.15em] font-body transition-all duration-300 py-1 ${selectedSubcategory === sub ? 'text-[hsl(var(--accent))] font-semibold' : 'text-foreground/60 hover:text-primary'}`}
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
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Designer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 h-8 text-[16px] bg-background border-[hsl(var(--gold))] shadow-sm rounded-full focus:border-primary/60 focus:shadow-md font-body"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results count */}
          {(searchQuery || selectedCategory) && (
            <p className="text-left text-[10px] text-muted-foreground/50 mb-4 font-body tracking-wider">
              {filteredPicks
                ? `${filteredPicks.length} piece${filteredPicks.length !== 1 ? 's' : ''} found`
                : `${totalCount} designer${totalCount !== 1 ? 's' : ''} found`}
              {selectedCategory && !selectedSubcategory && <span> · {selectedCategory}</span>}
              {selectedSubcategory && <span> · {selectedSubcategory}</span>}
            </p>
          )}

          {/* Desktop: A-Z jump bar — hidden when a category/subcategory filter is active */}
          {!(selectedCategory || selectedSubcategory) && (
            <div className="hidden md:block mb-6">
              <div className="h-px bg-border/60 mb-5" />
              <div
                ref={letterBarRef}
                className="flex items-center justify-between"
              >
                {LETTERS.map((letter) => {
                  const isActive = activeLetters.has(letter);
                  return (
                    <button
                      key={letter}
                      onClick={() => jumpToLetter(letter)}
                      className={`font-serif text-lg lg:text-xl leading-none transition-all duration-200 ${isActive ? "text-foreground hover:text-primary cursor-pointer" : "text-foreground/20 cursor-default"}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
              <div className="h-px bg-border/60 mt-5" />
            </div>
          )}

          {/* Desktop: Filter + Search row */}
          <div className="hidden md:flex items-center gap-3 mb-6">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-1.5 px-3 h-10 rounded border border-foreground text-foreground transition-colors relative"
              aria-label="Filter"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-[11px] font-body uppercase tracking-[0.15em] font-semibold">Filter</span>
              {selectedCategory && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[9px] w-4 h-4 flex items-center justify-center rounded-full">1</span>
              )}
            </button>
            <div className="flex-1" />
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-10 text-sm bg-background border-border shadow-sm focus:border-primary/60 focus:shadow-md font-body uppercase tracking-[0.12em]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Desktop: Sidebar + Directory layout */}
          <div className="hidden md:flex gap-6" data-directory-layout="desktop">
            <CategorySidebar
              activeCategory={selectedCategory}
              activeSubcategory={selectedSubcategory}
              onSelect={(cat, sub) => {
                setSelectedCategoryRaw(cat);
                setSelectedSubcategoryRaw(sub);
                broadcastFilter(cat, sub);
              }}
              itemCounts={itemCounts}
              sectionLabel="all Designers"
              onOpenChange={setSidebarOpen}
              isOpen={sidebarOpen}
            />
            <div className="flex-1 min-w-0">
              {isLoading && (
                <div className="flex items-center justify-center py-32">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
              {!isLoading && filteredPicks ? (
                filteredPicks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 text-center">
                    <p className="font-body text-sm text-muted-foreground">No pieces match this filter.</p>
                  </div>
                ) : (
                  <div className={`grid gap-4 md:gap-6 grid-cols-2 ${sidebarOpen ? 'md:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
                    {filteredPicks.map((pick) => (
                      <PickCard key={pick.id} pick={pick} onFavorite={toggleFavorite} isFavorited={favIds.has(pick.id)} />
                    ))}
                  </div>
                )
              ) : (
                <>
                  {!isLoading && filteredItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                      <p className="font-body text-sm text-muted-foreground">
                        {searchQuery ? "No designers match your search." : "Content coming soon — we're curating this collection."}
                      </p>
                    </div>
                  )}
                  {!isLoading && alphaGroups.length > 0 && (
                    <div>
                      {alphaGroups.map(([letter, designers]) => (
                        <LetterGroup
                          key={letter}
                          letter={letter}
                          anchorId={getDesignersDirectoryAnchorId(letter, "desktop")}
                          designers={designers}
                          forceOpen={forcedLetters.has(letter)}
                          parentDesignerCountByName={parentDesignerCountByName}
                          fallbackGalleryIndexByDesigner={fallbackGalleryIndexByDesigner}
                          initialExpand={initialExpand}
                          designersWithIgPosts={designersWithIgPosts}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Mobile: Directory */}
          <div className="md:hidden" data-directory-layout="mobile">
            {/* Mobile A-Z jump bar removed per design — letter section headers (A, B, C…) remain in the list below. */}
            {isLoading && (
              <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {!isLoading && filteredPicks ? (
              filteredPicks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <p className="font-body text-sm text-muted-foreground">No pieces match this filter.</p>
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-2">
                  {filteredPicks.map((pick) => (
                    <PickCard key={pick.id} pick={pick} onFavorite={toggleFavorite} isFavorited={favIds.has(pick.id)} />
                  ))}
                </div>
              )
            ) : (
              <>
                {!isLoading && filteredItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-32 text-center">
                    <p className="font-body text-sm text-muted-foreground">{searchQuery ? "No designers match your search." : "Content coming soon."}</p>
                  </div>
                )}
                {!isLoading && alphaGroups.length > 0 && (
                  <div>
                    {alphaGroups.map(([letter, designers]) => (
                      <LetterGroup
                        key={letter}
                        letter={letter}
                        anchorId={getDesignersDirectoryAnchorId(letter, "mobile")}
                        designers={designers}
                        forceOpen={forcedLetters.has(letter)}
                        parentDesignerCountByName={parentDesignerCountByName}
                        fallbackGalleryIndexByDesigner={fallbackGalleryIndexByDesigner}
                        initialExpand={initialExpand}
                        designersWithIgPosts={designersWithIgPosts}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {showTradeCTA && (
          <div className="mt-16 text-center">
            <Link to="/trade" className="inline-flex items-center gap-2 px-8 py-3 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-md hover:opacity-90 transition-opacity">
              Join Our Trade Program
            </Link>
          </div>
        )}
      </div>
    </div>
      <AuthGateDialog open={gateOpen} onClose={closeGate} action={gateAction} />
    </>
  );
};

export default DesignersDirectory;
