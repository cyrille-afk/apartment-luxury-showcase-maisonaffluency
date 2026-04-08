import { useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { APARTMENT_TOUR_VIDEO_URL } from "@/lib/apartmentTourVideo";
import { trackVideoEvent, attachMilestoneTracking } from "@/lib/videoTracking";
import ShareMenu from "@/components/ShareMenu";

const VIDEO_URL = APARTMENT_TOUR_VIDEO_URL;
const OG_IMAGE = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,g_auto,q_auto,f_jpg/bespoke-sofa_gxidtx.jpg";
const SHARE_URL = "https://www.maisonaffluency.com/apartment-tour-og.html";
const SHARE_MESSAGE = `Maison Affluency · A Private Apartment Tour — An exclusive cinematic tour of a bespoke Singapore apartment: ${SHARE_URL}`;

const ApartmentTour = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play();
    });

    // Track play/pause events
    const onPlay = () => trackVideoEvent("play", "showroom-tour");
    const onPause = () => trackVideoEvent("pause", "showroom-tour");
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);

    // Milestone tracking (25/50/75/100%)
    const detachMilestones = attachMilestoneTracking(v, "showroom-tour");

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      detachMilestones();
    };
  }, []);

  return (
    <>
      <Helmet>
        <title>A Private Apartment Tour — Maison Affluency Singapore</title>
        <meta name="description" content="An exclusive cinematic tour of a bespoke Singapore apartment curated by Maison Affluency — collectible furniture, artisan craftsmanship, and panoramic cityscape views." />
        <meta property="og:title" content="A Private Apartment Tour — Maison Affluency" />
        <meta property="og:description" content="An exclusive cinematic tour of a bespoke Singapore apartment curated by Maison Affluency." />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:type" content="video.other" />
        <meta property="og:video" content={VIDEO_URL} />
        <meta property="og:video:type" content="video/mp4" />
        <meta property="og:video:width" content="1920" />
        <meta property="og:video:height" content="1080" />
        <meta name="twitter:card" content="player" />
        <meta name="twitter:title" content="A Private Apartment Tour — Maison Affluency" />
        <meta name="twitter:description" content="An exclusive cinematic tour of a bespoke Singapore apartment." />
        <meta name="twitter:image" content={OG_IMAGE} />
        <meta name="twitter:player" content={VIDEO_URL} />
        <meta name="twitter:player:width" content="1920" />
        <meta name="twitter:player:height" content="1080" />
      </Helmet>

      <div className="min-h-screen bg-[#0d0c0a] flex flex-col items-center justify-center px-4">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <p className="text-[11px] md:text-[13px] tracking-[0.3em] uppercase text-[#d4bea0]/60 mb-3 font-light">
            Maison Affluency · Singapore
          </p>
          <h1 className="font-display text-2xl md:text-4xl lg:text-5xl text-[#f5f0eb] font-light tracking-wide">
            A Private Apartment Tour
          </h1>
          <div className="w-24 h-px bg-[#d4bea0]/40 mx-auto mt-5" />
        </div>

        {/* Video */}
        <div className="w-full max-w-5xl relative">
          <video
            ref={videoRef}
            src={VIDEO_URL}
            controls
            playsInline
            poster={OG_IMAGE}
            className="w-full rounded-sm shadow-2xl"
            style={{ aspectRatio: "16/9" }}
          />

          {/* Share button — frosted glass overlay */}
          <div className="absolute top-3 right-3 md:bottom-4 md:right-4 md:top-auto z-10">
            <ShareMenu
              url={SHARE_URL}
              message={SHARE_MESSAGE}
              className="bg-black/50 backdrop-blur-md hover:bg-black/70 text-white/80 hover:text-white rounded-full w-9 h-9 md:w-10 md:h-10 flex items-center justify-center transition-all"
              iconSize="w-4 h-4"
              showLabel={false}
            />
          </div>
        </div>

        {/* Caption */}
        <p className="text-[#d4bea0]/50 text-xs md:text-sm tracking-[0.15em] uppercase mt-6 md:mt-8 font-light">
          Collectible Furniture · Artisan Craftsmanship · Bespoke Interiors
        </p>

        {/* Back link */}
        <a
          href="/"
          className="mt-10 md:mt-14 text-[11px] tracking-[0.25em] uppercase text-[#d4bea0]/40 hover:text-[#d4bea0]/70 transition-colors font-light"
        >
          ← maisonaffluency.com
        </a>
      </div>
    </>
  );
};

export default ApartmentTour;
