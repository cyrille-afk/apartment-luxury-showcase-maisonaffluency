import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminOnboardingFunnel } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/onboarding-funnel")({
  component: () => (
    <TradeAdminOnboardingFunnel />
  ),
});
