import { setDarkIosChrome } from "@/lib/iosChrome";
import React, { lazy, Suspense } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { categoryUrl } from "@/lib/categorySlugs";
import { Helmet } from "react-helmet-async";
import { isPwaStandaloneDisplay } from "@/lib/pwaMode";
import { markDesignersLandingScrollLock, releaseDesignersLandingScrollLock } from "@/lib/designersScrollLock";

import { ChevronUp } from "lucide-react";
import { useState, useEffect, useLayoutEffect } from "react";
import Navigation from "@/components/Navigation";
import DesignersHoverHero from "@/components/DesignersHoverHero";


// Route-split heavy sub-components so they don't land in the initial
// /designers JS chunk. The hero is what first paint depends on; the
// directory + footer only mount after desktop handoff / scroll.
const DesignersDirectory = lazy(() => import("@/components/DesignersDirectory"));
const Footer = lazy(() => import("@/components/Footer"));

// ─── Back to Top Button ──────────────────────────────────────────────────────
function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-24 md:bottom-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:opacity-80 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none"
      }`}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}


// ─── Main Page ───────────────────────────────────────────────────────────────
const PublicDesigners = () => {
  const [searchParams] = useSearchParams();
  const openFindSheet = searchParams.get("find") === "1";
  const initialLetter = openFindSheet ? undefined : searchParams.get("letter") || undefined;
  const initialExpand = searchParams.get("expand") || undefined;
  const legacyCat = searchParams.get("category");
  const legacySub = searchParams.get("subcategory");

  // Redirect legacy ?category=...&subcategory=... → /products-category/<cat>/<sub>
  if (legacyCat) {
    return <Navigate to={categoryUrl(legacyCat, legacySub)} replace />;
  }

  return (
    <>
      <Helmet>
        <title>Designers & Ateliers — Maison Affluency</title>
        <meta
          name="description"
          content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting."
        />
        <link rel="canonical" href="https://maisonaffluency.com/designers" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta property="og:url" content="https://maisonaffluency.com/designers" />
        <meta property="og:title" content="Designers & Ateliers — Maison Affluency" />
        <meta property="og:description" content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Designers & Ateliers — Maison Affluency" />
        <meta name="twitter:description" content="Discover our curated selection of ateliers and designers — from historical masters to contemporary creators of collectible furniture and lighting." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
      </Helmet>

      <ScrollLockedDesigners initialLetter={initialLetter} initialExpand={initialExpand} />
    </>
  );
};

/**
 * The /designers landing is locked to the viewport on mobile only. On desktop
 * the page scrolls normally so the directory below is reachable, while the
 * "Find A Designer" sheet still provides quick access.
 */
function ScrollLockedDesigners({
  initialLetter,
  initialExpand,
}: {
  initialLetter?: string;
  initialExpand?: string;
}) {
  const hasDeepLink = Boolean(initialLetter || initialExpand);
  const [isMobileOrPwa, setIsMobileOrPwa] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches || isPwaStandaloneDisplay();
  });
  const locked = isMobileOrPwa && !hasDeepLink;

  // Directory only mounts after the landing handoff completes — a deep-link,
  // an explicit unlock event, or the user scrolling past the hero. This
  // eliminates the spinner/cards flash under the hero on first paint.
  const [directoryReady, setDirectoryReady] = useState(() => {
    if (typeof window === "undefined") return false;
    // Desktop: mount the directory immediately so the white runway section
    // peeks below the 85vh hero on first paint.
    return hasDeepLink || !(window.matchMedia("(max-width: 767px)").matches || isPwaStandaloneDisplay());
  });

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const standaloneMql = window.matchMedia?.("(display-mode: standalone)");
    const update = () => {
      setIsMobileOrPwa(mql.matches || isPwaStandaloneDisplay());
    };
    update();
    mql.addEventListener("change", update);
    standaloneMql?.addEventListener?.("change", update);
    return () => {
      mql.removeEventListener("change", update);
      standaloneMql?.removeEventListener?.("change", update);
    };
  }, []);

  useLayoutEffect(() => {
    if (!locked) {
      releaseDesignersLandingScrollLock();
      return;
    }
    const html = document.documentElement;
    const body = document.body;
    const updateLockedViewport = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      html.style.setProperty("--designers-landing-vh", `${Math.round(viewportHeight)}px`);
    };
    // iOS ignores body overflow alone during toolbar/rubber-band gestures. Pin
    // the body itself while /designers is in the locked mobile/PWA landing so
    // the hero cannot visually lift under the fixed header.
    updateLockedViewport();
    html.style.overflow = "hidden";
    (html.style as any).overscrollBehavior = "none";
    body.style.overflow = "hidden";
    (body.style as any).overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = "0";
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    html.style.height = "var(--designers-landing-vh, 100lvh)";
    // Use the large viewport, not 100dvh: iOS browser chrome sits outside the
    // dynamic viewport, and clipping the fixed body to dvh leaves the bottom
    // toolbar sampling only the black fallback instead of the hero image.
    body.style.height = "var(--designers-landing-vh, 100lvh)";
    body.style.minHeight = "var(--designers-landing-vh, 100lvh)";
    // Keep only a fallback color; the fixed body now extends far enough for the
    // hero image itself to paint behind the iOS toolbar.
    setDarkIosChrome();
    body.style.backgroundColor = "transparent";
    // Force scroll to top: on back-navigation the browser restores the previous
    // window.scrollY, but with body overflow locked the hero can't be scrolled
    // back — leaving the top half cut off and the bottom half empty.
    // Disable browser scroll restoration for this route while locked, and reset.
    markDesignersLandingScrollLock();
    try { (window.history as any).scrollRestoration = "manual"; } catch { /* ignore */ }
    let userInteracted = false;
    const stopReset = () => { userInteracted = true; };
    const forceTop = () => {
      updateLockedViewport();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      if (!userInteracted) window.dispatchEvent(new Event("designersLandingResetScroll"));
    };

    forceTop();
    let frameCount = 0;
    let raf = 0;
    const onFrame = () => {
      forceTop();
      frameCount += 1;
      if (frameCount < 8) raf = requestAnimationFrame(onFrame);
    };
    raf = requestAnimationFrame(onFrame);
    const timers = [80, 180, 360, 720].map((ms) => window.setTimeout(forceTop, ms));
    window.addEventListener("pageshow", forceTop);
    window.addEventListener("resize", updateLockedViewport);
    window.visualViewport?.addEventListener("resize", updateLockedViewport);
    window.visualViewport?.addEventListener("scroll", updateLockedViewport);
    window.addEventListener("touchstart", stopReset, { once: true, passive: true });
    window.addEventListener("pointerdown", stopReset, { once: true, passive: true });
    window.addEventListener("wheel", stopReset, { once: true, passive: true });
    window.addEventListener("keydown", stopReset, { once: true });
    return () => {
      releaseDesignersLandingScrollLock();
      cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("pageshow", forceTop);
      window.removeEventListener("resize", updateLockedViewport);
      window.visualViewport?.removeEventListener("resize", updateLockedViewport);
      window.visualViewport?.removeEventListener("scroll", updateLockedViewport);
      window.removeEventListener("touchstart", stopReset);
      window.removeEventListener("pointerdown", stopReset);
      window.removeEventListener("wheel", stopReset);
      window.removeEventListener("keydown", stopReset);
    };
  }, [locked]);

  // Desktop handoff only. Mobile/PWA intentionally remains a fixed hero with
  // the searchable thumbnail directory sheet, not the card directory below.
  useEffect(() => {
    if (directoryReady) return;
    if (isMobileOrPwa) return;
    if (locked) return; // mobile — stays landing-only until unlocked

    const onUnlock = () => setDirectoryReady(true);
    const onScroll = () => {
      if (window.scrollY > 120) setDirectoryReady(true);
    };
    window.addEventListener("unlockDesignersScroll", onUnlock);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("unlockDesignersScroll", onUnlock);
      window.removeEventListener("scroll", onScroll);
    };
  }, [directoryReady, isMobileOrPwa, locked]);

  // Desktop: warm the directory chunk while the hero is still on screen so the
  // Suspense fallback never paints (which used to flash the black page canvas).
  useEffect(() => {
    if (isMobileOrPwa) return;
    const warm = () => { void import("@/components/DesignersDirectory"); };
    const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void) => number);
    if (idle) { const id = idle(warm); return () => (window as any).cancelIdleCallback?.(id); }
    const t = window.setTimeout(warm, 400);
    return () => window.clearTimeout(t);
  }, [isMobileOrPwa]);

  useEffect(() => {
    if (hasDeepLink) setDirectoryReady(true);
  }, [hasDeepLink]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground">
      <Navigation />

      <div className={locked ? "pt-[var(--header-h)] h-[var(--designers-landing-vh,100lvh)] overflow-hidden" : "pt-[var(--header-h)]"}>
        <h1 className="sr-only">Designers &amp; Ateliers</h1>

        <div className={locked ? "h-[calc(var(--designers-landing-vh,100lvh)-var(--header-h))] overflow-hidden" : "pb-20"}>
          <div
            className={
              locked
                ? "relative md:h-full"
                : "relative min-h-[calc(100lvh-var(--header-h))] md:min-h-0 md:h-auto bg-[#0a0a0a]"
            }
          >
            <DesignersHoverHero />
          </div>
          {!isMobileOrPwa && !locked && directoryReady && (
            <div className="bg-background pt-12 md:pt-16">
              <Suspense fallback={<div className="min-h-[60vh] bg-background" aria-hidden="true" />}>
                <DesignersDirectory mode="designers" initialLetter={initialLetter} initialExpand={initialExpand} showHeader={false} showRunway />
              </Suspense>
            </div>
          )}
        </div>
      </div>

      {!isMobileOrPwa && (
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      )}
      {!isMobileOrPwa && <BackToTopButton />}

    </div>
  );
}



export default PublicDesigners;
