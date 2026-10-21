import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DpaTemplate, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/compliance_/dpa-template")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><DpaTemplate /></Suspense>
  ),
});
