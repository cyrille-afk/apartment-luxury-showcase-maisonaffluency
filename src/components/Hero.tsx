import { Link } from "react-router-dom";
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

const scrollToOverview = () => {
  revealBelowFold();
  scrollToSection("gallery");
};

const scrollToMeetDesigners = () => {
  revealBelowFold();
  scrollToSection("meet-designers");
};

const scrollToContact = () => {
  revealBelowFold();
  scrollToSection("contact");
};

const Hero = () => {
  return (
    <section className="relative h-screen w-full overflow-hidden">
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet={HERO_MOBILE_SRCSET}
          sizes="100vw"
        />
        <source
          media="(min-width: 768px)"
          srcSet={HERO_DESKTOP_SRCSET}
          sizes="100vw"
        />
        <img
          src={HERO_DESKTOP}
          srcSet={HERO_DESKTOP_SRCSET}
          sizes="100vw"
          width={1200}
          height={800}
          alt="Luxury living room with Asian-inspired murals and designer furniture"
          className="absolute inset-0 h-full w-full object-cover object-[50%_40%] md:h-[120%] md:object-[50%_0%]"
          loading="eager"
          decoding="sync"
          {...({ fetchpriority: "high" } as any)}
        />

      </picture>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/20" />




      {/* Text overlay — CSS-only animations, no framer-motion needed */}
      <div className="relative z-10 h-full px-4 pb-32 pt-[44%] md:px-32 md:pb-20 md:pt-[20%] lg:px-52 flex-col border rounded-none opacity-100 shadow-none flex items-start justify-start md:justify-start md:items-start">
        <div className="max-w-4xl md:text-left hero-fade-in">
          <h1 className="mb-8 md:mb-14 text-3xl leading-tight text-white md:text-4xl font-serif lg:text-5xl hero-fade-in-delayed-2">
            <button
              type="button"
              onClick={scrollToOverview}
              className="text-left text-inherit font-inherit leading-inherit cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0 m-0"
            >
              Discover The World's Best Interior Designers' Iconic Pieces
            </button>
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
                className="bg-transparent border-0 p-0 text-white text-sm md:text-lg font-body tracking-wide hover:opacity-80 transition-opacity hero-fade-in-delayed-4 [text-shadow:_0_1px_3px_rgba(0,0,0,0.45)]"
              >
                Explore Our Curated Collection
              </button>

              <button
                type="button"
                onClick={() => { trackEvent("click_meet_designers", { event_category: "CTA", event_label: "HeroCTA" }); scrollToMeetDesigners(); }}
                className="bg-transparent border-0 p-0 text-white text-sm md:text-lg font-body tracking-wide hover:opacity-80 transition-opacity hero-fade-in-delayed-4 [text-shadow:_0_1px_3px_rgba(0,0,0,0.45)]"
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
          className="bg-transparent border-0 p-0 text-right text-white text-xs font-body font-bold tracking-wide transition-opacity hover:opacity-80 [text-shadow:_0_1px_3px_rgba(0,0,0,0.55)]"
        >
          Book a Viewing
        </button>
        <Link
          to="/trade-program"
          className="bg-transparent border-0 p-0 text-right text-white text-xs font-body font-bold tracking-wide transition-opacity hover:opacity-80 [text-shadow:_0_1px_3px_rgba(0,0,0,0.55)]"
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
          className="bg-transparent border-0 p-0 text-white text-xs lg:text-sm font-body font-bold tracking-wide transition-opacity hover:opacity-80 [text-shadow:_0_1px_3px_rgba(0,0,0,0.55)]"
        >
          Book a Viewing
        </button>
        <Link
          to="/trade-program"
          className="bg-transparent border-0 p-0 text-white text-xs lg:text-sm font-body font-bold tracking-wide transition-opacity hover:opacity-80 [text-shadow:_0_1px_3px_rgba(0,0,0,0.55)]"
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