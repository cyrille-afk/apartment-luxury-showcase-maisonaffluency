import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeErrorBoundary, TradeLayout } from "@/app/legacyShell";

export const Route = createFileRoute("/trade")({
  component: () => (
    <Suspense fallback={null}><TradeErrorBoundary><TradeLayout /></TradeErrorBoundary></Suspense>
  ),
});
