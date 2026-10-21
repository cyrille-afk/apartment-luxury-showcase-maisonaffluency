import { createFileRoute } from "@tanstack/react-router";
import { TradeDashboard } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/dashboard")({
  component: () => (
    <TradeDashboard />
  ),
});
