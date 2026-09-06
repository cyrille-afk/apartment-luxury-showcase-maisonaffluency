import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Quote, Sparkles, Upload } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { cn } from "@/lib/utils";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { supabase } from "@/integrations/supabase/client";
import { clearDarkIosChrome, setImageIosChrome } from "@/lib/iosChrome";

import tradeClientAdvisorImg from "@/assets/trade-client-advisor.jpg";
import projectFoldersImg from "@/assets/benefit-project-folders.jpg";
const studioBeforeImgFallback = "https://res.cloudinary.com/dif1oamtj/image/upload/v1773976063/Screen_Shot_2026-03-20_at_11.05.23_AM_fo0aaz.png";
const studioAfterImgFallback = "https://res.cloudinary.com/dif1oamtj/image/upload/v1773975478/Screen_Shot_2026-03-20_at_10.57.13_AM_yiqv4q.png";
import { loadHeroOverrides, getHeroCacheEntry } from "@/components/trade/SectionHero";
import Navigation from "@/components/Navigation";

import ShippingTermsExplainer from "@/components/trade/ShippingTermsExplainer";
const TRADE_PROGRAM_SHARE_URL = "https://www.maisonaffluency.com/trade-program";
const TRADE_PROGRAM_SHARE_IMAGE = "https://www.maisonaffluency.com/trade-program-hero-whatsapp.jpg";
const TRADE_PROGRAM_HERO_IMAGE = cloudinaryUrl("dining-room_ey0bu5", { width: 1200, quality: "auto:good" });

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
  { value: "300+", label: "Ateliers & Partners" },
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

