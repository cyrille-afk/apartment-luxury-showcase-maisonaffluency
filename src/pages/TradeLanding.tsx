import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Quote, Sparkles } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { withOgCacheBust } from "@/lib/whatsapp-share";
import ShareMenu from "@/components/ShareMenu";
import tradeClientAdvisorImg from "@/assets/trade-client-advisor.jpg";
import projectFoldersImg from "@/assets/benefit-project-folders.jpg";
const studioBeforeImgFallback = "https://res.cloudinary.com/dif1oamtj/image/upload/v1773976063/Screen_Shot_2026-03-20_at_11.05.23_AM_fo0aaz.png";
const studioAfterImgFallback = "https://res.cloudinary.com/dif1oamtj/image/upload/v1773975478/Screen_Shot_2026-03-20_at_10.57.13_AM_yiqv4q.png";
import { loadHeroOverrides, getHeroCacheEntry } from "@/components/trade/SectionHero";

import ShippingTermsExplainer from "@/components/trade/ShippingTermsExplainer";
const TRADE_PROGRAM_SHARE_URL = withOgCacheBust("https://www.maisonaffluency.com/trade-program-og.html");

// Browser country inference moved to src/lib/inferCountry.ts and is now consumed
// directly by TradeRegistrationForm and QuoteRequestDialog as their default value.



const benefits = [
  {
    title: "Dedicated Client Advisor",
    description:
      "Maison Affluency nurture one-on-one relationships with its clients offering personalised and tailored advice on each project. From access to confidential sourcing, design collaborations and curation of artworks, our curating team offers a solid partnership.",
    image: cloudinaryUrl("v1773752378/Screen_Shot_2026-03-17_at_8.58.35_PM_mu5zwl", { width: 1400, quality: "auto:good", crop: "fill", gravity: "north" }),
  },
  {
    title: "Custom Requests",
    description:
      "Collaborating with an established network of manufacturers and specialist workshops, Maison Affluency Trade Program provides you with endless customisation possibilities and bespoke solutions specifically tailored to your creative needs.",
    image: cloudinaryUrl("v1774176831/Screen_Shot_2026-03-22_at_6.53.33_PM_ynpv0c", { width: 1400, quality: "auto:good", crop: "fill" }),
    objectPosition: "top",
  },
  {
    title: "Project Folders",
    description:
      "Maison Affluency Trade Program gives you access to smart professional tools — save your favourite items and easily organise them in project folders, with sharable links to colleagues and clients.",
    image: projectFoldersImg,
  },
  {
    title: "Trade Pricing & Bespoke Quotations",
    description:
      "View pricing instantly when you sign in with your trade account and save time with our bespoke quotations, a comprehensive multi-product document listing all prices at a glance.",
    image: cloudinaryUrl("v1773730098/Screen_Shot_2026-03-17_at_2.47.21_PM_lg1da3", { width: 1400, height: 1050, quality: "auto:good", crop: "fill", gravity: "north" }),
  },
  {
    title: "Samples & Swatches",
    description:
      "Every material speaks to authenticity and craftsmanship. Access the most comprehensive material library featuring a vast, curated selection of items or request the ones you truly desire.",
    image: cloudinaryUrl("v1773472978/combination-interior-material-samples-placed-dark-black-marble-table-including-wooden-ceramic-floor-tiles-luxury-marble-stones_1033579-186119_kmp53v", { width: 1400, quality: "auto:good", crop: "fill" }),
  },
  {
    title: "Consolidated Insured Shipping",
    description:
      "Let us help you navigate the many pitfalls of the freight world by recommending the most appropriate partners with full insurance coverage. Maximising time whilst minimising frictions.",
    image: cloudinaryUrl("v1773473193/quality-control_dvxvmb", { width: 1400, quality: "auto:good", crop: "fill" }),
  },
];

const stats = [
  { value: "300+", label: "Designers & Ateliers" },
  { value: "15+", label: "Countries Served" },
  { value: "100%", label: "Insured Shipping" },
  { value: "24h", label: "Quote Turnaround" },
];

