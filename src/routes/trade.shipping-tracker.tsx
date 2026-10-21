import { createFileRoute } from "@tanstack/react-router";
import { TradeShippingTracker } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/shipping-tracker")({
  component: () => (
    <TradeShippingTracker />
  ),
});
