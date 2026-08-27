import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Gallery from "@/components/Gallery";
import ApartmentTourInterlude from "@/components/ApartmentTourInterlude";
import GalleryDetailsFloatingNav from "@/components/GalleryDetailsFloatingNav";

// BackToTopButton removed — the floating quick-actions panel now provides
// Back-to-Top alongside All Categories, A–Z, and WhatsApp on mobile/PWA.

const PublicGallery = () => {
  // iOS Safari runs with viewport-fit=cover, so the fixed nav is 96px + the
  // status-bar inset — taller than the static --header-h constant. Measure the
  // real nav height so the interlude never tucks under the header.
  const [headerOffset, setHeaderOffset] = useState<number | null>(null);

  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector("nav");
      const h = nav?.getBoundingClientRect().height;
      if (h) setHeaderOffset(Math.ceil(h + 12));
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
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
      <Helmet>
        <title>Interactive Gallery — Maison Affluency</title>
        <meta
          name="description"
          content="Explore our Singapore gallery — room-by-room interiors with collectible furniture, bespoke lighting, and artisan rugs by world-renowned designers."
        />
        <link rel="canonical" href="https://maisonaffluency.com/gallery" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta property="og:url" content="https://maisonaffluency.com/gallery" />
        <meta property="og:title" content="Interactive Gallery — Maison Affluency" />
        <meta property="og:description" content="Explore our curated Singapore gallery — room-by-room interiors with collectible furniture, bespoke lighting, and artisan rugs from world-renowned designers." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Interactive Gallery — Maison Affluency" />
        <meta name="twitter:description" content="Explore our curated Singapore gallery — room-by-room interiors with collectible furniture, bespoke lighting, and artisan rugs from world-renowned designers." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
      </Helmet>

      <div className="min-h-screen bg-white text-foreground">
        <Navigation />
        <h1 className="sr-only">Maison Affluency Gallery</h1>

        <div className="mx-auto max-w-7xl px-6 md:px-12">
          <div
            className="pt-[var(--header-h)]"
            style={headerOffset ? { paddingTop: headerOffset } : undefined}
          >
            <ApartmentTourInterlude compact />
          </div>
        </div>

        <div className="pb-20">
          <Gallery />
        </div>

        <Footer />
        <GalleryDetailsFloatingNav showAfterElementId="gallery-section-6" forceDisplay />

      </div>
    </>
  );
};

export default PublicGallery;
