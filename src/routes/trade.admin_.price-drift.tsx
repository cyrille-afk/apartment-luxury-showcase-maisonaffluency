import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradePriceDriftAudit } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/price-drift")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradePriceDriftAudit /></Suspense>
  ),
});
