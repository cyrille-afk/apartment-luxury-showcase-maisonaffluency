import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminSubProcessors } from "@/app/legacyShell";

export const Route = createFileRoute("/admin_/compliance_/sub-processors")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminSubProcessors /></Suspense>
  ),
});
