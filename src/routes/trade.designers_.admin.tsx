import { createFileRoute } from "@tanstack/react-router";
import { TradeDesignersAdmin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/designers_/admin")({
  component: () => (
    <TradeDesignersAdmin />
  ),
});
