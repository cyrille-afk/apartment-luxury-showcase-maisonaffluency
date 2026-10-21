import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminEmailDeliverability } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/email-deliverability")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminEmailDeliverability /></Suspense>
  ),
});
