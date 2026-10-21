import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PaymentFailedPage } from "@/app/legacyShell";

export const Route = createFileRoute("/payment-failed")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PaymentFailedPage /></Suspense>
  ),
});
