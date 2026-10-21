import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradePurgeCache } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/purge-cache")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradePurgeCache /></Suspense>
  ),
});
