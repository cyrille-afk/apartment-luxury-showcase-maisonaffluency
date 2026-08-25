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


      {/* Text overlay — outer wrapper keeps flex positioning; inner wrapper forces alignment to the left side of the screen */}
      <div className={`ma-home-hero-copy relative z-10 flex flex-1 flex-col items-start justify-start px-6 pt-[calc(env(safe-area-inset-top)+14rem)] md:h-full md:min-h-0 md:justify-start md:px-32 md:pb-20 md:pt-[24rem] lg:px-48 ${
        isPwa ? "min-h-screen pb-[calc(env(safe-area-inset-bottom)+2rem)]" : "h-full min-h-0 pb-0"
      }`}>
        {/* Hero text wrapper — forces alignment to the left side of the screen */}
        <div className="flex flex-col items-start text-left w-full max-w-xl md:max-w-2xl px-6 md:px-12 mt-20">
          <h1 className="text-white font-serif text-4xl md:text-5xl leading-tight mb-4">
            Modern Masters.<br />
            Iconic Design.
          </h1>

          {/* Max-width constraint keeps this from spreading into the middle of the room */}
          <p
            className="text-white/90 text-sm md:text-base leading-relaxed mb-6 max-w-md"
            style={{ textShadow: "0px 2px 8px rgba(0,0,0,0.65)" }}
          >
            A curated collection of masterworks reeditions and contemporary design for global architectural projects.
          </p>

          {/* Right-shifted CTA button */}
          <button
            type="button"
            onClick={() => {
              trackEvent("click_meet_designers", { event_category: "CTA", event_label: "HeroCTA" });
              navigate("/designers");
            }}
            className="group flex items-center gap-4 border border-white/30 bg-black/10 px-6 py-3.5 text-xs font-medium tracking-[0.25em] text-white uppercase backdrop-blur-sm transform translate-x-4 md:translate-x-8 transition-all duration-500 ease-out hover:border-white hover:bg-white hover:text-black hover:translate-x-12 hero-fade-in-delayed-3"
          >
            <span>Explore the Collection</span>
            <span className="transition-transform duration-500 ease-out group-hover:translate-x-1">→</span>
          </button>
        </div>

        {/* Mobile / PWA — secondary CTAs centered above the iOS navigation bar */}
        <nav
          aria-label="Hero secondary actions"
          className={`flex w-full flex-col items-center gap-5 md:hidden ${
            isPwa
              ? "mt-auto pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-8"
              : "absolute inset-x-6 bottom-[calc(env(safe-area-inset-bottom)+4rem)] w-auto"
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
