import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { scrollToSection } from "@/lib/scrollToSection";
import { trackEvent, trackCTA } from "@/lib/analytics";
// Appointment dialog (plus its Turnstile widget) is click-only: keep it out of
// the homepage critical path.
const PrivateTourDialog = lazy(() => import("@/components/PrivateTourDialog"));

const HERO_BASE = "https://res.cloudinary.com/dif1oamtj/image/upload";
const HERO_ID = "v1781920000/AffluencySG_194-22.jpg_macpwj";
const HERO_MOBILE_WEBP = `${HERO_BASE}/c_scale,w_960,q_auto:good,f_webp/${HERO_ID}`;
const HERO_DESKTOP_WEBP = `${HERO_BASE}/c_scale,w_1440,q_auto:good,f_webp/${HERO_ID}`;
const HERO_FALLBACK_JPEG = `${HERO_BASE}/c_scale,w_1440,q_auto:good,f_jpg/${HERO_ID}`;

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
  const [tourMounted, setTourMounted] = useState(false);
  useEffect(() => {
    if (tourOpen) setTourMounted(true);
  }, [tourOpen]);

  const openTour = () => {
    trackCTA.bookAppointment("Hero Secondary CTA");
    setTourOpen(true);
  };

  return (
    <section
      className="relative flex h-[100svh] min-h-[100svh] w-full flex-col justify-between overflow-hidden md:h-screen"
    >
      <picture className="absolute inset-0 block h-full w-full bg-foreground">
        <source media="(max-width: 768px)" srcSet={HERO_MOBILE_WEBP} type="image/webp" />
        <source media="(min-width: 769px)" srcSet={HERO_DESKTOP_WEBP} type="image/webp" />
        <img
          src={HERO_FALLBACK_JPEG}
          width="1440"
          height="960"
          alt="Luxury living room with Asian-inspired murals and designer furniture"
          className="h-full w-full object-cover object-[50%_40%]"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </picture>

      {/* Legibility scrim: bottom-45% fade on mobile/PWA, subtler 35% fade on desktop */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/60 via-black/15 to-transparent md:h-[35%] md:from-black/40 md:via-transparent md:to-transparent"
        aria-hidden="true"
      />


      {/* Text overlay — desktop keeps the previous anchored-top editorial layout;
          mobile/PWA uses a bottom-aligned editorial link stack over the wallpaper. */}
      <div className="ma-home-hero-copy relative z-10 flex h-full min-h-0 flex-1 flex-col items-start justify-start px-6 pb-0 pt-[calc(env(safe-area-inset-top)+14rem)] md:px-32 md:pb-20 md:pt-[24rem] lg:px-48">

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
              onClick={() => {
                trackEvent("click_meet_designers", { event_category: "CTA", event_label: "HeroCTA" });
                navigate("/designers");
              }}
              className="group mt-16 flex translate-x-4 items-center gap-4 border border-white/20 bg-white/5 px-6 py-3.5 font-body text-[11px] font-medium uppercase tracking-[0.25em] text-white backdrop-blur-sm transition-all duration-500 ease-out hover:translate-x-12 hover:border-white hover:bg-white hover:text-black md:mt-20 md:translate-x-8"
            >
              <span>Explore the Collection</span>
              <span aria-hidden="true" className="inline-block transition-transform duration-500 ease-out group-hover:translate-x-1.5">→</span>
            </button>
          </div>
        </div>

        {/* Mobile / PWA — secondary CTAs centered above the iOS navigation bar */}
        <nav
          aria-label="Hero secondary actions"
          className="absolute inset-x-6 bottom-[calc(env(safe-area-inset-bottom)+2.5rem)] flex w-auto flex-col items-center gap-5 md:hidden"
        >
          <button
            type="button"
            onClick={() => {
              trackEvent("click_singapore_gallery_preview", { event_category: "CTA", event_label: "HeroSecondary" });
              scrollToSection("apartment-tour-heading");
            }}
            className="flex min-h-[44px] items-center justify-center font-body text-[11px] font-semibold uppercase tracking-[0.25em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-opacity duration-300 hover:opacity-70"
          >
            Singapore Gallery Preview
          </button>
          <span className="h-px w-20 bg-white/30" aria-hidden="true" />
          <button
            type="button"
            onClick={openTour}
            className="group flex min-h-[44px] flex-col items-center justify-center font-body text-[11px] font-semibold uppercase tracking-[0.25em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-opacity duration-300 hover:opacity-70"
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

      {tourMounted && (
        <Suspense fallback={null}>
          <PrivateTourDialog open={tourOpen} onOpenChange={setTourOpen} />
        </Suspense>
      )}
    </section>
  );
};

export default Hero;
