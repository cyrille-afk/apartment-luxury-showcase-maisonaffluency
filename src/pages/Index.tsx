import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import Hero from "@/components/Hero";
import useScrollDepthTracking from "@/hooks/useScrollDepthTracking";


// Navigation is heavy (Radix Sheet, Tooltip, DropdownMenu) — lazy-load it
const Navigation = lazy(() => import("@/components/Navigation"));

// Lazy-load everything below the fold to reduce initial JS
const Overview = lazy(() => import("@/components/Overview"));
const Gallery = lazy(() => import("@/components/Gallery"));
const ScrollProgress = lazy(() => import("@/components/ScrollProgress"));
const CuratingTeam = lazy(() => import("@/components/CuratingTeam"));
const QuickJumpMenu = lazy(() => import("@/components/QuickJumpMenu"));
const DesignDetails = lazy(() => import("@/components/DesignDetails"));
const ContactInquiry = lazy(() => import("@/components/ContactInquiry"));
const Footer = lazy(() => import("@/components/Footer"));
const FeaturedDesigners = lazy(() => import("@/components/FeaturedDesigners"));
const Collectibles = lazy(() => import("@/components/Collectibles"));
const BrandsAteliers = lazy(() => import("@/components/BrandsAteliers"));
const ProductGrid = lazy(() => import("@/components/ProductGrid"));

// ExitIntentBanner is deferred — not even fetched until 5s after load to avoid
// competing for bandwidth with LCP-critical resources on mobile.
const ExitIntentBanner = lazy(() => import("@/components/ExitIntentBanner"));
const StickyBottomNav = lazy(() => import("@/components/StickyBottomNav"));
const CompareFab = lazy(() => import("@/components/CompareFab"));
const CompareDrawer = lazy(() => import("@/components/CompareDrawer"));
const ParallaxInterlude = lazy(() => import("@/components/ParallaxInterlude"));

/**
 * Parse deep-link hash: #designer/<id>, #collectible/<id>, #atelier/<slug>
 */
