import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, SharedAILayout } from "@/app/legacyShell";

export const Route = createFileRoute("/layout_/$token")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><SharedAILayout /></Suspense>
  ),
});
