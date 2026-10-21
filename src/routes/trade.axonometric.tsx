import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeProjectWorkspace } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/axonometric")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeProjectWorkspace /></Suspense>
  ),
});
