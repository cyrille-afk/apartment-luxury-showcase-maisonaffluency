import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureStorageHeadroom } from "@/lib/storageReclaim";
import { useToast } from "@/hooks/use-toast";
import { TRADE_FAQ_ITEMS } from "@/components/trade/TradeFaq";

const TradeLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // "Back to Maison Affluency" must never point at the gated page the visitor
  // was just bounced from (that would redirect straight back to this login).
  // Only an explicit `back` param is honoured; otherwise go home.
  const backHref = (() => {
    const raw = searchParams.get("back") || "/";
    // Only permit same-origin absolute paths to prevent open-redirect.
    const safe = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
    return safe.startsWith("/trade") ? "/" : safe;
  })();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Signal the browser's password manager to save credentials
    if ('PasswordCredential' in window) {
      try {
        const cred = new (window as any).PasswordCredential({ id: email, password });
        await navigator.credentials.store(cred);
      } catch {
        // Silently ignore if credential storage fails
      }
    }

    navigate("/trade");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--card))] flex flex-col">
      <Helmet>
        <title>Trade Account Sign In — Maison Affluency</title>
        <meta name="description" content="Sign in to the Maison Affluency Trade Portal. Exclusive access for architects and interior designers to trade pricing, spec sheets, and curated collections." />
        <meta property="og:title" content="Trade Account Sign In — Maison Affluency" />
        <meta property="og:description" content="Exclusive access for architects and interior designers to trade pricing, spec sheets, and curated collections." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1773468211/FHMPRJ-033_W26_SCENE_5.jpg_rfvh62.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://www.maisonaffluency.com/trade/login" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trade Account Sign In — Maison Affluency" />
        <meta name="twitter:description" content="Exclusive access for architects and interior designers to trade pricing, spec sheets, and curated collections." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1773468211/FHMPRJ-033_W26_SCENE_5.jpg_rfvh62.jpg" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      {/* Centered credential portal */}
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md">
          {/* Brand / heading */}
          <div className="text-center mb-12">
            <Link to="/" className="inline-block">
              <span className="font-display text-3xl tracking-[0.08em] text-foreground">Maison Affluency</span>
            </Link>
            <h1 className="font-display text-xl md:text-2xl text-foreground tracking-[0.12em] uppercase mt-8">
              Trade Program Sign In
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border bg-transparent px-4 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground transition-colors rounded-none"
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border bg-transparent px-4 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground transition-colors rounded-none"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 bg-foreground text-background font-body text-xs uppercase tracking-[0.3em] rounded-none hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Signing In" : "Sign In"}
            </button>
          </form>

          {/* Low-contrast links */}
          <div className="mt-10 space-y-3">
            <p>
              <Link
                to="/trade-program?intent=apply"
                className="font-body text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Apply for a Trade Account
              </Link>
            </p>
            <p>
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="font-body text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Forgot Password?
              </button>
            </p>
          </div>

          <p className="font-body text-xs text-muted-foreground mt-16 text-center">
            <Link to={backHref} className="hover:text-foreground transition-colors">
              ← Back to Maison Affluency
            </Link>
          </p>
        </div>
      </div>

      {/* Trade FAQ accordion */}
      <section className="w-full border-t border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-20">
          <h2 className="font-display text-xl md:text-2xl text-foreground tracking-[0.12em] uppercase text-center mb-12">
            Trade FAQ
          </h2>
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
      </section>

      {/* Forgot password modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowForgot(false)}>
          <div className="bg-background border border-border p-8 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg text-foreground tracking-wide mb-2">Reset Password</h2>
            <p className="font-body text-xs text-muted-foreground mb-6">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setResetLoading(true);
                ensureStorageHeadroom();
                const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                setResetLoading(false);
                if (error) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                  return;
                }
                toast({ title: "Check your email", description: "We've sent you a password reset link." });
                setShowForgot(false);
              }}
              className="space-y-5"
            >
              <input
                type="email"
                required
                placeholder="Email Address"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full border border-border bg-transparent px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground transition-colors rounded-none"
              />
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.3em] rounded-none hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {resetLoading ? "Sending" : "Send Reset Link"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeLogin;
