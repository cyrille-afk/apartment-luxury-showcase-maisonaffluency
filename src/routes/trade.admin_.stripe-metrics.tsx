import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminStripeMetrics } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/stripe-metrics")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminStripeMetrics /></Suspense>
  ),
});
