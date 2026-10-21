import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminProcurementLedger } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/procurement-ledger")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminProcurementLedger /></Suspense>
  ),
});
