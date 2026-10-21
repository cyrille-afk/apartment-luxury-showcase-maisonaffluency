import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAiUsageDashboard } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/ai-usage")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAiUsageDashboard /></Suspense>
  ),
});
