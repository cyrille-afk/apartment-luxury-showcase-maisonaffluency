import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GalleryHorizontal, Play, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import PublicProductLightbox, { type PublicLightboxItem } from "@/components/PublicProductLightbox";
import { fetchCatalogManifest } from "@/lib/catalogManifest";
import { queryKeys } from "@/lib/queryKeys";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { resolveCuratorPickDescription } from "@/lib/curatorPickDescription";
import { APARTMENT_TOUR_VIDEO_URL } from "@/lib/apartmentTourVideo";
import { attachMilestoneTracking, trackVideoEvent } from "@/lib/videoTracking";
import { curatingTeam } from "@/components/CuratingTeam";

type Scene = { title: string; id: string };
type Space = { key: string; label: string; scenes: Scene[] };
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
  "A Dreamy Tuscan Landscape:Astra Dining Table": "3b6f6177-adfa-4f23-8cf7-75396028fe95",
  "A Dreamy Tuscan Landscape:Murano Cloud Bulle Pendants": "4b46af75-4c35-4a81-bea6-822810ae3422",
  "A Sophisticated Boudoir:Toshiro Lamp": "294326f2-a7a0-4447-8b50-f3bde7de2cc5",
  "A Sophisticated Boudoir:Lyric Desk": "ca386961-7986-43cf-aa8c-853249a177a5",
  "A Sophisticated Boudoir:Gold Leaves+Glass Snake Vessel (Unique Piece)": "cd18f654-d48f-4b86-80a0-62e10255b581",
  "A Masterful Suite:Villa Pedestal": "1419dd7f-b404-44d2-ae68-ca46890920ea",
  "A Masterful Suite:Brunelleschi Perspective Wallcover": "6f32db0d-3d34-4035-9bf4-b42cb33940e9",
  "A Masterful Suite:Bud Table Lamp": "da524883-8938-441a-b902-f12deb378ca7",
};
// The Boudoir's chandelier side pick was explicitly replaced by the Toshiro lamp.
const EXCLUDED_SIDE_PICK_HOTSPOTS = new Set(["A Sophisticated Boudoir:Custom Saint-Just Glass Chandelier"]);
// Honor the previously curated placements on the first photo of these rooms.
const SIDE_PICK_OVERRIDES: Record<string, "left" | "right"> = {
  "A Dreamy Tuscan Landscape:Astra Dining Table": "left",
  "A Dreamy Tuscan Landscape:PéPé S Icewood x FJ Hakimian": "left",
  "A Dreamy Tuscan Landscape:Crystalline Vase Volume 3": "right",
  "A Dreamy Tuscan Landscape:Murano Cloud Bulle Pendants": "right",
  "A Sophisticated Boudoir:Lyric Desk": "left",
  "A Sophisticated Boudoir:PéPé S Icewood x FJ Hakimian": "left",
  "A Sophisticated Boudoir:Toshiro Lamp": "right",
  "A Sophisticated Boudoir:Gold Leaves+Glass Snake Vessel (Unique Piece)": "right",
  "A Masterful Suite:Villa Pedestal": "left",
  "A Masterful Suite:Brunelleschi Perspective Wallcover": "left",
  "A Masterful Suite:Bud Table Lamp": "right",
};

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
};

type ScenePick = { hotspot: Hotspot; product: PublicLightboxItem; image: string };

