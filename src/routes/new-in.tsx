import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { NewIn, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/new-in")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><NewIn /></Suspense>
  ),
});
