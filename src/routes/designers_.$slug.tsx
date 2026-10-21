import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicDesignerProfile } from "@/app/legacyShell";

export const Route = createFileRoute("/designers_/$slug")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicDesignerProfile /></Suspense>
  ),
});
