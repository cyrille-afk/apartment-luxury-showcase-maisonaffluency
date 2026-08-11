import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { scrollToSection } from "@/lib/scrollToSection";
import { trackEvent, trackCTA } from "@/lib/analytics";
import PrivateTourDialog from "@/components/PrivateTourDialog";

const HERO_BASE = "https://res.cloudinary.com/dif1oamtj/image/upload";
const HERO_ID = "v1781920000/AffluencySG_194-22.jpg_macpwj";
// Desktop / landscape variants — q_auto:good (not eco) so the hero clears
// Chrome's 0.05 bpp LCP threshold and is eligible as the LCP candidate.
const HERO_DESKTOP = `${HERO_BASE}/w_1280,c_fill,q_auto:good,f_webp/${HERO_ID}`;
const HERO_DESKTOP_SRCSET = [828, 1280, 1600, 1920]
  .map((w) => `${HERO_BASE}/w_${w},c_fill,q_auto:good,f_webp/${HERO_ID} ${w}w`)
  .join(", ");
// Mobile portrait variants — cropped to ~9:19.5 so object-cover doesn't shrink LCP score
const HERO_MOBILE_SRCSET = [
  { w: 390, h: 844 },
  { w: 480, h: 1040 },
  { w: 780, h: 1688 }, // 2x for DPR 2/3
]
  .map(({ w, h }) => `${HERO_BASE}/w_${w},h_${h},c_fill,g_auto,q_auto:good,f_webp/${HERO_ID} ${w}w`)
  .join(", ");
// Safari/WebKit JPEG recovery. Portrait crop for phones, landscape for
// desktop — a portrait crop stretched across a wide viewport zooms the hero.
const HERO_SAFARI_FALLBACK = `${HERO_BASE}/w_780,h_1688,c_fill,g_auto,q_auto:good,f_jpg/${HERO_ID}`;
const HERO_SAFARI_FALLBACK_DESKTOP = `${HERO_BASE}/w_1920,c_fill,q_auto:good,f_jpg/${HERO_ID}`;

const Hero = () => {
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = useState(false);
  const [showImageFallback, setShowImageFallback] = useState(false);

  useEffect(() => {
    const isAppleWebKit = /AppleWebKit/i.test(navigator.userAgent) && !/(CriOS|FxiOS|EdgiOS)/i.test(navigator.userAgent);
    if (isAppleWebKit) setShowImageFallback(true);

    const copy = document.getElementById("static-hero-copy");
    if (copy) copy.style.display = "none";
    const pic = document.getElementById("static-hero");
    if (pic) pic.style.setProperty("display", "block", "important");
    document.getElementById("static-designers-hero")?.style.setProperty("display", "none", "important");
    document.getElementById("static-designers-hero-overlay")?.style.setProperty("display", "none", "important");

    // Some iOS Safari/PWA versions select the AVIF <source> but occasionally
    // fail to decode or repaint it from cache. A failed selected <source> does
    // not reliably fall through to the WebP <source>, leaving only the grey
    // picture background. Recover with a JPEG rendered inside this hero.
    const staticImage = pic?.querySelector("img");
    const recoverImage = () => setShowImageFallback(true);
    const verifyImage = () => {
      if (!staticImage || (staticImage.complete && staticImage.naturalWidth === 0)) {
        recoverImage();
      }
    };
    staticImage?.addEventListener("error", recoverImage);
    if (staticImage?.complete) verifyImage();
    const verificationTimer = window.setTimeout(verifyImage, 1800);

    return () => {
      window.clearTimeout(verificationTimer);
      staticImage?.removeEventListener("error", recoverImage);
    };
  }, []);

  const openTour = () => {
    trackCTA.bookAppointment("Hero Secondary CTA");
    setTourOpen(true);
  };

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Hero image is rendered by the static <picture id="static-hero"> in
          index.html (fixed, z-index:0, painted from the preloaded bytes
          before React boots). We intentionally do NOT re-render the image
          here — a second <picture> creates a duplicate LCP candidate and
          extra decode work that pushes LCP later on throttled CPUs. */}
      {showImageFallback && (
        <picture>
          <source media="(min-width: 768px)" srcSet={HERO_SAFARI_FALLBACK_DESKTOP} />
          <img
            src={HERO_SAFARI_FALLBACK}
            alt="Luxury living room with Asian-inspired murals and designer furniture"
            className="absolute inset-0 h-full w-full object-cover object-[50%_40%]"
            loading="eager"
            decoding="sync"
            fetchPriority="high"
          />
        </picture>
      )}

      {/* Global rear gradient: single continuous scrim across the bottom 40% */}
      <div
        className="absolute inset-x-0 bottom-0 h-[40%] pointer-events-none bg-gradient-to-t from-black/60 via-black/20 to-transparent"
        aria-hidden="true"
      />

      {/* Text overlay — anchored lower-left for a cohesive gallery-directory read */}
      <div className="ma-home-hero-copy relative z-10 flex h-full flex-col items-start justify-between px-6 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-[var(--home-hero-mobile-pad-top)] md:px-32 md:pb-20 md:pt-[24rem] lg:px-48">
        <div className="max-w-4xl md:text-left">
          <h1 className="text-3xl leading-tight text-white md:text-4xl font-serif lg:text-5xl">
            Modern Masters.<br />
            Iconic Design.
          </h1>

          <p className="relative mt-8 md:mt-10 inline-block text-base leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium [text-shadow:0_1px_10px_rgba(0,0,0,0.55)] hero-fade-in-delayed-3">
            A curated collection of masterworks<br />reeditions and contemporary design<br />for global architectural projects.
          </p>
        </div>

        <div className="flex flex-col items-start gap-6 hero-fade-in-delayed-5">
          <motion.button
            type="button"
            onClick={() => { trackEvent("click_meet_designers", { event_category: "CTA", event_label: "HeroCTA" }); navigate("/designers"); }}
            className="group inline-flex items-center gap-3 font-body text-[11px] md:text-xs font-medium uppercase tracking-[0.3em] text-white transition-opacity duration-300 hover:opacity-70 touch-manipulation [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]"
            whileTap={{ scale: 0.98, opacity: 0.75 }}
            transition={{ duration: 0.2 }}
          >
            <span>EXPLORE THE COLLECTION</span>
            <motion.span
              aria-hidden="true"
              animate={{ x: [0, 4] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
            >
              →
            </motion.span>
          </motion.button>

          <button
            type="button"
            onClick={() => {
              trackEvent("click_singapore_gallery_preview", { event_category: "CTA", event_label: "HeroSecondary" });
              scrollToSection("apartment-tour-heading");
            }}
            className="font-body text-[10px] md:text-[11px] font-light uppercase tracking-[0.34em] text-white/80 transition-opacity duration-300 hover:opacity-70 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] touch-manipulation"
          >
            Singapore Gallery Preview
          </button>

          <button
            type="button"
            onClick={openTour}
            className="group font-body text-[10px] md:text-[11px] font-light uppercase tracking-[0.34em] text-white/80 transition-opacity duration-300 hover:opacity-70 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)] touch-manipulation"
          >
            <span>Book Private Appointment</span>
            <span className="ml-2 tracking-[0.2em] text-white/60">(Trade Only)</span>
          </button>
        </div>
      </div>

      <PrivateTourDialog open={tourOpen} onOpenChange={setTourOpen} />
    </section>
  );
};

export default Hero;
