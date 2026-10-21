import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminDuplicates } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/duplicates")({
  component: () => (
    <TradeAdminDuplicates />
  ),
});
