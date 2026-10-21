import { createFileRoute } from "@tanstack/react-router";
import { TradeConcierge } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/concierge_/$threadId")({
  component: () => (
    <TradeConcierge />
  ),
});
