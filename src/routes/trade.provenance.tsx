import { createFileRoute } from "@tanstack/react-router";
import { TradeProvenance } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/provenance")({
  component: () => (
    <TradeProvenance />
  ),
});
