import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminShippingSurcharges } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/shipping-surcharges")({
  component: () => (
    <TradeAdminShippingSurcharges />
  ),
});
