import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Helmet } from "react-helmet-async";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ensureStorageHeadroom } from "@/lib/storageReclaim";
import { useToast } from "@/hooks/use-toast";
import { recordEmailPortalClick } from "@/lib/emailPortalClick";

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
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  useState(() => recordEmailPortalClick());

  // Destination to return to after sign-in — e.g. the OAuth consent screen
  // the member was sent here from (ChatGPT extension approval). Only
  // same-origin paths are honoured; anything else falls back to /trade.
  const getReturnPath = () => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("next") || params.get("redirect") || "";
    return requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/trade/login")
      ? requested
      : "/trade";
  };

  // Already signed in (e.g. returning from Google, or a reload restored this
  // screen) — step aside to the requested destination instead of trapping the
  // member on the sign-in form.
  useEffect(() => {
    if (authLoading || !user) return;
    try { sessionStorage.removeItem("maison:oauth-return-path"); } catch { /* noop */ }
    navigate(getReturnPath(), { replace: true });
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Accepts either the member's Trade ID or their email address. Trade IDs
    // are resolved to the account email via a security-definer RPC before the
    // credential call, which always authenticates against the stored email.
    const raw = identifier.trim();
    let email = raw;
    if (!raw.includes("@")) {
      const { data: resolved, error: resolveError } = await supabase.rpc("resolve_trade_email", { p_identifier: raw });
      if (resolveError || !resolved) {
        toast({
          title: "Login Failed",
          description: "Trade ID not recognised. Check your approval email, or sign in with your email address.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      email = resolved;
    }

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

    navigate(getReturnPath());
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      ensureStorageHeadroom();
      // Mark the intended destination so the full-page redirect flow returns
      // the member where they were headed (e.g. the OAuth consent screen)
      // instead of the public homepage.
      sessionStorage.setItem("maison:oauth-return-path", getReturnPath());
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.redirected) return; // browser is navigating to Google
      if (result.error) {
        setGoogleError(result.error.message || "Google sign-in could not be completed.");
        return;
      }
      // Popup flow: session is set — go straight to the requested destination.
      navigate(getReturnPath());
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : "Unexpected error");
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
        <Link to="/" className="inline-flex min-h-10 items-center">
          <span className="font-brand text-[1.4rem] font-bold tracking-widest text-foreground">
            Maison Affluency
          </span>
        </Link>
        <Link
          to="/"
          aria-label="Close"
          className="inline-flex h-10 w-10 items-center justify-center text-muted-foreground hover:opacity-60 transition-opacity -mr-2"
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

          {/* Persistent Google sign-in error with retry — a toast alone
              disappears and leaves the member with no way forward. */}
          {googleError && (
            <div role="alert" className="mt-4 border border-destructive/40 bg-destructive/5 px-4 py-3.5">
              <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
                Google sign-in didn't complete
              </p>
              <p className="mt-1.5 font-body text-sm text-foreground/80">
                {googleError}
              </p>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="mt-3 w-full py-3 border border-foreground/40 font-body text-xs uppercase tracking-[0.3em] text-foreground hover:bg-foreground/[0.03] transition-colors disabled:opacity-50"
              >
                {googleLoading ? "Retrying" : "Try Again"}
              </button>
            </div>
          )}

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
