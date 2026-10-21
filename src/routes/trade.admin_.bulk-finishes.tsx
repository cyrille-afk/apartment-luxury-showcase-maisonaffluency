import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminBulkFinishes } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/bulk-finishes")({
  component: () => (
    <TradeAdminBulkFinishes />
  ),
});
