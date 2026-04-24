import { useParams, Navigate } from "react-router-dom";
import { lazy, Suspense, useMemo, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { GUIDE_LOADERS } from "./guides/registry";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import logoMark from "@/assets/maison-affluency-mark.jpg";

export default function TradeGuideDetail() {
  const { slug } = useParams();

  const GuideComponent = useMemo(() => {
    if (!slug) return null;
    const loader = GUIDE_LOADERS[slug];
    if (!loader) return null;
    return lazy(loader as () => Promise<{ default: React.ComponentType }>);
  }, [slug]);

  useEffect(() => {
    if (!slug || !GUIDE_LOADERS[slug]) return;

    // Session-based dedupe: ignore repeat views of the same slug within the window.
    const DEDUPE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
    const storageKey = `guide_view_seen:${slug}`;
    try {
      const last = sessionStorage.getItem(storageKey);
      if (last && Date.now() - Number(last) < DEDUPE_WINDOW_MS) return;
      sessionStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // sessionStorage unavailable (private mode, SSR) — fall through and log.
    }

    trackEvent("trade_guide_view", {
      event_category: "Trade Guides",
      event_label: slug,
      guide_slug: slug,
    });
    // Best-effort persisted log for the internal analytics dashboard.
    (async () => {
      const { data } = await supabase.auth.getUser();
      await supabase.from("guide_views").insert({
        slug,
        user_id: data.user?.id ?? null,
      });
    })().catch(() => {
      // Swallow — analytics must never break UX.
    });
  }, [slug]);

  if (!slug || !GuideComponent) return <Navigate to="/trade/guides" replace />;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      }
    >
      <GuideComponent />
      <footer className="max-w-3xl mx-auto mt-16 pt-8 border-t border-border">
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src={logoMark}
            alt="Maison Affluency"
            className="h-10 w-auto opacity-80"
            loading="lazy"
          />
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            © 2026 Maison Affluency · Trade Portal Guide
          </p>
        </div>
      </footer>
    </Suspense>
  );
}
