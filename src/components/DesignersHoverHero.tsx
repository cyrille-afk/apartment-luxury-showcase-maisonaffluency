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
import { Search, X, ImageIcon } from "lucide-react";

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

/**
 * Small square thumbnail for the mobile "Find A Designer" list rows.
 * Applies a lightweight Cloudinary transform when possible so we don't
 * download hero-sized assets for a 40px slot.
 */
function thumbTransform(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  if (!src.includes("res.cloudinary.com") || !src.includes("/image/upload/")) return src;
  return src.replace("/image/upload/", "/image/upload/w_120,h_120,c_fill,g_auto,q_auto:good,f_auto/");
}

function DesignerRowThumb({ src, alt }: { src: string | null | undefined; alt: string }) {
  const url = thumbTransform(src);
  return (
    <span className="relative flex-shrink-0 h-11 w-9 rounded-md overflow-hidden bg-white/[0.06] ring-1 ring-white/10">
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-white/30">
          <ImageIcon className="h-4 w-4" aria-hidden />
        </span>
      )}
    </span>
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
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(new Set(["A"]));
  const [activeAccordionLetter, setActiveAccordionLetter] = useState<string | null>(null);
  const [activeMobileLetter, setActiveMobileLetter] = useState<string | null>(null);
  const [azDragging, setAzDragging] = useState(false);
  const [azMagnifier, setAzMagnifier] = useState<{ letter: string; y: number } | null>(null);
  const azTrackRef = useRef<HTMLElement | null>(null);
  const [azRailRect, setAzRailRect] = useState<{ top: number; height: number } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchScrollRef = useRef<HTMLDivElement>(null);
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
    if (params.get("find") === "1") {
      setSearchOpen(true);
      // Clean the URL so a refresh doesn't keep re-opening it.
      params.delete("find");
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


  // Desktop: wheel over the names list advances through designers.
  useEffect(() => {
    if (!hasItems) return;
    const nav = navRef.current;
    if (!nav) return;
    if (typeof window === "undefined") return;
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (!isDesktop) return;

    const canUseNativeListScroll = () => {
      const scroller = contentScrollRef.current;
      return Boolean(scroller && scroller.scrollHeight > scroller.clientHeight + 2);
    };

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

  // Mobile: capture vertical swipes on the designer NAMES list only so users
  // can advance featured designers by swiping on the list, while swipes on the
  // rest of the hero still scroll the page into the Directory below. Previously
  // this was bound to the entire section which blocked window scroll on mobile
  // and prevented the Directory from ever mounting.
  useEffect(() => {
    if (searchOpen) return;
    if (!hasItems) return;
    const nav = navRef.current;
    if (!nav) return;
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;

    const handoffToDirectory = () => {
      if (handoffLockRef.current) return;
      handoffLockRef.current = true;
      window.dispatchEvent(new Event("unlockDesignersScroll"));

      const scrollBelowHero = () => {
        const section = sectionRef.current;
        if (!section) return;
        const target = Math.max(0, section.getBoundingClientRect().bottom + window.scrollY - 1);
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

    let startY: number | null = null;
    let pointerStartY: number | null = null;
    let accum = 0;
    let pointerAccum = 0;
    let lock = false;
    let pointerLock = false;
    let lastPointerTouchAt = 0;

    const handleSwipeDelta = (deltaY: number, prevent: () => void, isPointer = false) => {
      if (canUseNativeListScroll()) return false;

      const idx = items.findIndex((d) => d.slug === activeSlugRef.current);
      const atFirst = idx <= 0;

      if (atFirst && deltaY < -SWIPE_THRESHOLD) {
        prevent();
        return true;
      }

      prevent();
      if (isPointer ? pointerLock : lock) return true;

      if (Math.abs(deltaY) > SWIPE_THRESHOLD) {
        suppressNavClickRef.current = true;
        if (isPointer) pointerLock = true;
        else lock = true;
        advance(deltaY > 0 ? 1 : -1);
        window.setTimeout(() => {
          if (isPointer) pointerLock = false;
          else lock = false;
        }, 450);
        window.setTimeout(() => {
          suppressNavClickRef.current = false;
        }, 650);
      }
      return true;
    };

    const supportsPointer = "PointerEvent" in window;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if ((e.target as HTMLElement | null)?.closest?.("#designers-search-sheet")) return;
      if (canUseNativeListScroll()) return;
      lastPointerTouchAt = Date.now();
      pointerStartY = e.clientY;
      pointerAccum = 0;
      nav.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (pointerStartY === null) return;
      pointerAccum = pointerStartY - e.clientY;
      const handled = handleSwipeDelta(
        pointerAccum,
        () => {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
        },
        true
      );
      if (handled && Math.abs(pointerAccum) > SWIPE_THRESHOLD) {
        pointerStartY = e.clientY;
        pointerAccum = 0;
      }
    };

    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pointerStartY = null;
      pointerAccum = 0;
      nav.releasePointerCapture?.(e.pointerId);
    };

    const onStart = (e: TouchEvent) => {
      if (Date.now() - lastPointerTouchAt < 700) return;
      if (canUseNativeListScroll()) return;
      startY = e.touches[0].clientY;
      accum = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (Date.now() - lastPointerTouchAt < 700) return;
      if ((e.target as HTMLElement | null)?.closest?.("#designers-search-sheet")) return;
      if (startY === null) return;
      const y = e.touches[0].clientY;
      accum = startY - y;
      const handled = handleSwipeDelta(accum, () => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      });
      if (handled && Math.abs(accum) > SWIPE_THRESHOLD) {
        startY = y;
        accum = 0;
      }
    };
    const onEnd = () => {
      startY = null;
      accum = 0;
    };

    if (supportsPointer) {
      nav.addEventListener("pointerdown", onPointerDown, { passive: false });
      nav.addEventListener("pointermove", onPointerMove, { passive: false });
      nav.addEventListener("pointerup", onPointerEnd, { passive: true });
      nav.addEventListener("pointercancel", onPointerEnd, { passive: true });
    }
    nav.addEventListener("touchstart", onStart, { passive: true });
    nav.addEventListener("touchmove", onMove, { passive: false });
    nav.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      if (supportsPointer) {
        nav.removeEventListener("pointerdown", onPointerDown);
        nav.removeEventListener("pointermove", onPointerMove);
        nav.removeEventListener("pointerup", onPointerEnd);
        nav.removeEventListener("pointercancel", onPointerEnd);
      }
      nav.removeEventListener("touchstart", onStart);
      nav.removeEventListener("touchmove", onMove);
      nav.removeEventListener("touchend", onEnd);
    };
  }, [hasItems, items, searchOpen]);

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
      // Boundary handoff: at last item swiping/wheeling up → page scroll to Directory.
      if (atLast && deltaY > 0) {
        handoffToDirectory();
        return;
      }
      // At first item swiping down → let page/native handle (no-op for hero).
      if (atFirst && deltaY < 0) {
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
      touchStartY = e.touches[0]?.clientY ?? null;
      touchLastY = touchStartY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartY === null) return;
      if (isInsideSearchSheet(e.target)) return;
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
      .map((d) => ({
        slug: d.slug as string,
        name: d.name as string,
        hero_image_url: (d.hero_image_url as string | null) ?? null,
        image_url: (d.image_url as string | null) ?? null,
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

  

  // Reset accordion state when closing the search sheet — reopen defaults to "A".
  useEffect(() => {
    if (!searchOpen) {
      setExpandedLetters(new Set(["A"]));
      setActiveAccordionLetter(null);
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
                // Mobile browser only: shift image content upward so featured
                // pieces sit higher in the visible frame (matches PWA framing).
                !isStandalone && "object-top md:object-center",
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
          ref={contentScrollRef}
          className={cn(
          "relative flex flex-col h-full px-6 sm:px-12 md:px-20 lg:px-28 pointer-events-auto md:overflow-visible",
            isStandalone
              ? "justify-start overflow-y-auto overscroll-contain touch-pan-y pt-6 pb-44 md:pt-8 md:pb-0 md:justify-center md:overflow-visible [-webkit-overflow-scrolling:touch]"
              : // Mobile browser: the section already starts below the fixed
                // header, so do not add var(--header-h) again here. Keep the
                // designer list high while leaving room for the Directory link.
                "justify-start overflow-y-auto overscroll-contain touch-pan-y pt-12 pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:pt-8 md:justify-center md:pb-0 md:overflow-visible [-webkit-overflow-scrolling:touch]"
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
                      className="text-[10px] md:text-[11px] uppercase tracking-[0.32em] font-body font-bold text-gold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] mb-1 md:mb-3"
                    >
                      {group.label}
                    </span>
                    <ul className="flex flex-col gap-1 text-left">
                      {group.designers.map((d, dIdx) => {
                        const [first, last] = splitName(d.name);
                        const isActive = d.slug === activeSlug;
                        const isDimmed = activeSlug !== null && !isActive;
                        const HIDE_FOUNDER_SUFFIX = new Set(["Man of Parts", "Pouenat"]);
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
                              onMouseEnter={() => setActiveSlug(d.slug)}
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
                                    Desktop only; faint by default, brightens on active/hover. */}
                                <ImageIcon
                                  aria-hidden="true"
                                  strokeWidth={1.25}
                                  className={cn(
                                    "hidden md:inline-block align-middle ml-2 -translate-y-[1px]",
                                    "h-[10px] w-[10px] transition-all duration-500",
                                    isActive
                                      ? "opacity-90 text-gold"
                                      : "opacity-30 text-cream/80 group-hover:opacity-70"
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
        {directoryLabels(cn(
          "absolute flex items-center gap-10 text-white w-fit pointer-events-auto md:hidden z-30",
          isMobileOrPwa
            ? "left-1/2 -translate-x-1/2 justify-center px-6"
            : "left-6 sm:left-[22rem] md:left-[26rem] lg:left-[28rem]",
          isStandalone
            ? "pt-6 bottom-[calc(6rem+env(safe-area-inset-bottom))]"
            // Mobile browser: the safe frame is already below the fixed header.
            : "pt-2 top-2"
        ))}


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
                        groupedResults.flatMap(([, items]) => items).map((d: any) => (
                          <li key={d.slug}>
                            <Link
                              to={`/designers/${d.slug}`}
                              state={{ fromDesignersHero: true }}
                              onClick={() => setSearchOpen(false)}
                              className="flex items-center gap-3 px-5 py-2 font-body text-[15px] text-white/85 hover:text-white hover:bg-white/[0.04] transition-colors"
                            >
                              <DesignerRowThumb src={d.image_url || d.hero_image_url} alt={d.name} />

                              <span className="truncate">{displayDesignerName(d.name)}</span>
                            </Link>
                          </li>
                        ))
                      ) : (
                        groupedResults.map(([letter, items]) => {
                          const isOpen = expandedLetters.has(letter);
                          return (
                            <li
                              key={letter}
                              data-designer-letter={letter}
                              className="flex flex-col border-b border-white/[0.06] last:border-b-0"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLetters((prev) => {
                                    if (prev.has(letter)) {
                                      if (activeAccordionLetter === letter) setActiveAccordionLetter(null);
                                      return new Set();
                                    }
                                    setActiveAccordionLetter(letter);
                                    return new Set([letter]);
                                  })
                                }
                                aria-expanded={isOpen}
                                className="w-full flex items-center justify-between px-5 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
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
                                  {items.map((d: any) => (
                                    <li key={d.slug}>
                                      <Link
                                        to={`/designers/${d.slug}`}
                                        state={{ fromDesignersHero: true }}
                                        onClick={() => setSearchOpen(false)}
                                        className="flex items-center gap-3 px-5 py-2 font-body text-[15px] text-white/85 hover:text-white hover:bg-white/[0.04] transition-colors"
                                      >
                                        <DesignerRowThumb src={d.image_url || d.hero_image_url} alt={d.name} />
                                        <span className="truncate">{displayDesignerName(d.name)}</span>
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
                                  if (prev.has(letter)) {
                                    if (activeAccordionLetter === letter) setActiveAccordionLetter(null);
                                    return new Set();
                                  }
                                  setActiveAccordionLetter(letter);
                                  return new Set([letter]);
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







          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default DesignersHoverHero;
