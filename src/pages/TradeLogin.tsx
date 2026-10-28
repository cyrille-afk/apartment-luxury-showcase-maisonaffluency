import { useEffect, useState } from "react";
import { useNavigate, Link } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { X, Loader2, CircleCheck, CircleAlert, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ensureStorageHeadroom } from "@/lib/storageReclaim";
import { useToast } from "@/hooks/use-toast";
import { recordEmailPortalClick } from "@/lib/emailPortalClick";
import { Button } from "@/components/ui/button";
import { MobileTradeTourNotice } from "@/components/trade/MobileTradeTourNotice";
import { clearGoogleAttempt, readGoogleAttempt, startGoogleAttempt } from "@/lib/googleSignInRecovery";
import { GoogleAccessNotice } from "@/components/GoogleAccessNotice";
import { signInErrorMessage } from "@/lib/signInFeedback";

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
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSucceeded, setLoginSucceeded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleRecovery, setGoogleRecovery] = useState(false);
  const [googleSucceeded, setGoogleSucceeded] = useState(false);
  const [returnedGoogleAttempt] = useState(() => {
    try { return !!readGoogleAttempt(sessionStorage) || new URLSearchParams(window.location.search).get("google_recovery") === "1"; }
    catch { return false; }
  });
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  useEffect(() => { recordEmailPortalClick(); }, []);

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
    clearGoogleAttempt();
    try { sessionStorage.removeItem("maison:oauth-return-path"); } catch { /* noop */ }
    navigate(getReturnPath(), { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!returnedGoogleAttempt || authLoading || user) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!cancelled && !error && !data.session) setGoogleRecovery(true);
    }, 1500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [returnedGoogleAttempt, authLoading, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || googleLoading || loginSucceeded) return;
    setLoginError(null);
    setGoogleRecovery(false);
    setGoogleError(null);
    setLoading(true);
    try {
    // Accepts either the member's Trade ID or their email address. Trade IDs
    // are resolved to the account email via a security-definer RPC before the
    // credential call, which always authenticates against the stored email.
    const raw = identifier.trim();
    let email = raw;
    if (!raw.includes("@")) {
      const { data: resolved, error: resolveError } = await supabase.rpc("resolve_trade_email", { p_identifier: raw });
      if (resolveError || !resolved) {
        setLoginError("Check your Trade ID in your approval email, or sign in with your email address.");
        return;
      }
      email = resolved;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoginError(signInErrorMessage(error));
      return;
    }
    setLoginSucceeded(true);

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
    } catch {
      setLoginError("We can’t reach your account right now. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading || googleLoading || loginSucceeded) return;
    setLoginError(null);
    setGoogleLoading(true);
    setGoogleError(null);
    setGoogleSucceeded(false);
    setGoogleRecovery(true);
    startGoogleAttempt(getReturnPath());
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
        clearGoogleAttempt();
        setGoogleRecovery(true);
        setGoogleError(result.error.message || "Google sign-in could not be completed.");
        return;
      }
      // A bridge return alone does not prove a session was established.
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        clearGoogleAttempt();
        setGoogleRecovery(true);
        return;
      }
      clearGoogleAttempt();
      setGoogleSucceeded(true);
      toast({ title: "Google sign-in succeeded", description: "Opening your requested page." });
      navigate(getReturnPath());
    } catch (err) {
      clearGoogleAttempt();
      setGoogleRecovery(true);
      setGoogleError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-card flex flex-col">

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

          <div className="mb-6"><MobileTradeTourNotice /></div>
          <form onSubmit={handleLogin} aria-busy={loading} className="space-y-5">
            <input
              type="text"
              name="identifier"
              autoComplete="off"
              inputMode="email"
              required
              aria-label="Trade ID or Email Address"
              disabled={loading || googleLoading || loginSucceeded}
              aria-describedby={loginError ? "credential-sign-in-status" : undefined}
              placeholder="Trade ID or Email Address"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setLoginError(null); }}
              className="w-full border border-border bg-transparent px-4 py-3.5 font-body text-sm text-foreground placeholder:text-muted-foreground/70 outline-hidden focus:border-foreground transition-colors rounded-none"
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                required
                aria-label="Password"
                disabled={loading || googleLoading || loginSucceeded}
                aria-describedby={loginError ? "credential-sign-in-status" : undefined}
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginError(null); }}
                className="w-full border border-border bg-transparent px-4 py-3.5 pr-12 font-body text-sm text-foreground placeholder:text-muted-foreground/70 outline-hidden focus:border-foreground transition-colors rounded-none"
              />
              {/* Reveal the typed password so the member can check it before
                  submitting. Kept out of the tab order so tab still moves
                  straight from the password to Sign In. */}
              <Button variant="ghost" size="icon"
                type="button"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword
                  ? <EyeOff className="h-4 w-4" aria-hidden="true" />
                  : <Eye className="h-4 w-4" aria-hidden="true" />}
              </Button>
            </div>

            <Button
              type="submit"
              disabled={loading || googleLoading || loginSucceeded}
              className="w-full h-14 mt-2 bg-foreground text-background font-body text-xs uppercase tracking-[0.3em] rounded-none hover:bg-foreground/90 transition-opacity disabled:opacity-70"
            >
              {loading ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : loginSucceeded ? <CircleCheck aria-hidden="true" /> : null}
              {loginSucceeded ? "Signed In" : loading ? "Signing In" : "Sign In"}
            </Button>
          </form>

          <div className="min-h-24 pt-4">
            {(loading || loginError || loginSucceeded) && (
              <div id="credential-sign-in-status" role={loginError ? "alert" : "status"} aria-live={loginError ? "assertive" : "polite"} aria-atomic="true"
                className={`border-l-2 pl-4 py-1 ${loginError ? "border-destructive text-destructive" : "border-primary text-foreground"}`}>
                <p className="font-display text-base flex items-center gap-2">
                  {loginError ? <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" /> : loginSucceeded ? <CircleCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
                  {loginError ? "Unable to sign in" : loginSucceeded ? "Welcome back" : "Signing you in"}
                </p>
                <p className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                  {loginError || (loginSucceeded ? "Your sign-in is confirmed. Opening your requested page." : "Checking your account securely…")}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4" aria-hidden="true"><span className="h-px flex-1 bg-border" /><span className="font-body text-xs text-muted-foreground">or</span><span className="h-px flex-1 bg-border" /></div>

          {/* Google sign-in — quiet, outlined, monochrome */}
          <Button variant="outline"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading || loginSucceeded}
            className="mt-5 h-14 w-full border border-foreground/30 bg-transparent text-foreground font-body text-xs uppercase tracking-[0.3em] rounded-none hover:border-foreground hover:bg-muted transition-colors disabled:opacity-70 gap-3"
          >
            {googleLoading ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : <GoogleGlyph className="w-4 h-4 text-foreground/80" />}
            {googleLoading ? "Connecting" : "Continue with Google"}
          </Button>
          <GoogleAccessNotice showAccessRequest showApplyLink={false} />

          {/* Persistent Google sign-in error with retry — a toast alone
              disappears and leaves the member with no way forward. */}
          {(googleError || googleRecovery) && (
            <div className={`mt-4 border-l-2 pl-4 py-1 ${googleLoading || googleSucceeded ? "border-primary" : "border-destructive"}`}>
              <div role="status" aria-live="polite" aria-atomic="true" data-testid="google-sign-in-status"
                className={`flex items-center gap-2 font-display text-base ${googleLoading || googleSucceeded ? "text-foreground" : "text-destructive"}`}>
                {googleLoading ? <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />
                  : googleSucceeded ? <CircleCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    : <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />}
                <span>{googleLoading ? "Google sign-in in progress" : googleSucceeded ? "Google sign-in succeeded" : "Google sign-in failed"}</span>
              </div>
              <p className="mt-1.5 font-body text-xs leading-relaxed text-muted-foreground">
                {googleLoading ? "Waiting for Google sign-in to complete. Finish signing in in the Google window."
                  : googleSucceeded ? "Opening your requested page."
                    : "Google sign-in didn’t complete. Try again, or use your approved account’s email and password."}
              </p>
              {!googleLoading && !googleSucceeded && <>
              <Button
                variant="outline"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="mt-3 w-full rounded-none font-body text-xs uppercase tracking-[0.2em]"
              >
                {googleLoading ? "Retrying" : "Retry Google sign-in"}
              </Button>
              <Button variant="link" type="button" className="mt-2 h-auto px-0 text-foreground"
                onClick={() => {
                  clearGoogleAttempt();
                  setGoogleRecovery(false);
                  setGoogleSucceeded(false);
                  setGoogleError(null);
                  document.querySelector<HTMLInputElement>('input[name="identifier"]')?.focus();
                }}>
                Use email and password
              </Button>
              </>}
            </div>
          )}

          {/* Low-contrast links */}
          <div className="mt-10 space-y-3">
            <p>
              <Link
                to="/trade-program?intent=apply"
                className="font-body text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Don’t have an account? Apply for the Trade Program.
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
                className="w-full border border-border bg-transparent px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground/70 outline-hidden focus:border-foreground transition-colors rounded-none"
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
