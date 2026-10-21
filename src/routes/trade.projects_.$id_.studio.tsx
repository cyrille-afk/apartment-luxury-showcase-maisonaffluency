import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeProjectStudio } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/projects_/$id_/studio")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeProjectStudio /></Suspense>
  ),
});
