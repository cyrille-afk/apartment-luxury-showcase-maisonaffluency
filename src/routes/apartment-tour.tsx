import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead, STATIC_PAGE_HEADS } from "@/lib/pageHead";
import { Suspense } from "react";
import { ApartmentTour, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/apartment-tour")({
  head: () => buildPageHead(STATIC_PAGE_HEADS.apartmentTour),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ApartmentTour /></Suspense>
  ),
});
