import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminAxonometricCadQa } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/axonometric-cad-qa")({
  component: () => (
    <TradeAdminAxonometricCadQa />
  ),
});
