import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ensureStorageHeadroom } from "@/lib/storageReclaim";
import { useToast } from "@/hooks/use-toast";

// Monochrome Google "G" — single-path glyph rendered in currentColor so it
// stays charcoal/grayscale and reads as part of the brand, not a vendor badge.
const GoogleGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M21.35 11.1h-9.17v2.96h5.3c-.23 1.4-.98 2.57-2.09 3.36v2.2h3.38c1.98-1.83 3.12-4.52 3.12-7.71 0-.75-.07-1.47-.2-2.16-.55-2.93-2.31-4.75-3.54-5.65H9.4v5.62h6.1c-.26 1.46-1.03 2.7-2.18 3.55-.94.68-2.15 1.08-3.58 1.08-2.77 0-5.12-1.87-5.96-4.38H.46v2.3c1.61 3.2 4.92 5.4 8.76 5.4 2.43 0 4.49-.8 5.98-2.18l.01.01 3.52-2.72c1.03-.95 1.79-2.18 2.26-3.62z" />
  </svg>
);

const TradeLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Accepts either the member's Trade ID or their email address; the
    // credential call itself always resolves against the stored email.
    const email = identifier.includes("@")
      ? identifier.trim()
      : identifier.trim();

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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      ensureStorageHeadroom();
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.redirected) return; // browser is navigating to Google
      if (result.error) {
        toast({ title: "Google Sign-In Failed", description: result.error.message, variant: "destructive" });
        return;
      }
      // Popup flow: session is set — go straight into the trade portal.
      navigate("/trade");
    } catch (err) {
      toast({ title: "Google Sign-In Failed", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
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

      {/* Brand mark pinned to the upper-left corner, RH-style */}
      <header className="flex items-start justify-between px-6 pt-6 md:px-10 md:pt-8">
        <Link to="/" className="inline-block">
          <span className="font-brand text-[1.4rem] font-bold tracking-widest text-foreground">
            Maison Affluency
          </span>
        </Link>
        <Link
          to="/"
          aria-label="Close"
          className="text-slate-500 hover:opacity-60 transition-opacity mt-1"
        >
          <X className="w-6 h-6" strokeWidth={1} />
        </Link>
      </header>

      {/* Centered credential portal */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <h1 className="font-display text-xl md:text-2xl text-foreground tracking-[0.12em] uppercase text-center mb-12">
            Trade Program Sign In
          </h1>

          <form onSubmit={handleLogin} className="space-y-5">
            <input
              type="text"
              name="identifier"
              autoComplete="username"
              inputMode="email"
              required
              placeholder="Trade ID or Email Address"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full border border-border bg-transparent px-4 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-foreground transition-colors rounded-none"
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="Password / Verification Key"
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

          {/* Google sign-in — quiet, outlined, monochrome */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="mt-5 w-full py-4 border border-foreground/30 bg-transparent text-foreground font-body text-xs uppercase tracking-[0.3em] rounded-none hover:border-foreground hover:bg-foreground/[0.03] transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <GoogleGlyph className="w-4 h-4 text-foreground/80" />
            {googleLoading ? "Connecting" : "Continue with Google"}
          </button>

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
            <p>
              <Link
                to="/trade-faq"
                className="font-body text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Trade FAQ
              </Link>
            </p>
          </div>

        </div>
      </div>

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
