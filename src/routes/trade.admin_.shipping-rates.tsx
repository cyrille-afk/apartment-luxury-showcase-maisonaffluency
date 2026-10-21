import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminShippingRates } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/shipping-rates")({
  component: () => (
    <TradeAdminShippingRates />
  ),
});
