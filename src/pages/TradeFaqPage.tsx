import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { ChevronDown } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { TRADE_FAQ_ITEMS } from "@/components/trade/TradeFaq";

const TradeFaqPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Trade FAQ — Maison Affluency</title>
        <meta name="description" content="Answers to common questions about the Maison Affluency Trade Program: eligibility, trade pricing, quotations, international shipping, VAT, and bespoke commissions." />
        <meta property="og:title" content="Trade FAQ — Maison Affluency" />
        <meta property="og:description" content="Answers to common questions about the Maison Affluency Trade Program." />
        <meta property="og:url" content="https://www.maisonaffluency.com/trade-faq" />
        <meta name="twitter:card" content="summary" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <Navigation />

      <main className="flex-1 w-full">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
          <h1 className="font-display text-xl md:text-2xl text-foreground tracking-[0.12em] uppercase text-center mb-12">
            Trade FAQ
          </h1>
          <div className="border-t border-border">
            {TRADE_FAQ_ITEMS.map((faq, i) => (
              <div key={i} className="border-b border-border">
                <button
                  type="button"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-6 py-5 text-left group"
                >
                  <span className="font-body text-xs md:text-sm font-medium uppercase tracking-[0.14em] text-foreground group-hover:text-muted-foreground transition-colors">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`}
                    strokeWidth={1.5}
                  />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: openFaq === i ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="font-body text-sm leading-relaxed text-muted-foreground pb-6 pr-10">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TradeFaqPage;
