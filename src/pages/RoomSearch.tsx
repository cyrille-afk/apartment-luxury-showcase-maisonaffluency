import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ProductGrid from "@/components/ProductGrid";
import InteractiveGalleryLookbook from "@/components/InteractiveGalleryLookbook";
import { resolveRoomSlug, ROOM_LABELS, type RoomSlug } from "@/lib/roomCategories";

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

/** Shop By Room: the original hotspot gallery canvas precedes the filtered catalogue. */
export default function RoomSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomParam = searchParams.get("room");
  const room = resolveRoomSlug(roomParam);
  const roomLabel = room ? ROOM_LABELS[room] : "Room not found";

  // Original head values captured at mount so unmount restores the
  // default gallery/homepage metadata (no leakage onto standard grids).
  const originalHead = useRef<Map<string, string | null> | null>(null);

  useEffect(() => {
    if (room && roomParam !== room) navigate(`/search?room=${room}`, { replace: true });
  }, [navigate, room, roomParam]);

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
            <InteractiveGalleryLookbook discoveryRoom={room} />
            <ProductGrid roomSlug={room} />
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
