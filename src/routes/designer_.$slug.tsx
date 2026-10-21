import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DesignerProfile, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/designer_/$slug")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><DesignerProfile /></Suspense>
  ),
});
