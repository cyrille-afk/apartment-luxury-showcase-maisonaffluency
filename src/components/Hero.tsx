import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { scrollToSection } from "@/lib/scrollToSection";
import { trackEvent } from "@/lib/analytics";

const TradeAccessDialog = lazy(() => import("@/components/TradeAccessDialog"));

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
  revealAndScrollTo("apartment-tour");
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
  "inline-flex min-h-11 items-center justify-center rounded-full bg-white px-7 py-3 text-center text-[hsl(var(--foreground))] text-sm md:text-base font-body font-semibold tracking-wide shadow-[0_12px_36px_rgba(0,0,0,0.35)] transition-all hover:bg-[hsl(var(--accent))] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent hero-fade-in-delayed-4";

const heroGhostCtaClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/75 bg-transparent px-6 py-3 text-center text-white text-sm md:text-base font-body font-medium tracking-wide transition-all hover:bg-white/10 hover:border-white focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-transparent hero-fade-in-delayed-4 [text-shadow:_0_1px_3px_rgba(0,0,0,0.55)]";


const Hero = () => {
  const navigate = useNavigate();
  const [tradeOpen, setTradeOpen] = useState(false);
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
      {/* Very light editorial scrim — just enough to keep the headline legible
          without dulling the showroom's warmth. */}
      <div
        className="absolute inset-0 pointer-events-none md:hidden"
        style={{
          background: `linear-gradient(to bottom, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.30) 100%)`,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none hidden md:block"
        style={{
          background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 60%)`,
        }}
      />

      {/* Editorial, centered caption layout with generous whitespace */}
      <div className="relative z-10 h-full px-6 md:px-16 lg:px-24 pt-[22vh] md:pt-[20vh] pb-10 md:pb-16 flex flex-col justify-between">
        {/* Centered: refined headline + sub-text */}
        <div className="w-full max-w-3xl mx-auto text-center">
          <h1 className="text-2xl leading-[1.2] text-white md:text-4xl lg:text-5xl font-serif font-light tracking-[0.04em] [text-shadow:_0_1px_8px_rgba(0,0,0,0.45)]">
            The Architecture of Interiors
          </h1>
          <p className="mt-5 md:mt-6 text-sm md:text-base lg:text-lg font-body font-normal text-white/90 leading-[1.7] max-w-2xl mx-auto [text-shadow:_0_1px_6px_rgba(0,0,0,0.35)]">
            Sourcing iconic furniture designs and masterwork re-editions for international trade projects and private collectors.
          </p>
        </div>

        {/* Bottom-right: CTAs */}
        <div className="flex justify-start md:justify-end">
          <div className="flex flex-col items-start md:items-end gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => {
                trackEvent("click_trade_access", { event_category: "CTA", event_label: "HeroCTA" });
                setTradeOpen(true);
              }}
              className={heroPrimaryCtaClass}
            >
              Apply for Trade Access
            </button>

            <button
              type="button"
              onClick={() => {
                trackEvent("click_explore_collection", { event_category: "CTA", event_label: "HeroCTA" });
                navigate("/designers");
              }}
              className={heroGhostCtaClass}
            >
              Explore the Collection
            </button>
          </div>
        </div>
      </div>


      <Suspense fallback={null}>
        {tradeOpen && <TradeAccessDialog open={tradeOpen} onOpenChange={setTradeOpen} />}
      </Suspense>

    </section>
  );
};
export default Hero;