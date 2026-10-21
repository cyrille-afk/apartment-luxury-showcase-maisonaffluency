import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminDashboard } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin-dashboard")({
  component: () => (
    <TradeAdminDashboard />
  ),
});
