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
import { useClientSafeMode } from "@/lib/clientSafeMode";
import { useQuery } from "@tanstack/react-query";
import { fetchPublicProductPage } from "@/lib/publicProductPageQuery";
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
  const { user, isTradeUser, isAdmin, isSuperAdmin, tradeStatus, rolesLoaded } = useAuth();
  const { clientSafe } = useClientSafeMode();
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

  const shortRouteProduct = useQuery({
    queryKey: ["trade-short-product-route", productSlug],
    enabled: tradeSessionLatched && !routeInsideTradePortal && !designerSlug && !!productSlug,
    queryFn: () => fetchPublicProductPage(undefined, productSlug),
  });

  if (user && !rolesLoaded && !routeInsideTradePortal) return <PageLoadingSkeleton />;
  if (!routeInsideTradePortal && tradeSessionLatched && !designerSlug && productSlug) {
    if (shortRouteProduct.data?.product?.id) {
      return <Navigate to={`/trade/products/${shortRouteProduct.data.product.id}${search}`} replace />;
    }
    if (shortRouteProduct.isLoading) return <PageLoadingSkeleton />;
  }

  // The B2B layout only renders correctly inside the trade portal shell
  // (sidebar, light canvas). On a public URL, send the latched trade session
  // to the equivalent /trade route instead of rendering it in the public shell.
  if (!routeInsideTradePortal && tradeSessionLatched && designerSlug && productSlug) {
    return (
      <Navigate
        to={`/trade/products/${designerSlug}/${productSlug}${search}`}
        replace
      />
    );
  }

  const insideTradePortal = routeInsideTradePortal;



  return (
    <ProductConfigProvider isInsideTradePortal={insideTradePortal}>
      <Suspense fallback={<PageLoadingSkeleton />}>
        {insideTradePortal && !clientSafe ? <TradePortalDashboardLayout /> : <PublicEditorialLayout presentation={insideTradePortal && clientSafe} />}
      </Suspense>
    </ProductConfigProvider>
  );
}
