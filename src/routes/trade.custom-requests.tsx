import { createFileRoute } from "@tanstack/react-router";
import { TradeCustomRequests } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/custom-requests")({
  component: () => (
    <TradeCustomRequests />
  ),
});
