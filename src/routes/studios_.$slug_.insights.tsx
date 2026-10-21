import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, StudioInsights } from "@/app/legacyShell";

export const Route = createFileRoute("/studios_/$slug_/insights")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><StudioInsights /></Suspense>
  ),
});
