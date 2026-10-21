import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CheckoutPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/checkout")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><CheckoutPage /></Suspense>
  ),
});
