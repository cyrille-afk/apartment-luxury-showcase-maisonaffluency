import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminStudios } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/studios")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminStudios /></Suspense>
  ),
});