function GalleryTour() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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

    video.playbackRate = 0.75;
    void video.play().catch(() => setIsPlaying(false));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = 1;
    video.muted = false;
    video.playbackRate = 0.75;
    const onPlay = () => {
      setIsPlaying(true);
      trackVideoEvent("play", "showroom-tour");
    };
    const onPause = () => {
      setIsPlaying(false);
      trackVideoEvent("pause", "showroom-tour");
    };
    const onFullscreenChange = () => {
      if (document.fullscreenElement !== video && !video.paused) video.pause();
    };
    const onWebkitEndFullscreen = () => {
      if (!video.paused) video.pause();
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    video.addEventListener("webkitendfullscreen", onWebkitEndFullscreen);
    const detachMilestones = attachMilestoneTracking(video, "showroom-tour");
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      video.removeEventListener("webkitendfullscreen", onWebkitEndFullscreen);
      detachMilestones();
    };
  }, []);

  return (
    <motion.div key="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto max-w-[1500px] px-4 pb-12 pt-7 md:px-10 md:pb-16 md:pt-9">
      <div className="mx-auto mb-7 max-w-6xl text-center md:mb-9">
        <p className="font-body text-[10px] font-light uppercase tracking-[0.28em] text-muted-foreground">Maison Affluency · Singapore</p>
        <p className="mx-auto mt-3 w-full text-center font-body text-[11px] font-light leading-relaxed tracking-[0.08em] text-muted-foreground md:whitespace-nowrap">A private walkthrough of collectible design, bespoke interiors and artisan craftsmanship.</p>
      </div>
      <div className="w-full bg-muted/30 p-3 md:p-8">
        <div className="relative mx-auto aspect-video w-full max-w-6xl overflow-hidden bg-foreground">
          <video
            ref={videoRef}
            controls
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

type InteractiveGalleryLookbookProps = {
  initialView?: "tour" | "living-room";
};

export default function InteractiveGalleryLookbook({ initialView = "tour" }: InteractiveGalleryLookbookProps) {
  const [galleryState, setGalleryState] = useState<GalleryState>(initialView === "living-room" ? { kind: "room", spaceIndex: 0 } : { kind: "tour" });
  const [sceneIdx, setSceneIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [lightboxProduct, setLightboxProduct] = useState<PublicLightboxItem | null>(null);
  const [portraitSceneIds, setPortraitSceneIds] = useState<Set<string>>(() => new Set());

  const roomSpaceIndex = galleryState.kind === "room" ? galleryState.spaceIndex : 0;
  const space = SPACES[roomSpaceIndex];
  const galleryPages = useMemo(() => createGalleryPages(space), [space]);
  const activePage = galleryPages[sceneIdx];

  useEffect(() => {
    supabase
      .from("gallery_hotspots")
      .select("id, image_identifier, x_percent, y_percent, product_name, designer_name, product_image_url, materials, dimensions, link_url, mapped_pick_id")
      .then(({ data }) => setHotspots((data as Hotspot[]) || []));
  }, []);

  const { data: manifest } = useQuery({
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
    return [...merged.values()];
  }, [manifest]);

  const hotspotsForScene = useCallback(
    (scene: Scene) => hotspots.filter((hotspot) => normalize(hotspot.image_identifier) === normalize(scene.title)),
    [hotspots],
  );

  const resolveHotspotProduct = useCallback((hotspot: Hotspot): PublicLightboxItem | null => {
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
    setSceneIdx((index) => (index + direction + galleryPages.length) % galleryPages.length);
  }, [galleryState.kind, galleryPages.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (lightboxProduct) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxProduct, step]);

  const selectSpace = (spaceIndex: number) => {
    setGalleryState({ kind: "room", spaceIndex });
    setSceneIdx(0);
    setActivePin(null);
    setLightboxProduct(null);
  };
  const selectScene = (spaceIndex: number, sceneIndex: number) => {
    setGalleryState({ kind: "room", spaceIndex });
    setSceneIdx(sceneIndex);
    setActivePin(null);
    setLightboxProduct(null);
  };

  const ribbonItems = [
    { key: "tour", label: "Tour Our Gallery", onClick: () => setGalleryState({ kind: "tour" }), active: galleryState.kind === "tour" },
    ...SPACES.map((item, index) => ({ key: item.key, label: item.label, onClick: () => selectSpace(index), active: galleryState.kind === "room" && roomSpaceIndex === index })),
    { key: "curators", label: "The Curators", onClick: () => setGalleryState({ kind: "curators" }), active: galleryState.kind === "curators" },
  ];

  const activeTitle = galleryState.kind === "room"
    ? activePage.title
    : galleryState.kind === "tour"
      ? "Tour Our Gallery"
      : "The Curators";
  const activeCategory = galleryState.kind === "room"
    ? space.label
    : galleryState.kind === "tour"
      ? "Tour Our Gallery"
      : "The Curators";
  const activeScene = galleryState.kind === "room" ? activePage.scenes[0] : undefined;
  const activeSceneIsPortrait = activeScene ? portraitSceneIds.has(activeScene.id) : false;
  const scenePicks = activeScene ? hotspotsForScene(activeScene)
    .filter((hotspot) => !EXCLUDED_SIDE_PICK_HOTSPOTS.has(`${hotspot.image_identifier}:${hotspot.product_name}`))
    .map((hotspot): ScenePick | null => {
      const product = resolveHotspotProduct(hotspot);
      const image = product?.id.startsWith("hotspot-") ? hotspot.product_image_url : product?.image_url || hotspot.product_image_url;
      return product && image ? { hotspot, product, image } : null;
    })
    .filter((pick): pick is ScenePick => pick !== null) : [];
  const sideForPick = ({ hotspot }: ScenePick) => SIDE_PICK_OVERRIDES[`${hotspot.image_identifier}:${hotspot.product_name}`] || (hotspot.x_percent < 50 ? "left" : "right");
  const featuredLeftPicks = scenePicks.filter((pick) => sideForPick(pick) === "left").sort((a, b) => a.hotspot.x_percent - b.hotspot.x_percent);
  const featuredRightPicks = scenePicks.filter((pick) => sideForPick(pick) === "right").sort((a, b) => a.hotspot.x_percent - b.hotspot.x_percent);
  const hasScenePicks = scenePicks.length > 0;

  const renderScenePick = ({ hotspot, product, image }: ScenePick) => (
    <Button key={hotspot.id} type="button" variant="ghost" onClick={() => openHotspot(hotspot)} aria-label={`View ${hotspot.product_name} details`} className="h-auto min-w-0 w-full flex-col items-start rounded-none p-0 text-left hover:bg-transparent">
      <img src={image} alt={hotspot.product_name} loading="lazy" className="aspect-square w-full object-contain" />
      <span className="mt-1.5 block w-full whitespace-normal break-words font-display text-xs font-light leading-tight text-foreground lg:text-sm">{product.id.startsWith("hotspot-") ? hotspot.product_name : product.title}</span>
      <span className="mt-1 block w-full whitespace-normal break-words font-body text-[9px] font-light uppercase leading-tight tracking-wider text-muted-foreground">{product.brand_name}</span>
    </Button>
  );

  return (
    <section aria-label="Interactive Gallery" className="bg-background pb-16 text-foreground">
      <header className="flex min-h-20 items-center justify-center px-6 py-4 text-center md:min-h-24 md:py-5">
        <h2 className="font-body text-xs font-light uppercase tracking-[0.25em] text-foreground">
          {activeTitle}
        </h2>
      </header>

      <nav aria-label="Gallery timeline" className="mx-auto max-w-[1280px] border-y border-border/60 py-1 md:py-2">
        <div className="flex min-h-9 snap-x snap-mandatory items-center gap-7 overflow-x-auto scroll-smooth whitespace-nowrap px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-center md:gap-9 md:px-6">
          {ribbonItems.map((item) => (
            <Button key={item.key} type="button" variant="ghost" onClick={item.onClick} aria-current={item.active ? "page" : undefined} className={`h-9 shrink-0 snap-start rounded-none border-b px-0 font-body text-[10px] uppercase tracking-[0.24em] ${item.active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"}`}>
              {item.label}
            </Button>
          ))}
        </div>
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {galleryState.kind === "tour" ? <GalleryTour /> : galleryState.kind === "curators" ? <CuratorsCanvas /> : (
          <motion.div key={space.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative mx-auto w-full max-w-[1280px]">
              <div className={`relative mx-auto w-full max-w-full ${activeSceneIsPortrait ? "md:border-x md:border-border/40" : hasScenePicks ? "md:w-full" : "md:w-fit"}`}>
              <div className="flex w-full items-center justify-between border-b border-border/60 px-4 py-3 md:px-0 md:py-4">
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
              {lightboxProduct && (
                <PublicProductLightbox
                  product={lightboxProduct}
                  allPicks={allPicks.filter((pick) => pick.brand_name === lightboxProduct.brand_name)}
                  onClose={() => setLightboxProduct(null)}
                  onSelectRelated={setLightboxProduct}
                  inline
                  contextualPanel
                />
              )}
               <div className={`relative flex w-full items-center justify-center overflow-hidden bg-background ${hasScenePicks ? "md:items-stretch md:gap-3 lg:gap-6" : ""}`}>
                  {hasScenePicks && (
                    <aside aria-label="Products on the left of this photo" className="hidden w-40 shrink-0 content-center border-r border-border/60 pr-2 md:grid lg:w-52 lg:pr-4 xl:w-56 xl:pr-6">
                      <div className="grid grid-cols-2 content-center gap-x-2 gap-y-4">{featuredLeftPicks.map(renderScenePick)}</div>
                    </aside>
                  )}
                 <div className="flex min-w-0 flex-1 items-center justify-center">
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
                         <img
                           src={large(pageScene.id)}
                           alt={`${space.label} — ${pageScene.title}`}
                           onLoad={(event) => {
                             if (event.currentTarget.naturalHeight <= event.currentTarget.naturalWidth) return;
                             setPortraitSceneIds((current) => {
                               if (current.has(pageScene.id)) return current;
                               const next = new Set(current);
                               next.add(pageScene.id);
                               return next;
                             });
                           }}
                           className="block h-auto w-full object-contain md:max-h-[60vh] md:w-auto md:max-w-full"
                         />
                         {hotspotsForScene(pageScene).map((hotspot) => (
                           <Button key={hotspot.id} type="button" variant="ghost" size="icon" aria-label={`View ${hotspot.product_name}`} onClick={() => openHotspot(hotspot)} className="group absolute z-10 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full p-0 hover:bg-transparent md:size-9" style={{ left: `${hotspot.x_percent}%`, top: `${hotspot.y_percent}%` }}>
                             <span className="relative block size-6 rounded-full border border-background/90 bg-foreground/65 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110">
                               <span className="absolute left-1/2 top-1/2 h-px w-2.5 -translate-x-1/2 -translate-y-1/2 bg-background" />
                               <span className="absolute left-1/2 top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-background" />
                             </span>
                           </Button>
                         ))}
                       </motion.div>
                     ))}
                   </AnimatePresence>
                 </div>
                  {hasScenePicks && (
                    <aside aria-label="Products on the right of this photo" className="hidden w-40 shrink-0 content-center border-l border-border/60 pl-2 md:grid lg:w-52 lg:pl-4 xl:w-56 xl:pl-6">
                      <div className="grid grid-cols-2 content-center gap-x-2 gap-y-4">{featuredRightPicks.map(renderScenePick)}</div>
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