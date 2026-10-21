import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { OrderConfirmationPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/order-confirmation")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><OrderConfirmationPage /></Suspense>
  ),
});
