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
import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { ProductConfigProvider } from "@/contexts/ProductConfigContext";
import { useAuth } from "@/hooks/useAuth";
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
  const { pathname, search } = useLocation();
  const { slug: designerSlug, productSlug } = useParams<{ slug?: string; productSlug?: string }>();
  const { isTradeUser, isAdmin, isSuperAdmin, tradeStatus, rolesLoaded } = useAuth();
  const routeInsideTradePortal =
    isInsideTradePortal ?? /^\/trade(\/|$)/.test(pathname);

  // An approved trade session (or admin) always gets the full B2B layout, even
  // on public product URLs. Latched once confirmed so a later role re-check can
  // never flip the page back to the public layout mid-visit.
  const [tradeSessionLatched, setTradeSessionLatched] = useState(false);
  useEffect(() => {
    if (tradeSessionLatched || !rolesLoaded) return;
    if (isAdmin || isSuperAdmin || (isTradeUser && tradeStatus === "approved")) {
      setTradeSessionLatched(true);
    }
  }, [tradeSessionLatched, rolesLoaded, isAdmin, isSuperAdmin, isTradeUser, tradeStatus]);

  // The B2B layout only renders correctly inside the trade portal shell
  // (sidebar, light canvas). On a public URL, send the latched trade session
  // to the equivalent /trade route instead of rendering it in the public shell.
  if (!routeInsideTradePortal && tradeSessionLatched && designerSlug && productSlug) {
    return (
      <Navigate
        to={`/trade/products/${designerSlug}/${productSlug}${search}`}
        replace
        state={{ from: pathname }}
      />
    );
  }

  const insideTradePortal = routeInsideTradePortal;


  return (
    <ProductConfigProvider isInsideTradePortal={insideTradePortal}>
      <Suspense fallback={<PageLoadingSkeleton />}>
        {insideTradePortal ? <TradePortalDashboardLayout /> : <PublicEditorialLayout />}
      </Suspense>
    </ProductConfigProvider>
  );
}
