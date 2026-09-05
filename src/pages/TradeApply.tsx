import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import TradeFaq from "@/components/trade/TradeFaq";
import TradeRegistrationForm from "@/components/trade/TradeRegistrationForm";

/* Dedicated application page — FAQ (left) + registration form (right). */
const TradeApply = () => {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";
  const regionParam = (searchParams.get("region") || "").toLowerCase();
  const isUKVariant = regionParam === "uk" || regionParam === "gb";

  return (
    <>
      <Helmet>
        <title>Apply — Trade Program — Maison Affluency</title>
        <meta
          name="description"
          content="Apply for the Maison Affluency Trade Program. Exclusive trade pricing, dedicated advisors, and consolidated insured shipping for architects and interior designers."
        />
        <link rel="canonical" href="https://maisonaffluency.com/trade/apply" />
        <meta property="og:title" content="Apply — Trade Program — Maison Affluency" />
        <meta property="og:type" content="website" />
        <meta
          property="og:description"
          content="Register for exclusive trade pricing and dedicated support for design professionals."
        />
        <meta property="og:url" content="https://maisonaffluency.com/trade/apply" />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Top nav */}
        <div className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
          <div className="max-w-7xl mx-auto px-4 md:px-12 py-3 flex items-center justify-between">
            <Link
              to="/trade-program"
              className="inline-flex items-center gap-1.5 font-body text-xs font-semibold text-foreground hover:text-primary transition-colors uppercase tracking-[0.1em]"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Trade Program
            </Link>
            <Link
              to="/trade/login"
              className="px-5 py-2 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 md:py-14 flex flex-col lg:flex-row lg:items-stretch gap-10 lg:gap-16">
          {/* Left — FAQ */}
          <div className="flex-1 lg:pr-12 order-2 lg:order-1">
            <TradeFaq isUKVariant={isUKVariant} />
          </div>

          {/* Divider */}
          <div className="hidden lg:block w-px bg-border shrink-0 order-2" />
          <div className="block lg:hidden order-2">
            <div className="h-px bg-border" />
            <div className="h-px bg-border/50 mt-[2px]" />
          </div>

          {/* Right — Registration Form */}
          <div className="flex-1 lg:pl-12 order-1 lg:order-3">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="mb-8">
                <h1 className="font-display text-2xl md:text-3xl text-foreground mb-3 text-center">
                  Apply to the Trade Program
                </h1>
                <div className="border-t border-border mt-4" />
              </div>

              <p className="font-body text-sm text-muted-foreground mb-6">
                Get verified instantly.<br />Our automated system reviews global design credentials in real time.
              </p>
              <TradeRegistrationForm prefillEmail={prefillEmail} />
              <p className="mt-6 font-body text-sm text-muted-foreground">
                Already a member?{" "}
                <Link to="/trade/login" className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors">
                  Sign in
                </Link>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TradeApply;
