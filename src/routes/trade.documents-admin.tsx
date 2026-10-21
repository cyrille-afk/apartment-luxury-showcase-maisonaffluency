import { createFileRoute } from "@tanstack/react-router";
import { TradeDocumentsAdmin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/documents-admin")({
  component: () => (
    <TradeDocumentsAdmin />
  ),
});
