import { createFileRoute } from "@tanstack/react-router";
import { TradeQuotesAdmin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/quotes-admin")({
  component: () => (
    <TradeQuotesAdmin />
  ),
});
