import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DevCheckoutTest, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/dev-checkout-test")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><DevCheckoutTest /></Suspense>
  ),
});
