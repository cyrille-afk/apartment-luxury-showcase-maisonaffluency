import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { heldTradePageHeight } from "@/lib/tradePageHeightHold";

const PageLoadingSkeleton = () => {
  const held = typeof window !== "undefined" && window.location.pathname.startsWith("/trade") ? heldTradePageHeight() : 0;
  return (
    <div data-trade-page-loading role="status" aria-label="Loading page" className="relative min-h-screen bg-background" style={held ? { minHeight: held } : undefined}>
      <div className="sticky top-0 flex h-screen items-center justify-center">
        <DotCircleLoader size="lg" />
      </div>
    </div>
  );
};

export default PageLoadingSkeleton;
