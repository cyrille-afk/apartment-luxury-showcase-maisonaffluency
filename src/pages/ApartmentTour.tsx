import { Helmet } from "react-helmet-async";

const VIDEO_URL = "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/videos/apartment-tour-watermark.mp4";
const OG_IMAGE = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,g_auto,q_auto/bespoke-sofa_gxidtx";

const ApartmentTour = () => {
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
        <div className="w-full max-w-5xl">
          <video
            src={VIDEO_URL}
            controls
            autoPlay
            muted
            playsInline
            poster={OG_IMAGE}
            className="w-full rounded-sm shadow-2xl"
            style={{ aspectRatio: "16/9" }}
          />
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
