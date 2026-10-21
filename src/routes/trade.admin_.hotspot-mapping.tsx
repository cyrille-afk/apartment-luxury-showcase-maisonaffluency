import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminHotspotMapping } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/hotspot-mapping")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminHotspotMapping /></Suspense>
  ),
});
