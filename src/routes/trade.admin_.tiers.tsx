import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminTiers } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/tiers")({
  component: () => (
    <TradeAdminTiers />
  ),
});
