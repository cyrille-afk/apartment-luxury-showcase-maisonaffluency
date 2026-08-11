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

const revealBelowFold = () => {
  window.dispatchEvent(new CustomEvent("ma:reveal-below-fold"));
};

const scrollToMeetDesigners = () => {
  revealBelowFold();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById("meet-designers-headline");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        scrollToSection("meet-designers");
      }
    });
  });
};

const heroPrimaryCtaClass =
  "group inline-flex min-h-12 items-center justify-center gap-3 rounded-none border border-white/80 bg-transparent px-9 py-3.5 text-center text-white text-[11px] md:text-xs font-body font-light tracking-[0.3em] uppercase [text-shadow:0_1px_8px_rgba(0,0,0,0.75)] drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)] transition-[background-color,border-color,color,opacity] duration-[400ms] ease-[cubic-bezier(0.25,1,0.5,1)] hover:border-white hover:bg-white/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent hero-fade-in-delayed-4";



const Hero = () => {
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = useState(false);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
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

    // Detect PWA standalone mode (installed app)
    const mql = window.matchMedia("(display-mode: standalone)");
    const check = () =>
      setIsPWA(mql.matches || (window.navigator as any).standalone === true);
    check();
    mql.addEventListener?.("change", check);
    return () => {
      window.clearTimeout(verificationTimer);
      staticImage?.removeEventListener("error", recoverImage);
      mql.removeEventListener?.("change", check);
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
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/20" />
      {/* Mobile/PWA only: subtle linear scrim across the bottom third for legibility */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none md:hidden"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0.3) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Text overlay — CSS-only animations, no framer-motion needed */}
      <div className="ma-home-hero-copy relative z-10 h-full px-6 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-[var(--home-hero-mobile-pad-top)] md:px-32 md:pb-20 md:pt-[24rem] lg:px-48 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-start md:items-start">
        <div className="max-w-4xl md:text-left">
          <h1 className="text-3xl leading-tight text-white md:text-4xl font-serif lg:text-5xl">
            Modern Masters.<br />
            Iconic Design.
          </h1>

          <div className="mt-8 md:mt-10 flex w-full max-w-3xl flex-col items-start">
            <p className="relative inline-block text-base leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium hero-fade-in-delayed-3 before:content-[''] before:absolute before:-inset-x-3 before:-inset-y-2 before:-z-10 before:rounded-sm before:bg-black/30 before:backdrop-blur-[1px] before:[mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_100%)]">
              A curated collection of masterworks<br />reeditions and contemporary design<br />for global architectural projects.
            </p>
            <div className="hero-mobile-cta-stack w-screen -translate-x-6 items-center md:w-full md:translate-x-0 md:items-start mt-12 md:mt-20 flex flex-col gap-5 md:gap-6">
              <div className="flex flex-col items-center gap-6 md:inline-flex md:items-start">
                <motion.button
                  type="button"
                  onClick={() => { trackEvent("click_meet_designers", { event_category: "CTA", event_label: "HeroCTA" }); navigate("/designers"); }}
                  className={`${heroPrimaryCtaClass} touch-manipulation md:order-2`}
                  whileTap={{ scale: 0.98, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                  transition={{ duration: 0.2 }}
                >
                  <span>EXPLORE THE COLLECTION</span>
                  <motion.span
                    aria-hidden="true"
                    animate={{ x: [0, 4] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                  >
                    &#8594;
                  </motion.span>
                </motion.button>


                {/* Desktop — inline editorial links, raised above the CTA over the darker
                    left-hand section of the image, with a soft scrim for legibility */}
                <div className="hidden hero-fade-in-delayed-5 md:order-1 md:mb-2 md:flex md:flex-col md:items-start">
                  <div className="relative inline-flex items-center gap-3 before:content-[''] before:absolute before:-inset-x-4 before:-inset-y-2.5 before:-z-10 before:rounded-sm before:bg-black/35 before:backdrop-blur-[2px] before:[mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)] [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
                    <button
                      type="button"
                      onClick={() => {
                        trackEvent("click_singapore_gallery_preview", { event_category: "CTA", event_label: "HeroSecondary" });
                        scrollToSection("apartment-tour-heading");
                      }}
                      className="font-body text-[10px] font-light uppercase tracking-[0.34em] text-white transition-opacity duration-300 hover:opacity-70"
                    >
                      Singapore Gallery Preview
                    </button>
                    <span className="h-3 w-px bg-white/40" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={openTour}
                      className="group font-body text-[10px] font-light uppercase tracking-[0.34em] text-white transition-opacity duration-300 hover:opacity-70"
                    >
                      <span>Book Private Appointment</span>
                      <span className="ml-2 tracking-[0.2em] text-white/70">(Trade Only)</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Mobile / PWA — frosted glass editorial links, in normal flow */}
              <div className={`hero-mobile-links-inner${isPWA ? " is-pwa" : ""} mt-2 flex w-[calc(100%-2rem)] max-w-md flex-col items-center space-y-2 rounded-2xl border border-white/25 bg-white/[0.08] px-5 py-3 text-center shadow-[0_8px_28px_rgba(0,0,0,0.28)] backdrop-blur-[10px] hero-fade-in-delayed-5 md:hidden`}>
                <button
                  type="button"
                  onClick={() => {
                    trackEvent("click_singapore_gallery_preview", { event_category: "CTA", event_label: "HeroSecondary" });
                    scrollToSection("apartment-tour-heading");
                  }}
                  className="font-body text-[12.5px] font-light uppercase tracking-[0.32em] text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.5)]"
                >
                  Singapore Gallery Preview
                </button>

                <div className="h-px w-10 bg-white/30" aria-hidden="true" />

                <motion.button
                  type="button"
                  onClick={() => {
                    trackCTA.bookAppointment("Hero Mobile Frosted Card");
                    setIsBookingLoading(true);
                    window.setTimeout(() => {
                      setTourOpen(true);
                      setIsBookingLoading(false);
                    }, 500);
                  }}
                  disabled={isBookingLoading}
                  className="group relative flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/[0.06] px-3 py-1.5 font-body text-[10px] font-light uppercase tracking-[0.22em] whitespace-nowrap text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] transition-colors hover:text-white/80 backdrop-blur-[8px] touch-manipulation"
                  whileTap={{ scale: 0.98, backdropFilter: "blur(24px)" }}
                  transition={{ duration: 0.2 }}
                >
                  {isBookingLoading ? (
                    <motion.span
                      className="inline-block h-4 w-4 rounded-full border border-white/30 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                  ) : (
                    <>
                      <span>Book Private Appointment</span>
                      <span className="text-[9px] font-normal italic lowercase tracking-normal text-white/70">(trade only)</span>
                    </>
                  )}
                  <motion.span
                    className="absolute bottom-1 left-0 h-[1px] w-full bg-white"
                    initial={{ scaleX: 0 }}
                    whileTap={{ scaleX: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    style={{ transformOrigin: "center" }}
                  />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>


      <PrivateTourDialog open={tourOpen} onOpenChange={setTourOpen} />
    </section>
  );
};
export default Hero;