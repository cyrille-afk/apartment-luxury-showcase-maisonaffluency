import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import FeaturedDesigners from "@/components/FeaturedDesigners";
import BrandsAteliers from "@/components/BrandsAteliers";
import Overview from "@/components/Overview";
import Gallery from "@/components/Gallery";
import Collectibles from "@/components/Collectibles";
import DesignDetails from "@/components/DesignDetails";
import ContactInquiry from "@/components/ContactInquiry";
import Footer from "@/components/Footer";

import ScrollProgress from "@/components/ScrollProgress";
import CuratingTeam from "@/components/CuratingTeam";
import QuickJumpMenu from "@/components/QuickJumpMenu";

/**
 * Parse deep-link hash: #designer/<id>, #collectible/<id>, #atelier/<slug>
 * Returns { section, id } or null.
 */
function parseDeepLink(hash: string) {
  const match = hash.match(/^#(designer|collectible|atelier)\/(.+)$/);
  if (!match) return null;
  return { section: match[1] as "designer" | "collectible" | "atelier", id: decodeURIComponent(match[2]) };
}

/** Global flag so components can skip entrance animations on deep-link */
export const isDeepLink = () => !!parseDeepLink(window.location.hash);

const Index = () => {
  const [deepLinkReady, setDeepLinkReady] = useState(false);

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
      // Instant scroll (no smooth) for fast landing
      const sectionEl = document.getElementById(sectionId);
      if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: "instant", block: "start" });
      }

      // Short delay for components to hydrate, then dispatch
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("deeplink-open-profile", {
            detail: { section: link.section, id: link.id },
          })
        );
        setDeepLinkReady(true);
      }, 200);
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
          <FeaturedDesigners />
        </section>
        <section id="collectibles" className="scroll-mt-20 md:scroll-mt-24">
          <Collectibles />
        </section>
        <section id="brands" className="scroll-mt-20 md:scroll-mt-24">
          <BrandsAteliers />
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
