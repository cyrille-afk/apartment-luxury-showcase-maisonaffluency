import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminApplications } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/trade-applications")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminApplications /></Suspense>
  ),
});
