import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminDuplicateScan } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/duplicate-scan")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminDuplicateScan /></Suspense>
  ),
});
