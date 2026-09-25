import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, GalleryHorizontal, X } from "lucide-react";
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

function GalleryTour() {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => trackVideoEvent("play", "showroom-tour");
    const onPause = () => trackVideoEvent("pause", "showroom-tour");
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    const detachMilestones = attachMilestoneTracking(video, "showroom-tour");
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      detachMilestones();
    };
  }, []);

  return (
    <motion.div key="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto flex min-h-[68vh] max-w-[1500px] items-center px-4 py-8 md:px-10">
      <div className="w-full bg-muted/30 p-3 md:p-8">
        <video ref={videoRef} src={APARTMENT_TOUR_VIDEO_URL} controls playsInline poster={large("bespoke-sofa_gxidtx")} className="mx-auto aspect-video w-full max-w-6xl bg-foreground object-cover" />
        <div className="mx-auto mt-5 flex max-w-6xl items-end justify-between gap-6">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Maison Affluency · Singapore</p>
            <h2 className="mt-2 font-display text-2xl md:text-4xl">Tour Our Gallery</h2>
          </div>
          <p className="hidden max-w-sm text-right font-body text-xs leading-relaxed text-muted-foreground md:block">A private walkthrough of collectible design, bespoke interiors and artisan craftsmanship.</p>
        </div>
      </div>
    </motion.div>
  );
}

