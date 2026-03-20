import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import TradeRegistrationForm from "@/components/trade/TradeRegistrationForm";
import WhatsAppShareButton from "@/components/WhatsAppShareButton";
import { sharePageOnWhatsApp } from "@/lib/whatsapp-share";

const TradeRegister = () => {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";

  return (
    <>
      <Helmet>
        <title>Apply — Trade Program — Maison Affluency</title>
        <meta name="description" content="Register and apply for the Maison Affluency Trade Program. Exclusive access for architects, interior designers, and luxury hospitality professionals." />
        <link rel="canonical" href="https://maisonaffluency.com/trade/register" />
        <meta property="og:title" content="Apply — Trade Program — Maison Affluency" />
        <meta property="og:description" content="Register for exclusive trade pricing and dedicated support for design professionals." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://maisonaffluency.com/trade/register" />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772600100/IMG_3387_1_p1mhex" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <div className="min-h-screen bg-background px-4 py-6 md:py-12">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between mb-6">
          <Link to="/" className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Maison Affluency
          </Link>
          <Link
            to="/trade/login"
            className="px-5 py-2 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
        </div>

        <div className="w-full max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <Link to="/" className="inline-block">
              <h1 className="font-display text-xl md:text-2xl text-foreground tracking-wide">Maison Affluency</h1>
            </Link>
            <p className="font-body text-xs text-muted-foreground mt-1">Trade Account Application</p>
            <div className="mt-2">
              <WhatsAppShareButton
                onClick={(e) => {
                  e.preventDefault();
                  sharePageOnWhatsApp("/trade/register", "Apply to Trade Program — Maison Affluency", "Exclusive access for design professionals");
                }}
                label="Share trade registration on WhatsApp"
                size="sm"
                variant="prominent"
                className="md:!text-sm md:!px-4 md:!py-2"
              />
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2">
            {[
              { title: "Dedicated Advisor", desc: "Personalised guidance on every project" },
              { title: "Custom Requests", desc: "Access to specialist workshops worldwide" },
              { title: "Samples & Swatches", desc: "Comprehensive curated material library" },
              { title: "Insured Shipping", desc: "Consolidated freight with full coverage" },
            ].map((b) => (
              <div key={b.title} className="border border-border rounded-sm px-3 py-2">
                <p className="font-display text-xs text-foreground">{b.title}</p>
                <p className="font-body text-[11px] text-muted-foreground mt-0.5 leading-tight">{b.desc}</p>
              </div>
            ))}
          </div>

          <TradeRegistrationForm prefillEmail={prefillEmail} />
        </div>
      </div>
    </>
  );
};

export default TradeRegister;
