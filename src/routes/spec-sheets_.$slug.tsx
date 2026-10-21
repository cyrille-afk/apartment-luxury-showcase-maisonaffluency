import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { SpecSheetRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/spec-sheets_/$slug")({
  component: () => (
    <Suspense fallback={null}><SpecSheetRedirect /></Suspense>
  ),
});
