import { createFileRoute } from "@tanstack/react-router";
import { TradeFFEExportTest } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/ffe-export-test")({
  component: () => (
    <TradeFFEExportTest />
  ),
});
