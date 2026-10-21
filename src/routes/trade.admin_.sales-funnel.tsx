import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminSalesFunnel } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/sales-funnel")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminSalesFunnel /></Suspense>
  ),
});
