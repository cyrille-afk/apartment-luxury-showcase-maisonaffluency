import { createFileRoute } from "@tanstack/react-router";
import { TradeOrderTimeline } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/order-timeline")({
  component: () => (
    <TradeOrderTimeline />
  ),
});
