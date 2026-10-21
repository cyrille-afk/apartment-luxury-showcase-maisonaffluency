import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminCadAssets } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/cad-assets")({
  component: () => (
    <TradeAdminCadAssets />
  ),
});
