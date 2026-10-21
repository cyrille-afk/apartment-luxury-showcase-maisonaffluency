import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, SuccessPage } from "@/app/legacyShell";

export const Route = createFileRoute("/success")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><SuccessPage /></Suspense>
  ),
});
