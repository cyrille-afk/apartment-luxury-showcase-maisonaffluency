import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminDesignNoteCoverage } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/design-note-coverage")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminDesignNoteCoverage /></Suspense>
  ),
});
