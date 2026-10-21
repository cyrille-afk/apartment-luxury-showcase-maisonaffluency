import { createFileRoute } from "@tanstack/react-router";
import { TradeAdmin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin")({
  component: () => (
    <TradeAdmin />
  ),
});
