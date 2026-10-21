import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminStudioDetail } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/studios_/$studioId")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminStudioDetail /></Suspense>
  ),
});
