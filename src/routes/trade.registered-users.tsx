import { createFileRoute } from "@tanstack/react-router";
import { TradeRegisteredUsers } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/registered-users")({
  component: () => (
    <TradeRegisteredUsers />
  ),
});
