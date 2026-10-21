import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, StudioProfile } from "@/app/legacyShell";

export const Route = createFileRoute("/studios_/$slug")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><StudioProfile /></Suspense>
  ),
});
