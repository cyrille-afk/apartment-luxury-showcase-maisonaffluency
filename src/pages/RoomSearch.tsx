import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ProductGrid from "@/components/ProductGrid";
import InteractiveGalleryLookbook from "@/components/InteractiveGalleryLookbook";
import RoomPageNavigation from "@/components/RoomPageNavigation";
import { resolveRoomSlug, type RoomSlug } from "@/lib/roomCategories";
import { getRoomPreviewScene } from "@/lib/roomPreviewScenes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Room hero assets reused from the header mega-menu so the shared link
// preview shows the same vignette the navigation pathway advertises.
import livingRoomVignette from "@/assets/living-room-hero.jpg";
import diningRoomVignette from "@/assets/intimate-dining.jpg";
import bedroomVignette from "@/assets/master-suite.jpg";
import lightingVignette from "@/assets/dining-room.jpg";
import officeVignette from "@/assets/home-office-desk.jpg";

/** Evocative "universe" name used in titles/descriptions per room. */
const ROOM_UNIVERSES: Record<RoomSlug, string> = {
  estates: "An Exceptional Estate",
  "living-room": "A Sophisticated Living Room",
  "dining-room": "An Elegant Dining Room",
  bedroom: "A Serene Bedroom",
  bath: "A Refined Bath",
  office: "A Considered Home Office",
  lighting: "A Sculptural Lighting Collection",
  outdoor: "An Inspired Outdoor Collection",
  modern: "A Modern Collector's Interior",
};

/** Middle title segment: "[Universe] | Curated [Room] | Maison Affluency". */
const ROOM_CURATED: Record<RoomSlug, string> = {
  estates: "Curated Estates",
  "living-room": "Curated Living Room",
  "dining-room": "Curated Dining Room",
  bedroom: "Curated Bedroom",
  bath: "Curated Bath",
  office: "Curated Home Office",
  lighting: "Curated Lighting",
  outdoor: "Curated Outdoor",
  modern: "Curated Modern",
};

/** Room vignette for og:image / twitter:image (rooms without one keep the sitewide image). */
const ROOM_VIGNETTES: Partial<Record<RoomSlug, string>> = {
  "living-room": livingRoomVignette,
  "dining-room": diningRoomVignette,
  bedroom: bedroomVignette,
  lighting: lightingVignette,
  office: officeVignette,
};

const SITE_ORIGIN = "https://www.maisonaffluency.com";
const DEFAULT_TITLE = "Maison Affluency | Luxury Collectible Design Singapore";

/** Head tags this component manages, with the static index.html defaults to restore on unmount. */
const MANAGED_TAGS: Array<{ attr: "name" | "property"; key: string; fallback: string | null }> = [
  { attr: "property", key: "og:title", fallback: DEFAULT_TITLE },
  {
    attr: "property",
    key: "og:description",
    fallback:
      "Curated luxury collectible furniture, bespoke interiors, and contemporary design by world-renowned designers and ateliers in Singapore.",
  },
  { attr: "name", key: "twitter:title", fallback: DEFAULT_TITLE },
  {
    attr: "name",
    key: "twitter:description",
    fallback:
      "Curated luxury collectible furniture, bespoke interiors, and contemporary design by world-renowned designers and ateliers in Singapore.",
  },
  { attr: "name", key: "description", fallback: null },
];

function upsertMeta(attr: "name" | "property", key: string, content: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return el;
}

/** Full-width room scene and its curated alternatives, part of the page flow. */
function RoomCuration({ room }: { room: RoomSlug }) {
  const scene = getRoomPreviewScene(room);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  return (
    <section aria-label="Curated alternatives" className="w-full bg-background">
      <div className="relative h-[38vh] min-h-[280px] max-h-[520px] w-full overflow-hidden md:h-[52vh]">
        <img src={scene.previewImage.src} alt={scene.previewImage.alt} className="h-full w-full object-cover" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={`Shop this look: ${scene.hotspot.label}; highlight curated alternatives`} aria-expanded={open}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setOpen(true); }}
              onPointerLeave={(event) => { if (event.pointerType === "mouse") setOpen(false); }}
              onClick={() => { setSelected(true); setOpen(true); }}
              style={{ left: `${scene.hotspot.left}%`, top: `${scene.hotspot.top}%` }}
              className="group absolute z-10 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-0 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring">
              <span className="relative block size-6 rounded-full border border-background/90 bg-foreground shadow-lg transition-transform group-hover:scale-110">
                <span className="absolute left-1/2 top-1/2 h-px w-2.5 -translate-x-1/2 -translate-y-1/2 bg-background" />
                <span className="absolute left-1/2 top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-background" />
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" sideOffset={2} onOpenAutoFocus={(event) => event.preventDefault()} className="pointer-events-none w-auto rounded-none border-border bg-background/95 px-3 py-1.5 font-body text-xs text-foreground shadow-sm">Shop this Look</PopoverContent>
        </Popover>
      </div>
      <div className="w-full px-5 pb-8 pt-6 md:px-8">
        <h2 className="mb-3 font-body text-[10px] uppercase text-muted-foreground">Curated alternatives</h2>
        <div className="grid grid-cols-3 gap-3 md:gap-5">
          {scene.pieces.map((piece, index) => (
            <div key={piece.src} className={cn("min-w-0 border-b-2 transition-colors", selected && index === scene.highlightIndex ? "border-primary" : "border-transparent")}>
              <div className="aspect-[4/3] overflow-hidden bg-muted"><img src={piece.src} alt={piece.alt} className="h-full w-full object-contain" /></div>
              <div className="py-2 font-body"><div className="text-xs font-semibold leading-snug text-foreground">{piece.name}</div><div className="text-[11px] leading-snug text-muted-foreground">{piece.designer}</div></div>
            </div>
          ))}
        </div>
        <p className="mt-6 w-full text-justify font-body text-sm font-semibold leading-relaxed text-crimson-black">Leverage our elite global gallery network and high-end sourcing to elevate your portfolio.</p>
      </div>
    </section>
  );
}

