import { useEffect, lazy, Suspense } from "react";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Overview from "@/components/Overview";
import Gallery from "@/components/Gallery";
import ScrollProgress from "@/components/ScrollProgress";
import CuratingTeam from "@/components/CuratingTeam";
import QuickJumpMenu from "@/components/QuickJumpMenu";
import DesignDetails from "@/components/DesignDetails";
import ContactInquiry from "@/components/ContactInquiry";
import Footer from "@/components/Footer";

// Lazy-load heavy sections (each has 100-250+ image imports)
const FeaturedDesigners = lazy(() => import("@/components/FeaturedDesigners"));
const Collectibles = lazy(() => import("@/components/Collectibles"));
const BrandsAteliers = lazy(() => import("@/components/BrandsAteliers"));

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

const Index = () => {
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

      // Short delay for lazy component to hydrate
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("deeplink-open-profile", {
            detail: { section: link.section, id: link.id },
          })
        );
      }, 500);
    });

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <ScrollProgress />
      <Navigation />
      <main className="min-h-screen overflow-x-hidden">
        <section id="home">
          <Hero />
        </section>
        <section id="overview" className="scroll-mt-20 md:scroll-mt-24">
          <Overview />
        </section>
        <section id="gallery" className="scroll-mt-20 md:scroll-mt-24">
          <Gallery />
        </section>
        <section id="curating-team" className="scroll-mt-20 md:scroll-mt-24">
          <CuratingTeam />
        </section>
        <section id="designers" className="scroll-mt-20 md:scroll-mt-24">
          <Suspense fallback={<SectionFallback />}>
            <FeaturedDesigners />
          </Suspense>
        </section>
        <section id="collectibles" className="scroll-mt-20 md:scroll-mt-24">
          <Suspense fallback={<SectionFallback />}>
            <Collectibles />
          </Suspense>
        </section>
        <section id="brands" className="scroll-mt-20 md:scroll-mt-24">
          <Suspense fallback={<SectionFallback />}>
            <BrandsAteliers />
          </Suspense>
        </section>
        <section id="details" className="scroll-mt-20 md:scroll-mt-24">
          <DesignDetails />
        </section>
        <section id="contact" className="scroll-mt-20 md:scroll-mt-24">
          <ContactInquiry />
        </section>
        <Footer />
      </main>
      
      <QuickJumpMenu />
    </>
  );
};
export default Index;
