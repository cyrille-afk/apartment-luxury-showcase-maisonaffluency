import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminBrandLeadTimes } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/brand-lead-times")({
  component: () => (
    <TradeAdminBrandLeadTimes />
  ),
});
