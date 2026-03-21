import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";

const TradeLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);

    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/trade`,
      });

      if (result.error) {
        toast({ title: "Google Sign-In Failed", description: String(result.error), variant: "destructive" });
        return;
      }

      // In some environments OAuth returns tokens without doing a full-page redirect.
      // Ensure users still enter the trade portal immediately.
      if (!result.redirected) {
        navigate("/trade", { replace: true });
      }
    } catch (err) {
      toast({
        title: "Google Sign-In Failed",
        description: err instanceof Error ? err.message : "Unexpected OAuth error",
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Helmet>
        <title>Trade Portal — Maison Affluency</title>
        <meta name="description" content="Sign in to the Maison Affluency Trade Portal. Exclusive access for architects and interior designers to trade pricing, spec sheets, and curated collections." />
        <meta property="og:title" content="Trade Portal — Maison Affluency" />
        <meta property="og:description" content="Exclusive access for architects and interior designers to trade pricing, spec sheets, and curated collections." />
        <meta property="og:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1773468211/FHMPRJ-033_W26_SCENE_5.jpg_rfvh62.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://maisonaffluency.com/trade/login" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Trade Portal — Maison Affluency" />
        <meta name="twitter:description" content="Exclusive access for architects and interior designers to trade pricing, spec sheets, and curated collections." />
        <meta name="twitter:image" content="https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1773468211/FHMPRJ-033_W26_SCENE_5.jpg_rfvh62.jpg" />
        <link rel="canonical" href="https://maisonaffluency.com/trade/login" />
      </Helmet>
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-block">
            <h1 className="font-display text-2xl text-foreground tracking-wide">Maison Affluency</h1>
          </Link>
          <p className="font-body text-sm text-muted-foreground mt-2">Trade Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="font-body text-sm text-foreground">Email</label>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]"
            />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Password</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-foreground text-background font-body text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="relative flex items-center gap-4 py-2">
            <div className="flex-1 border-t border-border" />
            <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-3 border border-border rounded-full font-body text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>

          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="font-body text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Forgot password?
            </button>
          </div>
        </form>

        {/* Forgot password modal */}
        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowForgot(false)}>
            <div className="bg-background border border-border rounded-lg p-6 w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-display text-lg text-foreground mb-2">Reset Password</h2>
              <p className="font-body text-xs text-muted-foreground mb-5">
                Enter your email and we'll send you a link to reset your password.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setResetLoading(true);
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
                className="space-y-4"
              >
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="flex-1 py-2.5 font-body text-xs uppercase tracking-[0.15em] border border-border rounded-full hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {resetLoading ? "Sending..." : "Send Link"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="text-center mt-8 space-y-3">
          <p className="font-body text-sm md:text-xs text-muted-foreground">
            Don't have a trade account?{" "}
            <Link to="/trade/register" className="text-foreground underline underline-offset-4 hover:opacity-70 font-medium">
              Apply here
            </Link>
          </p>
          <p className="font-body text-sm md:text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              ← Back to Maison Affluency
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TradeLogin;
