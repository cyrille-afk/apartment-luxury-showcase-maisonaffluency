import { createFileRoute } from "@tanstack/react-router";
import { TradeSettings } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/settings")({
  component: () => (
    <TradeSettings />
  ),
});
