import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import Hero from "@/components/Hero";
import useScrollDepthTracking from "@/hooks/useScrollDepthTracking";
import { scrollToSection } from "@/lib/scrollToSection";

// Retry wrapper for dynamic imports — handles stale Vite chunks after HMR
function lazyRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err) => {
      // If a chunk fails to load, try once more after a short delay
      console.warn("Dynamic import failed, retrying…", err);
      return new Promise<{ default: React.ComponentType<any> }>((resolve) =>
        setTimeout(() => resolve(factory()), 1500)
      );
    })
  );
}

// Lazy-load FeaturedReadBanner & Navigation to keep lucide-react out of the initial chunk
const FeaturedReadBanner = lazyRetry(() => import("@/components/FeaturedReadBanner"));
const Navigation = lazyRetry(() => import("@/components/Navigation"));


// Lazy-load everything below the fold to reduce initial JS

const Gallery = lazyRetry(() => import("@/components/Gallery"));
const ScrollProgress = lazyRetry(() => import("@/components/ScrollProgress"));
const CuratingTeam = lazyRetry(() => import("@/components/CuratingTeam"));
const QuickJumpMenu = lazyRetry(() => import("@/components/QuickJumpMenu"));
const DesignDetails = lazyRetry(() => import("@/components/DesignDetails"));
const ContactInquiry = lazyRetry(() => import("@/components/ContactInquiry"));
const Footer = lazyRetry(() => import("@/components/Footer"));
const DesignersDirectory = lazyRetry(() => import("@/components/DesignersDirectory"));
const Collectibles = lazyRetry(() => import("@/components/Collectibles"));
const ProductGrid = lazyRetry(() => import("@/components/ProductGrid"));

// ExitIntentBanner is deferred — not even fetched until 5s after load to avoid
// competing for bandwidth with LCP-critical resources on mobile.
const ExitIntentBanner = lazyRetry(() => import("@/components/ExitIntentBanner"));
const StickyBottomNav = lazyRetry(() => import("@/components/StickyBottomNav"));
const JournalTeaser = lazyRetry(() => import("@/components/JournalTeaser"));
const InstagramFeed = lazyRetry(() => import("@/components/InstagramFeed"));
const CompareFab = lazyRetry(() => import("@/components/CompareFab"));
const CompareDrawer = lazyRetry(() => import("@/components/CompareDrawer"));
const TradeFloatingCTA = lazy(() => import("@/components/TradeFloatingCTA"));
const ParallaxInterlude = lazy(() => import("@/components/ParallaxInterlude"));
const ApartmentTourInterlude = lazyRetry(() => import("@/components/ApartmentTourInterlude"));

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

/** Category route deep-link (e.g. /products-category/seating/armchairs)
 *  must reveal below-fold sections immediately so the filtered grid mounts
 *  and the scroll target (#designers) exists for CategoryRoute's poller. */
const isCategoryRoute = () =>
  typeof window !== "undefined" &&
  /^\/products-category\//.test(window.location.pathname);

