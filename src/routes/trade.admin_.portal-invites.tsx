import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminPortalInvites } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/portal-invites")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminPortalInvites /></Suspense>
  ),
});
