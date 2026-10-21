import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, StudioSubmit } from "@/app/legacyShell";

export const Route = createFileRoute("/studios_/submit")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><StudioSubmit /></Suspense>
  ),
});
