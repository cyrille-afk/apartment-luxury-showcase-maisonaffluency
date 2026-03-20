import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, Quote } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { cloudinaryUrl } from "@/lib/cloudinary";
import tradeClientAdvisorImg from "@/assets/trade-client-advisor.jpg";
import projectFoldersImg from "@/assets/benefit-project-folders.jpg";
const studioBeforeImgFallback = "https://res.cloudinary.com/dif1oamtj/image/upload/v1773976063/Screen_Shot_2026-03-20_at_11.05.23_AM_fo0aaz.png";
const studioAfterImgFallback = "https://res.cloudinary.com/dif1oamtj/image/upload/v1773975478/Screen_Shot_2026-03-20_at_10.57.13_AM_yiqv4q.png";
import { loadHeroOverrides, getHeroCacheEntry } from "@/components/trade/SectionHero";
import TradeRegistrationForm from "@/components/trade/TradeRegistrationForm";

const FaqItem = ({ question, answer }: { question: string; answer: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 md:py-5 text-left gap-4"
      >
        <span className="font-display text-sm md:text-base text-foreground">{question}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="font-body text-sm leading-relaxed text-muted-foreground pb-5 text-justify">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
    image: cloudinaryUrl("v1773758590/Screen_Shot_2026-03-17_at_10.40.56_PM_mlwtop", { width: 1400, quality: "auto:good", crop: "fill" }),
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
  { value: "70+", label: "Designers & Ateliers" },
  { value: "15+", label: "Countries Served" },
  { value: "100%", label: "Insured Shipping" },
  { value: "24h", label: "Quote Turnaround" },
];

const testimonials = [
  {
    quote: "The dedicated advisor made our sourcing process seamless. We saved weeks on our hospitality project thanks to their global network and bespoke quotation system.",
    name: "Sarah L.",
    title: "Principal, Studio Interiors",
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
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";
  const [mobileFormExpanded, setMobileFormExpanded] = useState(false);
  const [mobileEmail, setMobileEmail] = useState("");

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

  const scrollToForm = () => {
    const el = formRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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
                className="w-full h-full object-cover object-bottom"
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
          content="Join Maison Affluency's Trade Program for exclusive benefits — dedicated client advisors, custom requests, material libraries, and consolidated insured shipping for architects and interior designers."
        />
        <meta property="og:title" content="Trade Program — Maison Affluency" />
        <meta property="og:type" content="website" />
        <meta
          property="og:description"
          content="Exclusive benefits for architects and interior designers. Apply now."
        />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex"
        />
        <meta property="og:url" content="https://maisonaffluency.com/trade/program" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trade Program — Maison Affluency" />
        <meta name="twitter:description" content="Exclusive benefits for architects and interior designers. Apply now." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex" />
        <link rel="canonical" href="https://maisonaffluency.com/trade/program" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Trade Program — Maison Affluency",
          "url": "https://maisonaffluency.com/trade/program",
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
        <div className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 md:px-12 py-3 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-body text-xs font-semibold text-foreground hover:text-primary transition-colors uppercase tracking-[0.1em]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Maison Affluency
            </Link>
          </div>
        </div>

        {/* ─── Full-width Hero ─── */}
        <div className="relative w-full h-[45vh] md:h-[65vh] overflow-hidden">
          <img
            src={cloudinaryUrl("v1772085848/intimate-dining_ux4pee", { width: 1920, height: 1080, quality: "auto:good", crop: "fill", gravity: "auto" })}
            alt="Maison Affluency Trade Program"
            className="w-full h-full object-cover"
            data-pin-nopin="true"
          />
          <div className="absolute inset-0 bg-foreground/20" />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          >
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)] tracking-wide">
              Welcome To Maison Affluency
            </h1>
            <p className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white mt-3 sm:mt-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] tracking-widest font-light max-w-2xl">
              Trade Program
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = formData.get("email") as string;
                if (email) {
                  setMobileEmail(email);
                  setMobileFormExpanded(true);
                  // Pre-fill the desktop form's email too
                  const emailInput = formRef.current?.querySelector<HTMLInputElement>('.hidden.lg\\:block input[type="email"]');
                  if (emailInput) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                    nativeInputValueSetter?.call(emailInput, email);
                    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                }
                scrollToForm();
              }}
              className="flex items-center gap-3 mt-10 sm:mt-14 w-full max-w-lg px-4"
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
            <p className="mt-5 font-body text-xs text-white/70 tracking-wide">
              Already registered?{" "}
              <Link to="/trade/login" className="text-white underline underline-offset-2 hover:text-white/90 transition-colors">
                Sign in
              </Link>
            </p>
          </motion.div>
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

        {/* ─── Intro text block ─── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className="mx-auto px-6 py-10 md:py-16 flex flex-col items-center"
        >
          <h2 className="w-[70rem] max-w-full font-display text-xl md:text-2xl lg:text-3xl text-foreground mb-6 text-center md:whitespace-nowrap">
            Discover Your Exclusive Trade Benefits and Bespoke Services
          </h2>
          <p className="w-[70rem] max-w-full font-body text-sm md:text-base leading-relaxed text-muted-foreground text-justify">
            Channeling the essence of high-end European craftsmanship and design, Maison Affluency is proud to work with leading design professionals, including architects, interior designers, and real estate developers across the Middle East and Asia Pacific regions.
          </p>
          <p className="w-[70rem] max-w-full font-body text-sm md:text-base leading-relaxed text-muted-foreground text-justify mt-4">
            Tailored for a community of professionals who value time, quality, and commitment, Maison Affluency Trade Program unlocks a suite of exclusive benefits, specifically conceived to meet design professionals' needs and bring your creative visions to life. Whether it is creating a one-off bespoke piece or supporting you on larger-scale projects, Maison Affluency dedicated Trade Team provides customised support to deliver seamless luxury residential projects, from first contact to post-sale assistance.
          </p>
        </motion.div>

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
                    className="w-full h-full object-cover object-bottom"
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
              <p className="font-body text-sm text-muted-foreground max-w-lg mx-auto">
                Hear from architects and interior designers who rely on our trade program for their projects.
              </p>
            </motion.div>

            <MobileTestimonials testimonials={testimonials} />
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
              { step: "02", title: "Get Approved", desc: "Our team reviews your application within 1–2 business days and activates your trade account." },
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

        {/* ─── FAQ + Registration Side by Side ─── */}
        <div ref={formRef} id="apply" className="w-full border-y border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-14 md:py-20 flex flex-col lg:flex-row lg:items-stretch gap-10 lg:gap-16">
            
            {/* Left — FAQ */}
            <div className="flex-1 lg:pr-12 order-3 lg:order-1">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="mb-8 md:mb-10"
              >
                <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3 text-center">
                  Frequently Asked Questions
                </h2>
                <div className="border-t border-border mt-4" />
              </motion.div>

              <div className="space-y-0 divide-y divide-border">
                {[
                  { q: "Who is eligible to join the Trade Program?", a: "The program is designed for architects, interior designers, decorators, and luxury hospitality professionals. We review each application based on company credentials and professional background." },
                  { q: "Is there a minimum order or annual spend requirement?", a: "No. There is no minimum purchase or annual commitment required. You can place orders of any size through your trade account." },
                  { q: "How does trade pricing work?", a: "Once approved, you'll see exclusive trade pricing when signed in. You can also request bespoke multi-product quotations with all prices listed at a glance, including GST where applicable." },
                  { q: "How quickly will I receive a quotation?", a: "Our team responds to quotation requests within 24 hours. Complex or multi-brand projects may take slightly longer as we coordinate with our workshops." },
                  { q: "Do you ship internationally?", a: "Yes. We arrange consolidated, fully insured shipping to most countries. Our logistics team will recommend the most appropriate freight partners for your project location." },
                  { q: "Can I request custom or bespoke pieces?", a: "Absolutely. We work directly with specialist workshops and renowned designers worldwide to fulfil custom requirements — from material modifications to entirely bespoke commissions." },
                  { q: "How long does the application review take?", a: "Applications are typically reviewed within 1–2 business days. You'll receive an email notification once your account has been approved." },
                ].map((faq, i) => (
                  <div key={i} className="py-4">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left lg:pointer-events-none"
                      onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    >
                      <h3 className="font-display text-sm md:text-base text-foreground">{faq.q}</h3>
                      <span className="lg:hidden ml-3 text-muted-foreground shrink-0 transition-transform duration-200" style={{ transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
                    </button>
                    <div className={`overflow-hidden transition-all duration-200 ${openIndex === i ? 'max-h-40 mt-2' : 'max-h-0 lg:max-h-40 lg:mt-2'}`}>
                      <p className="font-body text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px bg-border shrink-0 order-2" />
            <div className="block lg:hidden h-px bg-border my-10 order-2" />

            {/* Right — Registration Form */}
            <div className="flex-1 lg:pl-12 order-1 lg:order-3">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <div className="mb-8">
                  <h2 className="font-display text-2xl md:text-3xl text-foreground mb-3 text-center">
                    Apply to the Trade Program
                  </h2>
                  <div className="border-t border-border mt-4" />
                </div>

                {/* Mobile: collapsed email-first CTA */}
                {!mobileFormExpanded && (
                  <div className="lg:hidden">
                    <p className="font-body text-sm text-muted-foreground mb-4">
                      Enter your work email to get started.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        setMobileFormExpanded(true);
                      }}
                      className="flex items-center gap-3"
                    >
                      <input
                        type="email"
                        value={mobileEmail}
                        onChange={(e) => setMobileEmail(e.target.value)}
                        placeholder="Your work email"
                        required
                        className="flex-1 bg-transparent border-b border-border focus:border-foreground text-foreground placeholder:text-muted-foreground/50 pb-2 font-body text-sm outline-none transition-colors text-[16px]"
                      />
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[hsl(var(--gold))] text-white font-body text-xs uppercase tracking-[0.15em] rounded-full font-bold whitespace-nowrap"
                      >
                        Join Now
                      </button>
                    </form>
                    <p className="mt-4 font-body text-xs text-muted-foreground">
                      Already a member?{" "}
                      <Link to="/trade/login" className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors">
                        Sign in
                      </Link>
                    </p>
                  </div>
                )}

                {/* Mobile: expanded full form (after email entry) */}
                {mobileFormExpanded && (
                  <div className="lg:hidden">
                    <p className="font-body text-sm text-muted-foreground mb-6">
                      Complete the form below to get started. We'll review your application within 1–2 business days.
                    </p>
                    <TradeRegistrationForm prefillEmail={mobileEmail || prefillEmail} />
                    <p className="mt-6 font-body text-sm text-muted-foreground">
                      Already a member?{" "}
                      <Link to="/trade/login" className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors">
                        Sign in
                      </Link>
                    </p>
                  </div>
                )}

                {/* Desktop: always show full form */}
                <div className="hidden lg:block">
                  <p className="font-body text-sm text-muted-foreground mb-6">
                    Complete the form below to get started. We'll review your application within 1–2 business days.
                  </p>
                  <TradeRegistrationForm prefillEmail={prefillEmail} />
                  <p className="mt-6 font-body text-sm text-muted-foreground">
                    Already a member?{" "}
                    <Link to="/trade/login" className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors">
                      Sign in
                    </Link>
                  </p>
                </div>
              </motion.div>
            </div>

          </div>
        </div>

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
                onClick={() => { setMobileFormExpanded(false); setMobileEmail(""); scrollToForm(); }}
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
