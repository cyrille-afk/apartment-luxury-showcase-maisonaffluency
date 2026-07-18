import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { APARTMENT_TOUR_VIDEO_URL } from "@/lib/apartmentTourVideo";
import { trackVideoEvent, attachMilestoneTracking } from "@/lib/videoTracking";
import ShareMenu from "@/components/ShareMenu";

const CANONICAL_URL = "https://www.maisonaffluency.com/apartment-tour";
const SITE_URL = "https://www.maisonaffluency.com";

const VIDEO_URL = APARTMENT_TOUR_VIDEO_URL;
const OG_IMAGE = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,g_auto,q_auto,f_jpg/bespoke-sofa_gxidtx.jpg";
const SHARE_URL = "https://www.maisonaffluency.com/apartment-tour-og.html";
const SHARE_MESSAGE = `Maison Affluency · A Private Apartment Tour — An exclusive cinematic tour of a bespoke Singapore apartment: ${SHARE_URL}`;

const ApartmentTour = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Ensure sound is on by default. We don't auto-play because browsers
    // block autoplay with sound — the user's tap on the play control is the
    // gesture that unlocks audio, so the video starts unmuted.
    v.muted = false;
    v.volume = 1;

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
        <meta property="og:title" content="A Private Apartment Tour — Maison Affluency" />
        <meta property="og:description" content="A cinematic tour of a bespoke Singapore apartment curated by Maison Affluency — collectible furniture, artisan craft, skyline views." />
        <meta property="og:url" content={CANONICAL_URL} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:type" content="video.other" />
        <meta property="og:video" content={VIDEO_URL} />
        <meta property="og:video:type" content="video/mp4" />
        <meta property="og:video:width" content="1920" />
        <meta property="og:video:height" content="1080" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta name="description" content="Cinematic tour of a bespoke Singapore apartment by Maison Affluency — collectible furniture, artisan craft, panoramic skyline views." />
        <link rel="canonical" href={CANONICAL_URL} />
        <meta name="twitter:card" content="player" />
        <meta name="twitter:site" content="@maisonaffluency" />
        <meta name="twitter:title" content="A Private Apartment Tour — Maison Affluency" />
        <meta name="twitter:description" content="An exclusive cinematic tour of a bespoke Singapore apartment." />
        <meta name="twitter:image" content={OG_IMAGE} />
        <meta name="twitter:player" content={VIDEO_URL} />
        <meta name="twitter:player:width" content="1920" />
        <meta name="twitter:player:height" content="1080" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "VideoObject",
              "@id": `${CANONICAL_URL}#video`,
              name: "A Private Apartment Tour — Maison Affluency",
              description: "A cinematic tour of a bespoke Singapore apartment curated by Maison Affluency, showcasing collectible furniture, artisan craftsmanship and panoramic skyline views.",
              thumbnailUrl: [OG_IMAGE],
              contentUrl: VIDEO_URL,
              embedUrl: CANONICAL_URL,
              uploadDate: "2025-01-01",
              inLanguage: "en",
              isFamilyFriendly: true,
              publisher: {
                "@type": "Organization",
                name: "Maison Affluency",
                url: SITE_URL,
                logo: {
                  "@type": "ImageObject",
                  url: `${SITE_URL}/favicon.png`,
                },
              },
            },
            {
              "@type": "Residence",
              "@id": `${CANONICAL_URL}#residence`,
              name: "A Private Singapore Apartment by Maison Affluency",
              description: "A bespoke private residence in Singapore curated by Maison Affluency, featuring collectible design furniture, artisan craftsmanship and panoramic skyline views.",
              image: OG_IMAGE,
              url: CANONICAL_URL,
              address: {
                "@type": "PostalAddress",
                addressLocality: "Singapore",
                addressCountry: "SG",
              },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "A Private Apartment Tour", item: CANONICAL_URL },
              ],
            },
            {
              "@type": "WebPage",
              "@id": CANONICAL_URL,
              url: CANONICAL_URL,
              name: "A Private Apartment Tour — Maison Affluency Singapore",
              description: "Cinematic tour of a bespoke Singapore apartment by Maison Affluency — collectible furniture, artisan craft, panoramic skyline views.",
              primaryImageOfPage: OG_IMAGE,
              inLanguage: "en",
              isPartOf: {
                "@type": "WebSite",
                name: "Maison Affluency",
                url: SITE_URL,
              },
            },
          ],
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-[#0d0c0a] flex flex-col items-center px-4 py-16 md:py-24">
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
            ref={videoRef}
            src={VIDEO_URL}
            controls
            playsInline
            poster={OG_IMAGE}
            className="w-full rounded-sm shadow-2xl"
            style={{ aspectRatio: "16/9" }}
          />

          {/* Share button — placed below the video so it never covers controls */}
          <div className="flex justify-end mt-3">
            <ShareMenu
              url={SHARE_URL}
              message={SHARE_MESSAGE}
              className="flex items-center gap-2 text-[#d4bea0]/70 hover:text-[#d4bea0] transition-colors"
              iconSize="w-4 h-4"
              showLabel={true}
              labelSize="text-[10px]"
            />
          </div>
        </div>

        {/* Caption */}
        <p className="text-[#d4bea0]/50 text-xs md:text-sm tracking-[0.15em] uppercase mt-6 md:mt-8 font-light">
          Collectible Furniture · Artisan Craftsmanship · Bespoke Interiors
        </p>

        {/* Editorial body */}
        <section className="w-full max-w-3xl mt-16 md:mt-24 text-[#e8ddcf]/85 font-light leading-relaxed space-y-6 text-[15px] md:text-[16px]">
          <h2 className="font-display text-xl md:text-2xl text-[#f5f0eb] tracking-wide">
            Inside a bespoke Singapore residence
          </h2>
          <p>
            This private film follows a fully realised Maison Affluency commission in
            Singapore — a high-floor apartment shaped over many months around its owners,
            its skyline and a tightly edited cast of collectible pieces. The camera moves
            slowly through entry, living, dining and primary suite, pausing on the
            materials, joinery and proportions that anchor the project: hand-rubbed
            lacquer, woven shagreen, blackened bronze, raw silk, hand-tufted wool.
          </p>
          <p>
            Every object on screen is a curated choice, not a catalogue pick. The
            sofas are bespoke; the lighting is sculptural; the case goods are signed
            works by independent ateliers we represent. The result is an interior that
            reads as a private collection — quiet, layered, deeply personal — rather
            than a showroom.
          </p>
          <h3 className="font-display text-lg md:text-xl text-[#f5f0eb] tracking-wide pt-4">
            How Maison Affluency works
          </h3>
          <p>
            We act as the editorial layer between collectors, interior designers and a
            roster of European, Japanese and American makers. Every commission begins
            with a brief, a budget and a site; from there we propose a focused edit of
            pieces — often one of one — and manage production, freight, white-glove
            delivery and installation. The apartment in this film is one example of
            that process applied end to end.
          </p>
          <p>
            If you are designing a residence, a yacht or a hospitality project and
            want to work this way, our{" "}
            <Link to="/trade-program" className="text-[#d4bea0] hover:text-[#f5f0eb] underline underline-offset-4">
              trade programme
            </Link>{" "}
            opens net pricing, technical drawings and bespoke quoting. Private
            collectors can browse the same catalogue through our{" "}
            <Link to="/collectibles" className="text-[#d4bea0] hover:text-[#f5f0eb] underline underline-offset-4">
              collectibles edit
            </Link>{" "}
            and our{" "}
            <Link to="/designers" className="text-[#d4bea0] hover:text-[#f5f0eb] underline underline-offset-4">
              represented designers
            </Link>
            .
          </p>
          <h3 className="font-display text-lg md:text-xl text-[#f5f0eb] tracking-wide pt-4">
            About this Singapore commission
          </h3>
          <p>
            The residence sits on a high floor of a residential tower with uninterrupted
            views over the Marina Bay skyline. The brief asked for an interior that felt
            collected rather than decorated — pieces that would age, patinate and earn
            their place over the next decade. We worked with the architect on built-in
            joinery in fumed oak and bronze, then layered seating, lighting and case
            goods sourced from ateliers in Paris, Milan, Kyoto and New York. Several
            pieces are unique commissions made specifically for this apartment;
            others are limited editions from designers featured in our{" "}
            <Link to="/journal" className="text-[#d4bea0] hover:text-[#f5f0eb] underline underline-offset-4">
              journal
            </Link>
            . The result is a quiet, considered home that doubles as a working
            example of our curatorial approach.
          </p>
          <h3 className="font-display text-lg md:text-xl text-[#f5f0eb] tracking-wide pt-4">
            Continue exploring
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[14px] md:text-[15px]">
            <li>
              <Link to="/gallery" className="text-[#d4bea0] hover:text-[#f5f0eb] underline underline-offset-4">
                The showroom gallery
              </Link>
              <span className="text-[#d4bea0]/50"> — pieces in situ.</span>
            </li>
            <li>
              <Link to="/journal" className="text-[#d4bea0] hover:text-[#f5f0eb] underline underline-offset-4">
                Journal
              </Link>
              <span className="text-[#d4bea0]/50"> — essays on craft and provenance.</span>
            </li>
            <li>
              <Link to="/new-in" className="text-[#d4bea0] hover:text-[#f5f0eb] underline underline-offset-4">
                New arrivals
              </Link>
              <span className="text-[#d4bea0]/50"> — latest pieces in the edit.</span>
            </li>
            <li>
              <Link to="/contact" className="text-[#d4bea0] hover:text-[#f5f0eb] underline underline-offset-4">
                Contact
              </Link>
              <span className="text-[#d4bea0]/50"> — start a private commission.</span>
            </li>
          </ul>
        </section>

        {/* Back link */}
        <Link
          to="/"
          className="mt-16 md:mt-20 text-[11px] tracking-[0.25em] uppercase text-[#d4bea0]/40 hover:text-[#d4bea0]/70 transition-colors font-light"
        >
          ← maisonaffluency.com
        </Link>
      </div>
    </>
  );
};

export default ApartmentTour;
