import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminKpiLedger } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/kpi-ledger")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminKpiLedger /></Suspense>
  ),
});
