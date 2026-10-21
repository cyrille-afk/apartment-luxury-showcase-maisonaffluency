import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminTools } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/tools")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminTools /></Suspense>
  ),
});
