import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminOutbound } from "@/app/legacyShell";

export const Route = createFileRoute("/admin_/outbound")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminOutbound /></Suspense>
  ),
});
