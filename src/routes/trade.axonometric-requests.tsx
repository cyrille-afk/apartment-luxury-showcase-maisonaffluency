import { createFileRoute } from "@tanstack/react-router";
import { TradeAxonometricRequests } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/axonometric-requests")({
  component: () => (
    <TradeAxonometricRequests />
  ),
});
