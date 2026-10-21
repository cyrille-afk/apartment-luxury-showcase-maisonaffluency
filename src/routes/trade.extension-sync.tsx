import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeExtensionSync } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/extension-sync")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeExtensionSync /></Suspense>
  ),
});
