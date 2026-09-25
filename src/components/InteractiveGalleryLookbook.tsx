import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, GalleryHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";

type Scene = { title: string; id: string };
type Space = { key: string; label: string; scenes: Scene[] };

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
};

export default function InteractiveGalleryLookbook() {
  const [spaceIdx, setSpaceIdx] = useState(0);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [activePin, setActivePin] = useState<string | null>(null);

  const space = SPACES[spaceIdx];
  const scene = space.scenes[sceneIdx];

  useEffect(() => {
    supabase
      .from("gallery_hotspots")
      .select("id, image_identifier, x_percent, y_percent, product_name, designer_name, product_image_url, materials, dimensions, link_url")
      .then(({ data }) => setHotspots((data as Hotspot[]) || []));
  }, []);

  const sceneHotspots = useMemo(
    () => hotspots.filter((h) => h.image_identifier.toLowerCase() === scene.title.toLowerCase()),
    [hotspots, scene.title],
  );

  const step = useCallback((dir: number) => {
    setActivePin(null);
    setSceneIdx((i) => (i + dir + space.scenes.length) % space.scenes.length);
  }, [space.scenes.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const selectSpace = (i: number) => { setSpaceIdx(i); setSceneIdx(0); setActivePin(null); };
  const selectScene = (si: number, ci: number) => { setSpaceIdx(si); setSceneIdx(ci); setActivePin(null); };

  return (
    <section aria-label="Interactive Gallery" className="bg-background pb-24 text-foreground">
      <nav aria-label="Gallery spaces" className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-7 overflow-x-auto px-6 md:justify-center md:gap-10">
          {SPACES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => selectSpace(i)}
              aria-current={i === spaceIdx ? "true" : undefined}
              className={`shrink-0 whitespace-nowrap border-b py-1 font-body text-[11px] uppercase tracking-[0.28em] transition-colors ${
                i === spaceIdx ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-[1500px] px-4 pt-8 md:px-10">
        <div className="relative flex justify-center bg-muted/40">
          <div className="relative inline-block">
            <AnimatePresence mode="wait">
              <motion.img
                key={scene.id}
                src={large(scene.id)}
                alt={`${space.label} — ${scene.title}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="block max-h-[78vh] w-auto max-w-full"
              />
            </AnimatePresence>
            {sceneHotspots.map((h) => (
              <button
                key={h.id}
                type="button"
                aria-label={h.product_name}
                onClick={() => setActivePin(activePin === h.id ? null : h.id)}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${h.x_percent}%`, top: `${h.y_percent}%` }}
              >
                <span className="block size-5 rounded-full border-2 border-background bg-foreground/60 shadow-md transition-transform group-hover:scale-125" />
                <span className={`pointer-events-none absolute left-1/2 top-7 z-10 -translate-x-1/2 whitespace-nowrap bg-background px-3 py-1.5 font-body text-[11px] text-foreground shadow-md transition-opacity ${activePin === h.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                  {h.product_name}
                </span>
              </button>
            ))}
          </div>

          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Open scene carousel"
            onClick={() => setDrawerOpen((v) => !v)}
            className="absolute left-4 top-4 rounded-full bg-background/85 backdrop-blur"
          >
            <GalleryHorizontal className="size-4" />
          </Button>
          <button type="button" aria-label="Previous scene" onClick={() => step(-1)} className="absolute left-0 top-0 flex h-full w-16 items-center justify-center text-background/90 hover:text-background">
            <ChevronLeft className="size-9 drop-shadow" strokeWidth={1.2} />
          </button>
          <button type="button" aria-label="Next scene" onClick={() => step(1)} className="absolute right-0 top-0 flex h-full w-16 items-center justify-center text-background/90 hover:text-background">
            <ChevronRight className="size-9 drop-shadow" strokeWidth={1.2} />
          </button>
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <h2 className="font-display text-2xl md:text-3xl">{scene.title}</h2>
          <span className="font-body text-xs tracking-[0.2em] text-muted-foreground">
            {sceneIdx + 1} / {space.scenes.length}
          </span>
        </div>

        <div className="mt-14">
          <h3 className="mb-8 font-body text-[11px] uppercase tracking-[0.28em] text-muted-foreground">In this scene</h3>
          {sceneHotspots.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">Pieces for this scene are available upon request.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sceneHotspots.map((h) => {
                const inner = (
                  <>
                    <div className={`flex aspect-square items-center justify-center bg-background p-6 ring-1 transition ${activePin === h.id ? "ring-foreground" : "ring-border"}`}>
                      {h.product_image_url ? (
                        <img src={h.product_image_url} alt={h.product_name} loading="lazy" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="font-display text-sm text-muted-foreground">{h.product_name}</span>
                      )}
                    </div>
                    <p className="mt-4 font-display text-base leading-snug">{h.product_name}</p>
                    {h.designer_name && <p className="mt-1 font-body text-xs uppercase tracking-[0.18em] text-muted-foreground">{h.designer_name}</p>}
                    {(h.materials || h.dimensions) && (
                      <p className="mt-1 font-body text-xs text-muted-foreground">{[h.materials, h.dimensions].filter(Boolean).join(" · ")}</p>
                    )}
                    <p className="mt-2 font-body text-xs text-foreground">Price upon Request</p>
                  </>
                );
                return h.link_url ? (
                  <a key={h.id} href={h.link_url} onMouseEnter={() => setActivePin(h.id)} className="block">{inner}</a>
                ) : (
                  <div key={h.id} onMouseEnter={() => setActivePin(h.id)}>{inner}</div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 shadow-2xl backdrop-blur"
            aria-label="Scene carousel"
            role="dialog"
          >
            <div className="flex items-center justify-between px-6 pt-3">
              <span className="font-body text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Room scenes</span>
              <Button type="button" size="icon" variant="ghost" aria-label="Close scene carousel" onClick={() => setDrawerOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex gap-6 overflow-x-auto px-6 pb-5 pt-2">
              {SPACES.map((s, si) => (
                <div key={s.key} className="flex shrink-0 gap-2">
                  {s.scenes.map((c, ci) => {
                    const active = si === spaceIdx && ci === sceneIdx;
                    return (
                      <button key={c.id} type="button" onClick={() => selectScene(si, ci)} aria-label={`${s.label}: ${c.title}`} className="shrink-0 text-left">
                        <img src={thumb(c.id)} alt="" loading="lazy" className={`h-20 w-32 object-cover transition ${active ? "ring-2 ring-foreground" : "opacity-70 hover:opacity-100"}`} />
                        {ci === 0 && <span className="mt-1 block font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.label}</span>}
                      </button>
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
