import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, Studios } from "@/app/legacyShell";

export const Route = createFileRoute("/studios")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><Studios /></Suspense>
  ),
});
