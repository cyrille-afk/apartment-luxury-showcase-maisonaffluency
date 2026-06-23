/**
 * Editorial hover hero for the public /designers directory.
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

interface FeaturedDesigner {
  slug: string;
  name: string;
  founder: string | null;
  hero_image_url: string | null;
  image_url: string | null;
}

const FEATURED_SLUGS = [
  "alexander-lamont",
  "leo-aerts-alinea",
  "apparatus-studio",
  "atelier-demichelis",
  "christopher-boots",
  "delcourt-collection",
  "ecart",
  "emmanuel-babled",
  "emmanuel-levet-stenne",
  "felix-agostini",
  "hamrei",
  "kerstens",
  "kiko-lopez",
  "ozone",
  "pierre-bonnefille",
  "thierry-lemaire",
];

function useFeaturedDesigners() {
  return useQuery({
    queryKey: ["designers-hero-featured-v2", FEATURED_SLUGS],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("slug, name, founder, hero_image_url, image_url")
        .in("slug", FEATURED_SLUGS)
        .eq("is_published", true);
      if (error) throw error;
      return ((data || []) as FeaturedDesigner[])
        .filter((d) => d.hero_image_url || d.image_url)
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
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
  const designerCount = useMemo(
    () => allDesigners.filter((d: any) => d.is_published).length,
    [allDesigners]
  );
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Pre-seed active on first render once data arrives so the hero is never
  // a void on entry — the first designer acts as default.
  useEffect(() => {
    if (!activeSlug && designers && designers.length > 0) {
      setActiveSlug(designers[0].slug);
    }
  }, [designers, activeSlug]);

  const items = designers ?? [];
  const hasItems = items.length > 0;

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

  return (
    <section
      ref={sectionRef}
      id="designers-hover-hero"
      aria-label="Featured designers"
      className="relative w-full h-[88vh] min-h-[640px] bg-[#0a0a0a] text-foreground overflow-hidden touch-none md:touch-auto"
    >
      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-6 sm:px-12 md:px-20 lg:px-28 pb-32 md:pb-24">
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-md">
          <nav
            ref={navRef}
            aria-label="Featured designers shortcut list"
            className="inline-block"
          >
            <ul className="flex flex-col gap-0.5 text-left">
              {items.map((d) => {
                const [first, last] = splitName(d.name);
                const isActive = d.slug === activeSlug;
                const isDimmed = activeSlug !== null && !isActive;
                const childBrand = d.founder && d.founder !== d.name;
                return (
                  <li key={d.slug} className="text-left">
                    <Link
                      to={`/designers/${d.slug}`}
                      onMouseEnter={() => setActiveSlug(d.slug)}
                      onFocus={() => setActiveSlug(d.slug)}
                      className={cn(
                        "inline-block",
                        "font-display font-light tracking-tight",
                        "text-sm sm:text-base md:text-2xl lg:text-[28px] leading-[1.25]",
                        "transition-colors duration-[1200ms] ease-out",
                        isDimmed ? "text-white/35" : "text-white/90"
                      )}
                    >
                      <span>
                        {first}
                        {last && <span className="italic"> {last}</span>}
                        {childBrand && (
                          <span className="opacity-80"> - {d.founder}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>

      {/* Archives / Directory labels — lifted on mobile to clear iOS Safari chrome */}
      <div className="absolute bottom-[calc(9rem+env(safe-area-inset-bottom))] md:bottom-24 left-6 sm:left-12 md:left-20 lg:left-28 z-10 flex items-center gap-10 text-white border-t border-white/20 pt-6 max-w-md">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.3em] mb-1 font-body text-white">
            Archives
          </span>
          <span className="text-xs font-body font-light text-white/85">1920 — Today</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.3em] mb-1 font-body text-white">
            Directory <span className="text-white/70 normal-case tracking-normal">({designerCount || 95})</span>
          </span>

          <Link
            to="/designers?letter=A"
            onClick={(e) => {
              e.preventDefault();
              jumpToDesignerLetter("A");
            }}
            className="text-xs font-body font-light italic text-white/85 hover:text-white underline-offset-4 hover:underline transition-colors"
          >
            Click to Browse A–Z
          </Link>
        </div>
      </div>


      {/* Vertical wordmark */}
      <div className="hidden lg:flex absolute bottom-28 right-12 flex-col items-end gap-6 z-10 pointer-events-none">
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
