import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminMcpUsage } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/mcp-usage")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminMcpUsage /></Suspense>
  ),
});
