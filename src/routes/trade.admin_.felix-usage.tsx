import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminFelixUsage } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/felix-usage")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminFelixUsage /></Suspense>
  ),
});
