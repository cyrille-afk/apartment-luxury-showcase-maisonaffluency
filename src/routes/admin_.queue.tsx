import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminQueue } from "@/app/legacyShell";

export const Route = createFileRoute("/admin_/queue")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminQueue /></Suspense>
  ),
});
