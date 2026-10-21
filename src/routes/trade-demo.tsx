import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeDemoPage } from "@/app/legacyShell";

export const Route = createFileRoute("/trade-demo")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeDemoPage /></Suspense>
  ),
});
