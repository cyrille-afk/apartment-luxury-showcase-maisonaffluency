import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, GalleryHorizontal, Images, Play, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import EditorialGalleryLandingHint from "@/components/product/EditorialGalleryLandingHint";
import PublicProductLightbox, { type PublicLightboxItem } from "@/components/PublicProductLightbox";
import { fetchCatalogManifest } from "@/lib/catalogManifest";
import { queryKeys } from "@/lib/queryKeys";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { resolveCuratorPickDescription } from "@/lib/curatorPickDescription";
import { APARTMENT_TOUR_VIDEO_URL } from "@/lib/apartmentTourVideo";
import { attachMilestoneTracking, trackVideoEvent } from "@/lib/videoTracking";
import { fetchPublicMicMacPins, mergeGalleryPins } from "@/lib/publicGalleryHotspots";
import { curatingTeam } from "@/components/CuratingTeam";
import { getParentCategoryFromSubcategory as parentOfSub } from "@/lib/categoryNormalization";
import type { RoomSlug } from "@/lib/roomCategories";

type Scene = { title: string; id: string };
type Space = { key: string; label: string; scenes: Scene[] };
const roomSpace = (room: RoomSlug) => room === "dining-room" ? 1 : room === "bedroom" ? 3 : room === "office" ? 5 : room === "bath" ? 6 : 0;
type GalleryState = { kind: "room"; spaceIndex: number } | { kind: "tour" } | { kind: "curators" };
type GalleryPage = { scenes: Scene[]; title: string };

/** Scene titles match gallery_hotspots.image_identifier exactly. */
const SPACES: Space[] = [
  { key: "living-room", label: "Living Room", scenes: [
    { title: "A Sophisticated Living Room", id: "living-room-hero_zxfcxl" },
    { title: "An Inviting Lounge Area", id: "bespoke-sofa_gxidtx" },
    { title: "Panoramic Cityscape Views", id: "dining-room_ey0bu5" },
    { title: "A Sun Lit Reading Corner", id: "IMG_2402-resized_swt5iy" },
  ] },
  { key: "dining-room", label: "Dining Room", scenes: [
    { title: "A Dreamy Tuscan Landscape", id: "intimate-dining_ux4pee" },
    { title: "A Highly Customised Dining Room", id: "intimate-table-detail_aqxvvm" },
    { title: "A Relaxed Setting", id: "intimate-lounge_tf4sm1" },
    { title: "A Colourful Nook", id: "IMG_2133_wtxd62" },
  ] },
  { key: "boudoir", label: "Boudoir", scenes: [
    { title: "A Sophisticated Boudoir", id: "boudoir_ll5spn" },
    { title: "A Jewelry Box Like Setting", id: "70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq" },
    { title: "A Serene Decor", id: "bedroom-second_cyfmdj" },
    { title: "A Design Treasure Trove", id: "art-master-bronze_hf6bad" },
  ] },
  { key: "master-suite", label: "Master Suite", scenes: [
    { title: "A Masterful Suite", id: "master-suite_y6jaix" },
    { title: "Design Tableau", id: "bedroom-third_ol56sx" },
    { title: "A Venitian Cocoon", id: "calming-2" },
    { title: "Unique By Design Vignette", id: "bedroom-alt_yk0j0d" },
  ] },
  { key: "guest-bedroom", label: "Guest Bedroom", scenes: [
    { title: "An Artistic Statement", id: "AffluencySG_094-Bloom_35_color_gimp_correction_okyphd" },
    { title: "Compact Elegance", id: "small-room-personality_wvxz6y" },
    { title: "Yellow Crystalline", id: "small-room-vase_s3nz5o" },
    { title: "Golden Hour", id: "small-room-chair_aobzyb" },
  ] },
  { key: "office", label: "Office", scenes: [
    { title: "A Workspace of Distinction", id: "home-office-desk_g0ywv2" },
    { title: "Refined Details", id: "home-office-desk-2_gb1nlb" },
    { title: "Light & Focus", id: "home-office-3_t39msw" },
    { title: "Design & Fine Art Books Corner", id: "AffluencySG_143_1_f9iihg" },
  ] },
  { key: "accessories", label: "Accessories", scenes: [
    { title: "Curated Vignette", id: "IMG_2397-resized_rufbef" },
    { title: "The Details Make The Design", id: "WhatsApp_Image_2026-03-30_at_7.35.18_PM_nkvc8c" },
    { title: "Light & Texture", id: "details-lamp_clzcrk" },
    { title: "Craftsmanship At Every Corner", id: "AffluencySG_204_1_qbbpqb" },
  ] },
];

const large = (id: string) => cloudinaryUrl(id, { width: 1920, quality: "auto:good" });
const thumb = (id: string) => cloudinaryUrl(id, { width: 320, height: 220, crop: "fill", gravity: "auto", quality: "auto" });
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const createGalleryPages = (space: Space): GalleryPage[] =>
  space.scenes.map((scene) => ({ scenes: [scene], title: scene.title }));