/** Global flag so components can skip entrance animations on deep-link */
export const isDeepLink = () =>
  !!parseDeepLink(window.location.hash) || isCategoryRoute();

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
  // Deep-links and explicit section hashes from shared links should land fast.
  useEffect(() => {
    const sectionHash = parseSectionHash(window.location.hash);
    const hasExplicitSectionHash = !!sectionHash && sectionHash !== "home";

    // If URL explicitly asks for a section, it must win over stale scroll restore.
    if (hasExplicitSectionHash) {
      sessionStorage.removeItem("__scroll_y");
      needsScrollRestore.current = false;
      setShowNavigation(true);
      setShowScrollProgress(true);
      setShowBelowFoldSections(true);
      return;
    }

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

    // Explicit section hash should always win over any stored scroll position.
    if (sectionId && sectionId !== "home") {
      sessionStorage.removeItem("__scroll_y");
      let attempts = 0;
      const tryScroll = () => {
        const el = document.getElementById(sectionId);
        if (el) {
          scrollToSection(sectionId, instant);
        } else if (attempts < 15) {
          attempts++;
          setTimeout(tryScroll, 200);
        }
      };
      setTimeout(tryScroll, 100);
      return;
    }

    // Category deep-links manage their own landing/scroll behavior.
    // Restoring an old homepage scroll position here can wrongly dump mobile
    // users back at the landing page after choosing a category/subcategory.
    if (isCategoryRoute()) {
      sessionStorage.removeItem("__scroll_y");
      return;
    }

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
          sessionStorage.removeItem("__scroll_y");
        }
      };
      setTimeout(tryRestore, 100);
    }
  }, [showBelowFoldSections]);

  // Track which section is in view without mutating the URL.
  useEffect(() => {
    if (!showBelowFoldSections) return;
    if (isDeepLink()) return;

    const sectionEls = TRACKED_SECTIONS
      .map(id => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      () => {
        // Intentionally keep homepage URLs clean — no section hashes.
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    const timerId = setTimeout(() => {
      sectionEls.forEach(el => observer.observe(el));
    }, 500);

    return () => {
      clearTimeout(timerId);
      observer.disconnect();
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
      <Helmet>
        <title>Maison Affluency | Luxury Furniture &amp; Collectible Design</title>
        <meta name="description" content="Discover exceptional collectible furniture, bespoke interiors, and contemporary design by world-renowned designers and ateliers. Based in Singapore." />
        <link rel="canonical" href="https://www.maisonaffluency.com" />
        <meta property="og:title" content="Maison Affluency — Curated Luxury Furniture &amp; Collectible Design" />
        <meta property="og:description" content="Discover exceptional collectible furniture, bespoke interiors, and contemporary design by world-renowned designers and ateliers. Based in Singapore." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.maisonaffluency.com" />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Maison Affluency — Curated Luxury Furniture &amp; Collectible Design" />
        <meta name="twitter:description" content="Discover exceptional collectible furniture, bespoke interiors, and contemporary design by world-renowned designers and ateliers. Based in Singapore." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg" />
      </Helmet>
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

      <Suspense fallback={null}>
        <FeaturedReadBanner />
      </Suspense>

      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded focus:shadow-lg focus:border focus:border-border font-body text-sm">
        Skip to main content
      </a>
      <main id="main-content" className="min-h-screen overflow-x-hidden">
        {/* Hero, gallery, interludes are skipped on /products-category/* so the
            page feels like a real PLP — user lands directly on the filtered grid. */}
        {!isCategoryRoute() && (
          <section id="home">
            <Hero />
          </section>
        )}

        {showBelowFoldSections ? (
          <>
            {!isCategoryRoute() && (
              <>
                <div className="bg-white">
                  <section id="overview" className="scroll-mt-20 md:scroll-mt-24">
                    <Suspense fallback={null}>
                      <ApartmentTourInterlude compact />
                    </Suspense>
                  </section>
                  <section id="gallery" className="scroll-mt-20 md:scroll-mt-24">
                    <Suspense fallback={<SectionFallback />}>
                      <Gallery />
                    </Suspense>
                  </section>
                </div>

                {/* Interlude 1: After Curating Team → Before Designers */}
                <Suspense fallback={null}>
                  <ParallaxInterlude
                    imageUrl="https://res.cloudinary.com/dif1oamtj/image/upload/w_1600,q_auto,f_auto/v1773373912/Screen_Shot_2026-03-13_at_11.51.17_AM_egvsuz.png"
                    quote="Every piece of furniture tells a story — of the hands that shaped it, the material that gave it life, and the space it was destined to inhabit"
                    attribution="The Maison Affluency Curation Philosophy"
                    overlayOpacity={0}
                    objectPosition="left center"
                  />
                </Suspense>
              </>
            )}

            <Suspense fallback={null}>
              <ProductGrid sectionScope="designers" />
            </Suspense>
            <section id="designers" className="scroll-mt-20 md:scroll-mt-24">
              <Suspense fallback={<SectionFallback />}>
                <DesignersDirectory showTradeCTA={false} />
              </Suspense>
            </section>

            {!isCategoryRoute() && (
              <>
                {/* Interlude 2: After Designers → Before Collectibles */}
                <Suspense fallback={null}>
                  <ParallaxInterlude
                    imageUrl="https://res.cloudinary.com/dif1oamtj/image/upload/w_1600,q_auto,f_auto/v1773372909/Screen_Shot_2026-03-13_at_11.34.42_AM_icbzuz.png"
                    quote="Collectible design exists at the intersection of art and function — where rarity becomes a conversation and craftsmanship becomes legacy"
                    attribution="On Collectible Design"
                    overlayOpacity={0}
                    reverse
                  />
                </Suspense>

                <Suspense fallback={null}>
                  <ProductGrid sectionScope="collectibles" />
                </Suspense>
                <section id="collectibles" className="scroll-mt-20 md:scroll-mt-24" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1800px' }}>
                  <Suspense fallback={<SectionFallback />}>
                    <Collectibles />
                  </Suspense>
                </section>

                {/* Interlude 3: After Collectibles → Before Ateliers */}
                <Suspense fallback={null}>
                  <ParallaxInterlude
                    imageUrl="https://res.cloudinary.com/dif1oamtj/image/upload/w_1600,q_auto,f_auto/v1773374192/Screen_Shot_2026-03-13_at_11.55.51_AM_vbstnu.png"
                    quote="An atelier is more than a workshop — it is a sanctuary where tradition meets innovation, and every detail is an act of devotion"
                    attribution="The Atelier Experience"
                    overlayOpacity={0}
                  />
                </Suspense>

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
                  <JournalTeaser />
                </Suspense>
                <Suspense fallback={null}>
                  <InstagramFeed />
                </Suspense>
              </>
            )}
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
          <TradeFloatingCTA />
        </Suspense>
      )}
    </>
  );
};

export default Index;

