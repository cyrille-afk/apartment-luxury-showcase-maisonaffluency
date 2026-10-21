import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DesignerUpload, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/designer-upload_/$slug")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><DesignerUpload /></Suspense>
  ),
});
