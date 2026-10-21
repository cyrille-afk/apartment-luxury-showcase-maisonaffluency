import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminOnboarding } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/onboarding")({
  component: () => (
    <TradeAdminOnboarding />
  ),
});
