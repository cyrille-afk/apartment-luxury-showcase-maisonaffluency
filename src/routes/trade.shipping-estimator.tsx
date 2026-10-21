import { createFileRoute } from "@tanstack/react-router";
import { TradeShippingEstimator } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/shipping-estimator")({
  component: () => (
    <TradeShippingEstimator />
  ),
});
