import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { redeemMobileSyncToken, MOBILE_SYNC_TTL_SECONDS } from "@/lib/mobileSync.functions";
import { readPendingAuthToken, clearPendingAuthToken, storePendingAuthToken } from "@/lib/pwaPendingAuth";
import { takeLaunchToken } from "@/lib/pwaLaunchManifest";
import { isInstalledPwaDisplay } from "@/lib/pwaMode";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, RotateCw } from "lucide-react";

/**
 * Runs once at app start inside the installed PWA. If the mobile browser
 * bridge parked a one-time sign-in token (ma_pwa_pending_auth_token), redeem
 * it here, establish the session, and land on the trade dashboard. Expired or
 * absent tokens fall back to normal routing. Route children remain unmounted
 * during the handshake so sign-in pages cannot flash or redirect prematurely.
 */
export function PwaPendingAuthConsumer({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { loading, user, rolesLoaded, setIsPwaBooting } = useAuth();
  const ran = useRef(false);
  const launchCaptured = useRef(false);
  const [phase, setPhase] = useState<"checking" | "signing-in" | "ready" | "fading" | "failed">("checking");
  const [failure, setFailure] = useState("This sign-in code has expired or already been used. Scan a fresh code from your desktop, or sign in here.");
  const [verified, setVerified] = useState(false);
  const [retryable, setRetryable] = useState(false);

  useEffect(() => {
    if (ran.current) return;
    if (!isInstalledPwaDisplay()) {
      ran.current = true;
      setPhase("ready");
      return;
    }
    if (!launchCaptured.current) {
      setIsPwaBooting(true);
      launchCaptured.current = true;
      const launchToken = takeLaunchToken();
      if (launchToken) storePendingAuthToken(launchToken, MOBILE_SYNC_TTL_SECONDS);
    }
    // Let restoration finish first so its older null session cannot overwrite
    // the new OTP session. The AuthProvider remains mounted above this gate.
    if (loading) return;
    ran.current = true;
    const token = readPendingAuthToken();
    if (!token) { setIsPwaBooting(false); setPhase("ready"); return; }
    void runHandshake(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, setIsPwaBooting]);

  async function runHandshake(token: string) {
    setRetryable(false);
    setPhase("signing-in");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (data.session?.expires_at && data.session.expires_at * 1000 > Date.now()) {
        clearPendingAuthToken();
        setVerified(true);
        return;
      }
      const res = await redeemMobileSyncToken({ data: { token } });
      if (!res.ok) {
        clearPendingAuthToken();
        setPhase("fading");
        return;
      }
      const { data: signedIn, error } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: "magiclink" });
      clearPendingAuthToken();
      if (error || !signedIn.session) { setPhase("fading"); return; }
      setVerified(true);
    } catch {
      // A network failure may precede consumption: retain the short-lived
      // token so the user can retry, never turn a failed handshake into a login loop.
      setRetryable(readPendingAuthToken() !== null);
      setFailure("We couldn't complete your sign-in. Check your connection and try again, or scan a fresh code from your desktop.");
      setPhase("fading");
    }
  }

  const retry = () => {
    const token = readPendingAuthToken();
    if (!token) {
      setRetryable(false);
      setFailure("This sign-in code has expired. Scan a fresh code from your desktop, or sign in here.");
      return;
    }
    setIsPwaBooting(true);
    void runHandshake(token);
  };

  useEffect(() => {
    if (phase !== "fading") return;
    const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    const timer = window.setTimeout(() => { setIsPwaBooting(false); setPhase("failed"); }, delay);
    return () => window.clearTimeout(timer);
  }, [phase, setIsPwaBooting]);

  useEffect(() => () => setIsPwaBooting(false), [setIsPwaBooting]);

  // Auto-retry with the same retained code once the device reconnects.
  useEffect(() => {
    if (phase !== "failed" || !retryable) return;
    const onOnline = () => retry();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, retryable]);

  useEffect(() => {
    if (!verified || loading || !user || !rolesLoaded) return;
    let active = true;
    void navigate({ to: "/trade", replace: true }).then(() => {
      if (active) { setIsPwaBooting(false); setPhase("ready"); }
    }).catch(() => { if (active) setPhase("fading"); });
    return () => { active = false; };
  }, [verified, loading, user, rolesLoaded, navigate, setIsPwaBooting]);

  if (phase === "ready" || phase === "checking") return children;
  return (
    <main className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <p className="font-display text-xl uppercase mb-10">Maison Affluency</p>
        {phase === "failed" ? (
          <section role="alert" className="space-y-6">
            <h1 className="font-display text-2xl">{retryable ? "Connection interrupted" : "Please sign in again"}</h1>
            <p className="font-body text-sm leading-relaxed text-muted-foreground">{failure}</p>
            {retryable && (
              <p role="status" aria-live="polite" className="font-body text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Waiting for connection — we'll retry automatically
              </p>
            )}
            {retryable && (
              <Button onClick={retry} className="w-full">
                <RotateCw aria-hidden="true" /> Try again
              </Button>
            )}
            <Button variant={retryable ? "outline" : "default"} onClick={() => { clearPendingAuthToken(); setPhase("ready"); void navigate({ to: "/trade/login", search: { next: "/trade" }, replace: true }); }}>
              <LogIn aria-hidden="true" /> Sign in
            </Button>
          </section>
        ) : (
          <div role="status" aria-live="polite" className={`space-y-5 transition-opacity duration-150 motion-reduce:transition-none ${phase === "fading" ? "opacity-0" : "opacity-100"}`}>
            <Loader2 aria-hidden="true" className="mx-auto h-8 w-8 text-primary motion-safe:animate-spin" />
            <p className="font-body text-sm text-muted-foreground">Opening your Trade Studio…</p>
          </div>
        )}
      </div>
    </main>
  );
}
