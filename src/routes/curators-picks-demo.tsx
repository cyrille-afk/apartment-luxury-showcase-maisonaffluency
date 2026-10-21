import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CuratorsPicksDemo, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/curators-picks-demo")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><CuratorsPicksDemo /></Suspense>
  ),
});
