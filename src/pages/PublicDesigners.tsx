import React, { lazy, Suspense } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { categoryUrl } from "@/lib/categorySlugs";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import DesignersHoverHero from "@/components/DesignersHoverHero";

// Route-split heavy sub-components so they don't land in the initial
// /designers JS chunk. The hero is what first paint depends on; the
// directory + footer only mount after desktop handoff / scroll.
const DesignersDirectory = lazy(() => import("@/components/DesignersDirectory"));
const Footer = lazy(() => import("@/components/Footer"));

const isStandaloneDisplay = () => {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("source") === "pwa" ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
};


// ─── Back to Top Button ──────────────────────────────────────────────────────
function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back-to-top"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 md:bottom-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:opacity-80 transition-opacity"
          aria-label="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}


// ─── Main Page ───────────────────────────────────────────────────────────────
const PublicDesigners = () => {
  const [searchParams] = useSearchParams();
  const initialLetter = searchParams.get("letter") || undefined;
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
  const [isMobileOrPwa, setIsMobileOrPwa] = useState(false);
  const locked = isMobileOrPwa && !hasDeepLink;

  // Directory only mounts after the landing handoff completes — a deep-link,
  // an explicit unlock event, or the user scrolling past the hero. This
  // eliminates the spinner/cards flash under the hero on first paint.
  const [directoryReady, setDirectoryReady] = useState(hasDeepLink);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const standaloneMql = window.matchMedia?.("(display-mode: standalone)");
    const update = () => {
      setIsMobileOrPwa(mql.matches || isStandaloneDisplay());
    };
    update();
    mql.addEventListener("change", update);
    standaloneMql?.addEventListener?.("change", update);
    return () => {
      mql.removeEventListener("change", update);
      standaloneMql?.removeEventListener?.("change", update);
    };
  }, []);

  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevOverscroll = (body.style as any).overscrollBehavior;
    const prevBodyBg = body.style.backgroundColor;
    // Only lock body; leaving html scrollable avoids an iOS Chrome quirk that
    // freezes nested overflow-y-auto scrollers when both html+body are hidden.
    body.style.overflow = "hidden";
    (body.style as any).overscrollBehavior = "none";
    // Match body background to the hero so the iOS toolbar blur shows the
    // dark image instead of the default cream page background.
    body.style.backgroundColor = "#0a0a0a";
    // Force scroll to top: on back-navigation the browser restores the previous
    // window.scrollY, but with body overflow locked the hero can't be scrolled
    // back — leaving the top half cut off and the bottom half empty.
    // Disable browser scroll restoration for this route while locked, and reset.
    const prevRestoration = (window.history as any).scrollRestoration;
    try { (window.history as any).scrollRestoration = "manual"; } catch { /* ignore */ }
    window.scrollTo(0, 0);
    // Run again on the next frames in case the browser re-applies scroll after paint.
    const raf1 = requestAnimationFrame(() => window.scrollTo(0, 0));
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, 0)));
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      (body.style as any).overscrollBehavior = prevOverscroll;
      body.style.backgroundColor = prevBodyBg;
      try { (window.history as any).scrollRestoration = prevRestoration ?? "auto"; } catch { /* ignore */ }
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
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

  useEffect(() => {
    if (hasDeepLink) setDirectoryReady(true);
  }, [hasDeepLink]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />

      <div className="pt-[var(--header-h)]">
        <h1 className="sr-only">Designers &amp; Ateliers</h1>

        <div className={locked ? "h-[calc(100lvh-var(--header-h))] overflow-hidden" : "pb-20"}>
          <div
            className={locked ? "relative md:h-full" : "relative min-h-[calc(100lvh-var(--header-h))] bg-[#0a0a0a]"}
          >

            <DesignersHoverHero />
            
          </div>
          {!isMobileOrPwa && !locked && directoryReady && (
            <Suspense fallback={<div className="min-h-[40vh]" aria-hidden="true" />}>
              <DesignersDirectory mode="designers" initialLetter={initialLetter} initialExpand={initialExpand} showHeader={false} showAlphabetBar={false} />
            </Suspense>
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
