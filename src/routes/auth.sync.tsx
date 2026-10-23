import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { redeemMobileSyncToken } from "@/lib/mobileSync.functions";

type Search = { t?: string };

export const Route = createFileRoute("/auth/sync")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    t: typeof s.t === "string" ? s.t : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Signing you in — Maison Affluency" },
      { name: "description", content: "Secure desktop-to-mobile sign-in for Maison Affluency trade members." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Signing you in — Maison Affluency" },
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

function AuthSync() {
  const { t } = Route.useSearch();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Never leave the one-time token in the address bar or history.
    window.history.replaceState(null, "", "/auth/sync");
    const done = () =>
      isStandalonePwa()
        ? navigate({ to: "/trade", replace: true })
        : navigate({ href: "/trade/launch?next=%2Ftrade", replace: true });

    (async () => {
      if (t) {
        try {
          const res = await redeemMobileSyncToken({ data: { token: t } });
          if (res.ok) {
            const { error } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: "magiclink" });
            if (!error) return done();
          }
        } catch {
          /* fall through */
        }
      }
      // Token missing/expired: an existing session on this phone still skips sign-in.
      const { data } = await supabase.auth.getSession();
      if (data.session) return done();
      setFailed(true);
    })();
  }, [t, navigate]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground">
      {failed ? (
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-display text-2xl">This code has expired</h1>
          <p className="font-body text-sm text-muted-foreground">
            Sign-in codes last two minutes and work once. Scan a fresh code from your desktop, or sign in here.
          </p>
          <Link to="/trade/login" className="inline-block border border-foreground px-5 py-2.5 font-body text-xs uppercase tracking-[0.18em]">
            Sign in
          </Link>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          <p className="font-body text-sm text-muted-foreground">Signing you in…</p>
        </div>
      )}
    </div>
  );
}
