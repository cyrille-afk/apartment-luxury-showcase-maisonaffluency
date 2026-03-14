import { motion } from "framer-motion";
import { Briefcase, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cloudinaryUrl } from "@/lib/cloudinary";

const philosophyPoints = [
  {
    title: "Dedicated Client Advisor",
    subtitle: "Tailored Advice and True Partnership",
    content:
      "Maison Affluency nurture one-on-one relationships with its clients offering personalised and tailored advice on each project. From access to confidential sourcing, design collaborations and curation of artworks, our curating team offers a solid partnership",
  },
  {
    title: "Custom Requests",
    subtitle: "From inspiration to customisation",
    content:
      "Let us use our global connections to specialist workshops and renowned designers to help you find the best solutions",
  },
  {
    title: "Samples & Swatches",
    subtitle: "A comprehensive Material Library",
    content:
      "Every material speaks to authenticity and craftsmanship. Natural stone, hand-woven textiles, solid brass fixtures, and hand-painted finishes create a tactile richness that can't be replicated with synthetic alternatives. Access a comprehensive material library featuring a vast, curated selection of items or Request the ones you truly desire",
  },
  {
    title: "Consolidated Insured Shipping",
    subtitle: "Maximising time whilst minimising frictions",
    content:
      "Let us help you navigate the many pitfalls of the freight world by recommending the most appropriate partners with full insurance coverage",
  },
];

const TradeLanding = () => {
  return (
    <>
      <Helmet>
        <title>Trade Program — Maison Affluency</title>
        <meta name="description" content="Join Maison Affluency's Trade Program for exclusive benefits — dedicated client advisors, custom requests, material libraries, and consolidated insured shipping for architects and interior designers." />
        <meta property="og:title" content="Trade Program — Maison Affluency" />
        <meta property="og:description" content="Exclusive benefits for architects and interior designers. Apply now." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Top nav */}
        <div className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 md:px-12 py-3 flex items-center justify-between">
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

        {/* Hero banner */}
        <div className="relative w-full max-w-6xl mx-auto mt-8 md:mt-12 px-4 md:px-12">
          <div className="overflow-hidden rounded-sm relative aspect-[16/9] md:aspect-[21/9]">
            <img
              src={cloudinaryUrl("v1772600100/IMG_3387_1_p1mhex", { width: 1400, quality: "auto:good", crop: "fill" })}
              alt="Luxury furniture styled in a professionally designed interior at Maison Affluency showroom"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
            >
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] tracking-wide">
                Trade Program
              </h1>
              <p className="font-display text-base sm:text-lg md:text-2xl text-white mt-3 sm:mt-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] tracking-widest font-light">
                Join &amp; Enjoy Exclusive Benefits
              </p>
            </motion.div>
          </div>
        </div>

        {/* Principles section */}
        <div className="max-w-4xl mx-auto px-4 md:px-12 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h2 className="font-display text-2xl md:text-3xl text-foreground text-center mb-10 underline underline-offset-8 decoration-1">
              Our Guiding Principles
            </h2>

            <Accordion type="single" collapsible className="space-y-4">
              {philosophyPoints.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`philosophy-${index}`}
                  className="border border-border bg-card px-6 md:px-8 py-2 transition-colors hover:bg-muted/30"
                >
                  <AccordionTrigger className="text-left hover:no-underline flex-row-reverse md:flex-row justify-end md:justify-between gap-3 md:gap-0 py-4">
                    <div>
                      <div className="font-display text-lg text-foreground md:text-xl">
                        {item.title}
                      </div>
                      <div className="mt-1 font-body text-sm text-muted-foreground">
                        {item.subtitle}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 pb-3">
                    <p className="font-body text-sm md:text-base leading-relaxed text-muted-foreground">
                      {item.content}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* CTAs */}
            <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-5">
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
