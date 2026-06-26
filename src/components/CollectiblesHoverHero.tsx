/**
 * Editorial hover hero for the public /collectibles directory.
 *
 * Mirrors the structure of DesignersHoverHero: a vertical list of featured
 * collectible pieces overlays a full-bleed background image that cross-fades
 * on hover. Each entry routes to the corresponding designer profile so the
 * visitor lands directly inside that maker's curated catalogue.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { collectibleDesigners } from "@/components/Collectibles";
import { useVisibleCollectibleDesigners } from "@/hooks/useCollectibleOverrides";

interface FeaturedPiece {
  slug: string;          // designer slug for routing
  pieceTitle: string;    // collectible piece name
  designerName: string;  // designer/atelier name
  image: string;
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

// Italicize the last word for the typographic move (matches DesignersHoverHero).
function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ""];
  const last = parts.pop()!;
  return [parts.join(" "), last];
}

const CollectiblesHoverHero = () => {
  // Pick one signature piece per featured collectible designer/atelier.
  const visibleDesigners = useVisibleCollectibleDesigners();
  const items: FeaturedPiece[] = useMemo(() => {
    return visibleDesigners
      .filter((d) => d.id && d.curatorPicks?.[0]?.image)
      .map((d) => ({
        slug: d.id!,
        pieceTitle: d.curatorPicks[0].title,
        designerName: d.name,
        image: d.curatorPicks[0].image,
      }))
      .sort((a, b) =>
        a.designerName.localeCompare(b.designerName, "en", { sensitivity: "base" })
      );
  }, [visibleDesigners]);

  const [activeSlug, setActiveSlug] = useState<string | null>(() =>
    visibleDesigners.find((d) => d.id && d.curatorPicks?.[0]?.image)?.id ?? null
  );
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const pieceCount = items.length;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia?.("(display-mode: standalone)");
    const update = () => setIsStandalone(isStandaloneDisplay());
    update();
    media?.addEventListener?.("change", update);
    return () => media?.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!activeSlug && items.length > 0) setActiveSlug(items[0].slug);
  }, [items, activeSlug]);

  const hasItems = items.length > 0;

  // Desktop wheel scrubbing
  useEffect(() => {
    if (!hasItems) return;
    const nav = navRef.current;
    if (!nav || typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;

    const advance = (dir: 1 | -1) => {
      setActiveSlug((current) => {
        const idx = items.findIndex((d) => d.slug === current);
        const base = idx === -1 ? 0 : idx;
        const nextIdx = (base + dir + items.length) % items.length;
        return items[nextIdx].slug;
      });
    };

    let lock = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      if (lock) return;
      lock = true;
      advance(e.deltaY > 0 ? 1 : -1);
      window.setTimeout(() => { lock = false; }, LOCK_MS);
    };
    nav.addEventListener("wheel", onWheel, { passive: false });
    return () => nav.removeEventListener("wheel", onWheel);
  }, [hasItems, items]);

  // Mobile swipe scrubbing
  useEffect(() => {
    if (!hasItems) return;
    const section = sectionRef.current;
    if (!section || typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;

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

    const onStart = (e: TouchEvent) => { startY = e.touches[0].clientY; accum = 0; };
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
        window.setTimeout(() => { lock = false; }, 450);
      }
    };
    const onEnd = () => { startY = null; accum = 0; };

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

  const directoryLabels = (className: string) => (
    <div className={className}>
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-[0.3em] mb-1 font-body text-white">
          Collection
        </span>
        <span className="text-xs font-body font-light text-white/85">
          Limited &amp; Numbered Editions
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-[0.3em] mb-1 font-body text-white">
          Catalogue <span className="text-white/70 normal-case tracking-normal">({pieceCount})</span>
        </span>
        <a
          href="#collectibles-directory"
          onClick={(e) => {
            e.preventDefault();
            const el = document.getElementById("collectibles-directory");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="text-xs font-body font-light italic text-white/85 hover:text-white underline-offset-4 hover:underline transition-colors"
        >
          Click to Browse Pieces
        </a>
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      id="collectibles-hover-hero"
      aria-label="Featured collectible pieces"
      className={cn(
        "relative w-full bg-[#0a0a0a] text-foreground overflow-hidden touch-pan-y",
        isStandalone
          ? "h-[calc(100svh-var(--header-h)+6rem)] min-h-[680px] md:h-[88vh] md:min-h-[640px]"
          : "h-[100lvh] min-h-[640px] md:h-[88vh]"
      )}
    >
      {/* Cross-fading background images */}
      <div className="absolute inset-0 z-0">
        {items.map((d, i) => {
          const isActive = d.slug === activeSlug;
          const isFirst = i === 0;
          return (
            <img
              key={d.slug}
              src={d.image}
              alt=""
              aria-hidden="true"
              loading={isFirst ? "eager" : "lazy"}
              decoding={isFirst ? "sync" : "async"}
              fetchPriority={isFirst ? ("high" as any) : ("auto" as any)}
              className={cn(
                "absolute inset-0 w-full h-full object-cover",
                hasInteracted ? "transition-opacity ease-out" : "",
                isActive ? "opacity-100" : "opacity-0"
              )}
              style={hasInteracted ? { transitionDuration: `${IMAGE_TRANSITION_MS}ms` } : undefined}
            />
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20 md:from-black/70 md:via-black/35 md:to-transparent" />
      </div>

      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 pointer-events-none",
          isStandalone ? "h-full" : "h-[calc(100svh-var(--header-h))] md:h-full"
        )}
      >
        <div
          className={cn(
            "relative flex flex-col h-full px-6 sm:px-12 md:px-20 lg:px-28 pt-6 md:pt-8 md:-translate-y-12 pointer-events-auto",
            isStandalone
              ? "justify-center pb-44 md:pb-0"
              : "justify-end pb-24 sm:pb-40 md:justify-center md:pb-0"
          )}
        >
          <p
            id="collectibles-hero-headline"
            className="mb-5 md:mb-8 font-body text-sm md:text-lg tracking-wide text-white/75 scroll-header-offset"
          >
            Collectible Design On View
          </p>
          <div className="w-full max-w-xs sm:max-w-sm md:max-w-md">
            <nav
              ref={navRef}
              aria-label="Featured collectible pieces shortcut list"
              className="inline-block"
            >
              <ul className="flex flex-col gap-0 text-left">
                {items.map((d) => {
                  const [first, last] = splitName(d.pieceTitle);
                  const isActive = d.slug === activeSlug;
                  const isDimmed = activeSlug !== null && !isActive;
                  return (
                    <li
                      key={d.slug}
                      className="text-left leading-[1.08] sm:leading-[1.12]"
                    >
                      <Link
                        to={`/designers/${d.slug}`}
                        onMouseEnter={() => setActiveSlug(d.slug)}
                        onFocus={() => setActiveSlug(d.slug)}
                        className={cn(
                          "inline-block whitespace-nowrap",
                          "font-display font-light tracking-tight",
                          "text-sm sm:text-base md:text-[20px] leading-[1.08] sm:leading-[1.12]",
                          "transition-colors duration-[1200ms] ease-out",
                          isDimmed ? "text-white/35" : "text-white/95"
                        )}
                      >
                        <span>
                          {first}
                          {last && <span className="italic"> {last}</span>}
                          <span className="opacity-80"> — {d.designerName}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>

        {directoryLabels(cn(
          "absolute left-6 sm:left-12 md:left-20 lg:left-28 flex items-center gap-10 text-white border-t border-white/20 pt-6 max-w-md pointer-events-auto",
          isStandalone
            ? "bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-14"
            : "bottom-[calc(1.25rem+env(safe-area-inset-bottom))] md:bottom-24"
        ))}
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

export default CollectiblesHoverHero;
