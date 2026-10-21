import { createFileRoute } from "@tanstack/react-router";
import { TradeTools } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/tools")({
  component: () => (
    <TradeTools />
  ),
});
