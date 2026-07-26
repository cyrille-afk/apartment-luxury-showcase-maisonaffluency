/**
 * Editorial hover hero for the public /designers directory.
 *
 * 🔒 LOCKED LAYOUT — 2026-06-24
 * Mobile (browser), PWA (standalone) and Desktop layouts are user-approved.
 * Do NOT modify heights, paddings, line-heights, or the isStandalone branches
 * (h-[100lvh], h-[calc(100svh-var(--header-h))], pb-44, justify-end, leading
 * values, Directory bottom offsets) without explicit user approval.
 * Reference screenshots: /mnt/documents/designers-hero-lock/*.png
 *
 * Inspired by lacollections.fr: a vertical list of featured designer
 * names overlays a full-bleed background image that cross-fades on hover.
 * Names route to /designers/:slug. On desktop the whole hero responds to
 * wheel/trackpad; on mobile only the names list claims vertical swipes so
 * the rest of the hero remains free for page scrolling.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X, ImageIcon } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAllDesigners } from "@/hooks/useDesigner";
import { useIsMobile } from "@/hooks/use-mobile";
import { applyCuratorPickOrder } from "@/lib/curatorPickSort";
import { sortNameKey, lastNameInitial, displayDesignerName } from "@/lib/nameFormat";
import { cldResponsiveImg } from "@/lib/cloudinary";
import { isPwaStandaloneDisplay } from "@/lib/pwaMode";
import featuredDesignersSeed from "@/data/featuredDesigners.json";

interface FeaturedDesigner {
  id: string;
  slug: string;
  name: string;
  founder: string | null;
  hero_image_url: string | null;
  image_url: string | null;
  first_pick_image_url: string | null;
}

const DESIGNERS_AZ_LAST_LETTER_KEY = "designers_az_last_letter";

function rememberDesignersAzLetter(letter: string | null | undefined) {
  const safeLetter = letter?.trim().toUpperCase().slice(0, 1);
  if (!safeLetter || !/^[A-Z]$/.test(safeLetter)) return;
  try {
    sessionStorage.setItem(DESIGNERS_AZ_LAST_LETTER_KEY, safeLetter);
  } catch {}
}

const isCloudinaryUpload = (src: string | null | undefined) =>
  !!src && src.includes("res.cloudinary.com") && src.includes("/image/upload/");

const isSupabaseObject = (src: string | null | undefined) =>
  !!src && src.includes("/storage/v1/object/public/");

/**
 * Rewrite a Supabase public object URL to go through the image
 * transformation endpoint so mobile A–Z cards download a right-sized,
 * re-encoded image instead of the full original.
 */
function supabaseTransform(src: string, width: number, quality = 65): string {
  const rendered = src.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );
  const sep = rendered.includes("?") ? "&" : "?";
  return `${rendered}${sep}width=${width}&quality=${quality}&resize=cover`;
}

/**
 * Rectangular image transform for the mobile A–Z grid cards.
 * Serves a portrait-cropped, right-sized image for a 2-col card.
 */
function gridImageTransform(src: string | null | undefined, width = 600): string | undefined {
  if (!src) return undefined;
  if (isCloudinaryUpload(src)) {
    const h = Math.round((width * 4) / 3);
    return src.replace(
      "/image/upload/",
      `/image/upload/w_${width},h_${h},c_fill,g_auto,q_auto:eco,f_auto/`
    );
  }
  if (isSupabaseObject(src)) return supabaseTransform(src, width, 65);
  return src;
}

function gridImageSrcSet(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  if (!isCloudinaryUpload(src) && !isSupabaseObject(src)) return undefined;
  const a = gridImageTransform(src, 300);
  const b = gridImageTransform(src, 600);
  const c = gridImageTransform(src, 900);
  if (!a || !b || !c) return undefined;
  return `${a} 300w, ${b} 600w, ${c} 900w`;
}

/**
 * Low-quality image placeholder (LQIP): a 20px-wide blurred variant used as a
 * background so users see a soft color hint instead of a black card while the
 * full image is streaming in.
 */
function gridImageLqip(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  if (isCloudinaryUpload(src)) {
    return src.replace(
      "/image/upload/",
      "/image/upload/w_24,h_30,c_fill,g_auto,q_auto:low,e_blur:400,f_auto/"
    );
  }
  if (isSupabaseObject(src)) return supabaseTransform(src, 24, 30);
  return undefined;
}

/**
 * Choose the most reliable image for the mobile grid. Prefer the hero/work
 * photo when it is hosted on Cloudinary; otherwise fall back to a Cloudinary
 * image_url so we avoid broken external hotlinks on large cards.
 */
function pickGridImage(d: { first_pick_image_url?: string | null; hero_image_url: string | null; image_url: string | null }): string | null {
  if (isCloudinaryUpload(d.first_pick_image_url)) return d.first_pick_image_url!;
  if (d.first_pick_image_url) return d.first_pick_image_url;
  if (isCloudinaryUpload(d.hero_image_url)) return d.hero_image_url;
  if (isCloudinaryUpload(d.image_url)) return d.image_url;
  return d.hero_image_url || d.image_url;
}

/**
 * Mobile grid card: large rectangular photo of the designer's work with the
 * name overlaid at the bottom. Replaces the small circular-avatar list rows
 * for a more visual, touch-friendly A–Z browse.
 */
