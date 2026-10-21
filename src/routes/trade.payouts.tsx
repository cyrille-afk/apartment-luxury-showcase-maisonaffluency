import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradePayoutStatement } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/payouts")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradePayoutStatement /></Suspense>
  ),
});