// Keep the explicitly selected blue Toshiro finish when its Boudoir hotspot is shown.
const FEATURED_HOTSPOT_PICK_IDS: Record<string, string> = {
  "An Inviting Lounge Area:Lounge Chair in UKIYO MONOGATARI 003": "0302a3b6-1ebf-4c57-8886-935bc48f9dfd",
  "A Dreamy Tuscan Landscape:Astra Dining Table": "3b6f6177-adfa-4f23-8cf7-75396028fe95",
  "A Dreamy Tuscan Landscape:Murano Cloud Bulle Pendants": "4b46af75-4c35-4a81-bea6-822810ae3422",
  "A Sophisticated Boudoir:Toshiro Lamp": "4fd12666-beb7-4be6-97fb-7678b48ac4a7",
  "A Sophisticated Boudoir:Lyric Desk": "ca386961-7986-43cf-aa8c-853249a177a5",
  "A Sophisticated Boudoir:Gold Leaves+Glass Snake Vessel (Unique Piece)": "cd18f654-d48f-4b86-80a0-62e10255b581",
  "A Masterful Suite:Villa Pedestal": "1419dd7f-b404-44d2-ae68-ca46890920ea",
  "A Masterful Suite:Brunelleschi Perspective Wallcover": "6f32db0d-3d34-4035-9bf4-b42cb33940e9",
  "A Masterful Suite:Bud Table Lamp": "da524883-8938-441a-b902-f12deb378ca7",
};
// The Dining Room chair uses its first curator photo, not the older cropped hotspot image.
const DINING_CHAIR_FIRST_PHOTO = "https://res.cloudinary.com/dif1oamtj/image/upload/v1790428122/Screen_Shot_2026-09-26_at_9.07.39_PM_wzo5mz.png";
// Use the requested sofa photograph only for the Living Room's second and third side picks.
const LIVING_ROOM_NIKO_PHOTO = "https://res.cloudinary.com/dif1oamtj/image/upload/v1779900275/Niko-9_ynis9l.jpg";
// The Boudoir's chandelier side pick was explicitly replaced by the Toshiro lamp.
const EXCLUDED_SIDE_PICK_HOTSPOTS = new Set([
  "An Inviting Lounge Area:Lounge Chair in UKIYO MONOGATARI 003",
  "A Sophisticated Boudoir:Custom Saint-Just Glass Chandelier",
]);
// Honor the previously curated placements on the first photo of these rooms.
const SIDE_PICK_OVERRIDES: Record<string, "left" | "right"> = {
  "A Dreamy Tuscan Landscape:Astra Dining Table": "left",
  "A Dreamy Tuscan Landscape:PéPé S Icewood x FJ Hakimian": "left",
  "A Dreamy Tuscan Landscape:Crystalline Vase Volume 3": "right",
  "A Dreamy Tuscan Landscape:Murano Cloud Bulle Pendants": "right",
  "A Highly Customised Dining Room:Crystalline Vase Volume 3": "right",
  "A Sophisticated Boudoir:Lyric Desk": "left",
  "A Sophisticated Boudoir:PéPé S Icewood x FJ Hakimian": "left",
  "A Sophisticated Boudoir:Toshiro Lamp": "right",
  "A Sophisticated Boudoir:Gold Leaves+Glass Snake Vessel (Unique Piece)": "right",
  "A Masterful Suite:Bronze MicMac Chandelier": "left",
  "A Masterful Suite:Bud Table Lamp": "left",
  "A Masterful Suite:Villa Pedestal": "left",
  "A Masterful Suite:Brunelleschi Perspective Wallcover": "right",
  "A Masterful Suite:Crystalline Blue Vessel Volume 5": "right",
  "A Masterful Suite:Giudecca Rug (Custom)": "right",
  "A Venitian Cocoon:Bronze MicMac Chandelier": "left",
  "An Artistic Statement:Martell Wall Lamp": "right",
  "An Artistic Statement:Lantern Table Lamp": "right",
  "An Artistic Statement:Eggshell DOT Side Table": "right",
  "A Workspace of Distinction:Bernt Petersen 4-Drawer Desk": "left",
  "Refined Details:Bernt Petersen 4-Drawer Desk": "left",
  "A Sun Lit Reading Corner:Japanese Cranes Wallcover": "left",
  "A Sun Lit Reading Corner:Blue Glazed Vallauris Floor Lamp": "left",
  "A Sun Lit Reading Corner:AB Chair": "left",
  "A Sun Lit Reading Corner:Monster Gold-Tone Incense Burner": "right",
  "The Details Make The Design:Unknow N.83 Cotissi Vessel": "right",
  "The Details Make The Design:Corteza Console Table": "right",
  "Craftsmanship At Every Corner:Sira Credenza (Shagreen Panels)": "right",
};
const CURATED_SIDE_PICK_ORDER = [
  "A Dreamy Tuscan Landscape:Astra Dining Table",
  "A Dreamy Tuscan Landscape:PéPé S Icewood x FJ Hakimian",
  "A Sophisticated Boudoir:Lyric Desk",
  "A Sophisticated Boudoir:PéPé S Icewood x FJ Hakimian",
  "A Masterful Suite:Bronze MicMac Chandelier",
  "A Masterful Suite:Bud Table Lamp",
  "A Masterful Suite:Villa Pedestal",
  "A Masterful Suite:Brunelleschi Perspective Wallcover",
  "A Masterful Suite:Crystalline Blue Vessel Volume 5",
  "A Masterful Suite:Giudecca Rug (Custom)",
  "A Sun Lit Reading Corner:Japanese Cranes Wallcover",
  "A Sun Lit Reading Corner:Blue Glazed Vallauris Floor Lamp",
  "A Sun Lit Reading Corner:AB Chair",
  "An Artistic Statement:Martell Wall Lamp",
  "An Artistic Statement:Lantern Table Lamp",
  "An Artistic Statement:Eggshell DOT Side Table",
];

type Hotspot = {
  id: string;
  image_identifier: string;
  x_percent: number;
  y_percent: number;
  product_name: string;
  designer_name: string | null;
  product_image_url: string | null;
  materials: string | null;
  dimensions: string | null;
  link_url: string | null;
  mapped_pick_id: string | null;
  restricted_gallery_pin?: boolean;
};

type ScenePick = { hotspot: Hotspot; product: PublicLightboxItem; image: string };

