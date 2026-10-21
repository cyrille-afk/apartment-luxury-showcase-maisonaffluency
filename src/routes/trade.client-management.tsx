import { createFileRoute } from "@tanstack/react-router";
import { TradeClients } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/client-management")({
  component: () => (
    <TradeClients />
  ),
});
