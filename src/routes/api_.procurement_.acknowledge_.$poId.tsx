import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PoAcknowledgePage } from "@/app/legacyShell";

export const Route = createFileRoute("/api_/procurement_/acknowledge_/$poId")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PoAcknowledgePage /></Suspense>
  ),
});
