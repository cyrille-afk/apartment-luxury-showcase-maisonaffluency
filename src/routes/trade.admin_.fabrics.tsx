import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminFabrics } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/fabrics")({
  component: () => (
    <TradeAdminFabrics />
  ),
});
