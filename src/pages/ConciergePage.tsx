import React, { useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ContactInquiry from "@/components/ContactInquiry";
import { AIConcierge } from "@/components/trade/AIConcierge";

const PublicConciergeMount: React.FC = () => <AIConcierge surface="public" />;
const AutoOpenConcierge: React.FC = () => {
  useEffect(() => {
    const t = setTimeout(() => {
      const btn = document.querySelector<HTMLButtonElement>('[aria-label="Open AI Concierge"]');
      btn?.click();
    }, 600);
    return () => clearTimeout(t);
  }, []);
  return null;
};

/**
 * Dedicated landing page for bespoke / concierge inquiries.
 *
 * Replaces the previous flow which deep-linked to /contact (the "Visit Us By
 * Appointment" form). Concierge is positioned as a distinct, white-glove
 * service: customisation of materials, dimensions, finishes, lead time, and
 * pricing for a specific piece — separate from a general showroom visit.
 *
 * Accepts URL params from product pages to pre-frame the inquiry:
 *   ?product=<title>&designer=<name>&page=<absolute-url>
 *
 * These are translated into the `subject` + `message` params that
 * ContactInquiry already understands, so prefill keeps working without
 * touching the form component.
 */
const ConciergePage: React.FC = () => {
  const location = useLocation();
  const [params] = useSearchParams();

  const product = params.get("product")?.trim() || "";
  const designer = params.get("designer")?.trim() || "";
  const page = params.get("page")?.trim() || "";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  // Build the prefill query for ContactInquiry. When the visitor lands
  // without a specific piece, the form opens blank.
  const prefillSearch = useMemo(() => {
    if (!product) return "";
    const subject = `Bespoke inquiry — ${product}${designer ? ` by ${designer}` : ""}`;
    const lines = [
      `Hello, I'd like to inquire about a bespoke version of:`,
      ``,
      `• ${product}`,
      designer ? `• Designer: ${designer}` : "",
      page ? `• Page: ${page}` : "",
      ``,
      `Please share customisation possibilities (materials, dimensions, finishes), lead time, and pricing.`,
    ].filter(Boolean);
    const next = new URLSearchParams();
    next.set("subject", subject);
    next.set("message", lines.join("\n"));
    return `?${next.toString()}`;
  }, [product, designer, page]);

  // ContactInquiry reads from location.search — rewrite history once so it
  // picks up subject/message without a remount. Keeps the visible URL as
  // /concierge?product=… for shareability while feeding the form correctly.
  useEffect(() => {
    if (!prefillSearch) return;
    const url = new URL(window.location.href);
    const target = new URLSearchParams(prefillSearch);
    target.forEach((v, k) => url.searchParams.set(k, v));
    window.history.replaceState({}, "", url.toString());
    // Notify listeners that depend on location.search (ContactInquiry's
    // useEffect deps on location.search via react-router).
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [prefillSearch]);

  const canonical = "https://maisonaffluency.com/concierge";

  return (
    <>
      <Helmet>
        <title>The Concierge — Bespoke Inquiries · Maison Affluency</title>
        <meta
          name="description"
          content="Maison Affluency's private concierge for bespoke commissions — custom materials, dimensions, finishes, lead times and pricing on collectible design."
        />
        <link rel="canonical" href={canonical} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Maison Affluency" />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content="The Concierge — Bespoke Inquiries" />
        <meta
          property="og:description"
          content="A private service for architects, designers and collectors seeking custom materials, dimensions, finishes and lead times on pieces from our ateliers."
        />
        <meta
          property="og:image"
          content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1774310625/20250822-designer-x-ai-gfx-test-09b_esclp8.jpg"
        />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <main className="pt-28 pb-16">
          {/* Editorial hero */}
          <section className="max-w-3xl mx-auto px-6 md:px-8 text-center">
            <p className="font-body text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-[hsl(var(--gold))] mb-6">
              The Concierge
            </p>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl leading-[1.05] text-foreground">
              Bespoke, by quiet appointment.
            </h1>
            <p className="font-body italic text-base md:text-lg text-muted-foreground mt-6 leading-relaxed">
              A private service for architects, designers and collectors —
              tailoring materials, dimensions, finishes and lead times on
              pieces from our ateliers.
            </p>

            {product && (
              <div className="mt-10 inline-flex flex-col items-center gap-1 px-6 py-4 border border-border/60 rounded-sm bg-card/40">
                <span className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Inquiry concerning
                </span>
                <span className="font-display text-lg md:text-xl text-foreground">
                  {product}
                </span>
                {designer && (
                  <span className="font-body text-xs text-muted-foreground italic">
                    by {designer}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* What concierge covers */}
          <section className="max-w-4xl mx-auto px-6 md:px-8 mt-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 border-t border-border/60 pt-12">
              {[
                {
                  k: "I.",
                  h: "Customisation",
                  b: "Adjusted dimensions, alternative finishes, COM upholstery, atelier-specific material requests.",
                },
                {
                  k: "II.",
                  h: "Sourcing",
                  b: "Pieces not yet listed, archive editions, limited runs and one-off commissions through our maker network.",
                },
                {
                  k: "III.",
                  h: "Project support",
                  b: "Lead-time scheduling, FF&E coordination, white-glove logistics and installation guidance.",
                },
              ].map((item) => (
                <div key={item.k} className="flex flex-col gap-2 text-left">
                  <span className="font-display italic text-sm text-[hsl(var(--gold))]">
                    {item.k}
                  </span>
                  <h2 className="font-display text-xl text-foreground leading-tight">
                    {item.h}
                  </h2>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">
                    {item.b}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Private AI concierge — mounted and auto-opened on this route. */}
          <section className="mt-16 max-w-3xl mx-auto px-6 md:px-8 text-center">
            <button
              type="button"
              onClick={() => {
                const btn = document.querySelector<HTMLButtonElement>('[aria-label="Open AI Concierge"]');
                btn?.click();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 shadow-sm hover:opacity-90 transition-all font-body text-[11px] uppercase tracking-[0.2em]"
            >
              Speak with the Concierge
            </button>
            <p className="font-body text-[11px] text-muted-foreground mt-4">
              Instant, private, English-speaking. Replies in seconds.
            </p>
          </section>
          <AutoOpenConcierge />
          <PublicConciergeMount />

          {/* Written brief fallback */}
          <section className="mt-16 border-t border-border/60 pt-4">
            <details className="max-w-3xl mx-auto px-6 md:px-8">
              <summary className="font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Prefer to send a written brief?
              </summary>
              <div className="mt-6">
                <ContactInquiry />
              </div>
            </details>
          </section>

          {/* Footer line */}
          <section className="max-w-2xl mx-auto px-6 md:px-8 mt-12 text-center">
            <p className="font-body text-[11px] text-muted-foreground">
              Prefer to visit?{" "}
              <Link
                to="/contact"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Book an appointment at our Singapore studio
              </Link>
              .
            </p>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default ConciergePage;
