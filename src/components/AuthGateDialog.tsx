import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, FileDown, UserPlus } from "lucide-react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useToast } from "@/hooks/use-toast";

interface AuthGateDialogProps {
  open: boolean;
  onClose: () => void;
  /** What the user was trying to do — shown as context */
  action?: string;
  /** Which form to show initially when opened */
  initialMode?: "prompt" | "signup" | "login";
}

/**
 * Modal that prompts unauthenticated users to create an account or sign in
 * before accessing gated features (e.g. tear sheet downloads).
 */
export default function AuthGateDialog({ open, onClose, action = "download this document", initialMode = "prompt" }: AuthGateDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<"prompt" | "signup" | "login">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isDesigner, setIsDesigner] = useState(false);
  const [newsletter, setNewsletter] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  if (!open) return null;

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.href,
      });
      if (result.error) {
        toast({ title: "Google Sign-In Failed", description: String(result.error), variant: "destructive" });
      } else if (!result.redirected) {
        onClose();
        window.location.reload();
      }
    } catch (err) {
      toast({ title: "Google Sign-In Failed", description: err instanceof Error ? err.message : "Unexpected error", variant: "destructive" });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, is_designer: isDesigner, newsletter },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign Up Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Check your email", description: "We've sent you a confirmation link. Please verify your email to continue." });
    onClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
      return;
    }
    onClose();
    window.location.reload();
  };

  const googleButton = (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={googleLoading}
      className="w-full py-2.5 border border-border rounded-full font-body text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {googleLoading ? "Connecting..." : "Continue with Google"}
    </button>
  );

  const divider = (
    <div className="relative flex items-center gap-4 py-1">
      <div className="flex-1 border-t border-border" />
      <span className="font-body text-[10px] text-muted-foreground uppercase tracking-widest">or</span>
      <div className="flex-1 border-t border-border" />
    </div>
  );

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
      <div className={`bg-background border border-border rounded-lg p-6 w-full shadow-xl relative ${mode === "signup" ? "max-w-lg" : "max-w-sm"}`} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>

        {mode === "prompt" && (
          <>
            <div className="text-center mb-5">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <FileDown size={20} className="text-[hsl(var(--pdf-red))]" />
              </div>
              <h2 className="font-display text-lg text-foreground">Create an Account</h2>
              <p className="font-body text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Sign in or create a free account to {action}.
              </p>
            </div>

            {googleButton}
            {divider}

            <div className="space-y-2">
              <button
                onClick={() => setMode("signup")}
                className="w-full py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <UserPlus size={14} />
                Create Account with Email
              </button>
              <button
                onClick={() => setMode("login")}
                className="w-full py-2.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Already have an account? <span className="underline underline-offset-2">Sign in</span>
              </button>
            </div>

            <p className="font-body text-[10px] text-muted-foreground/60 text-center mt-4 leading-relaxed">
              Are you an architect or interior designer?{" "}
              <button onClick={() => navigate("/trade/register")} className="underline underline-offset-2 hover:text-foreground transition-colors">
                Apply for trade access
              </button>
            </p>
          </>
        )}

        {mode === "signup" && (
          <>
            <h2 className="font-display text-xl text-foreground">Sign up</h2>
            <p className="font-body text-xs text-muted-foreground mt-1 mb-5">
              Already have an account?{" "}
              <button onClick={() => setMode("login")} className="underline underline-offset-2 hover:text-foreground transition-colors">Log in</button>
            </p>

            {googleButton}
            {divider}

            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Architect / Designer question */}
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-foreground">Are you an architect or an interior designer?</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="isDesigner"
                      checked={isDesigner}
                      onChange={() => setIsDesigner(true)}
                      className="w-4 h-4 accent-foreground"
                    />
                    <span className="font-body text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="isDesigner"
                      checked={!isDesigner}
                      onChange={() => setIsDesigner(false)}
                      className="w-4 h-4 accent-foreground"
                    />
                    <span className="font-body text-sm">No</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground text-[16px]" />
                <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground text-[16px]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="email" placeholder="Email address *" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                  className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground text-[16px]" />
                <input type="password" placeholder="Create password *" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password"
                  className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground text-[16px]" />
              </div>

              {/* Newsletter checkbox */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                  className="w-4 h-4 accent-foreground rounded"
                />
                <span className="font-body text-sm text-foreground">Subscribe me to the newsletter</span>
              </label>

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? "Creating..." : "Register"}
              </button>
            </form>

            {isDesigner && (
              <p className="font-body text-[10px] text-muted-foreground/70 text-center mt-3 leading-relaxed">
                As a design professional, you may also{" "}
                <button onClick={() => navigate("/trade/register")} className="underline underline-offset-2 hover:text-foreground transition-colors">
                  apply for trade access
                </button>{" "}
                for exclusive pricing.
              </p>
            )}
          </>
        )}

        {mode === "login" && (
          <>
            <h2 className="font-display text-lg text-foreground mb-4">Sign In</h2>
            {googleButton}
            {divider}
            <form onSubmit={handleLogin} className="space-y-3">
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
                className="w-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.15em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
            <button onClick={() => setMode("signup")} className="w-full mt-3 font-body text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
              Don't have an account? <span className="underline underline-offset-2">Create one</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
