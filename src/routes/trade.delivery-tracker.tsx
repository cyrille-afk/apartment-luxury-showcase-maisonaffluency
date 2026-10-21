import { createFileRoute } from "@tanstack/react-router";
import { TradeDeliveryTracker } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/delivery-tracker")({
  component: () => (
    <TradeDeliveryTracker />
  ),
});
