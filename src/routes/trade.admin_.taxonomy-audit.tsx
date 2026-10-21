import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminTaxonomyAudit } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/taxonomy-audit")({
  component: () => (
    <TradeAdminTaxonomyAudit />
  ),
});
