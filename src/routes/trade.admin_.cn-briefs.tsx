import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminCnBriefs } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/cn-briefs")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminCnBriefs /></Suspense>
  ),
});
