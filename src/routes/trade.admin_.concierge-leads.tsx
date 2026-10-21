import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminConciergeLeads } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/concierge-leads")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminConciergeLeads /></Suspense>
  ),
});
