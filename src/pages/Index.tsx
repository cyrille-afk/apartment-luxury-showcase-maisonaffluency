import { useEffect, useState, lazy, Suspense } from "react";
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

/** Global flag so components can skip entrance animations on deep-link */
export const isDeepLink = () => !!parseDeepLink(window.location.hash);

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
  const [showBelowFoldSections, setShowBelowFoldSections] = useState(false);

  // Defer non-critical UI/chunks so hero image can win bandwidth contention.
  useEffect(() => {
    if (isDeepLink()) {
      setShowNavigation(true);
      setShowScrollProgress(true);
      setShowBelowFoldSections(true);
      return;
    }

    const cleanups = [
      scheduleWhenIdle(() => setShowNavigation(true), 350),
      scheduleWhenIdle(() => setShowScrollProgress(true), 600),
      scheduleWhenIdle(() => setShowBelowFoldSections(true), 1200),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  // Defer ExitIntentBanner chunk fetch until 5s after mount
  useEffect(() => {
    const id = setTimeout(() => setShowBanner(true), 5000);
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
      {showScrollProgress ? (
        <Suspense fallback={null}>
          <ScrollProgress />
        </Suspense>
      ) : null}

      {showNavigation ? (
        <Suspense fallback={null}>
          <Navigation />
        </Suspense>
      ) : null}

      <main className="min-h-screen overflow-x-hidden">
        <section id="home">
          <Hero />
        </section>
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

        {showBelowFoldSections ? (
          <>
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

