import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminCollectorApplications } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/collector-applications")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminCollectorApplications /></Suspense>
  ),
});
