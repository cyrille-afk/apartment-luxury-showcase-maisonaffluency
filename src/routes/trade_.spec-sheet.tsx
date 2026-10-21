import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeSpecSheet } from "@/app/legacyShell";

export const Route = createFileRoute("/trade_/spec-sheet")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeSpecSheet /></Suspense>
  ),
});
