import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicDesigners } from "@/app/legacyShell";

export const Route = createFileRoute("/designers")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicDesigners /></Suspense>
  ),
});
