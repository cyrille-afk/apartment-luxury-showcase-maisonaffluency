/**
 * ProductPageContainer — the single stateful container for a product.
 *
 * It owns nothing visual: it resolves the `isInsideTradePortal` flag from the
 * current route, mounts the shared configuration/pricing engine
 * (`ProductConfigProvider`), and then renders one of two purely presentational
 * layout variants:
 *
 *   Variant A — PublicEditorialLayout      (isInsideTradePortal === false)
 *   Variant B — TradePortalDashboardLayout (isInsideTradePortal === true)
 *
 * Both variants consume the same state, so swapping a finish or changing the
 * quantity in either surface calculates against identical data variables.
 */
import { Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";
import { ProductConfigProvider } from "@/contexts/ProductConfigContext";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";

/** Variant A: spacious editorial gallery layout for the public site. */
const PublicEditorialLayout = lazy(() => import("./PublicProductPage"));
/** Variant B: high-efficiency B2B dashboard layout for the trade portal. */
const TradePortalDashboardLayout = lazy(() => import("./TradeProductPage"));

interface ProductPageContainerProps {
  /** Explicit override; otherwise derived from the route. */
  isInsideTradePortal?: boolean;
}

export default function ProductPageContainer({
  isInsideTradePortal,
}: ProductPageContainerProps) {
  const { pathname } = useLocation();
  const insideTradePortal =
    isInsideTradePortal ?? /^\/trade(\/|$)/.test(pathname);

  return (
    <ProductConfigProvider isInsideTradePortal={insideTradePortal}>
      <Suspense fallback={<PageLoadingSkeleton />}>
        {insideTradePortal ? <TradePortalDashboardLayout /> : <PublicEditorialLayout />}
      </Suspense>
    </ProductConfigProvider>
  );
}
