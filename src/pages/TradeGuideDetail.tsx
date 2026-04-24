import { useParams, Navigate } from "react-router-dom";
import { lazy, Suspense, useMemo, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { GUIDE_LOADERS } from "./guides/registry";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";

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
    </Suspense>
  );
}
