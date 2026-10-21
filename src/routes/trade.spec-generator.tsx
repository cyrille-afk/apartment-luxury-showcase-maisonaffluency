import { createFileRoute } from "@tanstack/react-router";
import { TradeSpecSheetGenerator } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/spec-generator")({
  component: () => (
    <TradeSpecSheetGenerator />
  ),
});
