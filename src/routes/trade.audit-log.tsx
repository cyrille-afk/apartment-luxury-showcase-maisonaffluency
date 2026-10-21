import { createFileRoute } from "@tanstack/react-router";
import { TradeAuditLog } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/audit-log")({
  component: () => (
    <TradeAuditLog />
  ),
});
