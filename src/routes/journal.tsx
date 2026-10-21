import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { Journal, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/journal")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><Journal /></Suspense>
  ),
});
