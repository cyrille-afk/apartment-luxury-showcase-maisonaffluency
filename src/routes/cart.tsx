import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CartPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/cart")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><CartPage /></Suspense>
  ),
});
