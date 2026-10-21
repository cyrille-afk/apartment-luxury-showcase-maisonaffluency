import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeIngestionQueue } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/ingestion")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeIngestionQueue /></Suspense>
  ),
});
