import { Link } from "react-router-dom";
import { useEffect } from "react";
import { scrollToSection } from "@/lib/scrollToSection";
import { trackCTA, trackEvent } from "@/lib/analytics";

const HERO_BASE = "https://res.cloudinary.com/dif1oamtj/image/upload";
const HERO_ID = "v1781920000/AffluencySG_194-22.jpg_macpwj";
// Desktop / landscape variants — q_auto:good (not eco) so the hero clears
// Chrome's 0.05 bpp LCP threshold and is eligible as the LCP candidate.
const HERO_DESKTOP = `${HERO_BASE}/w_1600,c_fill,q_auto:good,f_auto/${HERO_ID}`;
const HERO_DESKTOP_SRCSET = [828, 1200, 1600, 1920, 2400]
  .map((w) => `${HERO_BASE}/w_${w},c_fill,q_auto:good,f_auto/${HERO_ID} ${w}w`)
  .join(", ");
// Mobile portrait variants — cropped to ~9:19.5 so object-cover doesn't shrink LCP score
const HERO_MOBILE_SRCSET = [
  { w: 390, h: 844 },
  { w: 480, h: 1040 },
  { w: 780, h: 1688 }, // 2x for DPR 2/3
  { w: 1170, h: 2532 }, // 3x
]
  .map(({ w, h }) => `${HERO_BASE}/w_${w},h_${h},c_fill,g_auto,q_auto:good,f_auto/${HERO_ID} ${w}w`)
  .join(", ");

const revealBelowFold = () => {
  window.dispatchEvent(new CustomEvent("ma:reveal-below-fold"));
};

const revealAndScrollTo = (sectionId: string) => {
  revealBelowFold();

  // The reveal event mounts the fixed nav + below-fold sections. Wait for that
  // commit before measuring offsets, otherwise CTA landings get hidden/truncated
  // under the header on real devices.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollToSection(sectionId);
    });
  });
};

const scrollToOverview = () => {
  revealAndScrollTo("gallery");
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

const scrollToContact = () => {
  revealAndScrollTo("contact");
};

const heroPrimaryCtaClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/75 bg-white/15 px-6 py-3 text-center text-white text-sm md:text-base font-body font-semibold tracking-wide shadow-[0_8px_30px_rgba(0,0,0,0.22)] backdrop-blur-md transition-all hover:border-white hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent hero-fade-in-delayed-4 [text-shadow:_0_1px_3px_rgba(0,0,0,0.45)]";

const heroSecondaryCtaClass =
  "inline-flex min-h-9 items-center justify-center rounded-full border border-white/70 bg-white/15 px-4 py-2 text-center text-white text-xs lg:text-sm font-body font-bold tracking-wide shadow-[0_8px_24px_rgba(0,0,0,0.2)] backdrop-blur-md transition-all hover:border-white hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent [text-shadow:_0_1px_3px_rgba(0,0,0,0.55)]";

const Hero = () => {
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
      <div className="relative z-10 h-full px-4 pb-32 pt-[44%] md:px-32 md:pb-20 md:pt-[20%] lg:px-52 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-start md:items-start">
        <div className="max-w-4xl md:text-left">
          <h1 className="mb-8 md:mb-14 text-3xl leading-tight text-white md:text-4xl font-serif lg:text-5xl">
            Discover The World's Best Interior Designers' Iconic Pieces
          </h1>

          <div className="flex w-full max-w-3xl flex-col items-start">
            <p className="text-base leading-relaxed text-white text-left font-serif md:text-xl lg:text-2xl font-medium hero-fade-in-delayed-3">
              <span className="hidden md:inline">From Couture Furniture to Collectible Designs Items,
              <br /> Discover Emerging Talents and Design Masters In Our Gallery
              <br /> or Through the Best Ateliers and Designer Workshops We Partner&nbsp;With</span>
              <span className="md:hidden leading-relaxed text-left">From Couture Furniture to Collectible Designs Items, Discover Emerging Talents and Design Masters In Our Gallery or Through the Best Ateliers and Designer Workshops We Partner&nbsp;With</span>
            </p>

            <div className="mt-8 md:mt-10 flex flex-col items-start gap-4">
              <button
                onClick={scrollToOverview}
                className={heroPrimaryCtaClass}
              >
                Explore Our Curated Collection
              </button>

              <button
                type="button"
                onClick={() => { trackEvent("click_meet_designers", { event_category: "CTA", event_label: "HeroCTA" }); scrollToMeetDesigners(); }}
                className={heroPrimaryCtaClass}
              >
                Meet our Designers
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: bottom-right of hero, vertical stack, above iOS bar & Chat widget */}
      <div
        className="flex md:hidden absolute right-4 z-20 flex-col items-end gap-2 hero-fade-in-delayed-4"
        style={{ bottom: "max(9.5rem, calc(env(safe-area-inset-bottom) + 9rem))", animationDelay: "1.2s" }}
      >
        <button
          onClick={() => { trackCTA.bookAppointment("HeroCTA"); scrollToContact(); }}
          className={heroSecondaryCtaClass}
        >
          Book a Viewing
        </button>
        <Link
          to="/trade-program"
          className={heroSecondaryCtaClass}
        >
          Trade Program
        </Link>
      </div>

      {/* Desktop: bottom-right of hero, next to Chat widget */}
      <div
        className="hidden md:flex absolute bottom-6 z-20 items-center gap-2 hero-fade-in-delayed-4"
        style={{ right: "200px", animationDelay: "1.2s" }}
      >
        <button
          onClick={() => { trackCTA.bookAppointment("HeroCTA"); scrollToContact(); }}
          className={heroSecondaryCtaClass}
        >
          Book a Viewing
        </button>
        <Link
          to="/trade-program"
          className={heroSecondaryCtaClass}
        >
          Trade Program
        </Link>
      </div>

      {/* Scroll indicator — subtle animated chevron */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-1 hero-fade-in-delayed-4" style={{ animationDelay: "1.8s" }}>
        <span className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-body">Scroll</span>
        <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDuration: "2s" }} />
        </div>
      </div>
    </section>
  );
};
export default Hero;