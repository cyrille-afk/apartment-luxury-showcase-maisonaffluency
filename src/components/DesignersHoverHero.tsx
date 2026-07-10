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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { jumpToDesignerLetter } from "@/lib/jumpToDesignerLetter";
import { useAllDesigners } from "@/hooks/useDesigner";
import { useIsMobile } from "@/hooks/use-mobile";
import { applyCuratorPickOrder } from "@/lib/curatorPickSort";

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
      "emmanuel-babled",
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
  // via the "Click to Browse A–Z" link, per editorial intent.
  useEffect(() => {
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
  }, [hasItems, items]);

  if (!hasItems) return null;

  const DirectoryContent = ({ align = "left" }: { align?: "left" | "center" }) => (
    <div className={cn("flex flex-col md:w-56", align === "center" ? "items-center" : "items-start")}>
      <div className={cn("flex pb-3 md:pb-5", align === "center" ? "justify-center" : "justify-start md:justify-center", "w-full")}>
        <div
          className="h-px w-24 md:w-48 bg-[linear-gradient(90deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.35)_40%,transparent_40%,transparent_60%,rgba(255,255,255,0.35)_60%,rgba(255,255,255,0.35)_100%)]"
          aria-hidden="true"
        />
      </div>
      <span className="text-[10px] md:text-[19px] uppercase tracking-[0.3em] md:tracking-[0.34em] mb-1 md:mb-2 font-body font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
        Directory <span className="text-white/90 normal-case tracking-normal font-medium md:hidden">({designerCount || 95})</span>
      </span>
      <span className="hidden md:block mb-2 font-display text-[18px] leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
        ({designerCount || 95})
      </span>

      <Link
        to="/designers?letter=A"
        onClick={(e) => {
          e.preventDefault();
          jumpToDesignerLetter("A");
        }}
        className="whitespace-nowrap text-xs md:text-[21px] md:leading-[1.2] font-body md:font-display font-medium italic text-white hover:text-white/90 underline-offset-4 hover:underline transition-colors drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
      >
        <span className="md:hidden">Click to Browse A–Z</span>
        <span className="hidden md:block">Click to Browse</span>
        <span className="hidden md:block not-italic text-[24px] leading-[1.12]">A–Z</span>
      </Link>
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
          ? "h-[calc(100svh-var(--header-h)+6rem)] min-h-[680px] md:h-[88vh] md:min-h-[640px]"
          : // Background frame uses 100lvh so dark hero always covers Safari's
            // toolbar-collapse zone (no white strip). Content frame inside is
            // constrained to 100svh so the Directory clears the iOS toolbar
            // when it is visible.
            "h-[100lvh] min-h-[640px] md:h-[88vh]"
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
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-black/20 md:from-black/60 md:via-black/30 md:to-black/5" />
      </div>

      {/* Safe content frame — on mobile browser it tracks 100svh (toolbar-visible
          viewport) so list + directory always sit above iOS bottom chrome.
          PWA/desktop keep using the full section height. */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 pointer-events-none",
          // Mobile browser: frame height = visible viewport minus the fixed
          // header, so its bottom aligns with the iOS toolbar top (svh excludes
          // the toolbar). Desktop/PWA: full section height.
          isStandalone ? "h-full" : "h-[calc(100svh-var(--header-h))] md:h-full"
        )}
      >

        {/* Content */}
        <div
          className={cn(
            "relative flex flex-col h-full px-6 sm:px-12 md:px-20 lg:px-28 pt-6 md:pt-8 md:-translate-y-12 pointer-events-auto",
            isStandalone
              ? "justify-center pb-44 md:pb-0"
              : // Mobile browser: anchor list near the bottom of the svh frame
                // but reserve room for the Directory row + iOS safe-area.
                "justify-end pb-24 sm:pb-40 md:justify-center md:pb-0"
          )}
        >

          <span id="meet-designers-headline" className="inline-block mb-5 md:mb-8 text-[11px] uppercase tracking-[0.3em] font-body text-white/50 scroll-header-offset">
            Meet Our Designers
          </span>
          <div className="w-full max-w-xs sm:max-w-sm md:w-fit md:max-w-none">
            <div className="relative inline-block">
              {/* Localized text overlay — separates the typography from the
                  busy background image while keeping the editorial edge soft. */}
              <div className="absolute -inset-3 sm:-inset-4 md:-inset-5 -z-10 rounded-sm bg-gradient-to-r from-black/60 via-black/35 to-transparent" />
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
                    <span className="text-[10px] uppercase tracking-[0.3em] font-body text-white/50 mb-2 md:mb-3">
                      {group.label}
                    </span>
                    <ul className="flex flex-col gap-1 text-left">
                      {group.designers.map((d, idx) => {
                        const [first, last] = splitName(d.name);
                        const isActive = d.slug === activeSlug;
                        const isDimmed = activeSlug !== null && !isActive;
                        const childBrand = d.founder && d.founder !== d.name;
                        const isLast = groupIdx === groupedItems.length - 1 && idx === group.designers.length - 1;
                        return (
                          <li
                            key={d.slug}
                            className={cn(
                              "text-left leading-[1.5] sm:leading-[1.55]",
                              isLast && "relative"
                            )}
                          >
                            <span className={cn("inline-flex items-center", isLast && "relative")}>
                              <Link
                                to={`/designers/${d.slug}`}
                                onMouseEnter={() => setActiveSlug(d.slug)}
                                onFocus={() => setActiveSlug(d.slug)}
                                className={cn(
                                  "inline-block whitespace-nowrap relative",
                                  "text-sm sm:text-base md:text-[20px] leading-[1.5] sm:leading-[1.55]",
                                  "font-display font-light tracking-normal",
                                  "transition-all duration-[1200ms] ease-out",
                                  "drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]",
                                  isDimmed
                                    ? "text-white/80"
                                    : "font-bold text-white after:content-[''] after:absolute after:left-0 after:bottom-[-5px] after:h-[1px] after:w-8 after:bg-white/40"
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
                              {isLast && (
                                <div className="hidden md:block absolute left-full top-1/2 -translate-y-[88%] ml-10 pointer-events-auto">
                                  <DirectoryContent align="left" />
                                </div>
                              )}
                            </span>
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

        {/* Mobile/PWA directory — centered at the bottom of the safe frame. */}
        {isMobileOrPwa && (
          <div
            className={cn(
              "absolute flex justify-center text-white pt-6 max-w-md pointer-events-auto md:hidden",
              "left-1/2 -translate-x-1/2 w-full px-6",
              isStandalone
                ? "bottom-[calc(6rem+env(safe-area-inset-bottom))]"
                : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))]"
            )}
          >
            <DirectoryContent align="center" />
          </div>
        )}


        {/* Mobile/PWA scroll hint — quiet mouse icon above the directory, right-justified.
            Anchored inside the svh safe frame so it clears Safari's bottom toolbar. */}
        {isMobileOrPwa && (
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
          <Link
            key={active.slug}
            ref={portalRef}
            to={`/designers/${active.slug}`}
            aria-label={`View ${active.name}'s full collection`}
            className="hidden md:block absolute right-0 top-0 h-full w-1/2 z-10 pointer-events-auto group"
            style={{ cursor: "none" }}
            onMouseEnter={() => setShowPortalCursor(true)}
            onMouseLeave={() => setShowPortalCursor(false)}
            onMouseMove={handlePortalMove}
          >
            <div className="absolute right-12 lg:right-28 bottom-24 lg:bottom-24 flex flex-col items-end text-right text-white">
              <span
                key={`${active.slug}-title`}
                className="font-display font-light tracking-tight text-2xl lg:text-3xl animate-in fade-in duration-700"
              >
                {first}
                {last && <span className="italic"> {last}</span>}
              </span>
              <span
                key={`${active.slug}-cta`}
                className="mt-2 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] font-body text-white/70 group-hover:text-white transition-colors animate-in fade-in duration-1000 delay-200 fill-mode-both"
              >
                <span className="relative">
                  Click to view full collection
                  {/* Sliding underline on hover */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 -bottom-0.5 h-px bg-white/80 w-0 group-hover:w-full transition-[width] duration-500 ease-out"
                  />
                </span>
                {/* Arrow reveals + slides on hover */}
                <span
                  aria-hidden="true"
                  className="inline-block translate-x-[-4px] opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500 ease-out"
                >
                  →
                </span>
              </span>
            </div>

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
        );
      })()}





      {/* Vertical wordmark */}
      <div className="hidden lg:flex absolute top-28 right-12 flex-col items-end gap-6 z-10 pointer-events-none">
        <span
          className="text-[10px] uppercase tracking-[0.5em] text-white/80 font-body"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Maison Affluency
        </span>
        <div className="w-px h-28 bg-gradient-to-b from-white/70 to-transparent" />
      </div>
    </section>
  );
};

export default DesignersHoverHero;
