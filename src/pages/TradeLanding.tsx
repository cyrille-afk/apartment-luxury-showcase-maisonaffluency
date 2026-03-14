import { motion } from "framer-motion";
import { Briefcase, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { cloudinaryUrl } from "@/lib/cloudinary";

/**
 * Benefits displayed as alternating image + text sections.
 * Replace placeholder images with your own Cloudinary URLs.
 */
const benefits = [
  {
    title: "Trade Pricing & Bespoke Quotations",
    description:
      "View pricing instantly when you sign in with your trade account and save time with our bespoke quotations, a comprehensive multi-product document listing all prices at a glance.",
    // TODO: Replace with your own image
    image: cloudinaryUrl("v1772600100/IMG_3387_1_p1mhex", { width: 1400, quality: "auto:good", crop: "fill" }),
  },
  {
    title: "Dedicated Client Advisor",
    description:
      "Maison Affluency nurture one-on-one relationships with its clients offering personalised and tailored advice on each project. From access to confidential sourcing, design collaborations and curation of artworks, our curating team offers a solid partnership.",
    // TODO: Replace with your own image
    image: cloudinaryUrl("v1772600100/IMG_3387_1_p1mhex", { width: 1400, quality: "auto:good", crop: "fill" }),
  },
  {
    title: "Custom Requests",
    description:
      "Let us use our global connections to specialist workshops and renowned designers to help you find the best solutions. From inspiration to customisation, we help find the solutions for a seamless experience.",
    // TODO: Replace with your own image
    image: cloudinaryUrl("v1772600100/IMG_3387_1_p1mhex", { width: 1400, quality: "auto:good", crop: "fill" }),
  },
  {
    title: "Samples & Swatches",
    description:
      "Every material speaks to authenticity and craftsmanship. Access the most comprehensive material library featuring a vast, curated selection of items or request the ones you truly desire.",
    // TODO: Replace with your own image
    image: cloudinaryUrl("v1772600100/IMG_3387_1_p1mhex", { width: 1400, quality: "auto:good", crop: "fill" }),
  },
  {
    title: "Consolidated Insured Shipping",
    description:
      "Let us help you navigate the many pitfalls of the freight world by recommending the most appropriate partners with full insurance coverage. Maximising time whilst minimising frictions.",
    // TODO: Replace with your own image
    image: cloudinaryUrl("v1772600100/IMG_3387_1_p1mhex", { width: 1400, quality: "auto:good", crop: "fill" }),
  },
];

const TradeLanding = () => {
  return (
    <>
      <Helmet>
        <title>Trade Program — Maison Affluency</title>
        <meta
          name="description"
          content="Join Maison Affluency's Trade Program for exclusive benefits — dedicated client advisors, custom requests, material libraries, and consolidated insured shipping for architects and interior designers."
        />
        <meta property="og:title" content="Trade Program — Maison Affluency" />
        <meta
          property="og:description"
          content="Exclusive benefits for architects and interior designers. Apply now."
        />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex"
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Sticky top nav */}
        <div className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 md:px-12 py-3 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Maison Affluency
            </Link>
            <Link
              to="/trade/login"
              className="px-5 py-2 bg-white hover:bg-white/90 text-foreground border border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] font-body text-xs uppercase tracking-[0.15em] rounded-full transition-all duration-300"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* ─── Full-width Hero ─── */}
        <div className="relative w-full h-[70vh] md:h-[85vh] overflow-hidden">
          <img
            src={cloudinaryUrl("v1772085848/intimate-dining_ux4pee", { width: 1920, quality: "auto:good", crop: "fill" })}
            alt="Maison Affluency Trade Program"
            className="w-full h-full object-cover object-[center_70%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6"
          >
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)] tracking-wide">
              Trade Program
            </h1>
            <p className="font-display text-base sm:text-lg md:text-2xl text-white mt-3 sm:mt-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] tracking-widest font-light max-w-2xl">
              Join &amp; Enjoy Exclusive Benefits
            </p>
            <div className="flex items-center gap-4 mt-10 sm:mt-14">
              <Link
                to="/trade/register"
                className="bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 hover:border-white/50 text-white px-6 py-3 font-body text-xs uppercase tracking-[0.2em] rounded-full transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] font-bold"
              >
                Join Now
              </Link>
              <Link
                to="/trade/login"
                className="bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 hover:border-white/50 text-white px-6 py-3 font-body text-xs uppercase tracking-[0.2em] rounded-full transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.15)] font-bold min-w-[140px] text-center"
              >
                Log In
              </Link>
            </div>
          </motion.div>
        </div>

        {/* ─── Intro text block ─── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto px-6 py-20 md:py-28 text-center"
        >
          <h2 className="font-display text-2xl md:text-3xl text-foreground mb-6">
            Your Exclusive Benefits and Bespoke Services
          </h2>
          <p className="font-body text-base md:text-lg leading-relaxed text-muted-foreground text-justify">
            Our trade program is tailored for a community of professionals who value time, quality, and commitment. 
            In addition to special rates, we offer the full assistance of a dedicated team to swiftly and efficiently 
            manage custom requests. We oversee every aspect of design, sourcing, production, and delivery.
          </p>
        </motion.div>

        {/* ─── Alternating 50/50 split benefit sections ─── */}
        {benefits.map((benefit, index) => {
          const isEven = index % 2 === 0;
          return (
            <div
              key={index}
              className={`flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} min-h-[60vh] md:min-h-[70vh]`}
            >
              {/* Image half */}
              <div className="w-full md:w-1/2 h-[50vh] md:h-auto overflow-hidden relative">
                <img
                  src={benefit.image}
                  alt={benefit.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>

              {/* Text half */}
              <motion.div
                initial={{ opacity: 0, x: isEven ? 40 : -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.8 }}
                className="w-full md:w-1/2 flex flex-col justify-center items-center text-center px-8 py-14 md:px-14 lg:px-20 md:py-20"
              >
                <h2 className="font-display text-xl md:text-2xl lg:text-3xl text-foreground mb-5">
                  {benefit.title}
                </h2>
                <p className="font-body text-base md:text-lg leading-relaxed text-muted-foreground text-justify">
                  {benefit.description}
                </p>
              </motion.div>
            </div>
          );
        })}

        {/* ─── Final CTA ─── */}
        <div className="w-full bg-muted/30 border-t border-border">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto px-6 py-20 md:py-28 text-center"
          >
            <h2 className="font-display text-2xl md:text-3xl text-foreground mb-4">
              Join The Trade Program
            </h2>
            <p className="font-body text-base text-muted-foreground mb-10 max-w-xl mx-auto">
              Apply today and unlock exclusive benefits designed for architects and interior designers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <Link
                to="/trade/register"
                className="inline-flex items-center gap-2 px-8 py-3 bg-white hover:bg-white/90 text-foreground border border-[hsl(var(--gold))] shadow-[0_0_0_1px_hsl(var(--gold)/0.3)] hover:shadow-[0_0_0_2px_hsl(var(--gold)/0.5)] font-body text-xs uppercase tracking-[0.2em] rounded-full transition-all duration-300"
              >
                <Briefcase className="w-4 h-4" />
                Apply Now
              </Link>
              <Link
                to="/trade/login"
                className="font-body text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Already a member? Sign in
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TradeLanding;
