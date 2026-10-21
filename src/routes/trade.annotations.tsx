import { createFileRoute } from "@tanstack/react-router";
import { TradeAnnotations } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/annotations")({
  component: () => (
    <TradeAnnotations />
  ),
});
