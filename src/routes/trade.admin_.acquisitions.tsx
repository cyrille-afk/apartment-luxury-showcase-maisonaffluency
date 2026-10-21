import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminAcquisitions } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/acquisitions")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminAcquisitions /></Suspense>
  ),
});
