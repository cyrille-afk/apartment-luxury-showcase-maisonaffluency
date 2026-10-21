import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeConciergeUsage } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/concierge-usage")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeConciergeUsage /></Suspense>
  ),
});
