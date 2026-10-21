import { createFileRoute } from "@tanstack/react-router";
import { TradeMyDashboard } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/me")({
  component: () => (
    <TradeMyDashboard />
  ),
});
