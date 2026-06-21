/**
 * Editorial hover hero for the public /designers directory.
 *
 * Inspired by lacollections.fr: a vertical list of featured designer
 * names overlays a full-bleed background image that cross-fades on hover.
 * Names route to /designers/:slug. Mobile gracefully falls back to a
 * static intro (no hover) — the existing A–Z directory grid below covers
 * tap-driven browsing.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface FeaturedDesigner {
  slug: string;
  name: string;
  hero_image_url: string | null;
  image_url: string | null;
}

const FEATURED_SLUGS = [
  "alexander-lamont",
  "leo-aerts-alinea",
  "apparatus-studio",
  "christopher-boots",
  "delcourt-collection",
  "ecart",
  "emmanuel-babled",
  "felix-agostini",
  "kerstens",
  "kiko-lopez",
  "pierre-bonnefille",
  "ozone",
  "thierry-lemaire",
];

function useFeaturedDesigners() {
  return useQuery({
    queryKey: ["designers-hero-featured", FEATURED_SLUGS],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("slug, name, hero_image_url, image_url")
        .in("slug", FEATURED_SLUGS)
        .eq("is_published", true);
      if (error) throw error;
      const order = new Map(FEATURED_SLUGS.map((s, i) => [s, i]));
      return ((data || []) as FeaturedDesigner[])
        .filter((d) => d.hero_image_url || d.image_url)
        .sort(
          (a, b) =>
            (order.get(a.slug) ?? 99) - (order.get(b.slug) ?? 99)
        );
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
const SWIPE_MAX_DURATION = 600;

const DesignersHoverHero = () => {
  const { data: designers } = useFeaturedDesigners();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // Pre-seed active on first render once data arrives so the hero is never
  // a void on entry — the first designer acts as default.
  useEffect(() => {
    if (!activeSlug && designers && designers.length > 0) {
      setActiveSlug(designers[0].slug);
    }
  }, [designers, activeSlug]);

  const items = designers ?? [];
  const hasItems = items.length > 0;

  // Wheel/swipe navigation: scroll up/down moves through the list of names
  // without scrolling the page. Touch swipes advance the same way.
  useEffect(() => {
    if (!hasItems) return;
    const section = document.getElementById("designers-hover-hero");
    if (!section) return;

    const advance = (dir: 1 | -1) => {
      setActiveSlug((current) => {
        const idx = items.findIndex((d) => d.slug === current);
        const base = idx === -1 ? 0 : idx;
        const nextIdx = (base + dir + items.length) % items.length;
        return items[nextIdx].slug;
      });
    };

    let wheelLock = false;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true;
      advance(e.deltaY > 0 ? 1 : -1);
      window.setTimeout(() => {
        wheelLock = false;
      }, 350);
    };

    let touchStartY: number | null = null;
    let touchStartX: number | null = null;
    let touchStartTime = 0;
    let swiping = false;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartY = touch.clientY;
      touchStartX = touch.clientX;
      touchStartTime = Date.now();
      swiping = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY === null || touchStartX === null) return;
      const touch = e.touches[0];
      const dy = touchStartY - touch.clientY;
      const dx = touchStartX - touch.clientX;

      // Only claim vertical swipes once they exceed the threshold.
      if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        e.preventDefault();
        swiping = true;
        advance(dy > 0 ? 1 : -1);
        touchStartY = touch.clientY;
        touchStartX = touch.clientX;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!swiping) return;
      // If this was a swipe, stop the event from becoming a click on a Link.
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (link) {
        e.preventDefault();
      }
      swiping = false;
      touchStartY = null;
      touchStartX = null;
    };

    section.addEventListener("wheel", onWheel, { passive: false });
    section.addEventListener("touchstart", onTouchStart, { passive: true });
    section.addEventListener("touchmove", onTouchMove, { passive: false });
    section.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      section.removeEventListener("wheel", onWheel);
      section.removeEventListener("touchstart", onTouchStart);
      section.removeEventListener("touchmove", onTouchMove);
      section.removeEventListener("touchend", onTouchEnd);
    };
  }, [hasItems, items]);

  // Preload images so cross-fades are instant.
  const imageUrls = useMemo(
    () => items.map((d) => d.hero_image_url || d.image_url || ""),
    [items]
  );
  useEffect(() => {
    imageUrls.forEach((u) => {
      if (!u) return;
      const img = new Image();
      img.src = u;
    });
  }, [imageUrls]);

  if (!hasItems) return null;

  return (
    <section
      id="designers-hover-hero"
      aria-label="Featured designers"
      className="relative w-full h-[88vh] min-h-[640px] bg-[#0a0a0a] text-foreground overflow-hidden touch-pan-x overscroll-y-contain select-none"
    >
      {/* Background image stack — cross-fade between layers */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {items.map((d) => {
          const url = d.hero_image_url || d.image_url || "";
          const isActive = d.slug === activeSlug;
          return (
            <div
              key={d.slug}
              aria-hidden="true"
              className={cn(
                "absolute inset-0 transition-opacity duration-[1000ms] ease-in-out",
                isActive ? "opacity-100" : "opacity-0"
              )}
            >
              <img
                src={url}
                alt=""
                loading="eager"
                decoding="async"
                className={cn(
                  "w-full h-full object-cover transition-transform duration-[6000ms] ease-out",
                  isActive ? "scale-100" : "scale-105"
                )}
                style={{ filter: "brightness(0.78) saturate(0.95)" }}
              />
            </div>
          );
        })}
        {/* Left-side vignette for legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/85 via-[#0a0a0a]/25 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/60 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center h-full px-6 sm:px-12 md:px-20 lg:px-28">
        <div className="w-full max-w-xs sm:max-w-sm md:max-w-md">
          <nav aria-label="Featured designers shortcut list">
            <ul className="flex flex-col gap-0.5 text-center">
              {items.map((d) => {
                const [first, last] = splitName(d.name);
                const isActive = d.slug === activeSlug;
                const isDimmed = activeSlug !== null && !isActive;
                return (
                  <li key={d.slug} className="text-center">
                    <Link
                      to={`/designers/${d.slug}`}
                      onMouseEnter={() => setActiveSlug(d.slug)}
                      onFocus={() => setActiveSlug(d.slug)}
                      className={cn(
                        "inline-block",
                        "font-display font-light tracking-tight text-white",
                        "text-base sm:text-lg md:text-2xl lg:text-[28px] leading-[1.25]",
                        "transition-opacity duration-[600ms] ease-out",
                        isDimmed ? "opacity-30" : "opacity-100"
                      )}
                    >
                      <span>
                        {first}
                        {last && <span className="italic"> {last}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-12 md:mt-16 flex items-center gap-10 text-white/40 border-t border-white/10 pt-6 max-w-md">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-[0.3em] mb-1 font-body">
                Archives
              </span>
              <span className="text-xs font-body font-light">1920 — Today</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-[0.3em] mb-1 font-body">
                Directory
              </span>
              <span className="text-xs font-body font-light italic">
                Scroll to browse A–Z
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Vertical wordmark */}
      <div className="hidden lg:flex absolute bottom-12 right-12 flex-col items-end gap-6 z-10 pointer-events-none">
        <span
          className="text-[10px] uppercase tracking-[0.5em] text-white/25 font-body"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Maison Affluency
        </span>
        <div className="w-px h-28 bg-gradient-to-b from-white/25 to-transparent" />
      </div>
    </section>
  );
};

export default DesignersHoverHero;
