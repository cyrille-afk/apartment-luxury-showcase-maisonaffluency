import { createFileRoute } from "@tanstack/react-router";
import { TradeDocuments } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/documents")({
  component: () => (
    <TradeDocuments />
  ),
});