const testimonials = [
  {
    quote: "Working with Cyrille and Elsa on our recently completed 20,000 sq ft penthouse was a seamless experience. Maison Affluency did so without question. Their personalised approach helped to ensure that our design vision and curation was implemented meticulously. They are the partners you want on your most ambitious projects, and we look forward to many more collaborations ahead.",
    name: "Amelia W. and Antonio E.",
    title: "Co-founders, Wecraft Group",
    location: "Singapore",
  },
  {
    quote: "Access to exclusive collections and consolidated shipping has been invaluable. Maison Affluency truly understands the needs of design professionals working across borders.",
    name: "James T.",
    title: "Creative Director",
    location: "Hong Kong",
  },
  {
    quote: "Their material library is exceptional. Being able to request samples directly and receive a comprehensive quote within days has transformed how we specify for clients.",
    name: "Mei W.",
    title: "Interior Architect",
    location: "Kuala Lumpur",
  },
];

const TradeLanding = () => {
  // Featured Issue (AD) free-download removed from the trade area.

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const regionParam = (searchParams.get("region") || "").toLowerCase();
  const [isUKVariant, setIsUKVariant] = useState<boolean>(
    regionParam === "uk" || regionParam === "gb",
  );
  

  // Overridable 3D Studio images from HeroManager
  const [studioBeforeImg, setStudioBeforeImg] = useState(studioBeforeImgFallback);
  const [studioAfterImg, setStudioAfterImg] = useState(studioAfterImgFallback);

  useEffect(() => {
    loadHeroOverrides().then(() => {
      const before = getHeroCacheEntry("landing-3d-before");
      const after = getHeroCacheEntry("landing-3d-after");
      if (before) setStudioBeforeImg(before.image_url);
      if (after) setStudioAfterImg(after.image_url);
    });
  }, []);

  // Legacy #apply/#register deep links now live on the dedicated application page.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#register" || hash === "#apply") {
      navigate("/trade/apply", { replace: true });
    }
  }, [navigate]);


