import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminFunnelTracker } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/funnel-tracker")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminFunnelTracker /></Suspense>
  ),
});
