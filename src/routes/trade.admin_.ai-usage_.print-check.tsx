import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAiUsagePrintCheck } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/ai-usage_/print-check")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAiUsagePrintCheck /></Suspense>
  ),
});
