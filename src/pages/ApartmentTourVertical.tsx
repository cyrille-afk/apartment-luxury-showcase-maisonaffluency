import { Helmet } from "react-helmet-async";

const VIDEO_URL = "https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/videos/apartment-tour-vertical.mp4";
const OG_IMAGE = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1080,h_1920,c_fill,g_auto,q_auto/bespoke-sofa_gxidtx";

const ApartmentTourVertical = () => {
  return (
    <>
      <Helmet>
        <title>A Private Apartment Tour — Maison Affluency Singapore</title>
        <meta name="description" content="An exclusive cinematic tour of a bespoke Singapore apartment curated by Maison Affluency — vertical format for Instagram Reels and TikTok." />
        <meta property="og:title" content="A Private Apartment Tour — Maison Affluency" />
        <meta property="og:description" content="An exclusive cinematic tour of a bespoke Singapore apartment curated by Maison Affluency." />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:type" content="video.other" />
        <meta property="og:video" content={VIDEO_URL} />
        <meta property="og:video:type" content="video/mp4" />
        <meta property="og:video:width" content="1080" />
        <meta property="og:video:height" content="1920" />
        <meta name="twitter:card" content="player" />
        <meta name="twitter:title" content="A Private Apartment Tour — Maison Affluency" />
        <meta name="twitter:image" content={OG_IMAGE} />
      </Helmet>

      <div className="min-h-screen bg-[#0d0c0a] flex flex-col items-center justify-center px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6 md:mb-10">
          <p className="text-[11px] tracking-[0.3em] uppercase text-[#d4bea0]/60 mb-3 font-light">
            Maison Affluency · Singapore
          </p>
          <h1 className="font-display text-xl md:text-3xl text-[#f5f0eb] font-light tracking-wide">
            A Private Apartment Tour
          </h1>
          <div className="w-20 h-px bg-[#d4bea0]/40 mx-auto mt-4" />
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#d4bea0]/40 mt-3 font-light">
            Vertical · Instagram Reels &amp; TikTok
          </p>
        </div>

        {/* Video */}
        <div className="w-full max-w-sm">
          <video
            src={VIDEO_URL}
            controls
            autoPlay
            muted
            playsInline
            poster={OG_IMAGE}
            className="w-full rounded-sm shadow-2xl"
            style={{ aspectRatio: "9/16" }}
          />
        </div>

        {/* Caption */}
        <p className="text-[#d4bea0]/50 text-xs tracking-[0.15em] uppercase mt-6 font-light">
          Collectible Furniture · Artisan Craftsmanship
        </p>

        {/* Navigation */}
        <div className="flex gap-6 mt-8">
          <a
            href="/apartment-tour"
            className="text-[11px] tracking-[0.2em] uppercase text-[#d4bea0]/40 hover:text-[#d4bea0]/70 transition-colors font-light"
          >
            Horizontal version →
          </a>
          <a
            href="/"
            className="text-[11px] tracking-[0.2em] uppercase text-[#d4bea0]/40 hover:text-[#d4bea0]/70 transition-colors font-light"
          >
            ← Home
          </a>
        </div>
      </div>
    </>
  );
};

export default ApartmentTourVertical;
