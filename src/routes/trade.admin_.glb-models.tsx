import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminGlbModels } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/glb-models")({
  component: () => (
    <TradeAdminGlbModels />
  ),
});
