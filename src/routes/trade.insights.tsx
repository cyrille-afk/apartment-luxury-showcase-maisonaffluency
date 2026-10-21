import { createFileRoute } from "@tanstack/react-router";
import { TradeInsights } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/insights")({
  component: () => (
    <TradeInsights />
  ),
});
