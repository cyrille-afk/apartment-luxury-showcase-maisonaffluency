import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
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
