import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import InteractiveGalleryLookbook from "@/components/InteractiveGalleryLookbook";
import Gallery from "@/components/Gallery";
import GalleryDetailsFloatingNav from "@/components/GalleryDetailsFloatingNav";
import { useIsMobile } from "@/hooks/use-mobile";

// BackToTopButton removed — the floating quick-actions panel now provides
// Back-to-Top alongside All Categories, A–Z, and WhatsApp on mobile/PWA.

const PublicGallery = () => {
  const isMobile = useIsMobile();
  // Track the complete three-row header, including safe-area and font changes.
  const [headerOffset, setHeaderOffset] = useState<number | null>(null);

  useEffect(() => {
    const nav = document.querySelector("[data-site-header]");
    const measure = () => {
      const h = nav?.getBoundingClientRect().height;
      if (h) setHeaderOffset(Math.ceil(h));
    };
    const observer = new ResizeObserver(measure);
    if (nav) observer.observe(nav);
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);


  return (
    <>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />
        <h1 className="sr-only">Maison Affluency Gallery</h1>

        <div
          className="pt-[calc(var(--header-h)+24px)]"
          style={headerOffset ? { paddingTop: headerOffset + 24 } : undefined}
        >
          {isMobile ? <Gallery /> : <InteractiveGalleryLookbook />}
        </div>

        <Footer />
        

      </div>
    </>
  );
};

export default PublicGallery;
