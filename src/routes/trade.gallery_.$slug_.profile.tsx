import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicDesignerProfile } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/gallery_/$slug_/profile")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicDesignerProfile presentation /></Suspense>
  ),
});
