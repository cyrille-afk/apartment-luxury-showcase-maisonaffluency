import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminServiceRequests } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/service-requests")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminServiceRequests /></Suspense>
  ),
});