/* ─── Mobile Benefits Carousel ─── */
const MobileBenefitsCarousel = ({ benefits }: { benefits: typeof import("./TradeLanding").default extends never ? any : { title: string; description: string; image: string }[] }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.offsetWidth * 0.85;
    setActiveIndex(Math.round(scrollLeft / cardWidth));
  }, []);

  return (
    <div className="md:hidden pb-8">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-5"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {benefits.map((benefit: any, index: number) => (
          <div
            key={index}
            className="snap-center shrink-0 w-[85%] rounded-sm overflow-hidden border border-border bg-background"
          >
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src={benefit.image}
                alt={benefit.title}
                className={`w-full h-full object-cover ${benefit.objectPosition ? `object-${benefit.objectPosition}` : 'object-bottom'}`}
                loading="lazy"
              />
            </div>
            <div className="p-4">
              <p className="font-body text-[9px] tracking-[0.25em] uppercase text-accent mb-2">Trade Program Benefits</p>
              <h3 className="font-display text-sm text-foreground mb-1.5">{benefit.title}</h3>
              <p className="font-body text-xs leading-relaxed text-muted-foreground text-justify">{benefit.description}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {benefits.map((_: any, i: number) => (
          <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeIndex ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
};

/* ─── Mobile Testimonials (truncated) ─── */
const MobileTestimonials = ({ testimonials }: { testimonials: { quote: string; name: string; title: string; location: string }[] }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? testimonials : testimonials.slice(0, 1);

  return (
    <>
      {/* Desktop: full grid */}
      <div className="hidden md:grid grid-cols-3 gap-8">
        {testimonials.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: i * 0.15 }}
            className="relative bg-background border border-border rounded-sm p-8 flex flex-col"
          >
            <Quote className="w-5 h-5 text-accent/50 mb-4 shrink-0" />
            <p className="font-body text-sm leading-relaxed text-muted-foreground flex-1 text-justify">"{t.quote}"</p>
            <div className="mt-6 pt-4 border-t border-border">
              <p className="font-display text-sm text-foreground">{t.name}</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">{t.title} · {t.location}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Mobile: truncated */}
      <div className="md:hidden space-y-4">
        {visible.map((t, i) => (
          <div key={i} className="bg-background border border-border rounded-sm p-6 flex flex-col">
            <Quote className="w-5 h-5 text-accent/50 mb-4 shrink-0" />
            <p className="font-body text-sm leading-relaxed text-muted-foreground flex-1">"{t.quote}"</p>
            <div className="mt-4 pt-3 border-t border-border">
              <p className="font-display text-sm text-foreground">{t.name}</p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">{t.title} · {t.location}</p>
            </div>
          </div>
        ))}
        {!showAll && testimonials.length > 1 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full py-3 font-body text-xs tracking-[0.15em] uppercase text-accent border border-accent/30 rounded-sm hover:bg-accent/5 transition-colors"
          >
            Show {testimonials.length - 1} more reviews
          </button>
        )}
        {showAll && testimonials.length > 1 && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full py-3 font-body text-xs tracking-[0.15em] uppercase text-muted-foreground border border-border rounded-sm hover:bg-muted/30 transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    </>
  );
};

  return (
    <>
      <Helmet>
        <title>Trade Program — Maison Affluency</title>
        <meta
          name="description"
          content="Trade Program for architects & interior designers — exclusive pricing, dedicated advisors, custom sourcing, and consolidated insured shipping."
        />
        <meta property="og:title" content="Trade Program — Maison Affluency" />
        <meta property="og:type" content="website" />
        <meta
          property="og:description"
          content="Join Maison Affluency's Trade Program for architects and interior designers — exclusive pricing, dedicated advisors, custom sourcing, and insured shipping."
        />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex"
        />
        <meta property="og:url" content="https://maisonaffluency.com/trade-program" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trade Program — Maison Affluency" />
        <meta name="twitter:description" content="Join Maison Affluency's Trade Program for architects and interior designers — exclusive pricing, dedicated advisors, custom sourcing, and insured shipping." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex" />
        <link rel="canonical" href="https://maisonaffluency.com/trade-program" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Trade Program — Maison Affluency",
          "url": "https://maisonaffluency.com/trade-program",
          "description": "Exclusive trade program for architects and interior designers offering trade pricing, dedicated client advisors, custom requests, material libraries, and consolidated insured shipping.",
          "publisher": { "@type": "Organization", "name": "Maison Affluency" },
          "mainEntity": {
            "@type": "Service",
            "name": "Maison Affluency Trade Program",
            "provider": {
              "@type": "Organization",
              "name": "Maison Affluency",
              "url": "https://maisonaffluency.com"
            },
            "description": "B2B programme for interior designers, architects, and luxury hospitality professionals. Includes trade pricing, bespoke quotations, dedicated client advisors, custom sourcing, samples & swatches, and consolidated insured shipping.",
            "areaServed": { "@type": "Place", "name": "Asia-Pacific" },
            "audience": {
              "@type": "BusinessAudience",
              "audienceType": "Interior Designers, Architects, Decorators"
            },
            "offers": {
              "@type": "Offer",
              "description": "No minimum purchase required. Commission-based trade discounts.",
              "priceCurrency": "SGD"
            }
          }
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Sticky top nav */}
        <div className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
          <div className="max-w-7xl mx-auto px-4 md:px-12 py-3 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-body text-xs font-semibold text-foreground hover:text-primary transition-colors uppercase tracking-[0.1em]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Maison Affluency
            </Link>
            {/* Region selector — switches landing copy without changing the URL */}
            <div
              role="group"
              aria-label="Choose region"
              className="inline-flex items-center rounded-full border border-border bg-background overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setIsUKVariant(false)}
                aria-pressed={!isUKVariant}
                className={`px-3 py-1 font-body text-[10px] md:text-[11px] uppercase tracking-[0.15em] transition-colors ${
                  !isUKVariant
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Worldwide
              </button>
              <button
                type="button"
                onClick={() => setIsUKVariant(true)}
                aria-pressed={isUKVariant}
                className={`px-3 py-1 font-body text-[10px] md:text-[11px] uppercase tracking-[0.15em] transition-colors border-l border-border ${
                  isUKVariant
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                UK
              </button>
            </div>
          </div>
        </div>

        {/* ─── Split-screen Hero ─── */}
        <div className="relative w-full min-h-[calc(100svh-3.5rem)] flex flex-col md:flex-row">
          {/* Left Side */}
          <div className="w-full md:w-1/2 flex items-center justify-start px-6 md:px-12 lg:px-16 py-16 md:py-0 bg-background">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="w-full max-w-xl"
            >
              <h1 className="font-display text-2xl sm:text-3xl lg:text-5xl text-foreground tracking-wide">
                Welcome To Maison Affluency
              </h1>
              <p className="font-display text-2xl sm:text-3xl lg:text-5xl text-foreground mt-3 tracking-widest font-light">
                Trade Program
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const email = (formData.get("email") as string) || "";
                  navigate(`/trade/apply${email ? `?email=${encodeURIComponent(email)}` : ""}`);
                }}
                className="flex items-center gap-3 mt-6 w-full max-w-lg"
              >
                <input
                  type="email"
                  name="email"
                  placeholder="Your work email"
                  className="flex-1 bg-white border border-border/30 focus:border-border/60 text-foreground placeholder:text-muted-foreground/60 px-5 py-3 font-body text-xs uppercase tracking-[0.15em] rounded-full transition-all duration-300 outline-none focus:ring-1 focus:ring-border/30"
                />
                <button
                  type="submit"
                  className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold)/0.9)] text-white border border-[hsl(var(--gold))] px-6 py-3 font-body text-xs uppercase tracking-[0.2em] rounded-full transition-all duration-300 font-bold min-w-[120px] text-center whitespace-nowrap"
                >
                  Join Now
                </button>
              </form>
              <p className="mt-5 font-body text-xs text-muted-foreground tracking-wide">
                Already registered?{" "}
                <Link to="/trade/login" className="text-foreground underline underline-offset-2 hover:text-foreground/80 transition-colors">
                  Sign in
                </Link>
              </p>
            </motion.div>
          </div>

          {/* Right Side */}
          <div className="w-full md:w-1/2 relative min-h-[40vh] md:min-h-0">
            <img
              src={cloudinaryUrl("dining-room_ey0bu5", { width: 1200, height: 1600, quality: "auto:good", crop: "fill", gravity: "auto" })}
              alt="Maison Affluency Trade Program"
              className="absolute inset-0 w-full h-full object-cover"
              data-pin-nopin="true"
            />
            {/* Share button — bottom right of hero */}
            <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-10">
              <ShareMenu
                url={TRADE_PROGRAM_SHARE_URL}
                message={`Maison Affluency — Trade Program: ${TRADE_PROGRAM_SHARE_URL}`}
              />
            </div>
          </div>
        </div>

        {/* ─── Provenance Trust Strip ─── */}
        <div className="w-full bg-background border-b border-border">
          <p className="max-w-5xl mx-auto px-6 py-2.5 text-center font-body text-[11px] md:text-xs text-muted-foreground uppercase tracking-[0.18em]">
            {isUKVariant
              ? "Shipping to the UK from European ateliers — France, Italy & beyond"
              : "Shipping worldwide from European ateliers — France, Italy & beyond"}
          </p>
        </div>

        {/* ─── Stats Bar ─── */}
        <div className="w-full border-y border-border">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex flex-col items-center py-4 md:py-5"
              >
                <span className="font-display text-2xl md:text-3xl text-foreground/80 tracking-wide">
                  {stat.value}
                </span>
                <span className="font-body text-[11px] md:text-xs text-muted-foreground uppercase tracking-[0.15em] mt-1">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Featured Issue download banner removed — AD issue no longer offered as free download in the trade area. */}


        {/* ─── Intro text block ─── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className="mx-auto px-6 py-10 md:py-16 flex flex-col items-center"
        >
          <h2 className="w-[70rem] max-w-full font-display text-xl md:text-2xl lg:text-3xl text-foreground mb-6 text-center md:whitespace-nowrap">
            Discover Your Exclusive Trade Benefits<br className="md:hidden" /> and Bespoke Services
          </h2>
          <p className="w-[70rem] max-w-full font-body text-sm md:text-base leading-relaxed text-muted-foreground text-justify">
            Channeling the essence of high-end European craftsmanship and design, Maison Affluency is proud to work with leading design professionals, including architects, interior designers, and real estate developers across the Middle East and Asia Pacific regions.
          </p>
          <p className="w-[70rem] max-w-full font-body text-sm md:text-base leading-relaxed text-muted-foreground text-justify mt-4">
            Tailored for a community of professionals who value time, quality, and commitment, Maison Affluency Trade Program unlocks a suite of exclusive benefits, specifically conceived to meet design professionals' needs and bring your creative visions to life. Whether it is creating a one-off bespoke piece or supporting you on larger-scale projects, Maison Affluency dedicated Trade Team provides customised support to deliver seamless luxury residential projects, from first contact to post-sale assistance.
          </p>
        </motion.div>

        {/* ─── What You Unlock ─── */}
        <div className="w-full bg-muted/30 border-y border-border">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-14 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.8 }}
              >
                <p className="font-body text-xs tracking-[0.25em] uppercase text-accent mb-4">
                  What You Unlock
                </p>
                <h2 className="font-display text-2xl md:text-3xl lg:text-4xl text-foreground mb-5 leading-tight">
                  Elevate your studio workflow.
                </h2>
                <p className="font-body text-sm md:text-base leading-relaxed text-muted-foreground text-justify">
                  Joining the Maison Affluency Trade Program gives you exclusive pricing, dedicated logistical support, and immediate access to Felix.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.8, delay: 0.15 }}
                className="rounded-sm border border-border bg-card/40 backdrop-blur-sm p-6 md:p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gold))]">
                    Felix · AI Curatorial Guide
                  </p>
                </div>
                <h3 className="font-display text-lg md:text-xl text-foreground mb-3">
                  Meet Felix: Your Digital Studio Assistant
                </h3>
                <p className="font-body text-sm leading-relaxed text-muted-foreground text-justify">
                  Felix is our proprietary AI curation copilot built natively into your trade dashboard. Upload a mood board, and Felix will instantly cross-reference our global inventory to source matching masterworks, calculate trade margins, and generate bespoke PDF client presentations in seconds.
                </p>
                <p className="font-body text-sm leading-relaxed text-muted-foreground text-justify mt-3">
                  Tailor your studio experience: Felix can be renamed to whatever suits your firm's culture.
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* ─── Mobile: Accordion | Desktop: 50/50 split ─── */}

        {/* Mobile accordion */}
        <MobileBenefitsCarousel benefits={benefits} />

        {/* Desktop: alternating 50/50 split — narrower container */}
        <div className="hidden md:block max-w-6xl mx-auto px-8 lg:px-12 py-8">
          {benefits.map((benefit, index) => {
            const isEven = index % 2 === 0;
            return (
              <div
                key={index}
                className={`flex ${isEven ? "flex-row" : "flex-row-reverse"} mb-12 last:mb-0 rounded-sm overflow-hidden`}
              >
                <div className="w-1/2 aspect-[4/3] overflow-hidden relative">
                  <img
                    src={benefit.image}
                    alt={benefit.title}
                    className={`w-full h-full object-cover ${benefit.objectPosition ? `object-${benefit.objectPosition}` : 'object-bottom'}`}
                    loading="lazy"
                    decoding="async"
                    data-pin-nopin="true"
                  />
                </div>
                <motion.div
                  initial={{ opacity: 0, x: isEven ? 40 : -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.8 }}
                  className="w-1/2 flex flex-col justify-center items-center text-center px-10 lg:px-16 py-12"
                >
                  <p className="font-body text-xs tracking-[0.25em] uppercase text-accent mb-8">Trade Program Benefits</p>
                  <h2 className="font-display text-xl lg:text-2xl text-foreground mb-4">
                    {benefit.title}
                  </h2>
                  <p className="font-body text-base leading-relaxed text-muted-foreground text-justify">
                    {benefit.description}
                  </p>
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* ─── Designers & Ateliers Banner ─── */}
        <div className="w-full bg-muted/30 border-y border-border">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-14 md:py-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="text-center mb-8 md:mb-10"
            >
              <p className="font-body text-xs tracking-[0.25em] uppercase text-accent mb-4">Our Curated Network</p>
              <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3">
                Designers & Ateliers Library
              </h2>
              <p className="font-body text-sm text-muted-foreground max-w-lg mx-auto">
                Browse our curated directory of exceptional designers and specialist workshops from around the world.
              </p>
            </motion.div>

            <Link to="/trade/designers" className="block group">
              <div className="relative rounded-sm overflow-hidden aspect-[21/9] md:aspect-[3/1]">
                <img
                  src={cloudinaryUrl("v1773838925/1_6Jp3vJWe7VFlFHZ9WhSJng_u6ai93", { width: 1600, height: 600, quality: "auto:good", crop: "fill", gravity: "auto" })}
                  alt="Designers & Ateliers Library"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/15 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <div className="flex items-center gap-4 md:gap-8 mb-4">
                    <div>
                      <p className="font-display text-3xl md:text-5xl text-background drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">32</p>
                      <p className="font-body text-[10px] md:text-xs tracking-[0.2em] uppercase text-background/80">Ateliers</p>
                    </div>
                    <div className="w-px h-10 md:h-14 bg-background/30" />
                    <div>
                      <p className="font-display text-3xl md:text-5xl text-background drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">274</p>
                      <p className="font-body text-[10px] md:text-xs tracking-[0.2em] uppercase text-background/80">Designers</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 bg-background/15 backdrop-blur-sm border border-background/30 text-background px-5 py-2.5 font-body text-xs uppercase tracking-wider rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
                    Explore the Library
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* ─── 3D Studio Showcase ─── */}
        <div className="w-full relative overflow-hidden">
          {/* Full-bleed background image */}
          <div className="absolute inset-0">
            <img
              src={studioAfterImg}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-foreground/20" />
          </div>
          <div className="relative max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-24">
            <div className="border border-accent/30 rounded-sm bg-foreground/20 backdrop-blur-md px-6 md:px-12 py-12 md:py-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="text-center mb-12 md:mb-16"
            >
              <p className="font-body text-sm md:text-base tracking-[0.3em] uppercase text-[hsl(var(--gold))] mb-6 font-bold drop-shadow-[0_0_12px_hsl(var(--gold)/0.5)]">Exclusive Tool</p>
              <h2 className="font-display text-2xl md:text-4xl lg:text-5xl text-background mb-5">
                From Floor Plan to Furnished
              </h2>
              <p className="font-body text-sm md:text-base leading-relaxed text-background/70 max-w-2xl mx-auto">
                Upload your architectural drawings and watch them transform into fully furnished 3D visualisations, 
                featuring products from our curated portfolio. A first-of-its-kind tool for design professionals.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="relative"
              >
                <p className="font-body text-[10px] tracking-[0.2em] uppercase text-background mb-3">Your Drawing</p>
                <div className="aspect-[4/3] rounded-sm overflow-hidden border border-background/10">
                  <img
                    src={studioBeforeImg}
                    alt="Architectural floor plan sketch"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="relative"
              >
                <p className="font-body text-[10px] tracking-[0.2em] uppercase text-background mb-3">3D Studio Result</p>
                <div className="aspect-[4/3] rounded-sm overflow-hidden border border-background/10">
                  <img
                    src={studioAfterImg}
                    alt="3D furnished room visualization"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-center mt-10 md:mt-14"
            >
              <div className="flex flex-wrap justify-center gap-8 md:gap-14 font-body text-xs tracking-wider uppercase text-background">
                <span>AI-Powered Rendering</span>
                <span>Up to 10 Products</span>
                <span>Before / After Comparison</span>
              </div>
            </motion.div>
            </div>
          </div>
        </div>

        {/* ─── Testimonials ─── */}
        <div className="w-full bg-muted/30 border-y border-border">
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-14 md:py-20">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="text-center mb-10 md:mb-14"
            >
              <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3">
                Trusted by Design Professionals
              </h2>
              <p className="font-body text-sm text-muted-foreground mx-auto">
                Hear from architects and interior designers who rely on our trade program for their projects.
              </p>
            </motion.div>

            <MobileTestimonials
              testimonials={
                isUKVariant
                  ? [
                      {
                        quote:
                          "Sourcing French and Italian ateliers from London used to mean weeks of phone calls and conflicting freight quotes. Maison Affluency consolidates everything — pricing, lead times, customs, delivery — into one clear quotation. It has genuinely changed how we specify on our UK projects.",
                        name: "Studio Principal",
                        title: "Interior Architecture Practice",
                        location: "London, United Kingdom",
                      },
                      ...testimonials,
                    ]
                  : testimonials
              }
            />
          </div>
        </div>

        {/* ─── How It Works ─── */}
        <div className="w-full bg-background">
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-14 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-center mb-10 md:mb-14"
          >
            <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3">
              How It Works
            </h2>
            <p className="font-body text-sm text-muted-foreground max-w-lg mx-auto">
              Getting started takes less than five minutes.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              { step: "01", title: "Apply Online", desc: "Complete a short application with your company credentials and professional background." },
              { step: "02", title: "Get Approved", desc: "Get verified instantly — our automated system reviews global design credentials in real time and activates your trade account." },
              { step: "03", title: "Start Sourcing", desc: "Access trade pricing, request bespoke quotations, and work directly with your dedicated advisor." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="text-center"
              >
                <span className="font-display text-3xl md:text-4xl text-accent/40 tracking-wider">
                  {item.step}
                </span>
                <h3 className="font-display text-base md:text-lg text-foreground mt-3 mb-2">
                  {item.title}
                </h3>
                <p className="font-body text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
        </div>

        {/* ─── Shipping Terms Explainer (DDP vs DAP, destination-aware) ─── */}
        <ShippingTermsExplainer />

        {/* ─── Final CTA ─── */}
        <div className="w-full relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('https://res.cloudinary.com/dif1oamtj/image/upload/w_1600,q_auto,f_auto,c_fill,g_auto/v1773968016/ImgWeb_S25_PDW_Newsletter001_Article_03_1120x600_image002_Factory-_C2_A9GregSevaz_0_m5hi1i')" }}
          />
          <div className="absolute inset-0 bg-foreground/20" />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative z-10 max-w-3xl mx-auto px-6 py-14 md:py-24 text-center"
          >
            <h2 className="font-display text-2xl md:text-3xl text-background mb-4">
              Ready to Get Started?
            </h2>
            <p className="font-body text-sm md:text-base text-white mb-10 max-w-xl mx-auto leading-relaxed font-medium">
              Join a community of architects and interior designers who trust Maison Affluency for their most ambitious projects.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <button
                onClick={() => navigate("/trade/apply")}
                className="inline-flex items-center px-8 py-3 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold)/0.9)] text-white border border-[hsl(var(--gold))] font-body text-xs uppercase tracking-[0.2em] rounded-full transition-all duration-300 font-bold min-w-[160px] justify-center"
              >
                Apply Now
              </button>
              <p className="font-body text-sm text-white font-medium">
                Already a member?{" "}
                <Link to="/trade/login" className="text-white underline underline-offset-4 hover:text-white/90 transition-colors font-bold">
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TradeLanding;
