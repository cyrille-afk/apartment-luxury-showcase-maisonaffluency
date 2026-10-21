import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { GuestPayPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/pay_/$token")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><GuestPayPage /></Suspense>
  ),
});
