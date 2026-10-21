import { createFileRoute } from "@tanstack/react-router";
import { TradeInstagramAudit } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/designers_/instagram")({
  component: () => (
    <TradeInstagramAudit />
  ),
});
