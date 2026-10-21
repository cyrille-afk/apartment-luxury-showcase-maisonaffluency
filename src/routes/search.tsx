import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, RoomSearch } from "@/app/legacyShell";

export const Route = createFileRoute("/search")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><RoomSearch /></Suspense>
  ),
});
