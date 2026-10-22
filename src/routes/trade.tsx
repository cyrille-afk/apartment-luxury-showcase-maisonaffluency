import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeErrorBoundary, TradeLayout } from "@/app/legacyShell";
import { guardStudioSetupRoute } from "@/lib/studioSetupRouteGuard";

export const Route = createFileRoute("/trade")({
  ssr: false,
  beforeLoad: ({ location, preload }) => guardStudioSetupRoute({ pathname: location.pathname, preload }),
  component: () => (
    <Suspense fallback={null}><TradeErrorBoundary><TradeLayout /></TradeErrorBoundary></Suspense>
  ),
});
