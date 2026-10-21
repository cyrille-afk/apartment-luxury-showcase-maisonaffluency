import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminPaymentSettings } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/payment-settings")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminPaymentSettings /></Suspense>
  ),
});
