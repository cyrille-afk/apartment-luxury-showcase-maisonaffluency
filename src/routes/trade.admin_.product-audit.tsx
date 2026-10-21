import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminProductAudit } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/product-audit")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminProductAudit /></Suspense>
  ),
});
