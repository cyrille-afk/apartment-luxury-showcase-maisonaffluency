import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CategoryRoute, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/products-category_/$categorySlug")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><CategoryRoute /></Suspense>
  ),
});
