import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CategoryRoute, PageLoadingSkeleton } from "@/app/legacyShell";
import { buildCategoryHead } from "@/lib/categoryHead";

export const Route = createFileRoute("/products-category_/$categorySlug_/$subcategorySlug")({
  head: ({ params }) => buildCategoryHead(params.categorySlug, params.subcategorySlug),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><CategoryRoute /></Suspense>
  ),
});