function CuratorsCanvas() {
  return (
    <motion.div key="curators" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto min-h-[68vh] max-w-[1400px] px-6 py-12 md:px-12 md:py-16">
      <div className="mb-10 border-b border-border pb-6 md:mb-14">
        <p className="font-body text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Maison Affluency</p>
        <h2 className="mt-3 font-display text-3xl md:text-5xl">The Curators</h2>
      </div>
      <div className="grid gap-12 md:grid-cols-2 md:gap-16">
        {curatingTeam.map((member, index) => (
          <motion.article key={member.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="grid gap-6 sm:grid-cols-[minmax(180px,0.8fr)_1.2fr] sm:items-start">
            <img src={member.image} alt={member.name} className="aspect-[4/5] w-full object-cover" />
            <div className="border-t border-border pt-5">
              <h3 className="font-display text-2xl">{member.name}</h3>
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{member.role}</p>
              <p className="mt-6 font-body text-sm leading-7 text-muted-foreground">{member.bio}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </motion.div>
  );
}

export default function InteractiveGalleryLookbook() {
  const [galleryState, setGalleryState] = useState<GalleryState>({ kind: "room", spaceIndex: 0 });
  const [sceneIdx, setSceneIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [lightboxProduct, setLightboxProduct] = useState<PublicLightboxItem | null>(null);

  const roomSpaceIndex = galleryState.kind === "room" ? galleryState.spaceIndex : 0;
  const space = SPACES[roomSpaceIndex];
  const scene = space.scenes[sceneIdx];

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

  const sceneHotspots = useMemo(
    () => hotspots.filter((hotspot) => normalize(hotspot.image_identifier) === normalize(scene.title)),
    [hotspots, scene.title],
  );

  const openHotspot = useCallback((hotspot: Hotspot) => {
    setActivePin(hotspot.id);
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
    } : null;
    setLightboxProduct(exact || fuzzy || fallback);
  }, [allPicks]);

  const step = useCallback((direction: number) => {
    if (galleryState.kind !== "room") return;
    setActivePin(null);
    setSceneIdx((index) => (index + direction + space.scenes.length) % space.scenes.length);
  }, [galleryState.kind, space.scenes.length]);

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
  };
  const selectScene = (spaceIndex: number, sceneIndex: number) => {
    setGalleryState({ kind: "room", spaceIndex });
    setSceneIdx(sceneIndex);
    setActivePin(null);
  };

  const ribbonItems = [
    ...SPACES.map((item, index) => ({ key: item.key, label: item.label, onClick: () => selectSpace(index), active: galleryState.kind === "room" && roomSpaceIndex === index })),
    { key: "tour", label: "Tour Our Gallery", onClick: () => setGalleryState({ kind: "tour" }), active: galleryState.kind === "tour" },
    { key: "curators", label: "The Curators", onClick: () => setGalleryState({ kind: "curators" }), active: galleryState.kind === "curators" },
  ];

  return (
    <section aria-label="Interactive Gallery" className="bg-background pb-24 text-foreground">
      <nav aria-label="Gallery timeline" className="border-b border-border">
        <div className="mx-auto flex min-h-14 max-w-[1580px] snap-x snap-mandatory items-center gap-7 overflow-x-auto scroll-smooth whitespace-nowrap px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:min-h-16 md:justify-center md:gap-9 md:px-6">
          {ribbonItems.map((item) => (
            <Button key={item.key} type="button" variant="ghost" onClick={item.onClick} aria-current={item.active ? "page" : undefined} className={`h-14 shrink-0 snap-start rounded-none border-b px-0 font-body text-[10px] uppercase tracking-[0.24em] md:h-16 ${item.active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"}`}>
              {item.label}
            </Button>
          ))}
        </div>
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {galleryState.kind === "tour" ? <GalleryTour /> : galleryState.kind === "curators" ? <CuratorsCanvas /> : (
          <motion.div key={space.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto w-full max-w-[1500px] pt-4 md:px-10 md:pt-8">
            <div className="relative w-full bg-muted/40 md:flex md:min-h-[55vh] md:justify-center">
              <div className="relative w-full md:inline-flex md:w-auto md:items-center">
                <AnimatePresence mode="wait">
                  <motion.img key={scene.id} src={large(scene.id)} alt={`${space.label} — ${scene.title}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} className="block h-auto w-full md:max-h-[78vh] md:w-auto md:max-w-full" />
                </AnimatePresence>
                {sceneHotspots.map((hotspot) => (
                  <Button key={hotspot.id} type="button" variant="ghost" size="icon" aria-label={`View ${hotspot.product_name}`} onClick={() => openHotspot(hotspot)} className="group absolute z-10 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full p-0 hover:bg-transparent" style={{ left: `${hotspot.x_percent}%`, top: `${hotspot.y_percent}%` }}>
                    <span className="relative block size-6 rounded-full border border-background/90 bg-foreground/65 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110">
                      <span className="absolute left-1/2 top-1/2 h-px w-2.5 -translate-x-1/2 -translate-y-1/2 bg-background" />
                      <span className="absolute left-1/2 top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-background" />
                    </span>
                  </Button>
                ))}
              </div>

              <Button type="button" size="icon" variant="secondary" aria-label="Open scene carousel" onClick={() => setDrawerOpen((open) => !open)} className="absolute right-4 top-4 z-20 rounded-full bg-background/85 backdrop-blur">
                <GalleryHorizontal className="size-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label="Previous scene" onClick={() => step(-1)} className="absolute bottom-0 left-0 top-16 z-10 h-auto w-16 rounded-none text-background/90 hover:bg-foreground/10 hover:text-background">
                <ChevronLeft className="size-9 drop-shadow" strokeWidth={1.2} />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label="Next scene" onClick={() => step(1)} className="absolute bottom-0 right-0 top-0 z-10 h-auto w-16 rounded-none text-background/90 hover:bg-foreground/10 hover:text-background">
                <ChevronRight className="size-9 drop-shadow" strokeWidth={1.2} />
              </Button>
            </div>

            <div className="relative mx-auto mt-8 max-w-3xl px-12 text-center">
              <h2 className="font-display text-2xl md:text-3xl">{scene.title}</h2>
              <p className="mt-3 font-body text-[11px] uppercase tracking-[0.28em] text-muted-foreground">In this scene</p>
              <span className="absolute right-0 top-1/2 -translate-y-1/2 font-body text-xs tracking-[0.2em] text-muted-foreground">{sceneIdx + 1} / {space.scenes.length}</span>
            </div>

            <div className="mx-auto mt-14 max-w-[1320px] px-4 md:px-0">
              {sceneHotspots.length === 0 ? <p className="text-center font-body text-sm text-muted-foreground">Pieces for this scene are available upon request.</p> : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-16 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-12 lg:gap-y-20">
                  {sceneHotspots.map((hotspot) => (
                    <Button key={hotspot.id} type="button" variant="ghost" onClick={() => openHotspot(hotspot)} onMouseEnter={() => setActivePin(hotspot.id)} className="group h-auto min-w-0 flex-col items-center justify-start rounded-none bg-transparent p-0 text-center hover:bg-transparent">
                      <span className="flex aspect-square w-full items-center justify-center bg-transparent p-8 md:p-10">
                        {hotspot.product_image_url ? <img src={hotspot.product_image_url} alt="" loading="lazy" className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]" /> : <span className="font-display text-sm text-muted-foreground">{hotspot.product_name}</span>}
                      </span>
                      <span className="mt-5 block w-full whitespace-normal font-display text-base leading-snug">{hotspot.product_name}</span>
                      {hotspot.designer_name && <span className="mt-2 block w-full whitespace-normal font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{hotspot.designer_name}</span>}
                      {(hotspot.materials || hotspot.dimensions) && <span className="mt-2 block w-full whitespace-normal font-body text-xs leading-relaxed text-muted-foreground">{[hotspot.materials, hotspot.dimensions].filter(Boolean).join(" · ")}</span>}
                      <span className="mt-3 block w-full font-body text-xs text-foreground">Price upon Request</span>
                    </Button>
                  ))}
                </div>
              )}
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

      {lightboxProduct && (
        <PublicProductLightbox product={lightboxProduct} allPicks={allPicks.filter((pick) => pick.brand_name === lightboxProduct.brand_name)} onClose={() => setLightboxProduct(null)} onSelectRelated={setLightboxProduct} />
      )}
    </section>
  );
}