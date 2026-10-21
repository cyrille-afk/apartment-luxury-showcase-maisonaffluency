import { createFileRoute } from "@tanstack/react-router";
import { LegacyTradeSignupRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/trade_/register")({
  component: () => (
    <LegacyTradeSignupRedirect />
  ),
});
