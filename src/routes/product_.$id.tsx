import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, ProductPage } from "@/app/legacyShell";

export const Route = createFileRoute("/product_/$id")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ProductPage /></Suspense>
  ),
});
