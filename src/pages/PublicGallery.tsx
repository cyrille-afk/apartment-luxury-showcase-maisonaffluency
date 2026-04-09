import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Gallery from "@/components/Gallery";
import ApartmentTourInterlude from "@/components/ApartmentTourInterlude";

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

const PublicGallery = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  return (
    <>
      <Helmet>
        <title>Interactive Gallery — Maison Affluency</title>
        <meta
          name="description"
          content="Step inside our curated apartment gallery in Singapore — explore room-by-room interiors featuring collectible furniture, bespoke lighting, and artisan rugs from world-renowned designers."
        />
        <link rel="canonical" href="https://www.maisonaffluency.com/gallery" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta property="og:url" content="https://www.maisonaffluency.com/gallery" />
        <meta property="og:title" content="Interactive Gallery — Maison Affluency" />
        <meta property="og:description" content="Step inside our curated apartment gallery in Singapore — explore room-by-room interiors featuring collectible furniture, bespoke lighting, and artisan rugs from world-renowned designers." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Interactive Gallery — Maison Affluency" />
        <meta name="twitter:description" content="Step inside our curated apartment gallery in Singapore — explore room-by-room interiors featuring collectible furniture, bespoke lighting, and artisan rugs from world-renowned designers." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="pt-28">
          <ApartmentTourInterlude />
        </div>

        <div className="pb-20">
          <Gallery />
        </div>

        <Footer />
        <BackToTopButton />
      </div>
    </>
  );
};

export default PublicGallery;
