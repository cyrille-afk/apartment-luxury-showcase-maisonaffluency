import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/75 bg-white/15 px-6 py-3 text-center text-white text-sm md:text-base font-body font-semibold tracking-wide shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-md transition-all hover:border-white hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent hero-fade-in-delayed-4 [text-shadow:_0_1px_3px_rgba(0,0,0,0.45)]";

const Hero = () => {
  const navigate = useNavigate();
  // The pre-React static hero <picture> in index.html stays in place permanently
  // as the LCP candidate. The static copy overlay (#static-hero-copy) however
  // duplicates this section's <h1>, so we hide it as soon as React mounts.
  useEffect(() => {
    // Hide the static copy overlay (React's <h1> below replaces it).
    const copy = document.getElementById("static-hero-copy");
    if (copy) copy.style.display = "none";
    // Force the static hero <picture> visible. The inline script in index.html
    // appends a stylesheet that hides #static-hero on non-home first-loads to
    // prevent a flash on subpages; after SPA-navigation back to /, that
    // stylesheet persists and would otherwise leave the hero image blank.
    const pic = document.getElementById("static-hero");
    if (pic) pic.style.setProperty("display", "block", "important");
  }, []);
  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Hero image is rendered by the static <picture id="static-hero"> in
          index.html (fixed, z-index:0, painted from the preloaded bytes
          before React boots). We intentionally do NOT re-render the image
          here — a second <picture> creates a duplicate LCP candidate and
          extra decode work that pushes LCP later on throttled CPUs. */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/20" />





      {/* Text overlay — CSS-only animations, no framer-motion needed */}
      <div className="ma-home-hero-copy relative z-10 h-full px-6 pb-32 pt-[var(--home-hero-mobile-pad-top)] md:px-32 md:pb-20 md:pt-[16rem] lg:px-48 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-start md:items-start">
        <div className="max-w-4xl md:text-left">
          <h1 className="text-3xl leading-tight text-white md:text-4xl font-serif lg:text-5xl">
            Modern Masters.<br />
            Iconic Design.
          </h1>

          <div className="mt-8 md:mt-10 flex w-full max-w-3xl flex-col items-start">
            <p className="text-base leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium hero-fade-in-delayed-3">
              A curated collection of masterworks<br />reeditions and contemporary design<br />for global architectural projects.
            </p>
            <div className="mt-14 md:mt-20 w-full flex justify-end">
              <button
                type="button"
                onClick={() => { trackEvent("click_meet_designers", { event_category: "CTA", event_label: "HeroCTA" }); navigate("/designers"); }}
                className={heroPrimaryCtaClass}
              >
                EXPLORE THE COLLECTION
              </button>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
};
export default Hero;