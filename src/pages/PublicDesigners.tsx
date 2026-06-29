import React, { useMemo, useCallback } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { categoryUrl } from "@/lib/categorySlugs";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import DesignerIndexLinks from "@/components/DesignerIndexLinks";
import DesignersDirectory from "@/components/DesignersDirectory";
import DesignersHoverHero from "@/components/DesignersHoverHero";
import { useAllDesigners } from "@/hooks/useDesigner";
import { getDesignersDirectoryAnchorId } from "@/lib/designersDirectoryAnchors";
import { scrollToSection } from "@/lib/scrollToSection";
import { jumpToDesignerLetter } from "@/lib/jumpToDesignerLetter";


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
          className="fixed bottom-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-foreground text-background shadow-lg hover:opacity-80 transition-opacity"
          aria-label="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ─── A-Z Jump Bar (positioned at the bottom edge of the hero image) ─────────
const LETTERS = [...("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")), "#"];

function HeroAlphabetBar() {
  const { data: designers = [] } = useAllDesigners();

  const activeLetters = useMemo(() => {
    const set = new Set<string>();
    designers
      .filter((d) => d.is_published)
      .forEach((d) => {
        const firstChar = d.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")[0];
        const letter = firstChar?.toUpperCase() || "#";
        set.add(letter);
      });
    return set;
  }, [designers]);

  const jumpToLetter = useCallback(
    (letter: string) => {
      if (!activeLetters.has(letter)) return;
      jumpToDesignerLetter(letter);
    },
    [activeLetters]
  );


  return (
    <div className="hidden md:block absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="pointer-events-auto border-t border-white/10 bg-gradient-to-t from-[#0a0a0a]/95 via-[#0a0a0a]/75 to-transparent backdrop-blur-[2px]">
        <div className="px-6 sm:px-12 md:px-20 lg:px-28 py-4 flex items-center justify-between">
          {LETTERS.map((letter) => {
            const isActive = activeLetters.has(letter);
            return (
              <button
                key={letter}
                disabled={!isActive}
                onClick={() => jumpToLetter(letter)}
                className={`font-serif text-base md:text-lg lg:text-xl leading-none transition-colors duration-200 ${
                  isActive
                    ? "text-white/90 hover:text-white"
                    : "text-white/25 cursor-default"
                }`}
                aria-label={isActive ? `Jump to designers starting with ${letter}` : undefined}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>
    </div>
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

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="pt-20">
          {/* Visually-hidden H1 retained for SEO/a11y; hero + directory below provide visible headings */}
          <h1 className="sr-only">Designers &amp; Ateliers</h1>
          
          <div className="pb-20">
            <div className="relative">
              <DesignersHoverHero />
              <HeroAlphabetBar />
            </div>
            <DesignersDirectory mode="designers" initialLetter={initialLetter} initialExpand={initialExpand} showHeader={false} showAlphabetBar={false} />
          </div>
        </div>

        <Footer />
        <BackToTopButton />
      </div>
    </>
  );
};

export default PublicDesigners;
