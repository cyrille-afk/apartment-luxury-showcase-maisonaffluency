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
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAllDesigners } from "@/hooks/useDesigner";
import { useIsMobile } from "@/hooks/use-mobile";
import { applyCuratorPickOrder } from "@/lib/curatorPickSort";
import { sortNameKey, lastNameInitial, displayDesignerName } from "@/lib/nameFormat";

interface FeaturedDesigner {
  id: string;
  slug: string;
  name: string;
  founder: string | null;
  hero_image_url: string | null;
  image_url: string | null;
  first_pick_image_url: string | null;
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

const ALL_FEATURED_SLUGS = FEATURED_GROUPS.flatMap((g) => g.slugs);

function useFeaturedDesigners() {
  return useQuery({
    queryKey: ["designers-hero-featured-v3", ALL_FEATURED_SLUGS],
    staleTime: 1000 * 60 * 30,
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

      return designers.map((d) => ({
        ...d,
        first_pick_image_url: firstPickByDesigner.get(d.id) || null,
      }));
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

const isStandaloneDisplay = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("source") === "pwa" ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
};

const DesignersHoverHero = () => {
  const { data: designers } = useFeaturedDesigners();
  const { data: allDesigners = [] } = useAllDesigners();
  const designerCount = useMemo(
    () => allDesigners.filter((d: any) => d.is_published).length,
    [allDesigners]
  );
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPortalCursor, setShowPortalCursor] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(new Set());
  const [activeAccordionLetter, setActiveAccordionLetter] = useState<string | null>(null);
  const [activeMobileLetter, setActiveMobileLetter] = useState<string | null>(null);
  const azTrackRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchScrollRef = useRef<HTMLDivElement>(null);
  const directoryRef = useRef<HTMLDivElement>(null);
  const mastersRef = useRef<HTMLSpanElement>(null);
  const activeTitleRef = useRef<HTMLSpanElement>(null);
  const lastItemRef = useRef<HTMLLIElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; height: number } | null>(null);
  const [directoryTop, setDirectoryTop] = useState<number | null>(null);
  const [activeTitleTop, setActiveTitleTop] = useState<number | null>(null);

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
  const navRef = useRef<HTMLElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const portalRef = useRef<HTMLAnchorElement>(null);
  const portalCursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia?.("(display-mode: standalone)");
    const update = () => setIsStandalone(isStandaloneDisplay());
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
        .map((slug) => bySlug.get(slug))
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

  // Pre-seed active on first render once data arrives so the hero is never
  // a void on entry — the first designer acts as default.
  useEffect(() => {
    if (!activeSlug && items.length > 0) {
      setActiveSlug(items[0].slug);
    }
  }, [items, activeSlug]);

  // Desktop: wheel over the names list advances through designers.
  useEffect(() => {
    if (!hasItems) return;
    const nav = navRef.current;
    if (!nav) return;
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (!isDesktop) return;

    const advance = (dir: 1 | -1) => {
      setActiveSlug((current) => {
        const idx = items.findIndex((d) => d.slug === current);
        const base = idx === -1 ? 0 : idx;
        const nextIdx = (base + dir + items.length) % items.length;
        return items[nextIdx].slug;
      });
    };

    let transitionLock = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      if (transitionLock) return;
      transitionLock = true;
      advance(e.deltaY > 0 ? 1 : -1);
      window.setTimeout(() => {
        transitionLock = false;
      }, LOCK_MS);
    };

    nav.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      nav.removeEventListener("wheel", onWheel);
    };
  }, [hasItems, items]);

  // Mobile: capture vertical swipes on the hero section to advance through
  // featured designers (with the corresponding background image cross-fading
  // in) instead of scrolling the page. The directory below is only reached
  // via the "Find A Designer" link, per editorial intent.
  useEffect(() => {
    if (searchOpen) return;
    if (!hasItems) return;
    const section = sectionRef.current;
    if (!section) return;
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const advance = (dir: 1 | -1) => {
      setActiveSlug((current) => {
        const idx = items.findIndex((d) => d.slug === current);
        const base = idx === -1 ? 0 : idx;
        const nextIdx = Math.min(items.length - 1, Math.max(0, base + dir));
        return items[nextIdx].slug;
      });
    };

    let startY: number | null = null;
    let accum = 0;
    let lock = false;

    const onStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      accum = 0;
    };
    const onMove = (e: TouchEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("#designers-search-sheet")) return;
      if (startY === null) return;
      const y = e.touches[0].clientY;
      accum = startY - y;
      if (e.cancelable) e.preventDefault();
      if (lock) return;
      if (Math.abs(accum) > SWIPE_THRESHOLD) {
        lock = true;
        advance(accum > 0 ? 1 : -1);
        startY = y;
        accum = 0;
        window.setTimeout(() => {
          lock = false;
        }, 450);
      }
    };
    const onEnd = () => {
      startY = null;
      accum = 0;
    };

    section.addEventListener("touchstart", onStart, { passive: true });
    section.addEventListener("touchmove", onMove, { passive: false });
    section.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      section.removeEventListener("touchstart", onStart);
      section.removeEventListener("touchmove", onMove);
      section.removeEventListener("touchend", onEnd);
    };
  }, [hasItems, items, searchOpen]);

  const isDesktopViewport = !isMobileViewport && !isMobileHook && !isStandalone;

  // Lock body scroll + ESC-to-close + autofocus while the search sheet is open.
  // The mobile sheet uses a standard <input type="text">, so the native
  // keyboard opens as usual — no custom keyboard.
  useEffect(() => {
    if (!searchOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Delay focus so the slide-up animation is visible before the keyboard opens.
    const t = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 220);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [searchOpen, isDesktopViewport]);

  const { groupedResults, totalResults } = useMemo(() => {
    const list = (allDesigners as any[])
      .filter((d) => d.is_published && !d.trade_only)
      .map((d) => ({ slug: d.slug as string, name: d.name as string }));
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter((d) => d.name.toLowerCase().includes(q))
      : list;
    filtered.sort((a, b) => sortNameKey(a.name).localeCompare(sortNameKey(b.name)));
    const groups = new Map<string, { slug: string; name: string }[]>();
    for (const d of filtered) {
      const letter = lastNameInitial(d.name);
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(d);
    }
    const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    return { groupedResults: ordered, totalResults: filtered.length };
  }, [allDesigners, searchQuery]);

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

  

  // Reset desktop accordion state when closing the search sheet.
  useEffect(() => {
    if (!searchOpen) {
      setExpandedLetters(new Set());
    }
  }, [searchOpen]);

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
      );
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
      className={cn(
        "relative w-full bg-[#0a0a0a] text-foreground overflow-hidden touch-pan-y",
        isStandalone
          ? "h-[calc(100svh-var(--header-h)+6rem)] min-h-[680px] md:h-[calc(100svh-var(--header-h))] md:min-h-[640px]"
          : // Background frame uses 100lvh so dark hero always covers Safari's
            // toolbar-collapse zone (no white strip). Content frame inside is
            // constrained to 100svh so the Directory clears the iOS toolbar
            // when it is visible.
            "h-[100lvh] min-h-[640px] md:h-[calc(100svh-var(--header-h))]"
      )}
    >
      {/* Cross-fading background images */}
      <div className="absolute inset-0 z-0">
        {items.map((d) => {
          const src = isMobileOrPwa
            ? d.first_pick_image_url || d.hero_image_url || d.image_url
            : d.hero_image_url || d.image_url;
          if (!src) return null;
          const isActive = d.slug === activeSlug;
          return (
            <img
              key={`${d.slug}-${isMobileOrPwa ? "cur" : "hero"}`}
              src={src}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-opacity ease-out",
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
          isStandalone ? "h-full" : "h-[calc(100svh-var(--header-h))] md:h-full"
        )}
      >

        {/* Content */}
        <div
          className={cn(
          "relative flex flex-col h-full px-6 sm:px-12 md:px-20 lg:px-28 pointer-events-auto",
            isStandalone
              ? "justify-center pt-6 md:pt-8 pb-44 md:pb-0"
              : // Mobile browser: Directory pinned at top, so give list top room
                // and let it flow to the bottom of the svh frame (which already
                // excludes the iOS toolbar).
                "justify-start pt-[calc(var(--header-h)+3.25rem)] pb-6 md:pt-8 md:justify-center md:pb-0"
          )}
        >

          <div className="w-full max-w-xs sm:max-w-sm md:max-w-md">
            <div className="relative inline-block">
              {/* Desktop: Directory sits directly above the designer list to
                  group navigation (list) with its utility (search) — Proximity.
                  All items share the same left edge as the designer names. */}
              <div className="hidden md:block mb-5 lg:mb-6">
                {directoryLabels("w-fit", directoryRef, "left")}
              </div>


              <nav
                ref={navRef}
                aria-label="Featured designers shortcut list"
                className="relative inline-block"
              >
              <ul className="flex flex-col text-left">
                {groupedItems.map((group, groupIdx) => (
                  <li
                    key={group.label}
                    className={cn(
                      "flex flex-col text-left",
                      groupIdx > 0 && "mt-5 md:mt-6"
                    )}
                  >
                    <span
                      ref={groupIdx === 0 ? mastersRef : undefined}
                      className="text-[11px] uppercase tracking-[0.32em] font-body font-bold text-gold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] mb-2 md:mb-3"
                    >
                      {group.label}
                    </span>
                    <ul className="flex flex-col gap-1 text-left">
                      {group.designers.map((d, dIdx) => {
                        const [first, last] = splitName(d.name);
                        const isActive = d.slug === activeSlug;
                        const isDimmed = activeSlug !== null && !isActive;
                        const childBrand = d.founder && d.founder !== d.name;
                        const isLastItem =
                          groupIdx === groupedItems.length - 1 &&
                          dIdx === group.designers.length - 1;
                        return (
                          <li
                            key={d.slug}
                            ref={isLastItem ? lastItemRef : undefined}
                            className="text-left leading-[1.5] sm:leading-[1.55]"
                          >
                            <Link
                              to={`/designers/${d.slug}`}
                              state={{ fromDesignersHero: true }}
                              onMouseEnter={() => setActiveSlug(d.slug)}
                              onFocus={() => setActiveSlug(d.slug)}
                              className={cn(
                                "inline-block whitespace-nowrap relative",
                                "text-sm sm:text-base md:text-[20px] leading-[1.5] sm:leading-[1.55]",
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
        {directoryLabels(cn(
          "absolute flex items-center gap-10 text-white w-fit pointer-events-auto md:hidden z-30",
          isMobileOrPwa
            ? "left-1/2 -translate-x-1/2 justify-center px-6"
            : "left-6 sm:left-[22rem] md:left-[26rem] lg:left-[28rem]",
          isStandalone
            ? "pt-6 bottom-[calc(6rem+env(safe-area-inset-bottom))]"
            // Mobile browser: pin to top so it's not hidden by iOS bottom toolbar
            : "pt-2 top-[calc(var(--header-h)+0.5rem)]"
        ))}


        {/* Mobile/PWA scroll hint — quiet mouse icon above the directory, right-justified.
            Anchored inside the svh safe frame so it clears Safari's bottom toolbar. */}
        {isMobileOrPwa && isStandalone && (
          <div
            className={cn(
              "absolute right-6 sm:right-12 z-20 flex flex-col items-center gap-2 pointer-events-none md:hidden",
              isStandalone
                ? "bottom-[calc(11rem+env(safe-area-inset-bottom))]"
                : "bottom-[calc(6.25rem+env(safe-area-inset-bottom))]"
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
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="designers-search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSearchOpen(false)}
            className="fixed left-0 right-0 bottom-0 top-20 z-[70]"
            aria-hidden="true"
          />
        )}
        {searchOpen && (
          <motion.div
            key="designers-search-sheet"
            id="designers-search-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Browse designers A to Z"
            initial={
              isDesktopViewport
                ? { opacity: 0, y: -10, scale: 0.96 }
                : { y: "100%", opacity: 0.6 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              isDesktopViewport
                ? { opacity: 0, y: -10, scale: 0.96 }
                : { y: "100%", opacity: 0 }
            }
            transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.25 }}
            className={cn(
              "fixed z-[71] flex flex-col bg-[#0a0a0a] text-white border border-white/10 shadow-2xl overflow-hidden",
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
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/25 shrink-0" aria-hidden="true" />
            <div className="flex items-center gap-3 px-5 pt-3 pb-3 border-b border-white/10 shrink-0">
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
            <div ref={searchScrollRef} className="flex-1 overflow-y-auto overscroll-contain px-1 pt-0 pb-1 min-h-0 pr-10 md:pr-1 scroll-smooth relative touch-pan-y">

              {isSearching && groupedResults.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm font-body text-white/50">
                  No designers match “{searchQuery}”.
                </p>
              ) : (
                <>
                  {/* Mobile: grouped designer list with sticky letter headers */}
                  <div className="md:hidden">
                    <ul className="flex flex-col pb-2">
                      {isSearching ? (
                        groupedResults.flatMap(([, items]) => items).map((d) => (
                          <li key={d.slug}>
                            <Link
                              to={`/designers/${d.slug}`}
                              state={{ fromDesignersHero: true }}
                              onClick={() => setSearchOpen(false)}
                              className="block px-5 py-2.5 font-body text-[15px] text-white/85 hover:text-white hover:bg-white/[0.04] transition-colors"
                            >
                              {displayDesignerName(d.name)}
                            </Link>
                          </li>
                        ))
                      ) : (
                        groupedResults.map(([letter, items]) => (
                          <li
                            key={letter}
                            data-designer-letter={letter}
                            className="flex flex-col"
                          >
                            <div className="sticky top-0 z-[1] px-5 py-1.5 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-white/10">
                              <span className="font-serif text-sm text-white/70">{letter}</span>
                            </div>
                            <ul className="flex flex-col">
                              {items.map((d) => (
                                <li key={d.slug}>
                                  <Link
                                    to={`/designers/${d.slug}`}
                                    state={{ fromDesignersHero: true }}
                                    onClick={() => setSearchOpen(false)}
                                    className="block px-5 py-2.5 font-body text-[15px] text-white/85 hover:text-white hover:bg-white/[0.04] transition-colors"
                                  >
                                    {displayDesignerName(d.name)}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))
                      )}
                    </ul>
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
                              state={{ fromDesignersHero: true }}
                              onClick={() => setSearchOpen(false)}
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
                              onClick={() =>
                                setExpandedLetters((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(letter)) {
                                    next.delete(letter);
                                    if (activeAccordionLetter === letter) setActiveAccordionLetter(null);
                                  } else {
                                    next.add(letter);
                                    setActiveAccordionLetter(letter);
                                  }
                                  return next;
                                })
                              }
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
                                      state={{ fromDesignersHero: true }}
                                      onClick={() => setSearchOpen(false)}
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

            {/* Mobile A–Z jump strip — pinned to the sheet (outside the scroll
                container) so it stays visible while the list scrolls. */}
            {!isSearching && groupedResults.length > 0 && (() => {
              const jumpTo = (letter: string) => {
                const scroller = searchScrollRef.current;
                const row = scroller?.querySelector<HTMLElement>(
                  `[data-designer-letter="${letter}"]`
                );
                if (!scroller || !row) return;
                scroller.scrollTo({ top: row.offsetTop, behavior: "auto" });
                setActiveMobileLetter(letter);
                if ("vibrate" in navigator) {
                  try { navigator.vibrate?.(4); } catch {}
                }
              };
              const handleTouch = (e: React.TouchEvent) => {
                e.preventDefault();
                const t = e.touches[0];
                if (!t) return;
                const el = document.elementFromPoint(t.clientX, t.clientY) as HTMLElement | null;
                const letter = el?.closest<HTMLElement>("[data-az-letter]")?.dataset.azLetter;
                if (letter) jumpTo(letter);
              };
              return (
                <nav
                  ref={(n) => { azTrackRef.current = n; }}
                  aria-label="Jump to letter"
                  onTouchStart={handleTouch}
                  onTouchMove={handleTouch}
                  className="md:hidden fixed top-1/2 -translate-y-1/2 right-3 z-[100] flex flex-col items-center gap-0 py-3 px-1.5 select-none touch-none rounded-full bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.25)] overflow-y-auto max-h-[80vh]"
                >
                  {groupedResults.map(([letter]) => {
                    const isActive = activeMobileLetter === letter;
                    return (
                      <button
                        key={letter}
                        type="button"
                        data-az-letter={letter}
                        onClick={() => jumpTo(letter)}
                        aria-label={`Jump to ${letter}`}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "relative font-body text-[13px] leading-none tracking-[0.04em] w-7 min-h-[26px] flex items-center justify-center transition-colors rounded-full",
                          isActive ? "bg-black text-white font-semibold" : "text-black/80 hover:bg-black/5"
                        )}
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        <span className="pointer-events-none absolute -inset-y-1 -left-3 -right-3" aria-hidden />
                        {letter}
                      </button>
                    );
                  })}
                </nav>
              );
            })()}



          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default DesignersHoverHero;
