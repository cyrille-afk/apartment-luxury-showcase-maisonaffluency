import { useEffect, useState, useRef, lazy, Suspense } from "react";
import Hero from "@/components/Hero";

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
// ExitIntentBanner is deferred — not even fetched until 5s after load to avoid
// competing for bandwidth with LCP-critical resources on mobile.
const ExitIntentBanner = lazy(() => import("@/components/ExitIntentBanner"));

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
  const mainRef = useRef<HTMLElement>(null);

  // Stagger non-LCP content so hero image wins bandwidth on mobile.
  // Only deep-links (designer/collectible/atelier profiles) bypass delays.
  // Section hashes (#designers, #brands) still wait for hero to load first,
  // then mount sections and scroll — preserving LCP on mobile.
  useEffect(() => {
    if (isDeepLink()) {
      setShowNavigation(true);
      setShowScrollProgress(true);
      setShowBelowFoldSections(true);
      return;
    }

    // Wait for the hero image (LCP element) to finish loading before
    // allowing lazy chunks to compete for bandwidth.
    const heroImg = document.querySelector<HTMLImageElement>('#home img');

    const revealAfterHero = () => {
      // Navigation is above-fold — show first
      setShowNavigation(true);
      // Stagger below-fold + scroll indicator slightly so Navigation chunk
      // doesn't compete with Overview/Gallery chunks on mobile.
      requestAnimationFrame(() => {
        setShowScrollProgress(true);
        setShowBelowFoldSections(true);
      });
    };

    if (heroImg?.complete) {
      revealAfterHero();
    } else if (heroImg) {
      heroImg.addEventListener('load', revealAfterHero, { once: true });
      const timeout = setTimeout(revealAfterHero, 4000);
      heroImg.addEventListener('error', revealAfterHero, { once: true });
      return () => {
        clearTimeout(timeout);
        heroImg.removeEventListener('load', revealAfterHero);
        heroImg.removeEventListener('error', revealAfterHero);
      };
    } else {
      revealAfterHero();
    }
  }, []);

  // On mount with a section hash (e.g. #brands), scroll to that section
  // once the lazy content has mounted.
  useEffect(() => {
    const sectionId = parseSectionHash(window.location.hash);
    if (!sectionId || sectionId === "home") return;

    // Wait for Suspense boundaries to resolve
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "start" });
      } else if (attempts < 15) {
        attempts++;
        setTimeout(tryScroll, 200);
      }
    };
    // Small initial delay to let React mount lazy components
    setTimeout(tryScroll, 100);
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
    const id = setTimeout(() => setShowBanner(true), 30000);
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
        sectionEl.scrollIntoView({ behavior: "instant", block: "start" });
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

      <main className="min-h-screen overflow-x-hidden">
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
            <section id="designers" className="scroll-mt-20 md:scroll-mt-24" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1800px' }}>
              <Suspense fallback={<SectionFallback />}>
                <FeaturedDesigners />
              </Suspense>
            </section>
            <section id="collectibles" className="scroll-mt-20 md:scroll-mt-24" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1800px' }}>
              <Suspense fallback={<SectionFallback />}>
                <Collectibles />
              </Suspense>
            </section>
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

      {showBanner && (
        <Suspense fallback={null}>
          <ExitIntentBanner />
        </Suspense>
      )}
    </>
  );
};

export default Index;

