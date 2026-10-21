import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeRagDebug } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/rag-debug")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeRagDebug /></Suspense>
  ),
});
