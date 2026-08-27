import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { scrollToSection } from "@/lib/scrollToSection";
import { trackEvent, trackCTA } from "@/lib/analytics";
import { isPwaStandaloneDisplay } from "@/lib/pwaMode";
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

// Warm the /designers route chunk (and its lazy hero) before the user taps the
// CTA — the biggest chunk of perceived latency was code-splitting on click.
let designersPrefetched = false;
const prefetchDesigners = () => {
  if (designersPrefetched) return;
  designersPrefetched = true;
  void import("@/pages/PublicDesigners").catch(() => {});
  void import("@/components/DesignersHoverHero").catch(() => {});
};

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
  "group inline-flex min-h-12 items-center justify-between gap-6 px-2 py-4 text-left text-white text-[13px] font-body font-bold tracking-[0.25em] uppercase [text-shadow:0_1px_8px_rgba(0,0,0,0.75)] transition-opacity duration-300 hover:opacity-70 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/70 hero-fade-in-delayed-4";

const Hero = () => {
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = useState(false);
  const [showImageFallback, setShowImageFallback] = useState(false);
  const isPwa = isPwaStandaloneDisplay();

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
    <section
      className={`relative flex w-full flex-col justify-between md:h-screen md:overflow-hidden ${
        isPwa ? "min-h-screen" : "h-[100svh] min-h-[100svh] overflow-hidden"
      }`}
    >
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

      {/* Legibility scrim: bottom-45% fade on mobile/PWA, subtler 35% fade on desktop */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/60 via-black/15 to-transparent md:h-[35%] md:from-black/40 md:via-transparent md:to-transparent"
        aria-hidden="true"
      />


      {/* Text overlay — desktop keeps the previous anchored-top editorial layout;
          mobile/PWA uses a bottom-aligned editorial link stack over the wallpaper. */}
      <div className={`ma-home-hero-copy relative z-10 flex flex-1 flex-col items-start justify-start px-6 md:h-full md:min-h-0 md:justify-start md:px-32 md:pb-20 md:pt-[24rem] lg:px-48 ${
        isPwa
          ? // Standalone has no browser toolbar, so a fixed rem pad reads too high on
            // the taller viewport — anchor the copy proportionally instead.
            "min-h-screen pt-[calc(env(safe-area-inset-top)+29vh)] md:pt-[24rem] pb-[calc(env(safe-area-inset-bottom)+2rem)]"
          : "h-full min-h-0 pt-[calc(env(safe-area-inset-top)+14rem)] pb-0"
      }`}>

        <div className="w-full max-w-xl md:max-w-4xl md:text-left">
          <h1 className="text-3xl leading-tight text-white md:text-4xl font-serif lg:text-5xl">
            Modern Masters.<br />
            Iconic Design.
          </h1>

          <div className="mt-6 flex w-full max-w-3xl flex-col items-start md:mt-10">
            <p className="relative inline-block text-left font-serif text-sm font-medium leading-relaxed text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.55)] hero-fade-in-delayed-3 before:absolute before:-inset-x-3 before:-inset-y-2 before:-z-10 before:rounded-sm before:bg-black/35 before:content-[''] before:backdrop-blur-[1px] before:[mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_100%)] md:text-xl lg:text-2xl">
              A curated collection of masterworks<br />reeditions and contemporary design<br />for global architectural projects.
            </p>

            <button
              type="button"
              onPointerEnter={prefetchDesigners}
              onTouchStart={prefetchDesigners}
              onClick={() => {
                trackEvent("click_meet_designers", { event_category: "CTA", event_label: "HeroCTA" });
                navigate("/designers");
              }}
              className={`group flex translate-x-4 items-center gap-4 border border-white/20 bg-white/5 px-6 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.25em] text-white backdrop-blur-sm transition-all duration-500 ease-out hover:translate-x-12 hover:border-white hover:bg-white hover:text-black md:mt-20 md:translate-x-8 ${
              isPwa ? "mt-28" : "mt-16"
            }`}
            >
              <span>Explore the Collection</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-500 ease-out group-hover:translate-x-1.5">→</span>
            </button>
          </div>
        </div>

        {/* Mobile / PWA — secondary CTAs centered above the iOS navigation bar */}
        <nav
          aria-label="Hero secondary actions"
          className={`flex w-full flex-col items-center gap-5 md:hidden ${
            isPwa
              ? "mt-auto pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-8"
              : "absolute inset-x-6 bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] w-auto"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              trackEvent("click_singapore_gallery_preview", { event_category: "CTA", event_label: "HeroSecondary" });
              scrollToSection("apartment-tour-heading");
            }}
            className="font-body text-[11px] font-semibold uppercase tracking-[0.25em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-opacity duration-300 hover:opacity-70"
          >
            Singapore Gallery Preview
          </button>
          <span className="h-px w-20 bg-white/30" aria-hidden="true" />
          <button
            type="button"
            onClick={openTour}
            className="group flex flex-col items-center font-body text-[11px] font-semibold uppercase tracking-[0.25em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-opacity duration-300 hover:opacity-70"
          >
            <span>Book Private Appointment</span>
            <span className="text-[9px] font-bold normal-case italic tracking-widest text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">(trade only)</span>
          </button>
        </nav>



      </div>

      {/* Desktop — secondary CTAs lowered to the bottom, centred, same ghost UI */}
      <nav
        aria-label="Hero secondary actions"
        className="hero-fade-in-delayed-5 pointer-events-auto absolute bottom-8 inset-x-0 mx-auto w-fit z-20 hidden flex-col items-center gap-3 md:flex font-body text-[10px] font-light uppercase tracking-[0.34em] text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)] before:absolute before:-inset-x-4 before:-inset-y-2.5 before:-z-10 before:rounded-sm before:bg-black/35 before:backdrop-blur-[2px] before:[mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]"
      >
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              trackEvent("click_singapore_gallery_preview", { event_category: "CTA", event_label: "HeroSecondary" });
              scrollToSection("apartment-tour");
            }}
            className="transition-opacity duration-300 hover:opacity-70"
          >
            Singapore Gallery Preview
          </button>
          <span aria-hidden="true" className="h-3 w-px bg-white/40" />
          <button
            type="button"
            onClick={openTour}
            className="transition-opacity duration-300 hover:opacity-70"
          >
            Book Private Appointment{" "}
            <span className="ml-2 tracking-[0.2em] text-white/70">(Trade Only)</span>
          </button>
        </div>
      </nav>

      <PrivateTourDialog open={tourOpen} onOpenChange={setTourOpen} />
    </section>
  );
};

export default Hero;
