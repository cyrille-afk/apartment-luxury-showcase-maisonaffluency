import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ConciergePage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/concierge")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ConciergePage /></Suspense>
  ),
});
