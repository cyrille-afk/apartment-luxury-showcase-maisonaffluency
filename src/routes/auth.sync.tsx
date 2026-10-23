import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MoreVertical, Plus, Share, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { redeemMobileSyncToken, MOBILE_SYNC_TTL_SECONDS } from "@/lib/mobileSync.functions";
import { storePendingAuthToken, clearPendingAuthToken } from "@/lib/pwaPendingAuth";

type Search = { t?: string; token?: string };

export const Route = createFileRoute("/auth/sync")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    t: typeof s.t === "string" ? s.t : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "You're signed in — Maison Affluency" },
      { name: "description", content: "Secure desktop-to-mobile sign-in for Maison Affluency trade members." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "You're signed in — Maison Affluency" },
      { property: "og:description", content: "Secure desktop-to-mobile sign-in for Maison Affluency trade members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthSync,
});

function isStandalonePwa() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isMobileDevice() {
  return /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Bridge between the desktop QR code and the phone.
 *
 * - Installed PWA (standalone): redeem the one-time token immediately and go
 *   straight to the trade dashboard.
 * - Mobile browser: do NOT redeem or redirect. Stash the raw token in
 *   localStorage (ma_pwa_pending_auth_token) so the installed PWA can consume
 *   it on first launch, and show the static "Add to Home Screen" instructions.
 *   "Continue in browser" redeems the token for the browser session instead.
 */
function AuthSync() {
  const { t, token: tokenParam } = Route.useSearch();
  const token = t ?? tokenParam;
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"working" | "bridge" | "failed">("working");
  const ran = useRef(false);

  const redeemAndEnter = async (rawToken: string) => {
    const res = await redeemMobileSyncToken({ data: { token: rawToken } });
    if (!res.ok) return false;
    const { error } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: "magiclink" });
    if (error) return false;
    clearPendingAuthToken();
    return true;
  };

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Never leave the one-time token in the address bar or history.
    window.history.replaceState(null, "", "/auth/sync");

    (async () => {
      // Already inside the installed PWA: sign in and go straight to work.
      if (isStandalonePwa()) {
        if (token && (await redeemAndEnter(token))) {
          navigate({ to: "/trade", replace: true });
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: "/trade", replace: true });
          return;
        }
        setPhase("failed");
        return;
      }

      if (token) {
        // Static bridge: park the token for the PWA launch, show instructions.
        storePendingAuthToken(token, MOBILE_SYNC_TTL_SECONDS);
        setPhase("bridge");
        return;
      }

      // No token: an existing session on this phone still sees the bridge.
      const { data } = await supabase.auth.getSession();
      setPhase(data.session ? "bridge" : "failed");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  const continueInBrowser = async () => {
    setPhase("working");
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      navigate({ href: "/trade/launch?next=%2Ftrade", replace: true });
      return;
    }
    const pending = token;
    if (pending && (await redeemAndEnter(pending))) {
      navigate({ href: "/trade/launch?next=%2Ftrade", replace: true });
      return;
    }
    setPhase("failed");
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] px-6 py-10 text-white">
      <div className="w-full max-w-md">
        {phase === "working" && (
          <div className="space-y-4 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-white/70" />
            <p className="font-body text-sm text-white/70">Preparing your sign-in…</p>
          </div>
        )}

        {phase === "bridge" && (
          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <Check className="mx-auto h-6 w-6 text-emerald-400" />
              <h1 className="font-display text-2xl">You're signed in</h1>
              <p className="font-body text-sm text-white/70">
                Add Maison Affluency to your home screen — your sign-in carries over automatically.
              </p>
            </div>

            <div className="space-y-2 rounded-md border border-white/15 bg-white/[0.03] p-4">
              <h2 className="flex items-center gap-2 font-display text-sm">
                <Smartphone className="h-4 w-4" /> Add to Home Screen
              </h2>
              {isIOS ? (
                <ol className="space-y-1.5 font-body text-xs text-white/80">
                  <li className="flex gap-2"><span className="text-white/50">1.</span><span className="flex flex-wrap items-center gap-1">Tap <Share className="inline h-3 w-3" /> <strong>Share</strong> in Safari.</span></li>
                  <li className="flex gap-2"><span className="text-white/50">2.</span><span className="flex flex-wrap items-center gap-1">Choose <Plus className="inline h-3 w-3" /> <strong>Add to Home Screen</strong>.</span></li>
                  <li className="flex gap-2"><span className="text-white/50">3.</span><span>Tap <strong>Add</strong> — then open Maison Affluency from your home screen.</span></li>
                </ol>
              ) : (
                <ol className="space-y-1.5 font-body text-xs text-white/80">
                  <li className="flex gap-2"><span className="text-white/50">1.</span><span className="flex flex-wrap items-center gap-1">Open the <MoreVertical className="inline h-3 w-3" /> menu in Chrome.</span></li>
                  <li className="flex gap-2"><span className="text-white/50">2.</span><span>Tap <strong>Install app</strong> or <em>Add to Home screen</em>.</span></li>
                  <li className="flex gap-2"><span className="text-white/50">3.</span><span>Open Maison Affluency from your home screen — you'll be signed in.</span></li>
                </ol>
              )}
            </div>

            <button
              onClick={continueInBrowser}
              className="w-full rounded-md border border-white/25 py-3 font-body text-sm text-white transition-colors hover:bg-white/[0.05]"
            >
              Continue in browser →
            </button>
          </div>
        )}

        {phase === "failed" && (
          <div className="max-w-sm space-y-4 text-center">
            <h1 className="font-display text-2xl">This code has expired</h1>
            <p className="font-body text-sm text-white/70">
              Sign-in codes last two minutes and work once. Scan a fresh code from your desktop, or sign in here.
            </p>
            <Link to="/trade/login" className="inline-block border border-white px-5 py-2.5 font-body text-xs uppercase tracking-[0.18em]">
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
