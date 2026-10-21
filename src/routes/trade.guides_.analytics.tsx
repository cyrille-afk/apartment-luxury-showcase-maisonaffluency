import { createFileRoute } from "@tanstack/react-router";
import { TradeGuidesAnalytics } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/guides_/analytics")({
  component: () => (
    <TradeGuidesAnalytics />
  ),
});
