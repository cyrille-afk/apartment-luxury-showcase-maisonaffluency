import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, ScreenshotGallery } from "@/app/legacyShell";

export const Route = createFileRoute("/designers-hero-lock")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ScreenshotGallery /></Suspense>
  ),
});