/* ─── Mobile Benefits Carousel ─── */
const MobileBenefitsCarousel = ({ benefits }: { benefits: { title: string; description: string; image: string; objectPosition?: string }[] }) => {
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
    <div className="md:hidden mt-6 pb-10">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-5"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {benefits.map((benefit, index) => (
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
      <div className="flex justify-center gap-2 mt-6">
        {benefits.map((_, i) => (
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

/* ─── Hero Join Form ─── */
interface HeroJoinFormProps {
  ghost?: boolean;
  joinStep: 1 | 2 | 3 | 4;
  joinLoading: boolean;
  joinError: string | null;
  joinCredentialFile: File | null;
  setJoinCredentialFile: (f: File | null) => void;
  handleJoinSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleStudioSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  handleCredentialsSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

const HeroJoinForm = ({
  ghost = false,
  joinStep,
  joinLoading,
  joinError,
  joinCredentialFile,
  setJoinCredentialFile,
  handleJoinSubmit,
  handleStudioSubmit,
  handleCredentialsSubmit,
}: HeroJoinFormProps) => {
  const credentialFileRef = useRef<HTMLInputElement>(null);
  const labelCls = cn(
    "mb-1.5 block text-left font-body text-[10px] uppercase tracking-[0.22em]",
    ghost ? "text-white/85" : "text-muted-foreground"
  );
  const inputCls = cn(
    "w-full px-5 py-3 font-body text-xs uppercase tracking-[0.15em] text-foreground outline-none transition-colors duration-300 placeholder:text-muted-foreground/60 focus:border-accent focus:ring-1 focus:ring-accent/30",
    ghost
      ? "border border-white/50 bg-white/90 backdrop-blur-sm"
      : "border border-border/60 bg-card"
  );
  const goldBtn =
    "w-full border border-gold bg-gold px-6 py-3 text-center font-body text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground transition-colors duration-300 hover:bg-gold/90 disabled:opacity-60";

  return (
    <AnimatePresence mode="wait" initial={false}>
      {joinStep === 1 ? (
        <motion.div
          key="join-step-1"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
        >
          <form
            onSubmit={handleJoinSubmit}
            className={cn(
              "mx-auto flex w-full flex-col items-stretch gap-2.5",
              ghost ? "max-w-md" : "max-w-lg md:mx-0 md:flex-row md:items-center"
            )}
          >
            <input
              type="email"
              name="email"
              required
              placeholder="Your work email"
              className={cn(inputCls, !ghost && "md:flex-1")}
            />
            <button type="submit" disabled={joinLoading} className={cn(goldBtn, "min-w-[120px] md:w-auto")}>
              {joinLoading ? "Sending…" : "Join Now"}
            </button>
          </form>
          {joinError && (
            <p className={cn("mt-2 text-center font-body text-[11px] md:text-left", ghost ? "text-white" : "text-destructive")}>
              {joinError}
            </p>
          )}
          <p className={cn("mt-2 text-center font-body text-[11px] tracking-wide md:text-left md:text-xs", ghost ? "text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]" : "text-muted-foreground")}>
            Already registered?{" "}
            <Link
              to="/trade/login"
              className={cn("underline underline-offset-2 transition-colors", ghost ? "text-white hover:text-white/80" : "text-foreground hover:text-foreground/80")}
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      ) : joinStep === 2 ? (
        <motion.div
          key="join-step-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={cn("mx-auto w-full", ghost ? "max-w-md" : "max-w-lg md:mx-0")}
        >
          <p className={cn("font-display text-sm italic sm:text-base", ghost ? "text-white" : "text-foreground")}>
            Step 2 of 3 · Studio Details
          </p>
          <div className={cn("mt-2 mb-4 h-px w-full", ghost ? "bg-white/30" : "bg-border")}>
            <div className="h-px w-2/3 bg-gold" />
          </div>

          <form onSubmit={handleStudioSubmit} className="flex w-full flex-col gap-3">
            <div>
              <label htmlFor="company" className={labelCls}>Company / Firm Name</label>
              <input id="company" name="company" required placeholder="Studio name" className={inputCls} />
            </div>
            <div>
              <label htmlFor="website" className={labelCls}>Website or Portfolio Link</label>
              <input id="website" name="website" placeholder="www.yourstudio.com" className={inputCls} />
            </div>
            <button type="submit" disabled={joinLoading} className={cn(goldBtn, "mt-1")}>
              {joinLoading ? "Saving…" : "Continue"}
            </button>
          </form>
          {joinError && (
            <p className={cn("mt-2 text-center font-body text-[11px]", ghost ? "text-white" : "text-destructive")}>
              {joinError}
            </p>
          )}
        </motion.div>
      ) : joinStep === 3 ? (
        <motion.div
          key="join-step-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={cn("mx-auto w-full", ghost ? "max-w-md" : "max-w-lg md:mx-0")}
        >
          <p className={cn("font-display text-sm italic sm:text-base", ghost ? "text-white" : "text-foreground")}>
            Step 3 of 3 · Professional Verification
          </p>
          <div className={cn("mt-2 mb-4 h-px w-full", ghost ? "bg-white/30" : "bg-border")}>
            <div className="h-px w-full bg-gold" />
          </div>

          <form onSubmit={handleCredentialsSubmit} className="flex w-full flex-col gap-3">
            <div>
              <label htmlFor="regNumber" className={labelCls}>Business Registration Number / Tax ID</label>
              <input id="regNumber" name="regNumber" placeholder="e.g. UEN, VAT, EIN" className={inputCls} />
            </div>
            <div>
              <span className={labelCls}>Professional Certification or Portfolio</span>
              <input
                ref={credentialFileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  setJoinCredentialFile(e.target.files?.[0] ?? null);
                }}
              />
              <button
                type="button"
                onClick={() => credentialFileRef.current?.click()}
                className={cn(
                  "flex w-full items-center justify-between px-5 py-3 font-body text-xs uppercase tracking-[0.15em] transition-colors duration-300",
                  ghost
                    ? "border border-dashed border-white/50 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                    : "border border-dashed border-border/60 bg-card text-muted-foreground hover:border-accent/50 hover:text-foreground"
                )}
              >
                <span className="truncate">
                  {joinCredentialFile ? joinCredentialFile.name : "Upload certification or portfolio PDF"}
                </span>
                <Upload className="ml-3 h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
            <button type="submit" disabled={joinLoading} className={cn(goldBtn, "mt-1")}>
              {joinLoading ? "Submitting…" : "Submit Application"}
            </button>
          </form>
          {joinError && (
            <p className={cn("mt-2 text-center font-body text-[11px]", ghost ? "text-white" : "text-destructive")}>
              {joinError}
            </p>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="join-success"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 }}
          className={cn(
            "flex flex-col items-center justify-center py-2 text-center md:items-start md:text-left",
            ghost && "drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
          )}
        >
          <svg
            className={cn("mb-3 h-6 w-6", ghost ? "text-white" : "text-accent")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4.5 12.5l5 5L19.5 6" />
          </svg>
          <p className={cn("font-display text-lg sm:text-2xl", ghost ? "text-white" : "text-foreground")}>
            Thank You for Your Interest.
          </p>
          <p className={cn("mt-1.5 max-w-xs font-body text-[11px] leading-relaxed sm:text-xs md:max-w-sm", ghost ? "text-white/90" : "text-muted-foreground")}>
            An invitation link has been sent to your work email. Our team will review your credentials shortly.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TradeLanding = () => {
  useEffect(() => {
    setImageIosChrome(TRADE_PROGRAM_HERO_IMAGE);
    return () => clearDarkIosChrome();
  }, []);

  // Featured Issue (AD) free-download removed from the trade area.

  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const mobileFormRise = useTransform(heroScrollProgress, [0, 0.75], [18, -46]);
  const [searchParams] = useSearchParams();
  const regionParam = (searchParams.get("region") || "").toLowerCase();
  const [isUKVariant, setIsUKVariant] = useState<boolean>(
    regionParam === "uk" || regionParam === "gb",
  );
  const [joinStep, setJoinStep] = useState<1 | 2 | 3 | 4>(1);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinEmail, setJoinEmail] = useState("");
  const [joinCredentialFile, setJoinCredentialFile] = useState<File | null>(null);

  const handleJoinSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = ((formData.get("email") as string) || "").trim();
    if (!email) return;
    setJoinLoading(true);
    setJoinError(null);
    const { error } = await supabase.functions.invoke("trade-program-signup", {
      body: { email, step: 1 },
    });
    setJoinLoading(false);
    if (error) {
      setJoinError("We couldn't register that email. Please try again.");
      return;
    }
    setJoinEmail(email);
    setJoinStep(2);
  };

  const handleStudioSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const companyName = ((formData.get("company") as string) || "").trim();
    const websiteUrl = ((formData.get("website") as string) || "").trim();
    setJoinLoading(true);
    setJoinError(null);
    const { error } = await supabase.functions.invoke("trade-program-signup", {
      body: { email: joinEmail, step: 2, companyName, websiteUrl },
    });
    setJoinLoading(false);
    if (error) {
      setJoinError("We couldn't save your studio details. Please try again.");
      return;
    }
    setJoinStep(3);
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleCredentialsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const businessRegNumber = ((formData.get("regNumber") as string) || "").trim();
    setJoinLoading(true);
    setJoinError(null);
    let document: { name: string; contentType: string; data: string } | undefined;
    if (joinCredentialFile) {
      if (joinCredentialFile.size > 15 * 1024 * 1024) {
        setJoinLoading(false);
        setJoinError("The document is too large (max 15 MB).");
        return;
      }
      const dataUrl = await fileToDataUrl(joinCredentialFile);
      document = {
        name: joinCredentialFile.name,
        contentType: joinCredentialFile.type || "application/octet-stream",
        data: dataUrl.split(",")[1] || "",
      };
    }
    const { error } = await supabase.functions.invoke("trade-program-signup", {
      body: { email: joinEmail, step: 3, businessRegNumber, document },
    });
    setJoinLoading(false);
    if (error) {
      setJoinError("We couldn't submit your application. Please try again.");
      return;
    }
    setJoinStep(4);
  };


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
          content={TRADE_PROGRAM_SHARE_IMAGE}
        />
        <meta property="og:image:secure_url" content={TRADE_PROGRAM_SHARE_IMAGE} />
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Maison Affluency Trade Program" />
        <meta property="og:url" content="https://www.maisonaffluency.com/trade-program" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trade Program — Maison Affluency" />
        <meta name="twitter:description" content="Join Maison Affluency's Trade Program for architects and interior designers — exclusive pricing, dedicated advisors, custom sourcing, and insured shipping." />
        <meta name="twitter:image" content={TRADE_PROGRAM_SHARE_IMAGE} />
        <link rel="canonical" href="https://www.maisonaffluency.com/trade-program" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Trade Program — Maison Affluency",
          "url": "https://www.maisonaffluency.com/trade-program",
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

      <div className="min-h-[100dvh] scroll-smooth bg-background">
        <div className="relative z-10 w-full min-h-[100dvh] bg-transparent">

        {/* Full official site header (fixed) */}
        <Navigation />
        {/* Spacer reserving the fixed header's footprint */}
        <div aria-hidden className="h-24 md:h-[120px] pt-[env(safe-area-inset-top)]" />

        {/* ─── Split-screen Hero ─── */}
        <div ref={heroRef} className="relative flex h-[calc(100dvh-6rem)] min-h-[580px] w-full flex-col md:h-[calc(100vh-256px)] md:min-h-0 md:flex-row">
          {/* Left Side: title (mobile) / title + form (desktop) */}
          <div className="relative z-20 flex shrink-0 h-auto w-full items-center justify-center bg-background px-6 pb-4 pt-2 md:h-auto md:w-1/2 md:justify-start md:px-12 md:py-12 lg:px-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="relative w-[85%] max-w-xl md:ml-auto md:w-full md:pr-12 md:text-left lg:pr-16"
            >
              <h1 className="whitespace-nowrap font-display text-[1.35rem] leading-[1.2] text-foreground sm:text-3xl lg:text-5xl tracking-wide">
                Welcome to our Trade Program
              </h1>
              <motion.div
                style={{ y: mobileFormRise }}
                className="relative z-30 mx-auto mt-4 hidden w-full bg-background px-3 py-3 shadow-[0_12px_35px_hsl(var(--foreground)/0.08)] md:mx-0 md:block md:bg-transparent md:p-0 md:shadow-none md:!transform-none"
              >
                <HeroJoinForm
                  ghost={false}
                  joinStep={joinStep}
                  joinLoading={joinLoading}
                  joinError={joinError}
                  joinCredentialFile={joinCredentialFile}
                  setJoinCredentialFile={setJoinCredentialFile}
                  handleJoinSubmit={handleJoinSubmit}
                  handleStudioSubmit={handleStudioSubmit}
                  handleCredentialsSubmit={handleCredentialsSubmit}
                />
              </motion.div>
            </motion.div>
          </div>

          {/* Right Side: hero photograph (inline on mobile and desktop) */}
          <div className="relative min-h-[68%] flex-1 w-full bg-background md:h-full md:w-1/2 md:flex-none">
            <img
              src={TRADE_PROGRAM_HERO_IMAGE}
              alt="Maison Affluency Trade Program"
              className="absolute inset-0 h-full w-full object-cover object-[50%_20%] md:object-contain md:object-center"
              data-pin-nopin="true"
            />

            {/* Mobile form overlay — floats just below the chandelier globe and above the table */}
            <div className="absolute inset-x-0 top-[40%] z-30 px-5 md:hidden">
              {/* Readability underlay — blends into the photograph */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-10 -bottom-12 bg-gradient-to-b from-black/0 via-black/40 to-black/0"
              />
              <div className="relative mx-auto w-[85%] max-w-md">
                <HeroJoinForm
                  ghost
                  joinStep={joinStep}
                  joinLoading={joinLoading}
                  joinError={joinError}
                  joinCredentialFile={joinCredentialFile}
                  setJoinCredentialFile={setJoinCredentialFile}
                  handleJoinSubmit={handleJoinSubmit}
                  handleStudioSubmit={handleStudioSubmit}
                  handleCredentialsSubmit={handleCredentialsSubmit}
                />
              </div>
            </div>


            {/* WhatsApp share — direct deep link */}
            <div className="absolute bottom-6 right-6 md:bottom-7 md:right-7 z-40">
              <button
                onClick={() => {
                  const message = `Explore Maison Affluency's exclusive Trade Program for design professionals: ${TRADE_PROGRAM_SHARE_URL}`;
                  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
                  window.open(waUrl, "_blank", "noopener,noreferrer");
                }}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-white/10 text-foreground border border-white/20 shadow-[0_2px_10px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-300 hover:shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:scale-105 touch-manipulation"
                aria-label="Share on WhatsApp"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ─── Provenance Trust Strip ─── */}
        <div className="hidden w-full bg-background border-b border-border md:block">
          <p className="max-w-5xl mx-auto px-6 py-2.5 text-center font-body text-[11px] md:text-xs text-muted-foreground uppercase tracking-[0.18em]">
            {isUKVariant
              ? "Shipping to the UK from European ateliers — France, Italy & beyond"
              : "Shipping worldwide from European ateliers — France, Italy & beyond"}
          </p>
        </div>

        {/* ─── Stats Bar ─── */}
        <div className="w-full border-y border-border bg-background py-6 md:py-0">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-x-5 gap-y-8 px-6 md:grid-cols-4 md:gap-0 md:px-0 md:divide-x md:divide-border">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex min-h-[72px] flex-col items-center justify-center px-2 py-2 md:min-h-0 md:py-5"
              >
                <span className="font-display text-xl md:text-3xl text-foreground/80 tracking-wide">
                  {stat.value}
                </span>
                <span className="mt-1 text-center font-body text-[9px] uppercase tracking-[0.12em] text-muted-foreground md:text-xs md:tracking-[0.15em]">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Featured Issue download banner removed — AD issue no longer offered as free download in the trade area. */}

        {/* Full Trade Program content */}
        <div className="bg-background">


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
              className="rounded-[4px] border border-border/60 bg-cream p-6 md:p-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 text-accent">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="font-body text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--gold))]">
                    Felix · AI Curatorial Guide
                  </p>
                </div>
                <h3 className="font-display text-xl md:text-2xl italic text-foreground mb-3">
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
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 max-w-3xl mx-auto px-8 pt-16 pb-[max(4rem,env(safe-area-inset-bottom)+3rem)] md:py-24 text-center"
          >
            <h2 className="font-display text-2xl md:text-3xl text-white mb-5">
              Ready to Get Started?
            </h2>
            <p className="font-body text-sm md:text-base text-white mb-10 max-w-xl mx-auto leading-relaxed font-medium">
              Join a community of architects and interior designers who trust Maison Affluency for their most ambitious projects.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button
                onClick={() => navigate("/trade/apply")}
                className="inline-flex items-center px-8 py-3 bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold)/0.9)] text-white border border-[hsl(var(--gold))] font-body text-xs uppercase tracking-[0.2em] rounded-none transition-all duration-300 font-bold min-w-[160px] justify-center"
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
        </div>
      </div>
    </>
  );
};

export default TradeLanding;
