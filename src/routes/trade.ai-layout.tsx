import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAILayoutStudio } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/ai-layout")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAILayoutStudio /></Suspense>
  ),
});
