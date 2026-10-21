import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicDesignerBiography } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/gallery_/$slug_/biography")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicDesignerBiography /></Suspense>
  ),
});