function GalleryTour() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const playImmersively = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.volume = 1;

    if (video.requestFullscreen) {
      void video.requestFullscreen().catch(() => undefined);
    } else {
      const safariVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      safariVideo.webkitEnterFullscreen?.();
    }

    void video.play().catch(() => setIsPlaying(false));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = 1;
    video.muted = false;
    const resetToStart = () => {
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
      setHasStarted(false);
    };
    const onPlay = () => {
      setIsPlaying(true);
      setHasStarted(true);
      trackVideoEvent("play", "showroom-tour");
    };
    const onPause = () => {
      setIsPlaying(false);
      trackVideoEvent("pause", "showroom-tour");
    };
    const onFullscreenChange = () => {
      if (document.fullscreenElement !== video) resetToStart();
    };
    const onWebkitEndFullscreen = () => resetToStart();
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", resetToStart);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    video.addEventListener("webkitendfullscreen", onWebkitEndFullscreen);
    const detachMilestones = attachMilestoneTracking(video, "showroom-tour");
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", resetToStart);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      video.removeEventListener("webkitendfullscreen", onWebkitEndFullscreen);
      detachMilestones();
    };
  }, []);

  return (
    <motion.div key="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto max-w-[1500px] px-4 pb-12 pt-7 md:px-10 md:pb-16 md:pt-9">
      <div className="mx-auto mb-7 max-w-6xl text-center md:mb-9">
        <p className="font-body text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">Maison Affluency · Singapore</p>
        <p className="mx-auto mt-3 w-full text-center font-body text-[11px] leading-relaxed tracking-[0.08em] text-muted-foreground md:whitespace-nowrap">A private walkthrough of collectible design, bespoke interiors and artisan craftsmanship</p>
      </div>
      <div className="w-full bg-muted/30 p-3 md:p-8">
        <div className="relative mx-auto aspect-video w-full max-w-6xl overflow-hidden bg-foreground">
          <video
            ref={videoRef}
            controls={hasStarted}
            playsInline
            preload="none"
            poster={large("bespoke-sofa_gxidtx")}
            onClick={() => {
              if (videoRef.current?.paused) playImmersively();
            }}
            className="aspect-video w-full object-cover"
          >
            <source src={APARTMENT_TOUR_VIDEO_URL} type="video/mp4" />
          </video>
          {!hasStarted && (
            <img
              src={large("bespoke-sofa_gxidtx")}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 aspect-video h-full w-full object-cover"
            />
          )}
          {!isPlaying && (
            <Button
              type="button"
              variant="default"
              onClick={playImmersively}
              aria-label="Play gallery tour fullscreen with sound"
              className="absolute left-1/2 top-1/2 z-10 size-14 -translate-x-1/2 -translate-y-1/2 rounded-none border border-background/20 bg-foreground p-0 text-background shadow-none transition-colors duration-300 hover:border-background/40 hover:bg-foreground/90"
            >
              <Play className="size-5 fill-current" strokeWidth={0} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CuratorsCanvas() {
  return (
    <motion.div key="curators" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto min-h-[68vh] w-full max-w-[1280px] px-4 py-10 md:px-0 md:py-14">
      <div className="mx-auto grid w-full max-w-[1040px] gap-6 md:grid-cols-2 md:gap-8">
        {curatingTeam.map((member, index) => (
          <motion.article key={member.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="border border-border/60 bg-card p-5 md:p-7">
            <img src={member.image} alt={member.name} className="aspect-[4/5] w-full object-cover object-top" />
            <div className="border-t border-border/60 pt-6">
              <div className="flex items-center gap-3">
                <h3 className="font-display text-2xl font-light leading-none text-foreground md:text-3xl">{member.name}</h3>
                <span role="img" aria-label="French founder" className="text-base leading-none">🇫🇷</span>
              </div>
              <p className="mt-3 font-body text-[10px] font-light uppercase tracking-[0.2em] text-muted-foreground">{member.role}</p>
              <p className="mt-6 max-w-[46ch] font-body text-sm font-light leading-relaxed text-muted-foreground">{member.bio}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </motion.div>
  );
}

/** Editorial hotspot pin: fine-lined ring, quiet by default, label + pulse on hover (Shop by Room). */
function HotspotPin({ hotspot, editorial, onOpen }: { hotspot: Hotspot; editorial?: boolean; onOpen: () => void }) {
  if (!editorial) {
    return (
      <Button key={hotspot.id} type="button" variant="ghost" size="icon" aria-label={`View ${hotspot.product_name}`} onClick={onOpen} className="group absolute z-10 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full p-0 hover:bg-transparent md:size-9" style={{ left: `${hotspot.x_percent}%`, top: `${hotspot.y_percent}%` }}>
        <span className="relative block size-6 rounded-full border border-background/90 bg-foreground/65 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110">
          <span className="absolute left-1/2 top-1/2 h-px w-2.5 -translate-x-1/2 -translate-y-1/2 bg-background" />
          <span className="absolute left-1/2 top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-background" />
        </span>
      </Button>
    );
  }
  const flipLabel = hotspot.x_percent > 72;
  return (
    <Button key={hotspot.id} type="button" variant="ghost" aria-label={`View ${hotspot.product_name}`} onClick={onOpen} className="group absolute z-10 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full p-0 hover:bg-transparent focus-visible:bg-transparent md:size-9" style={{ left: `${hotspot.x_percent}%`, top: `${hotspot.y_percent}%` }}>
      <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 block size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background/70 bg-white/5 shadow-[0_1px_6px_rgba(0,0,0,0.18)] backdrop-blur-sm transition-all duration-300 ease-out group-hover:scale-110 group-hover:border-background/90 group-hover:animate-hotspot-pulse group-focus-visible:border-background/90 md:size-6">
        <span className="absolute left-1/2 top-1/2 h-px w-2.5 -translate-x-1/2 -translate-y-1/2 bg-background" />
        <span className="absolute left-1/2 top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-background" />
      </span>
      <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 z-20 hidden -translate-y-1/2 flex-col items-start whitespace-nowrap rounded-md border border-background/40 bg-background/95 px-4 py-2.5 opacity-0 shadow-[0_12px_32px_rgba(20,20,20,0.16)] backdrop-blur-sm transition-all duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 md:flex ${flipLabel ? "right-full mr-3 translate-x-1 group-hover:translate-x-0" : "left-full ml-3 -translate-x-1 group-hover:translate-x-0"}`}>
        <span className="font-display text-[13px] font-normal leading-snug text-foreground">
          {hotspot.product_name}
        </span>
        {hotspot.designer_name && (
          <span className="mt-0.5 font-body text-[9px] font-light uppercase tracking-[0.22em] text-muted-foreground">by {hotspot.designer_name}</span>
        )}
      </span>
    </Button>
  );
}

type InteractiveGalleryLookbookProps = {
  initialView?: "tour" | "living-room";
  /** Shop by Room reuses the gallery canvas but opts into category-based related pieces. */
  discoveryRoom?: RoomSlug;
};

export default function InteractiveGalleryLookbook({ initialView = "tour", discoveryRoom }: InteractiveGalleryLookbookProps) {
  const [galleryState, setGalleryState] = useState<GalleryState>(discoveryRoom ? { kind: "room", spaceIndex: roomSpace(discoveryRoom) } : initialView === "living-room" ? { kind: "room", spaceIndex: 0 } : { kind: "tour" });
  const [sceneIdx, setSceneIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [hotspotsReady, setHotspotsReady] = useState(false);
  const [loadedScenes, setLoadedScenes] = useState<Set<string>>(() => new Set());
  const [activePin, setActivePin] = useState<string | null>(null);
  const [lightboxProduct, setLightboxProduct] = useState<PublicLightboxItem | null>(null);
  const [expandedScene, setExpandedScene] = useState<Scene | null>(null);
  const [expandedLoadedScene, setExpandedLoadedScene] = useState<string | null>(null);
  const [portraitSceneIds, setPortraitSceneIds] = useState<Set<string>>(() => new Set());

  const roomSpaceIndex = galleryState.kind === "room" ? galleryState.spaceIndex : 0;
  const space = SPACES[roomSpaceIndex];
  const galleryPages = useMemo(() => createGalleryPages(space), [space]);
  const activePage = galleryPages[sceneIdx];

  useEffect(() => {
    if (!discoveryRoom) return;
    setGalleryState({ kind: "room", spaceIndex: roomSpace(discoveryRoom) });
    setSceneIdx(0);
    setLightboxProduct(null);
  }, [discoveryRoom]);

  useEffect(() => {
    void Promise.all([
      supabase.from("gallery_hotspots").select("id, image_identifier, x_percent, y_percent, product_name, designer_name, product_image_url, materials, dimensions, link_url, mapped_pick_id"),
      fetchPublicMicMacPins(),
    ]).then(([{ data }, special]) => {
      setHotspots(mergeGalleryPins((data as Hotspot[]) || [], special.map((pin): Hotspot => ({ ...pin, materials: pin.materials ?? null, dimensions: pin.dimensions ?? null, link_url: null, mapped_pick_id: null, restricted_gallery_pin: true }))));
      setHotspotsReady(true);
    });
  }, []);

  const markSceneLoaded = useCallback((id: string) => {
    setLoadedScenes((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const { data: manifest, isFetched: catalogReady } = useQuery({
    queryKey: queryKeys.curatorPicksLightbox(),
    queryFn: fetchCatalogManifest,
    staleTime: 5 * 60_000,
  });

  const allPicks = useMemo<PublicLightboxItem[]>(() => {
    const designerMap = new Map((manifest?.designers || []).map((designer: any) => [designer.id, designer]));
    const databasePicks = (manifest?.picks || []).map((pick: any) => {
      const designer = designerMap.get(pick.designer_id) as any;
      return {
        id: pick.id,
        title: pick.title,
        subtitle: pick.subtitle || null,
        image_url: pick.image_url,
        hover_image_url: pick.hover_image_url || null,
        brand_name: designer?.name || "Maison Affluency",
        designer_slug: designer?.slug || null,
        materials: pick.materials || null,
        materials_description: pick.materials_description || null,
        dimensions: pick.dimensions || null,
        lead_time: pick.lead_time || null,
        origin: pick.origin || null,
        description: resolveCuratorPickDescription({ description: pick.description }),
        category: pick.category || null,
        subcategory: pick.subcategory || null,
        pdf_url: pick.pdf_url || null,
        pdf_urls: pick.pdf_urls || null,
        size_variants: pick.size_variants || null,
        variant_placeholder: pick.variant_placeholder || null,
        base_axis_label: pick.base_axis_label || null,
        top_axis_label: pick.top_axis_label || null,
        gallery_images: pick.gallery_images || null,
        variant_image_map: pick.variant_image_map || null,
      } satisfies PublicLightboxItem;
    });
    const staticPicks: PublicLightboxItem[] = getAllTradeProducts().filter((pick) => pick.image_url).map((pick) => ({
      id: pick.id,
      title: pick.product_name,
      subtitle: pick.subtitle || null,
      image_url: pick.image_url || "",
      hover_image_url: pick.hover_image_url || null,
      brand_name: pick.brand_name,
      materials: pick.materials || null,
      dimensions: pick.dimensions || null,
      description: resolveCuratorPickDescription({ description: pick.description }),
      category: pick.category || null,
      subcategory: pick.subcategory || null,
      pdf_url: pick.pdf_url || null,
      pdf_urls: pick.pdf_urls || null,
      size_variants: (pick as any).size_variants || null,
    }));
    const merged = new Map<string, PublicLightboxItem>();
    staticPicks.forEach((pick) => merged.set(`${normalize(pick.brand_name)}:${normalize(pick.title)}`, pick));
    databasePicks.forEach((pick) => merged.set(`${normalize(pick.brand_name)}:${normalize(pick.title)}`, pick));
    return discoveryRoom ? databasePicks : [...merged.values()];
  }, [manifest, discoveryRoom]);

  const categoryDiscovery = useMemo(() => discoveryRoom ? {
    heading: (item: PublicLightboxItem) => {
      if ((parentOfSub(item.subcategory) || item.category) === "Seating") return "In Dialogue: Curated Seating";
      return discoveryRoom === "living-room" ? "In Dialogue: Alternative Centerpieces" : "In Dialogue: Alternative Curations";
    },
  } : undefined, [discoveryRoom]);

  const hotspotsForScene = useCallback(
    (scene: Scene) => hotspots.filter((hotspot) => normalize(hotspot.image_identifier) === normalize(scene.title)),
    [hotspots],
  );

  const resolveHotspotProduct = useCallback((hotspot: Hotspot): PublicLightboxItem | null => {
    if (hotspot.restricted_gallery_pin) return hotspot.product_image_url ? {
      id: `hotspot-${hotspot.id}`,
      title: hotspot.product_name,
      image_url: hotspot.product_image_url,
      brand_name: hotspot.designer_name || "Maison Affluency",
      dimensions: hotspot.dimensions ?? null,
      materials: hotspot.materials ?? null,
      description: hotspot.materials ?? null,
      is_catalog_item: false,
      restricted_gallery_pin: true,
    } : null;
    const preferredId = FEATURED_HOTSPOT_PICK_IDS[`${hotspot.image_identifier}:${hotspot.product_name}`];
    const preferred = preferredId ? allPicks.find((pick) => pick.id === preferredId) : null;
    const exact = hotspot.mapped_pick_id ? allPicks.find((pick) => pick.id === hotspot.mapped_pick_id) : null;
    const productName = normalize(hotspot.product_name);
    const designerName = normalize(hotspot.designer_name || "");
    const fuzzy = allPicks.find((pick) => {
      const title = normalize(pick.title);
      const brand = normalize(pick.brand_name);
      const nameMatches = title.includes(productName) || productName.includes(title);
      const designerMatches = !designerName || brand.includes(designerName) || designerName.includes(brand);
      return nameMatches && designerMatches;
    });
    const fallback: PublicLightboxItem | null = hotspot.product_image_url ? {
      id: `hotspot-${hotspot.id}`,
      title: hotspot.product_name,
      image_url: hotspot.product_image_url,
      brand_name: hotspot.designer_name || "Maison Affluency",
      materials: hotspot.materials,
      dimensions: hotspot.dimensions,
      is_catalog_item: false,
    } : null;
    return preferred || exact || fuzzy || fallback;
  }, [allPicks]);

  const openHotspot = useCallback((hotspot: Hotspot) => {
    setActivePin(hotspot.id);
    setLightboxProduct(resolveHotspotProduct(hotspot));
  }, [resolveHotspotProduct]);

  const step = useCallback((direction: number) => {
    if (galleryState.kind !== "room") return;
    setActivePin(null);
    setLightboxProduct(null);
    const nextIndex = sceneIdx + direction;
    if (nextIndex >= 0 && nextIndex < galleryPages.length) {
      setSceneIdx(nextIndex);
      return;
    }
    const nextSpaceIndex = (roomSpaceIndex + direction + SPACES.length) % SPACES.length;
    setGalleryState({ kind: "room", spaceIndex: nextSpaceIndex });
    setSceneIdx(direction > 0 ? 0 : SPACES[nextSpaceIndex].scenes.length - 1);
  }, [galleryState.kind, galleryPages.length, roomSpaceIndex, sceneIdx]);

  const stepExpanded = useCallback((direction: number) => {
    if (!expandedScene || galleryState.kind !== "room" || galleryPages.length === 0) return;
    const nextIndex = (sceneIdx + direction + galleryPages.length) % galleryPages.length;
    setSceneIdx(nextIndex);
    setExpandedScene(galleryPages[nextIndex].scenes[0] ?? null);
    setActivePin(null);
    setLightboxProduct(null);
  }, [expandedScene, galleryState.kind, galleryPages, sceneIdx]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (lightboxProduct) return;
      if (expandedScene) {
        if (event.key === "ArrowLeft") stepExpanded(-1);
        if (event.key === "ArrowRight") stepExpanded(1);
        return;
      }
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxProduct, expandedScene, step, stepExpanded]);

  const selectSpace = (spaceIndex: number) => {
    setExpandedScene(null);
    setGalleryState({ kind: "room", spaceIndex });
    setSceneIdx(0);
    setActivePin(null);
    setLightboxProduct(null);
  };
  const selectScene = (spaceIndex: number, sceneIndex: number) => {
    setExpandedScene(null);
    setGalleryState({ kind: "room", spaceIndex });
    setSceneIdx(sceneIndex);
    setActivePin(null);
    setLightboxProduct(null);
  };

  const ribbonItems = [
    { key: "tour", label: "Gallery Tour", onClick: () => setGalleryState({ kind: "tour" }), active: galleryState.kind === "tour" },
    { key: "curators", label: "The Curators", onClick: () => setGalleryState({ kind: "curators" }), active: galleryState.kind === "curators" },
    ...SPACES.map((item, index) => ({ key: item.key, label: item.label, onClick: () => selectSpace(index), active: galleryState.kind === "room" && roomSpaceIndex === index })),
  ];

  const activeTitle = galleryState.kind === "room"
    ? activePage.title
    : galleryState.kind === "tour"
      ? "Gallery Tour"
      : "The Curators";
  const activeCategory = galleryState.kind === "room"
    ? space.label
    : galleryState.kind === "tour"
      ? "Gallery Tour"
      : "The Curators";
  const activeScene = galleryState.kind === "room" ? activePage.scenes[0] : undefined;
  const activeSceneReady = !!activeScene && hotspotsReady && catalogReady && loadedScenes.has(activeScene.id);
  const activeSceneIsPortrait = activeScene ? portraitSceneIds.has(activeScene.id) : false;
  const scenePicks = activeScene && !(roomSpaceIndex === 0 && sceneIdx === 0) ? hotspotsForScene(activeScene)
    .filter((hotspot) => !EXCLUDED_SIDE_PICK_HOTSPOTS.has(`${hotspot.image_identifier}:${hotspot.product_name}`))
    .map((hotspot): ScenePick | null => {
      const product = resolveHotspotProduct(hotspot);
      const useScenePhoto = (hotspot.image_identifier === "A Dreamy Tuscan Landscape" && hotspot.product_name === "Astra Dining Table")
        || hotspot.product_name === "Eggshell DOT Side Table"
        || (hotspot.image_identifier === "A Masterful Suite" && hotspot.product_name === "Crystalline Blue Vessel Volume 5")
        || (hotspot.image_identifier === "Yellow Crystalline" && hotspot.product_name === "Yellow Crystalline Vessel Volume 5");
       const image = roomSpaceIndex === 0 && (sceneIdx === 1 || sceneIdx === 2) && /^Niko (340|420) Custom Sofa\b/.test(hotspot.product_name)
         ? LIVING_ROOM_NIKO_PHOTO
         : hotspot.image_identifier === "A Dreamy Tuscan Landscape" && hotspot.product_name === "PéPé S Icewood x FJ Hakimian"
         ? DINING_CHAIR_FIRST_PHOTO
        : useScenePhoto ? hotspot.product_image_url || product?.image_url : product?.id.startsWith("hotspot-") ? hotspot.product_image_url : product?.image_url || hotspot.product_image_url;
      return product && image ? { hotspot, product, image } : null;
    })
    .filter((pick): pick is ScenePick => pick !== null) : [];
  const sideForPick = ({ hotspot }: ScenePick) => SIDE_PICK_OVERRIDES[`${hotspot.image_identifier}:${hotspot.product_name}`] || (hotspot.x_percent < 50 ? "left" : "right");
  const sortSidePicks = (a: ScenePick, b: ScenePick) => {
    const position = ({ hotspot }: ScenePick) => CURATED_SIDE_PICK_ORDER.indexOf(`${hotspot.image_identifier}:${hotspot.product_name}`);
    const aOrder = position(a);
    const bOrder = position(b);
    if (aOrder !== -1 || bOrder !== -1) return (aOrder === -1 ? Infinity : aOrder) - (bOrder === -1 ? Infinity : bOrder);
    return a.hotspot.y_percent - b.hotspot.y_percent;
  };
  const featuredLeftPicks = scenePicks.filter((pick) => sideForPick(pick) === "left").sort(sortSidePicks);
  const featuredRightPicks = scenePicks.filter((pick) => sideForPick(pick) === "right").sort(sortSidePicks);
  const hasScenePicks = scenePicks.length > 0;

  const renderScenePick = ({ hotspot, product, image }: ScenePick) => (
    <Button key={hotspot.id} type="button" variant="ghost" onClick={() => openHotspot(hotspot)} aria-label={`View ${hotspot.product_name} details`} className="h-auto min-w-0 w-full flex-col items-start rounded-none p-0 text-left hover:bg-transparent">
      <div className="w-full bg-[hsl(var(--product-canvas))] p-3 lg:p-4">
        <img
          src={image}
          alt={hotspot.product_name}
          loading="lazy"
          onError={(event) => {
            if (hotspot.product_image_url && event.currentTarget.src !== hotspot.product_image_url) {
              event.currentTarget.src = hotspot.product_image_url;
            }
          }}
          className={`block aspect-square w-full ${hotspot.product_name === "Astra Dining Table" ? "object-cover" : "object-contain"}`}
        />
        <span className="mt-2 block w-full whitespace-normal break-words font-display text-xs font-light leading-tight text-foreground lg:text-sm">{product.id.startsWith("hotspot-") ? hotspot.product_name : product.title}</span>
        <span className="mt-1 block w-full whitespace-normal break-words font-body text-[9px] font-light uppercase leading-tight tracking-wider text-muted-foreground">{product.brand_name}</span>
      </div>
    </Button>
  );

  return (
    <section aria-label="Interactive Gallery" className={`bg-background text-foreground ${discoveryRoom ? "pb-12 md:pb-16" : "pb-16"}`}>
      <header className="flex min-h-20 items-center justify-center px-6 py-4 text-center md:min-h-14 md:py-2">
        <h2 className="font-body text-xs font-light uppercase tracking-[0.25em] text-foreground">
          {activeTitle}
        </h2>
      </header>

      {!discoveryRoom && <nav aria-label="Gallery timeline" className="mx-auto max-w-[1280px] border-y border-border/60 py-1 md:py-2">
        <div className="flex min-h-9 snap-x snap-mandatory items-center gap-7 overflow-x-auto scroll-smooth whitespace-nowrap px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center md:gap-9 md:px-6">
          {ribbonItems.map((item) => (
            <Button key={item.key} type="button" variant="ghost" onClick={item.onClick} aria-current={item.active ? "page" : undefined} className={`h-9 shrink-0 snap-start rounded-none border-b px-0 font-body text-[10px] uppercase tracking-[0.24em] ${item.active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"}`}>
              {item.label}
            </Button>
          ))}
        </div>
      </nav>}

      <AnimatePresence mode="wait" initial={false}>
        {galleryState.kind === "tour" ? <GalleryTour /> : galleryState.kind === "curators" ? <CuratorsCanvas /> : (
          <motion.div key={space.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative mx-auto w-full max-w-[1280px]">
              <div className={`relative mx-auto w-full max-w-full ${activeSceneIsPortrait ? "md:border-x md:border-border/40" : hasScenePicks ? "md:w-full" : "md:w-fit"}`}>
              <div className={`flex w-full items-center justify-between border-b border-border/60 px-4 md:px-0 ${discoveryRoom ? "py-2" : "py-3 md:py-2"}`}>
                <span className="font-body text-sm font-normal uppercase tracking-widest text-muted-foreground md:text-base">
                  {activeCategory}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-body text-sm font-normal uppercase tracking-widest text-muted-foreground md:text-base">
                    {sceneIdx + 1} / {galleryPages.length}
                  </span>
                  <Button type="button" size="icon" variant="ghost" aria-label="Open scene carousel" onClick={() => setDrawerOpen((open) => !open)} className="size-7 rounded-none p-0 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <GalleryHorizontal className="size-3.5" strokeWidth={1.25} />
                  </Button>
                </div>
              </div>
              {lightboxProduct && !expandedScene && (
                <PublicProductLightbox
                  product={lightboxProduct}
                  allPicks={discoveryRoom ? allPicks : allPicks.filter((pick) => pick.brand_name === lightboxProduct.brand_name)}
                  onClose={() => setLightboxProduct(null)}
                  onSelectRelated={setLightboxProduct}
                  categoryDiscovery={categoryDiscovery}
                />
              )}
               <div className={`relative flex w-full items-center justify-center overflow-hidden bg-background ${hasScenePicks ? "md:items-stretch md:gap-3 lg:gap-6" : ""}`}>
                  {hasScenePicks && (
                      <aside aria-label="Products on the left of this photo" className={`hidden w-40 shrink-0 content-center border-r border-border/60 px-2 md:grid lg:w-52 lg:px-4 xl:w-56 xl:px-5 ${activeSceneReady ? "" : "invisible"}`}>
                        <div className="grid grid-cols-1 content-center gap-y-8">{featuredLeftPicks.map(renderScenePick)}</div>
                    </aside>
                  )}
                  <div className="flex min-w-0 flex-1 items-start justify-center">
                   <AnimatePresence mode="wait">
                     {activePage.scenes.map((pageScene) => (
                       <motion.div
                         key={pageScene.id}
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         exit={{ opacity: 0 }}
                         transition={{ duration: 0.45 }}
                         className="relative mx-auto w-full overflow-hidden bg-transparent md:w-fit md:max-w-full"
                       >
                          {(() => {
                            const sceneReady = hotspotsReady && catalogReady && loadedScenes.has(pageScene.id);
                            return <>
                         <Button type="button" variant="ghost" onClick={() => setExpandedScene(pageScene)} aria-label={`Expand ${pageScene.title} photo`} className="block h-auto w-full rounded-none p-0 hover:bg-transparent md:w-auto md:max-w-full">
                           <img
                             src={large(pageScene.id)}
                             alt={`${space.label} — ${pageScene.title}`}
                             onLoad={(event) => {
                                markSceneLoaded(pageScene.id);
                               if (event.currentTarget.naturalHeight <= event.currentTarget.naturalWidth) return;
                               setPortraitSceneIds((current) => {
                                 if (current.has(pageScene.id)) return current;
                                 const next = new Set(current);
                                 next.add(pageScene.id);
                                 return next;
                               });
                             }}
                              className={`block h-auto w-full cursor-zoom-in object-contain md:max-h-[72vh] md:w-auto md:max-w-full ${discoveryRoom ? "md:max-h-[65vh]" : ""} ${sceneReady ? "opacity-100" : "opacity-0"}`}
                           />
                         </Button>
                            {sceneReady && hotspotsForScene(pageScene).map((hotspot) => (
                              <HotspotPin key={hotspot.id} hotspot={hotspot} editorial={!!discoveryRoom} onOpen={() => openHotspot(hotspot)} />
                            ))}
                            <div className="absolute bottom-3 right-3 z-20 hidden items-center md:flex">
                              <EditorialGalleryLandingHint key={pageScene.id} tone="hero" onClick={() => setExpandedScene(pageScene)} className="relative mr-2.5 py-1 text-[10px] tracking-[0.34em] before:absolute before:-inset-x-3 before:-inset-y-1.5 before:-z-10 before:rounded-sm before:bg-foreground/35 before:backdrop-blur-[2px] before:[mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]" />
                              <Button type="button" size="icon" variant="ghost" aria-label="Presentation" title="Presentation" onClick={() => setExpandedScene(pageScene)} className="relative isolate h-10 w-10 min-h-10 min-w-10 shrink-0 rounded-full border border-primary-foreground/35 bg-transparent text-primary-foreground shadow-none touch-manipulation animate-gallery-icon-pulse hover:bg-transparent hover:text-primary-foreground before:absolute before:-inset-1 before:-z-10 before:rounded-full before:bg-foreground/35 before:backdrop-blur-[2px] before:[mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]">
                                <Images size={20} strokeWidth={1.5} />
                              </Button>
                            </div>
                          <Button type="button" size="icon" variant="default" aria-label="Previous gallery photo" title="Previous gallery photo" onClick={() => step(-1)} className="absolute left-0 top-1/2 z-20 hidden h-12 w-10 -translate-y-1/2 rounded-none bg-foreground text-background shadow-none hover:bg-foreground/85 md:flex">
                            <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden="true" />
                          </Button>
                          <Button type="button" size="icon" variant="default" aria-label="Next gallery photo" title="Next gallery photo" onClick={() => step(1)} className="absolute right-0 top-1/2 z-20 hidden h-12 w-10 -translate-y-1/2 rounded-none bg-foreground text-background shadow-none hover:bg-foreground/85 md:flex">
                            <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden="true" />
                          </Button>
                            </>;
                          })()}
                       </motion.div>
                     ))}
                   </AnimatePresence>
                 </div>
                  {hasScenePicks && (
                      <aside aria-label="Products on the right of this photo" className={`hidden w-40 shrink-0 content-center border-l border-border/60 px-2 md:grid lg:w-52 lg:px-4 xl:w-56 xl:px-5 ${activeSceneReady ? "" : "invisible"}`}>
                        <div className="grid grid-cols-1 content-center gap-y-8">{featuredRightPicks.map(renderScenePick)}</div>
                    </aside>
                  )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex h-px gap-1 bg-background/25" aria-hidden="true">
                  {galleryPages.map((galleryPage, index) => (
                    <span key={galleryPage.scenes.map((pageScene) => pageScene.id).join("-")} className={`h-full flex-1 ${index === sceneIdx ? "bg-background" : "bg-background/35"}`} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!expandedScene} onOpenChange={(open) => { if (!open) setExpandedScene(null); }}>
        <DialogContent hideClose className="flex h-[100dvh] w-screen max-w-none items-center justify-center overflow-hidden rounded-none border-none bg-foreground/95 p-4 shadow-none sm:p-8" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{expandedScene ? `${space.label} — ${expandedScene.title}` : "Gallery photo"}</DialogTitle>
          {expandedScene && (
            <div className="relative max-h-[calc(100dvh-4rem)] max-w-full">
               <img src={large(expandedScene.id)} alt={`${space.label} — ${expandedScene.title}`} onLoad={() => setExpandedLoadedScene(expandedScene.id)} className={`block max-h-[calc(100dvh-4rem)] max-w-full object-contain ${hotspotsReady && expandedLoadedScene === expandedScene.id ? "opacity-100" : "opacity-0"}`} />
                {hotspotsReady && expandedLoadedScene === expandedScene.id && hotspotsForScene(expandedScene).map((hotspot) => (
                  <HotspotPin key={hotspot.id} hotspot={hotspot} editorial={!!discoveryRoom} onOpen={() => openHotspot(hotspot)} />
                ))}
            </div>
          )}
          {lightboxProduct && (
            <PublicProductLightbox
              inline
              product={lightboxProduct}
                allPicks={discoveryRoom ? allPicks : allPicks.filter((pick) => pick.brand_name === lightboxProduct.brand_name)}
              onClose={() => setLightboxProduct(null)}
              onSelectRelated={setLightboxProduct}
                categoryDiscovery={categoryDiscovery}
            />
          )}
          {expandedScene && galleryPages.length > 1 && (
            <>
              <Button type="button" variant="ghost" size="icon" aria-label="Previous photo in this room" onClick={() => stepExpanded(-1)} className="absolute left-3 top-1/2 z-20 h-12 w-10 -translate-y-1/2 rounded-none bg-foreground text-background hover:bg-foreground/90 hover:text-background sm:left-6">
                <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Next photo in this room" onClick={() => stepExpanded(1)} className="absolute right-3 top-1/2 z-20 h-12 w-10 -translate-y-1/2 rounded-none bg-foreground text-background hover:bg-foreground/90 hover:text-background sm:right-6">
                <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden="true" />
              </Button>
               <div className="absolute inset-x-0 bottom-4 z-20 flex items-center gap-2 px-4 sm:px-6" role="tablist" aria-label="Photos in this room">
                 {galleryPages.map((galleryPage, index) => (
                   <button key={galleryPage.title} type="button" role="tab" aria-selected={index === sceneIdx} aria-label={`Photo ${index + 1} of ${galleryPages.length}`} onClick={() => { setSceneIdx(index); setExpandedScene(galleryPage.scenes[0] ?? null); setActivePin(null); setLightboxProduct(null); }} className={`flex-1 rounded-full transition-all duration-200 ${index === sceneIdx ? "h-[3px] bg-background" : "h-px bg-background/25 hover:bg-background/50"}`} />
                 ))}
                 <span className="ml-2 shrink-0 font-body text-[11px] uppercase tracking-[0.28em] text-background/80">{String(sceneIdx + 1).padStart(2, "0")} / {String(galleryPages.length).padStart(2, "0")}</span>
               </div>
            </>
          )}
          <Button type="button" variant="ghost" size="icon" aria-label="Close expanded photo" onClick={() => setExpandedScene(null)} className="absolute right-4 top-4 z-20 text-background hover:bg-background/20 hover:text-background"><X className="size-5" /></Button>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {drawerOpen && galleryState.kind === "room" && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.35, ease: "easeOut" }} className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 shadow-2xl backdrop-blur" aria-label="Scene carousel" role="dialog">
            <div className="flex items-center justify-between px-6 pt-3">
              <span className="font-body text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Room scenes</span>
              <Button type="button" size="icon" variant="ghost" aria-label="Close scene carousel" onClick={() => setDrawerOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="flex gap-6 overflow-x-auto px-6 pb-5 pt-2">
              {SPACES.map((room, spaceIndex) => (
                <div key={room.key} className="flex shrink-0 gap-2">
                  {room.scenes.map((roomScene, sceneIndex) => {
                    const active = spaceIndex === roomSpaceIndex && sceneIndex === sceneIdx;
                    return (
                      <Button key={roomScene.id} type="button" variant="ghost" onClick={() => selectScene(spaceIndex, sceneIndex)} aria-label={`${room.label}: ${roomScene.title}`} className="h-auto shrink-0 flex-col items-start rounded-none p-0 text-left hover:bg-transparent">
                        <img src={thumb(roomScene.id)} alt="" loading="lazy" className={`h-20 w-32 object-cover transition ${active ? "ring-2 ring-foreground" : "opacity-70 hover:opacity-100"}`} />
                        {sceneIndex === 0 && <span className="mt-1 block font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{room.label}</span>}
                      </Button>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </section>
  );
}