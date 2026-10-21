import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeClientDashboard } from "@/app/legacyShell";

export const Route = createFileRoute("/(client)/trade-dashboard")({
  component: () => (
    <Suspense fallback={null}><TradeClientDashboard /></Suspense>
  ),
});
