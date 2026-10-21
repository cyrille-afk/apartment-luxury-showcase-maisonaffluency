import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ApartmentTour, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/apartment-tour")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ApartmentTour /></Suspense>
  ),
});
