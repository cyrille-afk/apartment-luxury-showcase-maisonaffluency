import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, SharedShortlist } from "@/app/legacyShell";

export const Route = createFileRoute("/shortlist_/$token")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><SharedShortlist /></Suspense>
  ),
});