function parseDeepLink(hash: string) {
  const match = hash.match(/^#(designer|collectible|atelier)\/(.+)$/);
  if (!match) return null;
  return { section: match[1] as "designer" | "collectible" | "atelier", id: decodeURIComponent(match[2]) };
}

/**
 * Tracked section IDs for scroll-based hash updates.
 * Order matters — later sections win when multiple are visible.
 */
const TRACKED_SECTIONS = ["home", "overview", "gallery", "curating-team", "designers", "collectibles", "brands", "details", "contact"] as const;

/**
 * Parse a simple section hash like #brands, #designers (not deep-links).
 */
function parseSectionHash(hash: string): string | null {
  const clean = hash.replace(/^#/, "");
  return (TRACKED_SECTIONS as readonly string[]).includes(clean) ? clean : null;
}

/** Global flag so components can skip entrance animations on deep-link */
export const isDeepLink = () => !!parseDeepLink(window.location.hash);

/** Check if hash points to a section (for fast restore on refresh) */
const hasSectionHash = () => !!parseSectionHash(window.location.hash);
const hasAnyHash = () => isDeepLink() || hasSectionHash();

/** Minimal loading placeholder for lazy sections */
const SectionFallback = () => (
  <div className="w-full py-24 flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

const scheduleWhenIdle = (callback: () => void, timeout: number) => {
  const win = window as any;

  if (typeof win.requestIdleCallback === "function") {
    const idleId = win.requestIdleCallback(callback, { timeout });
    return () => win.cancelIdleCallback?.(idleId);
  }

  const timeoutId = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(timeoutId);
};

const Index = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showNavigation, setShowNavigation] = useState(false);
  const [showScrollProgress, setShowScrollProgress] = useState(false);
  const [showBelowFoldSections, setShowBelowFoldSections] = useState(() => isDeepLink());
  const needsScrollRestore = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  // Track scroll depth for GA4 engagement
  useScrollDepthTracking();

  // Stagger non-LCP content so hero image wins bandwidth on mobile.
  // Only deep-links (designer/collectible/atelier profiles) bypass delays.
  // Section hashes (#designers, #brands) still wait for hero to load first,
  // then mount sections and scroll — preserving LCP on mobile.
  useEffect(() => {
    // Deep-links and scroll restore both need sections immediately
    const hasRestore = Number(sessionStorage.getItem("__scroll_y") || 0) > 0;
    if (isDeepLink() || hasRestore) {
      needsScrollRestore.current = hasRestore;
      setShowNavigation(true);
      setShowScrollProgress(true);
      setShowBelowFoldSections(true);
      return;
    }

    // Wait for the hero image (LCP element) to finish loading before
    // allowing lazy chunks to compete for bandwidth.
    const heroImg = document.querySelector<HTMLImageElement>('#home img');
    let cancelDeferredReveal: (() => void) | null = null;
    let timeoutId: number | null = null;

    const revealAfterHero = () => {
      // Navigation is above-fold — show first
      setShowNavigation(true);

      // Defer non-critical UI + below-fold sections until idle time.
      // This keeps mobile main-thread/network free for LCP.
      if (!cancelDeferredReveal) {
        cancelDeferredReveal = scheduleWhenIdle(() => {
          setShowScrollProgress(true);
          setShowBelowFoldSections(true);
        }, 500);
      }
    };

    if (heroImg?.complete) {
      revealAfterHero();
    } else if (heroImg) {
      heroImg.addEventListener('load', revealAfterHero, { once: true });
      timeoutId = window.setTimeout(revealAfterHero, 4000);
      heroImg.addEventListener('error', revealAfterHero, { once: true });
    } else {
      revealAfterHero();
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      heroImg?.removeEventListener('load', revealAfterHero);
      heroImg?.removeEventListener('error', revealAfterHero);
      cancelDeferredReveal?.();
    };
  }, []);

  // Persist scroll position to sessionStorage for refresh restoration
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const saveScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sessionStorage.setItem("__scroll_y", String(window.scrollY));
      }, 150);
    };
    window.addEventListener("scroll", saveScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", saveScroll);
    };
  }, []);

  // On mount: restore exact scroll position OR scroll to section hash
  useEffect(() => {
    if (!showBelowFoldSections) return;

    const savedY = sessionStorage.getItem("__scroll_y");
    const sectionId = parseSectionHash(window.location.hash);
    const instant = "instant" as ScrollBehavior;

    if (savedY && Number(savedY) > 0) {
      const targetY = Number(savedY);
      let waitAttempts = 0;

      const tryRestore = () => {
        // Wait until the document is tall enough to scroll to the saved position
        if (document.documentElement.scrollHeight >= targetY + window.innerHeight * 0.5) {
          window.scrollTo({ top: targetY, behavior: instant });
          sessionStorage.removeItem("__scroll_y");

          // Settle loop: content-visibility sections change height after scroll.
          // Re-check and correct position for up to ~3s.
          let settlePass = 0;
          const maxSettlePasses = 15;
          const settle = () => {
            settlePass++;
            const currentY = window.scrollY;
            // If the page shifted us away from target, jump back
            if (Math.abs(currentY - targetY) > 3) {
              window.scrollTo({ top: targetY, behavior: instant });
            }
            if (settlePass < maxSettlePasses) {
              setTimeout(settle, 200);
            }
          };
          setTimeout(settle, 200);
        } else if (waitAttempts < 25) {
          waitAttempts++;
          setTimeout(tryRestore, 200);
        } else {
          if (sectionId && sectionId !== "home") {
            document.getElementById(sectionId)?.scrollIntoView({ behavior: instant, block: "start" });
          }
          sessionStorage.removeItem("__scroll_y");
        }
      };
      setTimeout(tryRestore, 100);
    } else if (sectionId && sectionId !== "home") {
      let attempts = 0;
      const tryScroll = () => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: instant, block: "start" });
        } else if (attempts < 15) {
          attempts++;
          setTimeout(tryScroll, 200);
        }
      };
      setTimeout(tryScroll, 100);
    }
  }, [showBelowFoldSections]);

  // Track which section is in view and update the URL hash silently.
  // Uses replaceState to avoid polluting browser history.
  useEffect(() => {
    if (!showBelowFoldSections) return;

    // Don't overwrite deep-link hashes (designer/collectible/atelier)
    if (isDeepLink()) return;

    const sectionEls = TRACKED_SECTIONS
      .map(id => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (sectionEls.length === 0) return;

    let currentHash = window.location.hash.replace(/^#/, "") || "home";
    // Debounce to avoid excessive replaceState calls
    let rafId: number | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topSection: string | null = null;
        let topY = Infinity;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.boundingClientRect.top < topY) {
            topY = entry.boundingClientRect.top;
            topSection = entry.target.id;
          }
        }
        if (topSection && topSection !== currentHash) {
          currentHash = topSection;
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            const newHash = topSection === "home" ? "" : `#${topSection}`;
            const url = window.location.pathname + window.location.search + newHash;
            window.history.replaceState(null, "", url);
          });
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    // Small delay to ensure sections are in the DOM
    const timerId = setTimeout(() => {
      sectionEls.forEach(el => observer.observe(el));
    }, 500);

    return () => {
      clearTimeout(timerId);
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [showBelowFoldSections]);

  // Keep exit-intent banner completely out of the critical performance window
  useEffect(() => {
    const id = setTimeout(() => setShowBanner(true), 12000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const link = parseDeepLink(window.location.hash);
    if (!link) return;

    const sectionMap: Record<string, string> = {
      designer: "designers",
      collectible: "collectibles",
      atelier: "brands",
    };
    const sectionId = sectionMap[link.section];

    // Use requestAnimationFrame to act as soon as DOM is painted
    const raf = requestAnimationFrame(() => {
      // Instant scroll for fast landing
      const sectionEl = document.getElementById(sectionId);
      if (sectionEl) {
        const navHeight = document.querySelector('nav')?.getBoundingClientRect().height ?? 64;
        const top = sectionEl.getBoundingClientRect().top + window.scrollY - navHeight + 2;
        window.scrollTo({ top, behavior: "instant" });
      }

      // Retry dispatching until the lazy component has mounted and can handle it
      let attempts = 0;
      const maxAttempts = 20; // up to ~4s
      const tryDispatch = () => {
        attempts++;
        const targetEl = document.getElementById(`designer-${link.id}`) ||
                         document.getElementById(`collectible-${link.id}`) ||
                         document.getElementById(`brand-${link.id}`);
        window.dispatchEvent(
          new CustomEvent("deeplink-open-profile", {
            detail: { section: link.section, id: link.id },
          })
        );
        // If element not yet in DOM and we haven't exhausted retries, try again
        if (!targetEl && attempts < maxAttempts) {
          setTimeout(tryDispatch, 200);
        }
      };
      setTimeout(tryDispatch, 500);
    });

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {showScrollProgress && (
        <Suspense fallback={null}>
          <ScrollProgress />
        </Suspense>
      )}

      {showNavigation && (
        <Suspense fallback={null}>
          <Navigation />
        </Suspense>
      )}

      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded focus:shadow-lg focus:border focus:border-border font-body text-sm">
        Skip to main content
      </a>
      <main id="main-content" className="min-h-screen overflow-x-hidden">
        <section id="home">
          <Hero />
        </section>

        {showBelowFoldSections ? (
          <>
            <section id="overview" className="scroll-mt-20 md:scroll-mt-24">
              <Suspense fallback={<SectionFallback />}>
                <Overview />
              </Suspense>
            </section>
            <section id="gallery" className="scroll-mt-20 md:scroll-mt-24">
              <Suspense fallback={<SectionFallback />}>
                <Gallery />
              </Suspense>
            </section>
            <section id="curating-team" className="scroll-mt-20 md:scroll-mt-24" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 900px' }}>
              <Suspense fallback={<SectionFallback />}>
                <CuratingTeam />
              </Suspense>
            </section>

            {/* Interlude 1: After Curating Team → Before Designers */}
            <Suspense fallback={null}>
              <ParallaxInterlude
                imageUrl="https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=1920&q=80&auto=format&fit=crop"
                quote="Every piece of furniture tells a story — of the hands that shaped it, the material that gave it life, and the space it was destined to inhabit"
                attribution="The Maison Affluency Curation Philosophy"
                overlayOpacity={0.55}
              />
            </Suspense>

            <Suspense fallback={null}>
              <ProductGrid sectionScope="designers" />
            </Suspense>
            <section id="designers" className="scroll-mt-20 md:scroll-mt-24" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1800px' }}>
              <Suspense fallback={<SectionFallback />}>
                <FeaturedDesigners />
              </Suspense>
            </section>
            <Suspense fallback={null}>
              <ProductGrid sectionScope="collectibles" />
            </Suspense>
            <section id="collectibles" className="scroll-mt-20 md:scroll-mt-24" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1800px' }}>
              <Suspense fallback={<SectionFallback />}>
                <Collectibles />
              </Suspense>
            </section>
            <Suspense fallback={null}>
              <ProductGrid sectionScope="ateliers" />
            </Suspense>
            <section id="brands" className="scroll-mt-20 md:scroll-mt-24" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1800px' }}>
              <Suspense fallback={<SectionFallback />}>
                <BrandsAteliers />
              </Suspense>
            </section>
            <section id="details" className="scroll-mt-20 md:scroll-mt-24" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
              <Suspense fallback={<SectionFallback />}>
                <DesignDetails />
              </Suspense>
            </section>
            <section id="contact" className="scroll-mt-20 md:scroll-mt-24" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
              <Suspense fallback={<SectionFallback />}>
                <ContactInquiry />
              </Suspense>
            </section>
            <Suspense fallback={null}>
              <Footer />
            </Suspense>
          </>
        ) : null}
      </main>

      {showBelowFoldSections ? (
        <Suspense fallback={null}>
          <QuickJumpMenu />
        </Suspense>
      ) : null}

      {showBelowFoldSections ? (
        <Suspense fallback={null}>
          <StickyBottomNav />
        </Suspense>
      ) : null}

      {showBanner && (
        <Suspense fallback={null}>
          <ExitIntentBanner />
        </Suspense>
      )}

      {showBelowFoldSections && (
        <Suspense fallback={null}>
          <CompareFab />
          <CompareDrawer />
        </Suspense>
      )}
    </>
  );
};

export default Index;

