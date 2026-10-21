import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminDescriptorTaxonomy } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/descriptor-taxonomy")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminDescriptorTaxonomy /></Suspense>
  ),
});