function DesignerGridCard({
  designer,
  onNavigate,
  priority = false,
}: {
  designer: { slug: string; name: string; first_pick_image_url?: string | null; hero_image_url: string | null; image_url: string | null };
  onNavigate?: () => void;
  priority?: boolean;
}) {
  // Base = first curator pick (approved mobile/PWA behavior). First tap only
  // reveals the product CTA pill; it must not swap the card photo.
  const baseRaw = designer.first_pick_image_url || designer.hero_image_url || designer.image_url || null;
  const hasProductPill = !!designer.first_pick_image_url;
  const url = gridImageTransform(baseRaw);
  const srcSet = gridImageSrcSet(baseRaw);
  const lqip = gridImageLqip(baseRaw);
  const displayName = displayDesignerName(designer.name);
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const rememberLetter = () => {
    rememberDesignersAzLetter(lastNameInitial(designer.name));
  };
  return (
    <Link
      to={hasProductPill && !revealed ? "#" : `/designers/${designer.slug}`}
      state={{ fromDesignersHero: true, fromDesignersAZ: true }}
      data-nav-state={JSON.stringify({ fromDesignersHero: true, fromDesignersAZ: true })}
      onClick={(e) => {
        // First tap reveals the product pill; second tap navigates.
        if (hasProductPill && !revealed) {
          e.preventDefault();
          e.stopPropagation();
          setRevealed(true);
          return;
        }
        rememberLetter();
        onNavigate?.();
      }}
      onTouchStart={() => { import("../pages/PublicDesignerProfile").catch(() => {}); }}
      onMouseEnter={() => { import("../pages/PublicDesignerProfile").catch(() => {}); }}
      className="group relative block w-full aspect-[4/5] rounded-xl overflow-hidden bg-neutral-800 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-gold/60"
      aria-label={`View ${displayName}`}
      style={
        lqip
          ? {
              backgroundImage: `url("${lqip}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Shimmering skeleton — visible until the image finishes loading */}
      {url && !loaded && (
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-neutral-800/60" />
          <div className="absolute inset-y-0 -left-1/2 w-1/2 animate-card-shimmer bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>
      )}
      {url ? (
        <img
          src={url}
          srcSet={srcSet}
          sizes="(max-width: 640px) 50vw, 300px"
          width={600}
          height={750}
          alt=""
          loading={priority ? "eager" : "lazy"}
          {...(priority ? { fetchpriority: "high" as any } : {})}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105",
            "transition-opacity",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-white/30">
          <ImageIcon className="h-8 w-8" aria-hidden />
        </span>
      )}
      {/* Bottom gradient for text legibility — strong enough to hold white serif over light imagery */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
      {/* "Discover the Product" pill — mobile/PWA, shown once the curator-pick photo is tapped */}
      {hasProductPill && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-3 bg-black/20 transition-opacity duration-300",
            revealed ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white font-body text-[9px] uppercase tracking-[0.15em]">
            Discover the Product
          </span>
        </div>
      )}
      {/* Name overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 z-20">
        <span className="block font-serif text-sm leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
          {displayName}
        </span>
      </div>
    </Link>
  );
}

const FEATURED_GROUPS = [
  {
    label: "Masters",
    slugs: [
      "alexander-lamont",
      "emmanuel-babled",
      "felix-agostini",
      "jean-michel-frank",
      "kiko-lopez",
      "lazzarini-pickering",
      "ozone",
      "pierre-bonnefille",
      "pierre-chareau",
      "thierry-lemaire",
      "tristan-auer",
    ].sort(),
  },
  {
    label: "Contemporary Talents",
    slugs: [
      "apparatus-studio",
      "atelier-demichelis",
      "christopher-boots",
      "delcourt-collection",
      "emmanuel-levet-stenne",
      "hamrei",
      "kerstens",
      "leo-aerts-alinea",
      "victoria-magniant",
    ].sort(),
  },
];

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  ozone: "Michel Boyer - Ozone",
};

const ALL_FEATURED_SLUGS = FEATURED_GROUPS.flatMap((g) => g.slugs);

// Build-time seed so the first hero image URL is available synchronously on
// module parse — avoids the Supabase round-trip blocking LCP on Slow-4G.
const FEATURED_SEED = (featuredDesignersSeed as FeaturedDesigner[]) || [];

function useFeaturedDesigners() {
  return useQuery({
    queryKey: queryKeys.designersHeroFeatured(ALL_FEATURED_SLUGS),
    // Stale-while-revalidate: paint from build-time seed immediately, then
    // silently refetch in the background. `initialDataUpdatedAt: 0` marks the
    // seed as already-stale so react-query kicks off a background refresh on
    // mount without blocking the first paint.
    staleTime: 1000 * 60 * 30,
    initialData: FEATURED_SEED.length ? FEATURED_SEED : undefined,
    initialDataUpdatedAt: 0,
    refetchOnWindowFocus: false,
    // Pin the first designer's hero image URL to the seed so the background
    // refetch cannot swap the LCP <img> src and trigger a second LCP paint.
    // Non-visual fields (ids, names, curator picks for later cards) still
    // update from the network.
    select: (data) => {
      if (!data || !FEATURED_SEED.length) return data;
      const seedBySlug = new Map(FEATURED_SEED.map((d) => [d.slug, d]));
      return data.map((d, i) => {
        const seed = seedBySlug.get(d.slug);
        if (!seed) return d;
        // Only pin the visible hero URLs for the first seeded designer — the
        // LCP element. Other cards can accept fresh URLs since they are
        // offscreen and won't be reported as LCP.
        if (i === 0 || seed.slug === FEATURED_SEED[0]?.slug) {
          return {
            ...d,
            hero_image_url: seed.hero_image_url ?? d.hero_image_url,
            image_url: seed.image_url ?? d.image_url,
          };
        }
        return d;
      });
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, name, founder, hero_image_url, image_url")
        .in("slug", ALL_FEATURED_SLUGS)
        .eq("is_published", true);
      if (error) throw error;

      const designers = ((data || []) as FeaturedDesigner[]).filter(
        (d) => d.hero_image_url || d.image_url
      );

      if (designers.length === 0) return [];

      const ids = designers.map((d) => d.id);
      const { data: picks, error: picksError } = await applyCuratorPickOrder(
        supabase
          .from("designer_curator_picks_public" as any)
          .select("designer_id, image_url")
          .in("designer_id", ids)
      );
      if (picksError) throw picksError;

      const firstPickByDesigner = new Map<string, string>();
      for (const row of (picks || []) as any[]) {
        const did = row.designer_id;
        if (!firstPickByDesigner.has(did) && row.image_url) {
          firstPickByDesigner.set(did, row.image_url);
        }
      }

      // Preserve seed ordering so the first painted card stays first after
      // revalidation — reordering would otherwise remount the LCP image.
      const seedOrder = new Map(ALL_FEATURED_SLUGS.map((s, i) => [s, i]));
      const ordered = designers.slice().sort(
        (a, b) => (seedOrder.get(a.slug) ?? 999) - (seedOrder.get(b.slug) ?? 999)
      );

      return ordered.map((d) => ({
        ...d,
        first_pick_image_url: firstPickByDesigner.get(d.id) || null,
      }));
    },
  });
}

// Fetches the first curator-pick image for every designer, keyed by designer id.
function useAllFirstPickImages() {
  return useQuery({
    queryKey: queryKeys.designersAllFirstPickImages(),
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await applyCuratorPickOrder(
        supabase
          .from("designer_curator_picks_public" as any)
          .select("designer_id, image_url")
      );
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data || []) as any[]) {
        if (!row?.designer_id || !row?.image_url) continue;
        if (!map.has(row.designer_id)) map.set(row.designer_id, row.image_url as string);
      }
      return map;
    },
  });
}

// Split a name into ["First", "Last"] for the italic-on-last typographic move.
function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ""];
  const last = parts.pop()!;
  return [parts.join(" "), last];
}

const SWIPE_THRESHOLD = 50;
const IMAGE_TRANSITION_MS = 3500;
const LOCK_MS = 1200;

const DesignersHoverHero = () => {
  const { data: designers } = useFeaturedDesigners();
  const { data: allDesigners = [] } = useAllDesigners();
  const { data: firstPickMap } = useAllFirstPickImages();
  const designerCount = useMemo(
    () => allDesigners.filter((d: any) => d.is_published).length,
    [allDesigners]
  );
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  
  const [isStandalone, setIsStandalone] = useState(() => isPwaStandaloneDisplay());
  const [showPortalCursor, setShowPortalCursor] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const restoredLetterRef = useRef<string | null>(null);
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const l = sessionStorage.getItem(DESIGNERS_AZ_LAST_LETTER_KEY);
        if (l) {
          restoredLetterRef.current = l;
          return new Set([l]);
        }
      } catch {}
    }
    return new Set(["A"]);
  });
  const [activeAccordionLetter, setActiveAccordionLetter] = useState<string | null>(
    () => restoredLetterRef.current
  );
  const [activeMobileLetter, setActiveMobileLetter] = useState<string | null>(() => restoredLetterRef.current);
  const [azDragging, setAzDragging] = useState(false);
  const [azMagnifier, setAzMagnifier] = useState<{ letter: string; y: number } | null>(null);
  const azTrackRef = useRef<HTMLElement | null>(null);
  const [azRailRect, setAzRailRect] = useState<{ top: number; height: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchScrollRef = useRef<HTMLDivElement>(null);
  const [isRestoringLetter, setIsRestoringLetter] = useState(false);
  const [restoredOnlyLetter, setRestoredOnlyLetter] = useState<string | null>(() => restoredLetterRef.current);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const directoryRef = useRef<HTMLDivElement>(null);
  const mastersRef = useRef<HTMLSpanElement>(null);
  const activeTitleRef = useRef<HTMLSpanElement>(null);
  const lastItemRef = useRef<HTMLLIElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; height: number } | null>(null);
  const [directoryTop, setDirectoryTop] = useState<number | null>(null);
  const [activeTitleTop, setActiveTitleTop] = useState<number | null>(null);

  // Auto-open "Find A Designer" sheet when arriving with ?find=1 (e.g. the
  // floating burger on a designer profile returns users to the search list
  // they came from rather than the landing hero).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestedLetter = params.get("letter")?.trim().toUpperCase().slice(0, 1);
    if (requestedLetter && /^[A-Z]$/.test(requestedLetter)) {
      restoredLetterRef.current = requestedLetter;
      setExpandedLetters(new Set([requestedLetter]));
      setActiveAccordionLetter(requestedLetter);
      setActiveMobileLetter(requestedLetter);
      rememberDesignersAzLetter(requestedLetter);
    }
    if (params.get("find") === "1") {
      setSearchOpen(true);
      // Clean the URL so a refresh doesn't keep re-opening it.
      params.delete("find");
      params.delete("letter");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
      );
    }
  }, []);


  const isMobileHook = useIsMobile();
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  const isMobileOrPwa = isMobileViewport || isMobileHook || isStandalone;
  const isMobileBrowser = (isMobileViewport || isMobileHook) && !isStandalone;
  const navRef = useRef<HTMLElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const handoffLockRef = useRef(false);
  const suppressNavClickRef = useRef(false);
  const portalRef = useRef<HTMLAnchorElement>(null);
  const portalCursorRef = useRef<HTMLDivElement>(null);
  const activeSlugRef = useRef<string | null>(null);
  useEffect(() => {
    activeSlugRef.current = activeSlug;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia?.("(display-mode: standalone)");
    const update = () => setIsStandalone(isPwaStandaloneDisplay());
    update();
    media?.addEventListener?.("change", update);
    return () => media?.removeEventListener?.("change", update);
  }, []);

  // Preserve the curated group membership but render each group alphabetically
  // by display name so a brand like "Alinea Design Objects" (slug leo-aerts-alinea)
  // sits under A, not L.
  const groupedItems = useMemo(() => {
    const bySlug = new Map((designers || []).map((d) => [d.slug, d]));
    return FEATURED_GROUPS.map((g) => ({
      ...g,
      designers: g.slugs
        .map((slug) => {
          const d = bySlug.get(slug);
          if (!d) return undefined;
          const override = DISPLAY_NAME_OVERRIDES[slug];
          return override ? { ...d, name: override } : d;
        })
        .filter((d): d is FeaturedDesigner => Boolean(d))
        .sort((a, b) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
        ) as FeaturedDesigner[],
    }));
  }, [designers]);

  const items = useMemo(
    () => groupedItems.flatMap((g) => g.designers),
    [groupedItems]
  );
  const hasItems = items.length > 0;

  // The locked mobile /designers landing can be restored from browser history
  // with its inner hero scroller midway down even when window.scrollY is 0.
  // Reset both the nested scrollers and the active hero image ONLY on initial
  // mount or when the route-level lock asks for a top reset — never in
  // response to `items` refetching mid-scroll (that caused the list to jump
  // back to the top while the user was scrolling Masters / Contemporary
  // Talents, which also skipped a name because activeSlug was forced back to
  // items[0]).
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMobileOrPwa) return;

    let userInteracted = false;
    const markUserInteracted = () => {
      userInteracted = true;
    };

    const resetHeroScroll = (force = false) => {
      if (userInteracted && !force) return;
      contentScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      searchScrollRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      const list = itemsRef.current;
      if (list.length > 0) setActiveSlug(list[0].slug);
    };
    const forceResetHeroScroll = () => resetHeroScroll(true);

    resetHeroScroll();
    const raf = window.requestAnimationFrame(() => resetHeroScroll());
    const timers = [80, 180, 360].map((ms) => window.setTimeout(() => resetHeroScroll(), ms));
    window.addEventListener("designersLandingResetScroll", forceResetHeroScroll);
    window.addEventListener("pageshow", forceResetHeroScroll);
    window.addEventListener("focus", forceResetHeroScroll);
    window.addEventListener("touchstart", markUserInteracted, { once: true, passive: true });
    window.addEventListener("pointerdown", markUserInteracted, { once: true, passive: true });
    window.addEventListener("wheel", markUserInteracted, { once: true, passive: true });
    window.addEventListener("keydown", markUserInteracted, { once: true });
    return () => {
      window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("designersLandingResetScroll", forceResetHeroScroll);
      window.removeEventListener("pageshow", forceResetHeroScroll);
      window.removeEventListener("focus", forceResetHeroScroll);
      window.removeEventListener("touchstart", markUserInteracted);
      window.removeEventListener("pointerdown", markUserInteracted);
      window.removeEventListener("wheel", markUserInteracted);
      window.removeEventListener("keydown", markUserInteracted);
    };
  }, [isMobileOrPwa]);

  // iOS Safari paints the bottom browser chrome from the document/body backdrop,
  // not always from fixed-position children. Mirror the active mobile hero image
  // onto the page fallback so the area behind the toolbar stays photographic.
  // PWA/standalone is intentionally excluded.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isMobileBrowser || !items.length) return;
    const activeDesigner = items.find((d) => d.slug === activeSlug) || items[0];
    const src = activeDesigner.first_pick_image_url || activeDesigner.hero_image_url || activeDesigner.image_url;
    if (!src) return;

    const { src: backgroundSrc } = cldResponsiveImg(src, {
      widths: [720, 960, 1280],
      sizes: "100vw",
    });
    if (!backgroundSrc) return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBgImage = html.style.backgroundImage;
    const previousHtmlBgSize = html.style.backgroundSize;
    const previousHtmlBgPosition = html.style.backgroundPosition;
    const previousHtmlBgRepeat = html.style.backgroundRepeat;
    const previousHtmlBgColor = html.style.backgroundColor;
    const previousBodyBgImage = body.style.backgroundImage;
    const previousBodyBgSize = body.style.backgroundSize;
    const previousBodyBgPosition = body.style.backgroundPosition;
    const previousBodyBgRepeat = body.style.backgroundRepeat;

    // Mirror the active hero image onto html + body so the iOS browser chrome
    // (URL bar, bottom toolbar) is painted photographically rather than as a
    // solid black band. Safe now because /designers locks body scroll
    // (position:fixed, overflow:hidden) — there is no scroll bleed to worry
    // about. #0a0a0a stays as fallback under the image.
    const bgUrl = `url("${backgroundSrc}")`;
    html.style.backgroundImage = bgUrl;
    html.style.backgroundSize = "cover";
    html.style.backgroundPosition = "center";
    html.style.backgroundRepeat = "no-repeat";
    html.style.backgroundColor = "#0a0a0a";
    body.style.backgroundImage = bgUrl;
    body.style.backgroundSize = "cover";
    body.style.backgroundPosition = "center";
    body.style.backgroundRepeat = "no-repeat";


    return () => {
      html.style.backgroundImage = previousHtmlBgImage;
      html.style.backgroundSize = previousHtmlBgSize;
      html.style.backgroundPosition = previousHtmlBgPosition;
      html.style.backgroundRepeat = previousHtmlBgRepeat;
      html.style.backgroundColor = previousHtmlBgColor;
      body.style.backgroundImage = previousBodyBgImage;
      body.style.backgroundSize = previousBodyBgSize;
      body.style.backgroundPosition = previousBodyBgPosition;
      body.style.backgroundRepeat = previousBodyBgRepeat;
    };
  }, [activeSlug, isMobileBrowser, items]);

  // Pre-seed active on first render once data arrives so the hero is never
  // a void on entry — the first designer acts as default.
  useEffect(() => {
    if (!activeSlug && items.length > 0) {
      setActiveSlug(items[0].slug);
    }
  }, [items, activeSlug]);

  // Hide the inlined static /designers hero (in index.html) once React has
  // committed this component — the DB-driven <img>s take over from here.
  useEffect(() => {
    const p = document.getElementById("static-designers-hero");
    const o = document.getElementById("static-designers-hero-overlay");
    if (p) p.style.display = "none";
    if (o) o.style.display = "none";
  }, []);


  // Preload the initial (items[0]) hero image as soon as the query resolves,
  // so it lands well before React commits the <img> — cuts LCP on Slow-4G by
  // starting the download in parallel with the JS chunk parse. Route-scoped
  // (injected only on /designers via this component), and cleaned up on unmount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!items.length) return;
    const d = items[0];
    const src = isMobileOrPwa
      ? (d.first_pick_image_url || d.hero_image_url || d.image_url)
      : (d.hero_image_url || d.image_url);
    if (!src) return;
    const widths = isMobileOrPwa ? [480, 720, 960, 1280] : [960, 1280, 1600, 1920];
    const { src: href, srcSet } = cldResponsiveImg(src, { widths, sizes: "100vw" });
    if (!href) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = href;
    if (srcSet) link.setAttribute("imagesrcset", srcSet);
    link.setAttribute("imagesizes", "100vw");
    link.setAttribute("fetchpriority", "high");
    link.dataset.designersHeroPreload = "1";
    // Preconnect is already declared sitewide in index.html, so we don't
    // duplicate it here.
    document.head.appendChild(link);
    return () => {
      link.parentNode?.removeChild(link);
    };
  }, [items, isMobileOrPwa]);

  // First-visit hover-hint: auto-cycle the first 3 designers on desktop so
  // users discover that names pair with photos. Fires once per browser,
  // gated by localStorage. Cancels on any user interaction with the list.
  const HINT_KEY = "designers-hover-hint-v1";
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!items.length) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    try {
      if (localStorage.getItem(HINT_KEY)) return;
    } catch { /* ignore */ }

    const nav = navRef.current;
    let cancelled = false;
    const timers: number[] = [];
    const preview = items.slice(0, Math.min(3, items.length));

    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      try { localStorage.setItem(HINT_KEY, "1"); } catch { /* ignore */ }
    };

    // Start after a short delay so the hero settles first.
    timers.push(window.setTimeout(() => {
      if (cancelled) return;
      preview.forEach((d, i) => {
        timers.push(window.setTimeout(() => {
          if (cancelled) return;
          setActiveSlug(d.slug);
        }, i * 1100));
      });
      // Persist that the hint has been shown after the cycle completes.
      timers.push(window.setTimeout(() => {
        try { localStorage.setItem(HINT_KEY, "1"); } catch { /* ignore */ }
      }, preview.length * 1100 + 200));
    }, 900));

    nav?.addEventListener("mouseenter", cancel, { once: true });
    nav?.addEventListener("wheel", cancel, { once: true, passive: true });
    window.addEventListener("keydown", cancel, { once: true });
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      nav?.removeEventListener("mouseenter", cancel);
      nav?.removeEventListener("wheel", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [items]);


  // Desktop: names list no longer hijacks the wheel — page scrolls natively
  // so the Directory below is reachable from anywhere on the hero, including
  // while the cursor is over the names column. Hover on a name still swaps
  // the background photo.

  // When the landing list is taller than the locked mobile/PWA viewport, let it
  // scroll natively and keep the background photo synced to the visible row.
  useEffect(() => {
    if (searchOpen || !isMobileOrPwa) return;
    const scroller = contentScrollRef.current;
    if (!scroller) return;

    const updateActiveFromScroll = () => {
      if (scroller.scrollHeight <= scroller.clientHeight + 2) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const targetY = scrollerRect.top + scrollerRect.height * 0.34;
      const links = Array.from(
        scroller.querySelectorAll<HTMLAnchorElement>("[data-featured-designer-slug]")
      );
      let bestSlug: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const link of links) {
        const rect = link.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const distance = Math.abs(center - targetY);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestSlug = link.dataset.featuredDesignerSlug ?? null;
        }
      }

      if (bestSlug) setActiveSlug((current) => (current === bestSlug ? current : bestSlug));
    };

    scroller.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    window.addEventListener("resize", updateActiveFromScroll);
    return () => {
      scroller.removeEventListener("scroll", updateActiveFromScroll);
      window.removeEventListener("resize", updateActiveFromScroll);
    };
  }, [isMobileOrPwa, searchOpen, items]);

  // Mobile/PWA: forward touch/wheel gestures anywhere on the hero (including
  // the featured photo area outside the list column) so the user can advance
  // through featured designers from anywhere on the hero — not only when their
  // finger is directly on the list. If the list is short enough that its inner
  // scroller has no overflow, we advance the active designer via the same
  // step-advance logic used by swipes on the list itself. At the last item,
  // an upward swipe/wheel hands off to page scroll so the Directory can be
  // reached from outside the list too.
  useEffect(() => {
    if (searchOpen || !isMobileOrPwa) return;
    if (!hasItems) return;
    const section = sectionRef.current;
    if (!section) return;

    const isInsideSearchSheet = (target: EventTarget | null) =>
      Boolean((target as HTMLElement | null)?.closest?.("#designers-search-sheet"));

    const isInsideContentScroller = (target: EventTarget | null) => {
      const scroller = contentScrollRef.current;
      return Boolean(scroller && target instanceof Node && scroller.contains(target));
    };

    const canUseNativeListScroll = () => {
      const scroller = contentScrollRef.current;
      return Boolean(scroller && scroller.scrollHeight > scroller.clientHeight + 2);
    };

    const advance = (dir: 1 | -1) => {
      setActiveSlug((current) => {
        const idx = items.findIndex((d) => d.slug === current);
        const base = idx === -1 ? 0 : idx;
        const nextIdx = Math.min(items.length - 1, Math.max(0, base + dir));
        return items[nextIdx].slug;
      });
    };

    const handoffToDirectory = () => {
      if (handoffLockRef.current) return;
      handoffLockRef.current = true;
      window.dispatchEvent(new Event("unlockDesignersScroll"));
      const scrollBelowHero = () => {
        const s = sectionRef.current;
        if (!s) return;
        const target = Math.max(0, s.getBoundingClientRect().bottom + window.scrollY - 1);
        window.scrollTo({ top: target, behavior: "smooth" });
      };
      window.requestAnimationFrame(() => {
        scrollBelowHero();
        window.setTimeout(scrollBelowHero, 120);
      });
      window.setTimeout(() => {
        handoffLockRef.current = false;
      }, 900);
    };

    let touchStartY: number | null = null;
    let touchLastY: number | null = null;
    let touchLock = false;
    let wheelLock = false;

    const stepFromDelta = (deltaY: number, prevent: () => void, isTouch: boolean) => {
      // If the inner list is scrollable, forward pixels rather than stepping.
      if (canUseNativeListScroll()) {
        const scroller = contentScrollRef.current;
        if (scroller) {
          scroller.scrollTop += deltaY;
          prevent();
        }
        return;
      }
      if (Math.abs(deltaY) < SWIPE_THRESHOLD) return;
      const idx = items.findIndex((d) => d.slug === activeSlugRef.current);
      const atLast = idx >= items.length - 1;
      const atFirst = idx <= 0;
      // At last item swiping/wheeling up: stop here on mobile/PWA. The mobile
      // landing has no card directory below the hero (see PublicDesigners),
      // so the previous handoff would scroll the window past the locked hero
      // and leave a white gap while pulling the list up under the fixed
      // header — visible as a "jump" when reaching Victoria Magniant.
      if (atLast && deltaY > 0) {
        prevent();
        return;
      }
      // At first item swiping down → hold the locked hero in place instead of
      // letting iOS rubber-band/lift the page.
      if (atFirst && deltaY < 0) {
        prevent();
        return;
      }
      if (isTouch ? touchLock : wheelLock) {
        prevent();
        return;
      }
      prevent();
      if (isTouch) touchLock = true;
      else wheelLock = true;
      advance(deltaY > 0 ? 1 : -1);
      window.setTimeout(() => {
        if (isTouch) touchLock = false;
        else wheelLock = false;
      }, 450);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (isInsideSearchSheet(e.target)) return;
      if (canUseNativeListScroll() && isInsideContentScroller(e.target)) return;
      touchStartY = e.touches[0]?.clientY ?? null;
      touchLastY = touchStartY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY === null) return;
      if (isInsideSearchSheet(e.target)) return;
      if (canUseNativeListScroll() && isInsideContentScroller(e.target)) return;
      const y = e.touches[0]?.clientY;
      if (y === undefined) return;
      touchLastY = y;
      const delta = touchStartY - y;
      // If overflow scroller exists, forward incremental pixels smoothly.
      if (canUseNativeListScroll()) {
        const scroller = contentScrollRef.current;
        if (scroller && Math.abs(delta) >= 1) {
          scroller.scrollTop += delta;
          touchStartY = y;
          if (e.cancelable) e.preventDefault();
        }
        return;
      }
      // Otherwise, step-advance on threshold and reset baseline.
      if (Math.abs(delta) >= SWIPE_THRESHOLD) {
        stepFromDelta(delta, () => { if (e.cancelable) e.preventDefault(); }, true);
        touchStartY = y;
      }
    };

    const onTouchEnd = () => {
      touchStartY = null;
      touchLastY = null;
    };

    const onWheel = (e: WheelEvent) => {
      if (isInsideSearchSheet(e.target)) return;
      if (canUseNativeListScroll() && isInsideContentScroller(e.target)) return;
      if (Math.abs(e.deltaY) < 1) return;
      stepFromDelta(e.deltaY, () => { if (e.cancelable) e.preventDefault(); }, false);
    };

    section.addEventListener("touchstart", onTouchStart, { passive: true });
    section.addEventListener("touchmove", onTouchMove, { passive: false });
    section.addEventListener("touchend", onTouchEnd, { passive: true });
    section.addEventListener("touchcancel", onTouchEnd, { passive: true });
    section.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      section.removeEventListener("touchstart", onTouchStart);
      section.removeEventListener("touchmove", onTouchMove);
      section.removeEventListener("touchend", onTouchEnd);
      section.removeEventListener("touchcancel", onTouchEnd);
      section.removeEventListener("wheel", onWheel);
    };
  }, [isMobileOrPwa, searchOpen, hasItems, items]);


  const isDesktopViewport = !isMobileViewport && !isMobileHook && !isStandalone;

  // Lock body scroll + ESC-to-close + autofocus while the search sheet is open.
  // The mobile sheet uses a standard <input type="text">, so the native
  // keyboard opens as usual — no custom keyboard.
  useEffect(() => {
    if (!searchOpen) return;
    const wasAlreadyHidden = document.body.style.overflow === "hidden";
    if (!wasAlreadyHidden) document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Delay focus so the slide-up animation is visible before the keyboard opens.
    const t = window.setTimeout(() => {
      if (!restoredLetterRef.current) searchInputRef.current?.focus();
    }, 220);
    return () => {
      // Only clear if we set it. Never restore a stale "hidden" captured from
      // PublicDesigners' body lock — that would pin the next page's scroll.
      if (!wasAlreadyHidden) document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [searchOpen, isDesktopViewport]);

  const { groupedResults, totalResults } = useMemo(() => {
    const list = (allDesigners as any[])
      .filter((d) => d.is_published && !d.trade_only)
      .map((d) => ({
        slug: d.slug as string,
        name: d.name as string,
        hero_image_url: (d.hero_image_url as string | null) ?? null,
        image_url: (d.image_url as string | null) ?? null,
        first_pick_image_url: firstPickMap?.get(d.id) ?? null,
      }));
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter((d) => d.name.toLowerCase().includes(q))
      : list;
    filtered.sort((a, b) => sortNameKey(a.name).localeCompare(sortNameKey(b.name)));
    const groups = new Map<string, typeof filtered>();
    for (const d of filtered) {
      const letter = lastNameInitial(d.name);
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(d);
    }
    const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    return { groupedResults: ordered, totalResults: filtered.length };
  }, [allDesigners, searchQuery, firstPickMap]);

  // Flat list for the mobile-first bottom sheet: fast visual scan, no A–Z index.
  const flatResults = useMemo(() => {
    const list = (allDesigners as any[])
      .filter((d) => d.is_published && !d.trade_only)
      .map((d) => ({ slug: d.slug as string, name: d.name as string }));
    const q = searchQuery.trim().toLowerCase();
    const filtered = q ? list.filter((d) => d.name.toLowerCase().includes(q)) : list;
    filtered.sort((a, b) => sortNameKey(a.name).localeCompare(sortNameKey(b.name)));
    return filtered;
  }, [allDesigners, searchQuery]);

  // Zero-state: curated "Featured Masters" from the hero groupings, sorted.
  const featuredMasters = useMemo(() => {
    const mastersSlugs = new Set(
      (FEATURED_GROUPS.find((g) => g.label === "Masters")?.slugs ?? [])
    );
    return (allDesigners as any[])
      .filter((d) => d.is_published && mastersSlugs.has(d.slug))
      .map((d) => ({ slug: d.slug as string, name: d.name as string }))
      .sort((a, b) => sortNameKey(a.name).localeCompare(sortNameKey(b.name)));
  }, [allDesigners]);

  const isSearching = searchQuery.trim().length > 0;

  

  // Reset accordion state only on close (open→closed). Preserves any letter
  // restored from the back-nav sessionStorage on initial mount.
  const prevSearchOpenRef = useRef(searchOpen);
  useEffect(() => {
    if (prevSearchOpenRef.current && !searchOpen) {
      setExpandedLetters(new Set(["A"]));
      setActiveAccordionLetter(null);
    }
    prevSearchOpenRef.current = searchOpen;
    if (!searchOpen) return;
    {
      // Warm the PublicDesignerProfile chunk as soon as the A-Z opens so tapping
      // a card doesn't flash the Suspense fallback (which reads visually like
      // the designers landing page while the JS chunk downloads).
      import("../pages/PublicDesignerProfile").catch(() => {});
      // If we're restoring from back-nav, scroll the sheet to the remembered letter.
      // The A-Z grid can render after the sheet opens, so retry until the row
      // exists instead of clearing the saved letter too early.
      const restored = restoredLetterRef.current;
      if (restored) {
        let cancelled = false;
        setRestoredOnlyLetter(restored);
        setActiveMobileLetter(restored);
        setIsRestoringLetter(true);
        const scrollToLetter = () => {
          if (cancelled) return false;
          const scroller = searchScrollRef.current;
          const row = scroller?.querySelector<HTMLElement>(
            `[data-designer-letter="${restored}"]`
          );
          if (row && scroller) {
            const top = Math.max(0, row.offsetTop - 4);
            const previousBehavior = scroller.style.scrollBehavior;
            scroller.style.scrollBehavior = "auto";
            scroller.scrollTop = top;
            void scroller.offsetHeight;
            scroller.style.scrollBehavior = previousBehavior;
            return Math.abs(scroller.scrollTop - top) < 2;
          }
          return false;
        };
        let attempts = 0;
        const retryScrollToLetter = () => {
          if (cancelled) return;
          if (scrollToLetter()) {
            // Do one more pass on next frame in case row height shifted, then reveal.
            requestAnimationFrame(() => {
              scrollToLetter();
              if (!cancelled) {
                setIsRestoringLetter(false);
              }
            });
            return;
          }
          attempts += 1;
          if (attempts < 40) window.setTimeout(retryScrollToLetter, 25);
          else {
            setIsRestoringLetter(false);
            setRestoredOnlyLetter(null);
          }
        };
        requestAnimationFrame(() => requestAnimationFrame(retryScrollToLetter));
        const failsafe = window.setTimeout(() => {
          setIsRestoringLetter(false);
        }, 1500);
        return () => {
          cancelled = true;
          window.clearTimeout(failsafe);
          setIsRestoringLetter(false);
        };
      }
    }
  }, [searchOpen, groupedResults.length]);


  // Desktop accordion: when a letter opens, move the sheet viewport so the
  // expanded designer list is visible instead of being cut off at the bottom.
  useEffect(() => {
    if (!searchOpen || !isDesktopViewport || !activeAccordionLetter) return;
    if (!expandedLetters.has(activeAccordionLetter)) return;

    const frame = window.requestAnimationFrame(() => {
      const scroller = searchScrollRef.current;
      const row = scroller?.querySelector<HTMLElement>(
        `[data-designer-letter="${activeAccordionLetter}"]`
      );
      if (!scroller || !row) return;

      const scrollerRect = scroller.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const topOffset = rowRect.top - scrollerRect.top;
      const bottomOverflow = rowRect.bottom - scrollerRect.bottom;

      if (rowRect.height >= scrollerRect.height) {
        scroller.scrollTo({ top: scroller.scrollTop + topOffset, behavior: "smooth" });
      } else if (bottomOverflow > 0) {
        scroller.scrollBy({ top: bottomOverflow + 12, behavior: "smooth" });
      } else if (topOffset < 0) {
        scroller.scrollBy({ top: topOffset - 12, behavior: "smooth" });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeAccordionLetter, expandedLetters, isDesktopViewport, searchOpen]);

  // Track which letter row is currently topmost in the mobile scroller so
  // the right-edge A–Z strip can highlight it (IntersectionObserver-style).
  useEffect(() => {
    if (!searchOpen || isSearching) return;
    const scroller = searchScrollRef.current;
    if (!scroller) return;
    const compute = () => {
      const rows = Array.from(
        scroller.querySelectorAll<HTMLElement>("[data-designer-letter]")
      ).filter((row) => row.offsetParent !== null); // skip hidden desktop rows on mobile
      if (!rows.length) return;
      const scrollerTop = scroller.getBoundingClientRect().top;
      let current = rows[0].dataset.designerLetter ?? null;
      for (const row of rows) {
        if (row.getBoundingClientRect().top - scrollerTop <= 8) {
          current = row.dataset.designerLetter ?? current;
        } else break;
      }
      setActiveMobileLetter((prev) => (prev === current ? prev : current));
    };
    compute();
    scroller.addEventListener("scroll", compute, { passive: true });
    return () => scroller.removeEventListener("scroll", compute);
  }, [searchOpen, isSearching, groupedResults]);

  // Sync mobile A–Z rail bounds to the search list container so the rail
  // matches the list height exactly (never overlapping the close X above).
  useEffect(() => {
    if (!searchOpen) {
      setAzRailRect(null);
      return;
    }
    const compute = () => {
      const scroller = searchScrollRef.current;
      if (!scroller) return;
      const r = scroller.getBoundingClientRect();
      setAzRailRect({ top: r.top, height: r.height });
    };
    compute();
    const raf = window.requestAnimationFrame(compute);
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, { passive: true });
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute);
    };
  }, [searchOpen, groupedResults]);

  // Keep Directory y-aligned with MASTERS.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const m = mastersRef.current;
      const s = sectionRef.current;
      const t = activeTitleRef.current;
      const l = lastItemRef.current;
      if (!m || !s) return;
      const mRect = m.getBoundingClientRect();
      const sRect = s.getBoundingClientRect();
      setDirectoryTop(mRect.top - sRect.top);
      // Baseline-align the right-side active title with the last featured
      // designer (Victoria Magniant): title.bottom = lastItem.bottom.
      if (l && t) {
        const lRect = l.getBoundingClientRect();
        const tH = t.getBoundingClientRect().height;
        setActiveTitleTop(lRect.bottom - sRect.top - tH);
      }
    };
    update();
    const t1 = window.setTimeout(update, 100);
    const t2 = window.setTimeout(update, 400);
    const onResize = () => update();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", update);
    };
  }, [hasItems, items.length]);

  // Desktop dropdown opens to the RIGHT of the Directory button so it never
  // overlaps or truncates the featured-designers list underneath.
  useEffect(() => {
    if (!searchOpen || !isDesktopViewport || !directoryRef.current) {
      if (searchOpen && !isDesktopViewport) setDropdownPos(null);
      return;
    }
    const update = () => {
      const rect = directoryRef.current!.getBoundingClientRect();
      const navRect = navRef.current?.getBoundingClientRect();
      const width = 380;
      const gap = 24;
      const navRight = navRect ? navRect.right : rect.right;
      let left = navRight + gap;
      const maxLeft = window.innerWidth - width - 16;
      if (left > maxLeft) left = maxLeft;
      // Anchor top to Directory header baseline so the dropdown opens inline
      // with the navigation group, not floating above or below it.
      const top = rect.top;
      const navBottom = navRect ? navRect.bottom : rect.bottom + 400;
      // Clamp height to the featured designers list so the dropdown never
      // extends beyond it.
      const height = Math.max(320, navBottom - top);
      setDropdownPos({
        left,
        top,
        height,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [searchOpen, isDesktopViewport]);

  if (!hasItems) return null;

  const directoryLabels = (
    className: string,
    ref?: React.Ref<HTMLDivElement>,
    align: "left" | "right" = "left"
  ) => (
    <div ref={ref} className={className}>
      <div className={cn("flex flex-col", align === "right" && "items-end")}>
        <span
          className={cn(
            "text-[9px] uppercase tracking-[0.3em] mb-1 font-body text-white",
            align === "right" && "text-right"
          )}
        >
          Directory <span className="text-white/70 normal-case tracking-normal">({designerCount || 95})</span>
        </span>

        <button
          type="button"
          onClick={() => {
            if (isDesktopViewport && directoryRef.current) {
              const rect = directoryRef.current.getBoundingClientRect();
              const navRect = navRef.current?.getBoundingClientRect();
              const width = 380;
              const gap = 24;
              const navRight = navRect ? navRect.right : rect.right;
              const navBottom = navRect ? navRect.bottom : rect.bottom + 400;
              const height = Math.max(320, navBottom - rect.top);
              setDropdownPos({
                left: Math.min(window.innerWidth - width - 16, navRight + gap),
                top: rect.top,
                height,
              });
            } else {
              setDropdownPos(null);
            }

            setSearchOpen(true);
          }}
          aria-expanded={searchOpen}
          aria-controls="designers-search-sheet"
          className={cn(
            "inline-flex items-center gap-2 text-xs font-body font-light italic text-white/85 hover:text-white underline-offset-4 hover:underline transition-colors",
            align === "left" && "text-left",
            align === "right" && "text-right flex-row-reverse justify-start"
          )}
        >
          <Search className="h-3.5 w-3.5 not-italic" aria-hidden="true" />
          Find A Designer
        </button>
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      id="designers-hover-hero"
      aria-label="Featured designers"
      onMouseLeave={() => {}}
      className={cn(
        "relative w-full bg-[#0a0a0a] text-foreground overflow-hidden touch-pan-y",
        isStandalone
          ? "h-[calc(var(--designers-landing-vh,100svh)-var(--header-h))] md:h-[calc(100svh-var(--header-h))] md:min-h-[640px]"
          : // Background frame uses 100lvh so dark hero always covers Safari's
            // toolbar-collapse zone (no white strip). Content frame inside is
            // constrained to 100svh so the Directory clears the iOS toolbar
            // when it is visible.
            "h-[calc(var(--designers-landing-vh,100lvh)-var(--header-h))] md:h-[calc(100svh-var(--header-h))]"
      )}
    >
      {/* Cross-fading background images */}
      <div className="absolute inset-0 z-0">
        {items.map((d, i) => {
          // Per-designer mobile/PWA background overrides. Keeps desktop hero art
          // intact while giving small-screen framing a hand-picked image.
          const MOBILE_BG_OVERRIDES: Record<string, string> = {
            "jean-michel-frank":
              "https://res.cloudinary.com/dif1oamtj/image/upload/v1777428180/JMF_1935_Round_Table__02_Portrait_BD_1_aozicg.jpg",
            "hamrei":
              "https://res.cloudinary.com/dif1oamtj/image/upload/v1784262044/Screenshot_2026-07-17_at_12.19.46_PM_fzvmvb.png",
          };
          const src = isMobileOrPwa
            ? MOBILE_BG_OVERRIDES[d.slug] || d.first_pick_image_url || d.hero_image_url || d.image_url
            : d.hero_image_url || d.image_url;
          if (!src) return null;
          const isActive = d.slug === activeSlug;
          const isFirst = i === 0;
          const heroImgProps = cldResponsiveImg(src, {
            widths: isMobileOrPwa ? [480, 720, 960, 1280] : [960, 1280, 1600, 1920],
            sizes: "100vw",
          });
          return (
            <img
              key={`${d.slug}-${isMobileOrPwa ? "cur" : "hero"}`}
              {...heroImgProps}
              alt=""
              aria-hidden="true"
              loading={isFirst ? "eager" : "lazy"}
              decoding={isFirst ? "sync" : "async"}
              {...(isFirst ? { fetchPriority: "high" as const } : {})}
              className={cn(
                "absolute left-0 w-full object-cover transition-opacity ease-out",
                // Mobile/PWA sources are typically square. With `h-full` and a
                // portrait container, object-cover produces horizontal overflow
                // only, so `object-position` cannot lift the subject vertically.
                // Give the image ~18% extra height (top-anchored) so cover-fit
                // creates real vertical overflow at the bottom and the subject
                // is lifted up into the visible frame without heavy zoom.
                isMobileOrPwa
                  ? isStandalone
                    ? "top-[-7rem] left-0 h-[calc(118%+7rem)] object-top md:top-0 md:h-full md:object-center"
                    : "top-[-7rem] left-0 h-[calc(118%+7rem)] object-top md:top-0 md:h-full md:object-center"
                  : "inset-0 h-full",
                isActive ? "opacity-100" : "opacity-0"
              )}
              style={{ transitionDuration: `${IMAGE_TRANSITION_MS}ms` }}
            />
          );
        })}
        {/* Readability overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/30 md:from-black/60 md:via-black/30 md:to-black/5" />
        {/* Vignette overlay — deepens edges behind text so headings and
            names stay legible over dark, textured furniture imagery. */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)] pointer-events-none" />
        {/* Desktop left column backdrop — dedicates the left portion of the hero to
            a solid dark panel so the designer list never overlaps furniture
            imagery on the right. */}
        <div className="hidden md:block absolute inset-y-0 left-0 w-[38%] bg-gradient-to-r from-black via-black/90 to-transparent pointer-events-none" />
      </div>


      {/* Safe content frame — on mobile browser it tracks 100svh (toolbar-visible
          viewport) so list + directory always sit above iOS bottom chrome.
          PWA/desktop keep using the full section height. */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-20 pointer-events-none",
          // Mobile browser: frame height = visible viewport minus the fixed
          // header, so its bottom aligns with the iOS toolbar top (svh excludes
          // the toolbar). Desktop/PWA: full section height.
          isStandalone ? "h-full" : "h-[calc(var(--designers-landing-vh,100svh)-var(--header-h))] md:h-full"
        )}
      >

        {/* Content */}
        <div
          ref={contentScrollRef}
          className={cn(
          "relative flex flex-col h-full px-6 sm:px-12 md:px-20 lg:px-28 pointer-events-auto overflow-hidden md:overflow-visible",
            isStandalone
              ? "justify-start overscroll-contain touch-pan-y pt-8 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pt-8 md:pb-0 md:justify-center [-webkit-overflow-scrolling:touch]"
              : // Mobile browser: the section already starts below the fixed
                // header, so do not add var(--header-h) again here. Keep the
                // designer list high while leaving room for the Directory link.
                "justify-start overscroll-contain touch-pan-y pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pt-8 md:justify-center md:pb-0 [-webkit-overflow-scrolling:touch]"
          )}
        >

          <div className="w-full max-w-xs sm:max-w-sm md:max-w-md">
            <div className="relative inline-block">
              {/* Desktop: Directory sits directly above the designer list to
                  group navigation (list) with its utility (search) — Proximity.
                  All items share the same left edge as the designer names. */}
              <div className={cn("mb-5 lg:mb-6", isMobileBrowser ? "block md:hidden" : "hidden md:block")}>
                {directoryLabels("w-fit", directoryRef, "left")}
              </div>


              <nav
                ref={navRef}
                aria-label="Featured designers shortcut list"
                onClickCapture={(event) => {
                  if (!suppressNavClickRef.current) return;
                  event.preventDefault();
                  event.stopPropagation();
                  suppressNavClickRef.current = false;
                }}
                className={cn(
                  "relative inline-block select-none",
                  isMobileOrPwa ? "touch-pan-y" : "touch-none"
                )}
              >
              <ul className="flex flex-col text-left">
                {groupedItems.map((group, groupIdx) => (
                  <li
                    key={group.label}
                    className={cn(
                      "flex flex-col text-left",
                      groupIdx > 0 && "mt-3 md:mt-6"
                    )}
                  >
                    <span
                      ref={groupIdx === 0 ? mastersRef : undefined}
                      className="inline-flex items-center gap-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.32em] font-body font-bold text-gold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] mb-1 md:mb-3"
                    >
                      {group.label}
                    </span>
                    <ul className="flex flex-col gap-1 text-left">
                      {group.designers.map((d, dIdx) => {
                        const [first, last] = splitName(d.name);
                        const isActive = d.slug === activeSlug;
                        const isDimmed = activeSlug !== null && !isActive;
                        const HIDE_FOUNDER_SUFFIX = new Set(["Man of Parts", "Pouenat", "Ozone"]);
                        const childBrand = d.founder && d.founder !== d.name && !HIDE_FOUNDER_SUFFIX.has(d.founder);
                        const isLastItem =
                          groupIdx === groupedItems.length - 1 &&
                          dIdx === group.designers.length - 1;
                        return (
                          <li
                            key={d.slug}
                            ref={isLastItem ? lastItemRef : undefined}
                            className="text-left leading-[1.4] sm:leading-[1.55]"
                          >
                            <Link
                              to={`/designers/${d.slug}`}
                              data-featured-designer-slug={d.slug}
                              state={{ fromDesignersHero: true }}
                              data-nav-state={JSON.stringify({ fromDesignersHero: true })}
                              onMouseEnter={() => {
                                setActiveSlug(d.slug);
                              }}
                              onFocus={() => setActiveSlug(d.slug)}
                              className={cn(
                                "inline-block whitespace-nowrap relative",
                                "text-[13px] sm:text-sm md:text-[20px] leading-[1.4] sm:leading-[1.55]",
                                "font-display font-light tracking-normal",
                                "transition-all duration-[1200ms] ease-out",
                                "drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]",
                                isDimmed
                                  ? "text-cream/90"
                                  : "font-bold text-cream after:content-[''] after:absolute after:left-0 after:bottom-[-5px] after:h-[1px] after:w-8 after:bg-cream/40"
                              )}
                            >
                              <span>
                                {first}
                                {last && (
                                  <span>
                                    {" "}
                                    {last}
                                  </span>
                                )}
                                {childBrand && (
                                  <span className="opacity-80"> - {d.founder}</span>
                                )}
                                {/* Discovery cue: tiny aperture glyph hinting each name has a photo.
                                    Shown on every viewport; faint by default, brightens when active. */}
                                <ImageIcon
                                  aria-hidden="true"
                                  strokeWidth={1.25}
                                  className={cn(
                                    "inline-block align-middle ml-2 -translate-y-[1px]",
                                    "h-[10px] w-[10px] transition-all duration-500",
                                    isActive
                                      ? "opacity-90 text-gold"
                                      : "opacity-30 text-cream/80 md:group-hover:opacity-70"
                                  )}
                                />
                              </span>
                            </Link>

                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </nav>
            </div>
          </div>
        </div>

        {/* Directory label — pinned to the svh frame bottom on mobile only.
            Desktop version now lives at the top of the featured list. */}
        {isStandalone && directoryLabels(cn(
          "absolute flex items-center gap-10 text-white w-fit pointer-events-auto md:hidden z-30 left-1/2 -translate-x-1/2 justify-center px-6 bottom-[calc(1.75rem+env(safe-area-inset-bottom))]"
        ))}


        {/* Mobile/PWA scroll hint — quiet mouse icon above the directory, right-justified.
            Anchored inside the svh safe frame so it clears Safari's bottom toolbar. */}
        {isMobileOrPwa && (
          <div
            className={cn(
              "absolute right-6 sm:right-12 z-20 flex flex-col items-center gap-2 pointer-events-none md:hidden",
              isStandalone
                ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
                : "bottom-[calc(4rem+env(safe-area-inset-bottom))]"
            )}
          >
            <style>{`
              @keyframes scroll-reveal {
                0%   { clip-path: inset(0 0 100% 0); opacity: 0.4; }
                40%  { clip-path: inset(0 0 0 0);   opacity: 1;   }
                80%  { clip-path: inset(0 0 0 0);   opacity: 1;   }
                100% { clip-path: inset(0 0 100% 0); opacity: 0.4; }
              }
              @keyframes scroll-dot {
                0%   { transform: translateY(0);   opacity: 0.2; }
                40%  { transform: translateY(9px); opacity: 1;   }
                80%  { transform: translateY(9px); opacity: 1;   }
                100% { transform: translateY(0);   opacity: 0.2; }
              }
            `}</style>
            <svg
              width="22"
              height="34"
              viewBox="0 0 20 32"
              fill="none"
              aria-hidden="true"
              className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            >
              {/* Faint base outline */}
              <rect x="1" y="1" width="18" height="30" rx="9" stroke="rgba(255,255,255,0.35)" strokeWidth="1.75" />
              {/* Bright outline that wipes in from top to bottom */}
              <rect
                x="1"
                y="1"
                width="18"
                height="30"
                rx="9"
                stroke="rgba(255,255,255,0.95)"
                strokeWidth="1.75"
                fill="none"
                style={{ animation: "scroll-reveal 2s ease-in-out infinite" }}
              />
              {/* Dot descending inside */}
              <circle
                cx="10"
                cy="8"
                r="1.6"
                fill="rgba(255,255,255,0.95)"
                style={{ animation: "scroll-dot 2s ease-in-out infinite" }}
              />
            </svg>
            <span className="font-serif text-[10px] uppercase tracking-[0.35em] text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
              Scroll
            </span>
          </div>
        )}
      </div>



      {/* Active designer portal — the entire right half of the hero is a
          clickable link to the active designer's profile. Caption sits in the
          bottom-right corner and animates in response to hovering anywhere
          across this region (group). */}
      {(() => {
        const active = items.find((d) => d.slug === activeSlug);
        if (!active) return null;
        const [first, last] = splitName(active.name);

        const handlePortalMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
          if (!portalRef.current || !portalCursorRef.current) return;
          const rect = portalRef.current.getBoundingClientRect();
          portalCursorRef.current.style.left = `${e.clientX - rect.left}px`;
          portalCursorRef.current.style.top = `${e.clientY - rect.top}px`;
        };

        return (
          <>
            {/* Profile portal — the right-half image area shows a kinetic
                "View Profile" cursor and links to the active designer. */}
            <Link
              key={`${active.slug}-portal`}
              ref={portalRef}
              to={`/designers/${active.slug}`}
              state={{ fromDesignersHero: true }}
              data-nav-state={JSON.stringify({ fromDesignersHero: true })}
              aria-label={`View ${active.name}'s profile`}
              className="hidden md:block absolute right-0 top-0 h-full w-1/2 z-30 pointer-events-auto group"
              style={{ cursor: "none" }}
              onMouseEnter={() => setShowPortalCursor(true)}
              onMouseLeave={() => setShowPortalCursor(false)}
              onMouseMove={handlePortalMove}
            >
              {/* Kinetic editorial cursor — a glass-blur disc that follows the
                  mouse over the right-half portal, replacing the previous large
                  VIEW button cursor. */}
              <div
                ref={portalCursorRef}
                className={cn(
                  "absolute pointer-events-none z-50 transition-opacity duration-300 ease-out",
                  showPortalCursor ? "opacity-100" : "opacity-0"
                )}
                style={{ transform: "translate(-50%, -50%)" }}
              >
                <div className="relative w-20 h-20 rounded-full bg-black/25 backdrop-blur-md border border-white/15 flex flex-col items-center justify-center shadow-2xl transition-transform duration-500 ease-out scale-[0.72] group-hover:scale-100">
                  <div className="absolute inset-1.5 rounded-full border border-dashed border-white/10 animate-[spin_20s_linear_infinite]" />
                  <span className="font-serif italic text-white text-[11px] tracking-[0.2em]">View</span>
                  <div className="w-5 h-px bg-white/40 my-1" />
                  <span className="text-white/40 text-[7px] uppercase tracking-[0.3em] font-body">Profile</span>
                </div>
              </div>
            </Link>

            {/* Caption / CTA — rendered as a separate, higher-stacked link so
                hovering the bottom-right CTA shows the normal cursor and can be
                clicked independently of the profile portal. */}
            <Link
              key={`${active.slug}-cta`}
              to={`/designers/${active.slug}`}
              state={{ fromDesignersHero: true }}
              data-nav-state={JSON.stringify({ fromDesignersHero: true })}
              aria-label={`View ${active.name}'s full collection`}
              className="hidden md:block absolute right-20 lg:right-40 z-40 pointer-events-auto cursor-pointer group"
              style={activeTitleTop != null ? { top: activeTitleTop } : { bottom: 96 }}
            >
              <div className="flex flex-col items-end text-right text-white">
                <span
                  ref={activeTitleRef}
                  key={`${active.slug}-title`}
                  className="font-display font-light tracking-tight text-2xl lg:text-3xl leading-[1.5] animate-in fade-in duration-700"
                >
                  {first}
                  {last && <span className="italic"> {last}</span>}
                </span>
                <span
                  key={`${active.slug}-cta`}
                  className="mt-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] font-body font-medium text-white/70 group-hover:text-white underline decoration-white/40 underline-offset-4 group-hover:decoration-white/80 transition-colors animate-in fade-in duration-1000 delay-200 fill-mode-both"
                >
                  <span>Click to view full collection</span>
                  {/* Arrow reveals + slides on hover */}
                  <span
                    aria-hidden="true"
                    className="inline-block translate-x-[-4px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 ease-out"
                  >
                    →
                  </span>
                </span>
              </div>
            </Link>
          </>
        );
      })()}






      {/* Designer search: mobile bottom-sheet, desktop dropdown beside the
          Directory button. */}
      {searchOpen && (
        <>
          <div
            key="designers-search-backdrop"
            onClick={() => setSearchOpen(false)}
            className="fixed left-0 right-0 bottom-0 top-20 z-[70] animate-fade-in"
            style={{ animationDuration: "200ms" }}
            aria-hidden="true"
          />
          <div
            key="designers-search-sheet"
            id="designers-search-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Browse designers A to Z"
            className={cn(
              "fixed z-[71] flex flex-col bg-[#0a0a0a] text-white border border-white/10 shadow-2xl overflow-hidden",
              // Enter animation — dropped exit for critical-path perf.
              isDesktopViewport ? "animate-scale-in" : "animate-slide-in-right",
              // Mobile: full sheet anchored right below the fixed header so the
              // search field is immediately visible and the list has room to scroll.
              "inset-x-0 top-[var(--header-h)] bottom-0 rounded-none pb-[env(safe-area-inset-bottom)]",
              // Desktop: dropdown anchored to the Directory button via inline styles.
              "md:inset-x-auto md:right-auto md:top-auto md:bottom-auto md:w-[380px] md:max-w-[calc(100vw-2rem)] md:max-h-[calc(100vh-var(--header-h)-3rem)] md:rounded-xl md:pb-0"
            )}
            style={
              dropdownPos
                ? {
                    left: dropdownPos.left,
                    top: dropdownPos.top,
                    height: isDesktopViewport ? dropdownPos.height : undefined,
                    maxHeight: isDesktopViewport ? dropdownPos.height : undefined,
                  }
                : undefined
            }
          >
            <div className="mx-auto mt-1.5 h-1 w-9 rounded-full bg-white/25 shrink-0" aria-hidden="true" />
            <div className="flex items-center gap-2.5 px-4 pt-2 pb-3 border-b border-white/10 shrink-0 mb-2">
              <Search className="h-4 w-4 text-white/60 shrink-0" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${designerCount || totalResults} designers…`}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="flex-1 bg-transparent border-0 outline-none font-body text-sm text-white placeholder:text-white/40"
                aria-label="Search designers"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
                className="p-1 text-white/60 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Sticky horizontal A–Z quick-jump (mobile only, hidden while searching) */}
            {!isSearching && (
              <div className="md:hidden shrink-0 border-b border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur mb-3">
                <div
                  className={cn(
                    "flex items-center gap-0.5 overflow-x-auto no-scrollbar px-3 py-1.5 transition-opacity duration-150",
                    isRestoringLetter ? "opacity-0" : "opacity-100"
                  )}
                  style={{ scrollbarWidth: "none" }}
                >
                  {groupedResults.map(([letter]) => {
                    const isActive = activeMobileLetter === letter;
                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => {
                          rememberDesignersAzLetter(letter);
                          setRestoredOnlyLetter(null);
                          setExpandedLetters(new Set([letter]));
                          setActiveAccordionLetter(letter);
                          requestAnimationFrame(() => {
                            const row = searchScrollRef.current?.querySelector<HTMLElement>(
                              `[data-designer-letter="${letter}"]`
                            );
                            const scroller = searchScrollRef.current;
                            if (row && scroller) {
                              const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 4;
                              scroller.scrollTo({ top, behavior: "smooth" });
                            }
                          });
                        }}
                        className={cn(
                          "shrink-0 w-7 h-7 flex items-center justify-center rounded-full font-serif text-[13px] transition-colors",
                          isActive ? "bg-white text-black" : "text-white/70 hover:text-white"
                        )}
                        aria-label={`Jump to ${letter}`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div ref={searchScrollRef} className={`flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4 min-h-0 relative touch-pan-y transition-opacity duration-150 ${isRestoringLetter ? "opacity-0" : "opacity-100"}`}>

              {!isSearching && groupedResults.length === 0 ? (
                <div className="px-4 py-10 flex flex-col items-center gap-3" aria-live="polite">
                  <div className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" aria-hidden="true" />
                  <p className="text-xs font-body text-white/50 uppercase tracking-[0.2em]">Loading directory…</p>
                  <div className="grid grid-cols-2 gap-3 w-full mt-4 md:hidden">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="aspect-[4/5] rounded-xl bg-white/[0.04] animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : isSearching && groupedResults.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm font-body text-white/50">
                  No designers match “{searchQuery}”.
                </p>
              ) : (
                <>
                  {/* Mobile: grouped designer grid with sticky letter headers */}
                  <div className="md:hidden">
                    <div className="flex flex-col pb-2">
                      {isSearching ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-4 px-0 pt-2 pb-4">
                          {groupedResults.flatMap(([, items]) => items).map((d: any) => (
                            <DesignerGridCard
                              key={d.slug}
                              designer={d}
                              onNavigate={() => setSearchOpen(false)}
                            />
                          ))}
                        </div>
                      ) : (
                        (restoredOnlyLetter ? groupedResults.filter(([letter]) => letter === restoredOnlyLetter) : groupedResults).map(([letter, items], letterIdx) => {
                          const isOpen = expandedLetters.has(letter);
                          return (
                            <div
                              key={letter}
                              data-designer-letter={letter}
                              className="border-b border-white/[0.06] last:border-b-0"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  let willOpen = false;
                                  setExpandedLetters((prev) => {
                                    if (prev.has(letter)) {
                                      if (activeAccordionLetter === letter) setActiveAccordionLetter(null);
                                      return new Set();
                                    }
                                    setActiveAccordionLetter(letter);
                                    rememberDesignersAzLetter(letter);
                                    willOpen = true;
                                    return new Set([letter]);
                                  });
                                  if (willOpen) {
                                    // Preload the letter's card images immediately so the
                                    // browser starts fetching before React paints the grid.
                                    // Also prefetch the previous/next letters' images at
                                    // lower priority so navigating between letters feels
                                    // instant.
                                    try {
                                      const preloadItems = (arr: any[], eager: boolean) => {
                                        for (const d of arr) {
                                          const raw = pickGridImage(d);
                                          const u = gridImageTransform(raw, 600);
                                          if (!u) continue;
                                          const img = new Image();
                                          img.decoding = "async";
                                          if (!eager) (img as any).fetchPriority = "low";
                                          img.src = u;
                                        }
                                      };
                                      preloadItems(items as any[], true);
                                      const prev = groupedResults[letterIdx - 1];
                                      const next = groupedResults[letterIdx + 1];
                                      if (prev) preloadItems(prev[1] as any[], false);
                                      if (next) preloadItems(next[1] as any[], false);
                                    } catch {}
                                    requestAnimationFrame(() => {
                                      const scroller = searchScrollRef.current;
                                      const row = scroller?.querySelector<HTMLElement>(
                                        `[data-designer-letter="${letter}"]`
                                      );
                                      if (row && scroller) {
                                        const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 4;
                                        scroller.scrollTo({ top, behavior: "smooth" });
                                      }
                                    });
                                  }
                                }}
                                aria-expanded={isOpen}
                                className="w-full flex items-center justify-between px-4 py-1.5 text-left hover:bg-white/[0.04] transition-colors"
                              >
                                <span className="flex items-center gap-2.5">
                                  <span
                                    className={cn(
                                      "text-white/50 text-xs transition-transform",
                                      isOpen && "rotate-90"
                                    )}
                                    aria-hidden="true"
                                  >
                                    ›
                                  </span>
                                  <span className="font-serif text-base text-white">{letter}</span>
                                </span>
                                <span className="font-body text-[11px] tracking-wide text-white/45 pl-3">{items.length}</span>
                              </button>
                              {isOpen && (
                                <div className="grid grid-cols-2 gap-x-3 gap-y-4 px-0 pt-2 pb-4">
                                  {items.map((d: any, i: number) => (
                                    <DesignerGridCard
                                      key={d.slug}
                                      designer={d}
                                      priority={i < 4}
                                      onNavigate={() => setSearchOpen(false)}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Desktop: A–Z accordion with counts, expandable per letter */}
                  <ul className="hidden md:flex flex-col pt-0 pb-1">
                    {isSearching ? (
                      flatResults.length === 0 ? (
                        <li className="px-4 py-8 text-center text-sm font-body text-white/50">
                          No designers match “{searchQuery}”.
                        </li>
                      ) : (
                        flatResults.map((d) => (
                          <li key={d.slug}>
                            <Link
                              to={`/designers/${d.slug}`}
                              state={{ fromDesignersHero: true, fromDesignersAZ: true }}
                              data-nav-state={JSON.stringify({ fromDesignersHero: true, fromDesignersAZ: true })}
                              onClick={() => {
                                rememberDesignersAzLetter(lastNameInitial(d.name));
                                setSearchOpen(false);
                              }}
                              className="block px-5 py-2 font-body text-[14px] text-white/80 hover:text-white hover:bg-white/[0.04] transition-colors"
                            >
                              {displayDesignerName(d.name)}
                            </Link>
                          </li>
                        ))
                      )
                    ) : (
                      groupedResults.map(([letter, items]) => {
                        const isOpen = expandedLetters.has(letter);
                        return (
                          <li
                            key={letter}
                            data-designer-letter={letter}
                            className="border-b border-white/[0.06] last:border-b-0 scroll-mt-2"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                let willOpen = false;
                                setExpandedLetters((prev) => {
                                  if (prev.has(letter)) {
                                    if (activeAccordionLetter === letter) setActiveAccordionLetter(null);
                                    return new Set();
                                  }
                                  setActiveAccordionLetter(letter);
                                  rememberDesignersAzLetter(letter);
                                  willOpen = true;
                                  return new Set([letter]);
                                });
                                if (willOpen) {
                                  requestAnimationFrame(() => {
                                    const scroller = searchScrollRef.current;
                                    const row = scroller?.querySelector<HTMLElement>(
                                      `[data-designer-letter="${letter}"]`
                                    );
                                    if (row && scroller) {
                                      const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 4;
                                      scroller.scrollTo({ top, behavior: "smooth" });
                                    }
                                  });
                                }
                              }}
                              aria-expanded={isOpen}
                              className="w-full flex items-center justify-between px-5 py-2 text-left hover:bg-white/[0.04] transition-colors"
                            >
                              <span className="flex items-center gap-3">
                                <span
                                  className={cn(
                                    "text-white/50 text-xs transition-transform",
                                    isOpen && "rotate-90"
                                  )}
                                  aria-hidden="true"
                                >
                                  ›
                                </span>
                                <span className="font-serif text-lg text-white">{letter}</span>
                              </span>
                              <span className="font-body text-xs text-white/50">{items.length}</span>
                            </button>
                            {isOpen && (
                              <ul className="flex flex-col pb-2">
                                {items.map((d) => (
                                  <li key={d.slug}>
                                    <Link
                                      to={`/designers/${d.slug}`}
                                      state={{ fromDesignersHero: true, fromDesignersAZ: true }}
                                      data-nav-state={JSON.stringify({ fromDesignersHero: true, fromDesignersAZ: true })}
                                      onClick={() => {
                                        rememberDesignersAzLetter(lastNameInitial(d.name));
                                        setSearchOpen(false);
                                      }}
                                      className="block pl-12 pr-5 py-1.5 font-body text-[14px] text-white/80 hover:text-white hover:bg-white/[0.04] transition-colors"
                                    >
                                      {displayDesignerName(d.name)}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })
                    )}
                  </ul>
                </>
              )}
            </div>







          </div>
        </>
      )}
    </section>
  );
};

export default DesignersHoverHero;
