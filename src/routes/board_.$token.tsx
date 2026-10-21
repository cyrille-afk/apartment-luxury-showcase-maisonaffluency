import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ClientBoardViewer, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/board_/$token")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ClientBoardViewer /></Suspense>
  ),
});
