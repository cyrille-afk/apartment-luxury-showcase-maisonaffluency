import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, SharedProcurementBoard } from "@/app/legacyShell";

export const Route = createFileRoute("/shared_/board_/$token")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><SharedProcurementBoard /></Suspense>
  ),
});
