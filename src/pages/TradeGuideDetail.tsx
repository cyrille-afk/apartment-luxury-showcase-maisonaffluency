import { useParams, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const SharedFiltersGuide = lazy(() => import("./TradeGuideSharedFilters"));

const GUIDE_REGISTRY: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  "shared-filters": SharedFiltersGuide,
};

export default function TradeGuideDetail() {
  const { slug } = useParams();
  if (!slug) return <Navigate to="/trade/guides" replace />;

  const GuideComponent = GUIDE_REGISTRY[slug];
  if (!GuideComponent) return <Navigate to="/trade/guides" replace />;

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
