import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicFavorites } from "@/app/legacyShell";

export const Route = createFileRoute("/favorites")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicFavorites /></Suspense>
  ),
});
