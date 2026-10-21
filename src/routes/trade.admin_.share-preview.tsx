import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminSharePreview } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/share-preview")({
  component: () => (
    <TradeAdminSharePreview />
  ),
});
