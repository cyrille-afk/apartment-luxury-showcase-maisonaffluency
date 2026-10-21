import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicGallery } from "@/app/legacyShell";

export const Route = createFileRoute("/gallery")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicGallery /></Suspense>
  ),
});
