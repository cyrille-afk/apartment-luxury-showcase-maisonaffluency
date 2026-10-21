import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CartIdentifyPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/cart_/identify")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><CartIdentifyPage /></Suspense>
  ),
});
