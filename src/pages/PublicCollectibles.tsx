import React from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import Collectibles from "@/components/Collectibles";

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

const PublicCollectibles = () => {
  return (
    <>
      <Helmet>
        <title>Collectible Design On View — Maison Affluency</title>
        <meta
          name="description"
          content="Explore our curated selection of collectible design — sculptural furniture, rare lighting, and limited-edition objets d'art from world-renowned ateliers."
        />
        <link rel="canonical" href="https://www.maisonaffluency.com/collectibles" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta property="og:url" content="https://www.maisonaffluency.com/collectibles" />
        <meta property="og:title" content="Collectible Design On View — Maison Affluency" />
        <meta property="og:description" content="Explore our curated selection of collectible design — sculptural furniture, rare lighting, and limited-edition objets d'art from world-renowned ateliers." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Collectible Design On View — Maison Affluency" />
        <meta name="twitter:description" content="Explore our curated selection of collectible design — sculptural furniture, rare lighting, and limited-edition objets d'art from world-renowned ateliers." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="pt-28 pb-20">
          <Collectibles />
        </div>

        <Footer />
        <BackToTopButton />
      </div>
    </>
  );
};

export default PublicCollectibles;
