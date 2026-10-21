import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAdminDesignNoteResearch } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/design-note-research")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAdminDesignNoteResearch /></Suspense>
  ),
});
