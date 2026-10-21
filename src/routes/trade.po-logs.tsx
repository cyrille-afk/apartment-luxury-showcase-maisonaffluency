import { createFileRoute } from "@tanstack/react-router";
import { TradePOLogs } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/po-logs")({
  component: () => (
    <TradePOLogs />
  ),
});
