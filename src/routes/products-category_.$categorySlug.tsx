import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CategoryRoute, PageLoadingSkeleton } from "@/app/legacyShell";
import { buildCategoryHead } from "@/lib/categoryHead";

export const Route = createFileRoute("/products-category_/$categorySlug")({
  head: ({ params }) => buildCategoryHead(params.categorySlug),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><CategoryRoute /></Suspense>
  ),
});
