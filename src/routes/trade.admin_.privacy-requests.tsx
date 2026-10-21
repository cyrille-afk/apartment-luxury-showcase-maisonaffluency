import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminPrivacyRequests } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/privacy-requests")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminPrivacyRequests /></Suspense>
  ),
});