/** Shop By Room: the original hotspot gallery canvas precedes the filtered catalogue. */
export default function RoomSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomParam = searchParams.get("room");
  const room = resolveRoomSlug(roomParam);
  const gridLanding = searchParams.get("view") === "grid";

  // Original head values captured at mount so unmount restores the
  // default gallery/homepage metadata (no leakage onto standard grids).
  const originalHead = useRef<Map<string, string | null> | null>(null);

  useEffect(() => {
    if (room && roomParam !== room) {
      const params = new URLSearchParams(searchParams);
      params.set("room", room);
      navigate(`/search?${params.toString()}`, { replace: true });
    }
  }, [navigate, room, roomParam, searchParams]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [room]);

  // Dynamic client-side SEO overrides — only while a roomSlug is active.
  useEffect(() => {
    const head = document.head;

    // Capture the pre-existing values exactly once per mount.
    if (!originalHead.current) {
      const captured = new Map<string, string | null>();
      captured.set("title", document.title);
      for (const tag of MANAGED_TAGS) {
        const el = head.querySelector<HTMLMetaElement>(`meta[${tag.attr}="${tag.key}"]`);
        captured.set(`${tag.attr}:${tag.key}`, el ? el.getAttribute("content") : null);
      }
      originalHead.current = captured;
    }

    if (!room) return;

    const universe = ROOM_UNIVERSES[room];
    const curated = ROOM_CURATED[room];
    const title = `${universe} | ${curated} | Maison Affluency`;
    // Drop the leading article so the sentence reads naturally.
    const universePhrase = universe.toLowerCase().replace(/^(an?|the)\s+/, "");
    const description = `Explore a fully curated ${universePhrase} designed for trade professionals. Source authentic collectible furniture, architectural seating, and premium centerpieces directly from our digital gallery portfolio.`;
    const roomUrl = `${SITE_ORIGIN}/search?room=${room}`;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", roomUrl);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);

    // Room vignette image — absolute URL for the share preview. Rooms without
    // a dedicated vignette keep the sitewide static og:image untouched.
    // Note: <link rel="canonical"> is owned by GlobalCanonical (pathname-based)
    // and is deliberately not touched here.
    const vignette = ROOM_VIGNETTES[room];
    if (vignette) {
      const absolute = new URL(vignette, window.location.origin).href;
      upsertMeta("property", "og:image", absolute);
      upsertMeta("name", "twitter:image", absolute);
    }
  }, [room]);

  // Revert to default gallery meta on unmount so metadata never leaks
  // onto standard collection grids.
  useEffect(() => {
    return () => {
      const captured = originalHead.current;
      if (!captured) return;
      document.title = captured.get("title") ?? DEFAULT_TITLE;
      const head = document.head;
      for (const tag of MANAGED_TAGS) {
        const key = `${tag.attr}:${tag.key}`;
        const original = captured.get(key);
        const el = head.querySelector<HTMLMetaElement>(`meta[${tag.attr}="${tag.key}"]`);
        if (!el) continue;
        if (original === null) {
          // We created it — remove it (matches the Helmet-only default state).
          el.remove();
        } else {
          el.setAttribute("content", original);
        }
      }
      // og:image / twitter:image: restore the static sitewide share image.
      for (const [attr, key] of [
        ["property", "og:image"],
        ["name", "twitter:image"],
      ] as const) {
        const el = head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
        if (el && !el.getAttribute("content")?.includes("res.cloudinary.com")) el.remove();
      }
      // og:url: restore the sitewide default.
      const ogUrl = head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
      if (ogUrl) ogUrl.setAttribute("content", `${SITE_ORIGIN}/`);
      // Canonical is owned by GlobalCanonical — never touched here.
      originalHead.current = null;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation alwaysVisible />
      <main className="min-h-[70vh] pt-[var(--header-h)]">
        {room ? (
          <>
            <div className="flex w-full flex-col md:flex-row">
              <RoomPageNavigation room={room} />
              <div className="min-w-0 flex-1">
                {!searchParams.get("category") && <>
                  <RoomCuration room={room} />
                  <InteractiveGalleryLookbook discoveryRoom={room} />
                </>}
                <ProductGrid roomSlug={room} roomCategory={gridLanding ? searchParams.get("category") : null} roomSubcategory={gridLanding ? searchParams.get("subcategory") : null} compactTop />
              </div>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-7xl px-6 py-20">
            <h1 className="font-display text-3xl text-foreground">Room not found</h1>
            <p className="mt-3 font-body text-sm text-muted-foreground">
              Choose a room from the menu to browse the collection.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
