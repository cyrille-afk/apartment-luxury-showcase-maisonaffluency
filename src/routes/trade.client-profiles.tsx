import { createFileRoute } from "@tanstack/react-router";
import { TradeClientProfiles } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/client-profiles")({
  component: () => (
    <TradeClientProfiles />
  ),
});
