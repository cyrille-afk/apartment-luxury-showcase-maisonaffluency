import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminSyncStatus } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/sync-status")({
  component: () => (
    <TradeAdminSyncStatus />
  ),
});
