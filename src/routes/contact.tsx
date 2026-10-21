import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ContactPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/contact")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ContactPage /></Suspense>
  ),
});
