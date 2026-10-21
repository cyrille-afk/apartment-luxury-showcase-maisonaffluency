import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeSharedRooms } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/visualiser_/shared-rooms")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeSharedRooms /></Suspense>
  ),
});
