import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Smartphone, Share, Plus, MoreVertical, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Clean deep-link landing route for the desktop → mobile QR handoff.
 *
 * Flow:
 *  1. Magic link redirects here with the Supabase session in the URL.
 *  2. We wait for auth to hydrate (client auto-consumes the tokens).
 *  3. On installable mobile browsers we capture `beforeinstallprompt` and
 *     invite the user to install the PWA before continuing.
 *  4. Once dismissed / installed / not-eligible, we forward to `?next=`.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function TradeMobileLaunch() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"auth" | "ready" | "installing" | "forwarding">("auth");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const forwarded = useRef(false);

  const nextPath = useMemo(() => {
    const raw = params.get("next") || "/trade";
    // Only allow same-origin internal paths that start with /trade.
    if (!raw.startsWith("/trade")) return "/trade";
    return raw;
  }, [params]);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true);

  const isIOS =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;

  // Mark that a mobile visit happened so the desktop continuity banner hides.
  useEffect(() => {
    try { localStorage.setItem("maf_mobile_pwa_seen", "1"); } catch {}
  }, []);

  // Capture the install prompt on Android / desktop Chrome.
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  // Wait for the auth session to be established from the magic-link tokens.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) setStatus("ready");
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") setStatus("ready");
    });
    // Safety net: after 4s, proceed regardless (the user may already be signed in
    // via cookies from a prior visit, or the link was already consumed).
    const timer = window.setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "auth" ? "ready" : s));
    }, 4000);
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  // If we're already inside the installed PWA, skip install UI entirely.
  useEffect(() => {
    if (status !== "ready") return;
    if (isStandalone || !isMobile) {
      forward();
      return;
    }
    // Give the beforeinstallprompt event a brief window to arrive on Android.
    const t = window.setTimeout(() => {
      // No-op — we render the "Install" screen and wait for user action.
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isStandalone, isMobile]);

  const forward = () => {
    if (forwarded.current) return;
    forwarded.current = true;
    setStatus("forwarding");
    // Use replace so the launch URL doesn't linger in history.
    navigate(nextPath, { replace: true });
  };

  const onInstall = async () => {
    if (!installEvent) {
      forward();
      return;
    }
    setStatus("installing");
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {}
    forward();
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-white flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        {status === "auth" && (
          <div className="text-center space-y-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-white/70" />
            <p className="font-body text-sm text-white/70">Signing you in…</p>
          </div>
        )}

        {(status === "ready" || status === "installing") && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Check className="h-6 w-6 text-emerald-400 mx-auto" />
              <h1 className="font-display text-2xl">You're signed in</h1>
              <p className="font-body text-sm text-white/70">
                Add Maison Affluency to your home screen for a fullscreen, app-like experience.
              </p>
            </div>

            {isAndroid && installEvent ? (
              <button
                onClick={onInstall}
                className="w-full py-3 rounded-md bg-white text-[#0a0a0a] font-body font-medium tracking-wide hover:bg-white/90 transition-colors"
              >
                {status === "installing" ? "Installing…" : "Install app"}
              </button>
            ) : isIOS ? (
              <div className="rounded-md border border-white/15 bg-white/[0.03] p-4 space-y-2">
                <h2 className="font-display text-sm flex items-center gap-2">
                  <Smartphone className="h-4 w-4" /> Add to Home Screen
                </h2>
                <ol className="space-y-1.5 font-body text-xs text-white/80">
                  <li className="flex gap-2"><span className="text-white/50">1.</span><span className="flex items-center gap-1 flex-wrap">Tap <Share className="inline h-3 w-3" /> <strong>Share</strong> in Safari.</span></li>
                  <li className="flex gap-2"><span className="text-white/50">2.</span><span className="flex items-center gap-1 flex-wrap">Choose <Plus className="inline h-3 w-3" /> <strong>Add to Home Screen</strong>.</span></li>
                  <li className="flex gap-2"><span className="text-white/50">3.</span><span>Tap <strong>Add</strong> — then open Maison Affluency from your home screen.</span></li>
                </ol>
              </div>
            ) : isAndroid ? (
              <div className="rounded-md border border-white/15 bg-white/[0.03] p-4 space-y-2">
                <h2 className="font-display text-sm flex items-center gap-2">
                  <Smartphone className="h-4 w-4" /> Install from Chrome
                </h2>
                <ol className="space-y-1.5 font-body text-xs text-white/80">
                  <li className="flex gap-2"><span className="text-white/50">1.</span><span className="flex items-center gap-1 flex-wrap">Open the <MoreVertical className="inline h-3 w-3" /> menu.</span></li>
                  <li className="flex gap-2"><span className="text-white/50">2.</span><span>Tap <strong>Install app</strong> or <em>Add to Home screen</em>.</span></li>
                </ol>
              </div>
            ) : null}

            <button
              onClick={forward}
              className="w-full py-3 rounded-md border border-white/25 text-white font-body text-sm hover:bg-white/[0.05] transition-colors"
            >
              Continue in browser →
            </button>
          </div>
        )}

        {status === "forwarding" && (
          <div className="text-center space-y-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-white/70" />
            <p className="font-body text-sm text-white/70">Opening your workspace…</p>
          </div>
        )}
      </div>
    </div>
  );
}
