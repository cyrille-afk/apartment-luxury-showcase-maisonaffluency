import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminCuratedPairings } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/curated-pairings")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminCuratedPairings /></Suspense>
  ),
});
