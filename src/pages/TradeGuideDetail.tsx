import { useParams, Navigate } from "react-router-dom";
import { lazy, Suspense, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { GUIDE_LOADERS } from "./guides/registry";

export default function TradeGuideDetail() {
  const { slug } = useParams();

  const GuideComponent = useMemo(() => {
    if (!slug) return null;
    const loader = GUIDE_LOADERS[slug];
    if (!loader) return null;
    return lazy(loader as () => Promise<{ default: React.ComponentType }>);
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
